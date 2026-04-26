// @ts-nocheck
"use server"
import prisma from "@/lib/prisma"

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
            data: { score: 0, test: { connect: { id: testId } }, user: { connect: { id: userId } } },
        })
        return { success: true, attemptId: newAttempt.id, message: "New attempt started" }
    } catch (error) {
        return { success: false, message: "Failed to start test attempt" }
    }
}

// Auto-save function - stripped down to be as lightweight as possible.
// We don't grade here anymore, just dump the draft text to the DB.
export async function flushAnswers(
    attemptId: string,
    answers: Record<string, string>,
    questions: { id: string }[]
) {
    try {
        const attempt = await prisma.testResult.findUnique({ where: { id: attemptId } })
        if (!attempt || attempt.completedAt) return { success: false }

        // Minimal draft upserts without grading logic
        await prisma.$transaction(
            Object.entries(answers).map(([questionId, answerText]) => {
                return prisma.answer.upsert({
                    where: { testResultId_questionId: { testResultId: attemptId, questionId } },
                    update: { text: answerText },
                    create: { text: answerText, isCorrect: false, score: 0, testResultId: attemptId, questionId },
                })
            })
        )
        return { success: true }
    } catch (error) {
        return { success: false }
    }
}

// The core submission handler. All grading is done IN MEMORY for instant speed.
export async function submitTest(
    attemptId: string,
    finalAnswers: Record<string, string>, // We now receive answers directly from the client
    timeSpent: number
) {
    try {
        const attempt = await prisma.testResult.findUnique({
            where: { id: attemptId },
            include: { test: { include: { questions: true } } },
        })

        if (!attempt) return { success: false, message: "Test attempt not found" }
        if (attempt.completedAt) return { success: false, message: "Test has already been submitted" }

        const gradedAnswers = [];
        const shortAnswersToGrade = [];
        let totalPossibleScore = 0;
        let earnedScore = 0;

        // 1. Grade all MCQs and True/False instantly in server memory
        for (const question of attempt.test.questions) {
            totalPossibleScore += question.points;
            const studentAnswerText = finalAnswers[question.id] || "";
            
            let isCorrect = false;
            let score = 0;

            if (question.type === "multiple-choice") {
                isCorrect = studentAnswerText.trim() === question.answer.trim();
                score = isCorrect ? question.points : 0;
                earnedScore += score;
                gradedAnswers.push({ questionId: question.id, text: studentAnswerText, isCorrect, score });
            
            } else if (question.type === "true-false") {
                if ((question.answer === "False" || question.answer === "1") && studentAnswerText === "1") {
                    isCorrect = true; score = question.points;
                } else if ((question.answer === "True" || question.answer === "0") && studentAnswerText === "0") {
                    isCorrect = true; score = question.points;
                }
                earnedScore += score;
                gradedAnswers.push({ questionId: question.id, text: studentAnswerText, isCorrect, score });
            
            } else if (question.type === "short-answer") {
                shortAnswersToGrade.push({ 
                    questionId: question.id, 
                    studentAnswer: studentAnswerText, 
                    expectedAnswer: question.answer, 
                    points: question.points,
                    questionText: question.text
                });
            }
        }

        // 2. Process AI Grading ONLY if there are short answers
        if (shortAnswersToGrade.length > 0) {
            try {
                const { GoogleGenerativeAI } = await import("@google/generative-ai")
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.5-flash",
                    systemInstruction: "You are an exam grader. Respond ONLY with valid JSON.",
                    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
                })

                const prompt = `Grade these short answer responses against the sample correct answers. 
                Data: ${JSON.stringify(shortAnswersToGrade)}
                Respond with a JSON array format: [{"questionId": "id", "isCorrect": true/false, "partialScore": 0.0-1.0}]`;

                const result = await model.generateContent(prompt)
                const gradingResults = JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, '').trim());

                for (const res of gradingResults) {
                    const originalQ = shortAnswersToGrade.find(q => q.questionId === res.questionId);
                    if (originalQ) {
                        const finalScore = Math.round((res.partialScore ?? (res.isCorrect ? 1 : 0)) * originalQ.points);
                        earnedScore += finalScore;
                        gradedAnswers.push({
                            questionId: res.questionId,
                            text: originalQ.studentAnswer,
                            isCorrect: res.isCorrect,
                            score: finalScore
                        });
                    }
                }
            } catch (aiError) {
                console.error("AI grading failed, using fallback:", aiError)
                // Fallback to exact match
                for (const q of shortAnswersToGrade) {
                    const isCorrect = q.studentAnswer.trim().toLowerCase() === q.expectedAnswer.trim().toLowerCase();
                    const score = isCorrect ? q.points : 0;
                    earnedScore += score;
                    gradedAnswers.push({ questionId: q.questionId, text: q.studentAnswer, isCorrect, score });
                }
            }
        }

        const percentageScore = totalPossibleScore > 0 ? (earnedScore / totalPossibleScore) * 100 : 0;

        // 3. ONE database operation to wipe drafts, save final answers, and update the test result
        await prisma.$transaction([
            prisma.answer.deleteMany({ where: { testResultId: attemptId } }),
            prisma.answer.createMany({
                data: gradedAnswers.map(ga => ({
                    testResultId: attemptId,
                    questionId: ga.questionId,
                    text: ga.text,
                    isCorrect: ga.isCorrect,
                    score: ga.score
                }))
            }),
            prisma.testResult.update({
                where: { id: attemptId },
                data: { score: percentageScore, completedAt: new Date(), timeSpent },
            })
        ]);

        return { success: true, message: "Test submitted successfully" }
    } catch (error) {
        console.error("Error submitting test:", error)
        return { success: false, message: "Failed to submit test" }
    }
}