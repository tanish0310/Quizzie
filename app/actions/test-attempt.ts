// @ts-nocheck
"use server"
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function startTestAttempt(testId: string, userId: string) {
    try {
        const existingAttempt = await prisma.testResult.findUnique({
            where: { testId_userId: { testId, userId } },
        })

        if (existingAttempt && !existingAttempt.completedAt) {
            return { success: true, attemptId: existingAttempt.id, message: "Resumed existing attempt" }
        }

        if (existingAttempt && existingAttempt.completedAt) {
            return { success: false, message: "You have already completed this test" }
        }

        const newAttempt = await prisma.testResult.create({
            data: {
                score: 0,
                test: { connect: { id: testId } },
                user: { connect: { id: userId } },
            },
        })

        return { success: true, attemptId: newAttempt.id, message: "New attempt started" }
    } catch (error) {
        console.error("Error starting test attempt:", error)
        return { success: false, message: "Failed to start test attempt" }
    }
}

// Used by auto-save during the test — saves one answer at a time
export async function saveAnswer(attemptId: string, questionId: string, answer: string) {
    try {
        const attempt = await prisma.testResult.findUnique({
            where: { id: attemptId },
            include: { test: { include: { questions: true } } },
        })

        if (!attempt) return { success: false, message: "Test attempt not found" }
        if (attempt.completedAt) return { success: false, message: "Cannot modify answers for a completed test" }

        const question = attempt.test.questions.find((q) => q.id === questionId)
        if (!question) return { success: false, message: "Question not found" }

        let isCorrect = false
        let score = 0

        switch (question.type) {
            case "multiple-choice":
                isCorrect = answer.trim() === question.answer.trim()
                score = isCorrect ? question.points : 0
                break
            case "true-false":
                isCorrect = false
                score = 0
                if ((question.answer.trim() === "False" || question.answer.trim() === "1") && answer.trim() === "1") {
                    score = question.points
                    isCorrect = true
                }
                if ((question.answer.trim() === "True" || question.answer.trim() === "0") && answer.trim() === "0") {
                    score = question.points
                    isCorrect = true
                }
                break
            case "short-answer":
                // Saved immediately, graded at submit time
                isCorrect = false
                score = 0
                break
        }

        const existingAnswer = await prisma.answer.findUnique({
            where: { testResultId_questionId: { testResultId: attemptId, questionId } },
        })

        if (existingAnswer) {
            await prisma.answer.update({
                where: { id: existingAnswer.id },
                data: { text: answer, isCorrect, score },
            })
        } else {
            await prisma.answer.create({
                data: {
                    text: answer,
                    isCorrect,
                    score,
                    testResult: { connect: { id: attemptId } },
                    question: { connect: { id: questionId } },
                },
            })
        }

        return { success: true, message: "Answer saved" }
    } catch (error) {
        console.error("Error saving answer:", error)
        return { success: false, message: "Failed to save answer" }
    }
}

// Called once at submit time — bulk upserts all answers in a single DB transaction.
// Much faster than calling saveAnswer N times.
export async function flushAnswers(
    attemptId: string,
    answers: Record<string, string>,
    questions: { id: string; type: string; answer: string; points: number }[]
) {
    try {
        const attempt = await prisma.testResult.findUnique({
            where: { id: attemptId },
        })

        if (!attempt || attempt.completedAt) return { success: false }

        const questionMap = new Map(questions.map(q => [q.id, q]))

        // Run all upserts in a single transaction
        await prisma.$transaction(
            Object.entries(answers).map(([questionId, answerText]) => {
                const question = questionMap.get(questionId)
                if (!question) return null

                let isCorrect = false
                let score = 0

                if (question.type === "multiple-choice") {
                    isCorrect = answerText.trim() === question.answer.trim()
                    score = isCorrect ? question.points : 0
                } else if (question.type === "true-false") {
                    if ((question.answer === "False" || question.answer === "1") && answerText === "1") {
                        isCorrect = true; score = question.points
                    } else if ((question.answer === "True" || question.answer === "0") && answerText === "0") {
                        isCorrect = true; score = question.points
                    }
                }
                // short-answer: score=0, graded later in submitTest

                return prisma.answer.upsert({
                    where: { testResultId_questionId: { testResultId: attemptId, questionId } },
                    update: { text: answerText, isCorrect, score },
                    create: {
                        text: answerText,
                        isCorrect,
                        score,
                        testResultId: attemptId,
                        questionId,
                    },
                })
            }).filter(Boolean)
        )

        return { success: true }
    } catch (error) {
        console.error("Error flushing answers:", error)
        return { success: false }
    }
}

