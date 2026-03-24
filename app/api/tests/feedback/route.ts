// @ts-nocheck

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { questionText, correctAnswer, userAnswer, questionType } = await request.json()

    const isShortAnswer = questionType === "short-answer"

    const prompt = isShortAnswer
      ? `A student answered a short answer question. Evaluate their response and provide helpful feedback.

Question: "${questionText}"
Sample correct answer: "${correctAnswer}"
Student's answer: "${userAnswer}"

In 3-4 sentences:
1. Assess whether the student's answer captures the key idea (even if worded differently)
2. Point out what was correct or missing in their response
3. Give a brief explanation of the concept to reinforce understanding`
      : `A student got this question wrong. Explain why their answer was incorrect and why the correct answer is right.

Question: "${questionText}"
Student's answer: "${userAnswer}"
Correct answer: "${correctAnswer}"

In 2-3 sentences:
1. Explain specifically why the student's answer is wrong
2. Explain why the correct answer is right
3. Give a one-line tip to remember this concept`

    const { GoogleGenerativeAI } = await import("@google/generative-ai")
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: "You are an expert tutor. Give concise, student-friendly explanations that focus on understanding, not just the right answer.",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
      },
    })

    const result = await model.generateContent(prompt)
    const feedback = result.response.text().trim()

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error("Error generating AI feedback:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}