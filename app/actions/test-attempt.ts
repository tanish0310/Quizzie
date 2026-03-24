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
                // Use Gemini to grade short answer questions
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
  "partialScore": a number between 0 and 1 representing how correct the answer is (0 = completely wrong, 0.5 = half correct, 1 = fully correct)
}

Be generous — if the student demonstrates understanding of the core concept even with different wording, mark it as correct.`

                    const result = await model.generateContent(gradingPrompt)
                    const gradingResult = JSON.parse(result.response.text())

                    isCorrect = gradingResult.isCorrect === true
                    score = Math.round((gradingResult.partialScore ?? (isCorrect ? 1 : 0)) * question.points)
                } catch (gradingError) {
                    console.error("AI grading failed, falling back to exact match:", gradingError)
                    isCorrect = answer.trim().toLowerCase() === question.answer.trim().toLowerCase()
                    score = isCorrect ? question.points : 0
                }
                break

            default:
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

        const totalPossibleScore = attempt.test.questions.reduce((sum, q) => sum + q.points, 0)
        const earnedScore = attempt.answers.reduce((sum, a) => sum + a.score, 0)
        const percentageScore = totalPossibleScore > 0 ? (earnedScore / totalPossibleScore) * 100 : 0

        await prisma.testResult.update({
            where: { id: attemptId },
            data: {
                score: percentageScore,
                completedAt: new Date(),
                timeSpent,
            },
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