async function gradeShortAnswer(answer: string, question: any): Promise<{ isCorrect: boolean; score: number }> {
    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai")
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: "You are a strict but fair exam grader. Respond only with valid JSON.",
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
            },
        })

        const gradingPrompt = `Grade this short answer response.

Question: "${question.text}"
Sample correct answer: "${question.answer}"
Student's answer: "${answer}"

Respond with JSON in this exact format:
{
  "isCorrect": true or false,
  "partialScore": a number between 0 and 1 (0 = completely wrong, 0.5 = half correct, 1 = fully correct)
}

Be generous — if the student demonstrates understanding of the core concept even with different wording, mark it as correct.`

        const result = await model.generateContent(gradingPrompt)
        const gradingResult = JSON.parse(result.response.text())
        const isCorrect = gradingResult.isCorrect === true
        const score = Math.round((gradingResult.partialScore ?? (isCorrect ? 1 : 0)) * question.points)
        return { isCorrect, score }
    } catch (error) {
        console.error("AI grading failed, falling back to exact match:", error)
        const isCorrect = answer.trim().toLowerCase() === question.answer.trim().toLowerCase()
        return { isCorrect, score: isCorrect ? question.points : 0 }
    }
}

export async function submitTest(attemptId: string, timeSpent: number) {
    try {
        const attempt = await prisma.testResult.findUnique({
            where: { id: attemptId },
            include: {
                answers: true,
                test: { include: { questions: true } },
            },
        })

        if (!attempt) return { success: false, message: "Test attempt not found" }
        if (attempt.completedAt) return { success: false, message: "Test has already been submitted" }

        // Grade all short answers in parallel
        const shortAnswers = attempt.answers.filter(a => {
            const q = attempt.test.questions.find(q => q.id === a.questionId)
            return q?.type === "short-answer"
        })

        if (shortAnswers.length > 0) {
            const gradingResults = await Promise.all(
                shortAnswers.map(async (answer) => {
                    const question = attempt.test.questions.find(q => q.id === answer.questionId)
                    const { isCorrect, score } = await gradeShortAnswer(answer.text, question)
                    return { answerId: answer.id, isCorrect, score }
                })
            )

            await Promise.all(
                gradingResults.map(({ answerId, isCorrect, score }) =>
                    prisma.answer.update({
                        where: { id: answerId },
                        data: { isCorrect, score },
                    })
                )
            )
        }

        // Fetch updated answers for final score
        const updatedAnswers = await prisma.answer.findMany({
            where: { testResultId: attemptId },
        })

        const totalPossibleScore = attempt.test.questions.reduce((sum, q) => sum + q.points, 0)
        const earnedScore = updatedAnswers.reduce((sum, a) => sum + (a.score ?? 0), 0)
        const percentageScore = totalPossibleScore > 0 ? (earnedScore / totalPossibleScore) * 100 : 0

        await prisma.testResult.update({
            where: { id: attemptId },
            data: { score: percentageScore, completedAt: new Date(), timeSpent },
        })

        revalidatePath(`/test-results/${attempt.testId}`)
        revalidatePath("/myspace")
        revalidatePath("/dashboard")

        return { success: true, message: "Test submitted successfully" }
    } catch (error) {
        console.error("Error submitting test:", error)
        return { success: false, message: "Failed to submit test" }
    }
}