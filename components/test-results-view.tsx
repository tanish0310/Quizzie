// @ts-nocheck

"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, ArrowLeft, Loader2, HelpCircle } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface TestResultsViewProps {
  test: any
  testResult: any
}

export function TestResultsView({ test, testResult }: TestResultsViewProps) {
  const [feedbacks, setFeedbacks] = useState({})
  const [loadingFeedback, setLoadingFeedback] = useState({})

  const formatTimeSpent = (seconds: number) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes} min ${remainingSeconds} sec`
  }

  const correctAnswers = testResult.answers.filter((answer: any) => answer.isCorrect).length
  const totalQuestions = test.questions.length
  const completionDate = new Date(testResult.completedAt).toLocaleDateString()

  const handleGenerateFeedback = async (question: any, userAnswer: any) => {
    setLoadingFeedback((prev) => ({ ...prev, [question.id]: true }))

    // Build human-readable versions of the answers
    const correctAnswerText =
      question.type === "multiple-choice"
        ? question.options[Number.parseInt(question.answer)] || question.answer
        : question.type === "true-false"
        ? question.answer === "0" ? "True" : "False"
        : question.answer

    const userAnswerText = userAnswer
      ? question.type === "multiple-choice"
        ? question.options[Number.parseInt(userAnswer.text)] || userAnswer.text
        : question.type === "true-false"
        ? userAnswer.text === "0" ? "True" : "False"
        : userAnswer.text
      : "No answer provided"

    try {
      const res = await fetch("/api/tests/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: question.text,
          correctAnswer: correctAnswerText,
          userAnswer: userAnswerText,
          questionType: question.type,
        })
      })

      const data = await res.json()
      setFeedbacks((prev) => ({
        ...prev,
        [question.id]: data.feedback || "Unable to generate feedback."
      }))
    } catch (error) {
      console.error("Error generating feedback:", error)
      setFeedbacks((prev) => ({ ...prev, [question.id]: "Error generating feedback." }))
    } finally {
      setLoadingFeedback((prev) => ({ ...prev, [question.id]: false }))
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{test.name} Results</h1>
          <p className="text-muted-foreground">Completed on {completionDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/test-details/${test.id}`}>
              View Test Details
            </Link>
          </Button>
          <Button asChild>
            <Link href="/myspace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Space
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Your Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle className="stroke-muted stroke-[8] fill-none" cx="50" cy="50" r="40" />
                  <circle
                    className="stroke-primary stroke-[8] fill-none"
                    cx="50"
                    cy="50"
                    r="40"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * testResult.score) / 100}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{testResult.score.toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                {correctAnswers} of {totalQuestions} questions correct
              </p>
              <p className="text-sm text-muted-foreground">Time spent: {formatTimeSpent(testResult.timeSpent)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Test Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Score</span>
              <Badge>{testResult.score.toFixed(0)}%</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Time Spent</span>
              <Badge variant="outline">{formatTimeSpent(testResult.timeSpent)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Questions</span>
              <Badge variant="outline">{totalQuestions}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Correct Answers</span>
              <Badge variant="outline">{correctAnswers}</Badge>
            </div>
            <Separator />
            <div className="text-center text-sm text-muted-foreground">
              {testResult.score >= 70 ? "Great job! Keep it up!" : "Keep practicing — you'll get there!"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Review</CardTitle>
          <CardDescription>Review your answers. Click QuizzieAI Solve for a personalised explanation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {test.questions.map((question: any, index: number) => {
            const answer = testResult.answers.find((a: any) => a.questionId === question.id)
            const isAnswered = !!answer
            const isShortAnswer = question.type === "short-answer"

            // For short answer, treat as "needs review" rather than flat incorrect
            const showAsCorrect = isAnswered && answer.isCorrect
            const showAsIncorrect = isAnswered && !answer.isCorrect && !isShortAnswer
            const showAsReview = isAnswered && !answer.isCorrect && isShortAnswer

            return (
              <div key={question.id} className="relative space-y-4 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Question {index + 1}</h3>
                    <p className="mt-1">{question.text}</p>
                  </div>
                  {showAsCorrect && (
                    <Badge className="bg-green-600 shrink-0">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Correct
                    </Badge>
                  )}
                  {showAsIncorrect && (
                    <Badge variant="destructive" className="shrink-0">
                      <XCircle className="mr-1 h-3 w-3" />
                      Incorrect
                    </Badge>
                  )}
                  {showAsReview && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 shrink-0">
                      <HelpCircle className="mr-1 h-3 w-3" />
                      Review with AI
                    </Badge>
                  )}
                  {!isAnswered && (
                    <Badge variant="secondary" className="shrink-0">
                      <XCircle className="mr-1 h-3 w-3" />
                      Unanswered
                    </Badge>
                  )}
                </div>

                <div className="grid gap-2 text-sm">
                  {isAnswered ? (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-medium shrink-0">Your answer:</span>
                        <span className={showAsCorrect ? "text-green-600" : showAsReview ? "text-amber-700" : "text-red-600"}>
                          {question.type === "multiple-choice"
                            ? question.options[Number.parseInt(answer.text)] || answer.text
                            : question.type === "true-false"
                            ? answer.text === "0" ? "True" : "False"
                            : answer.text}
                        </span>
                      </div>
                      {(showAsIncorrect || showAsReview) && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium shrink-0">
                            {isShortAnswer ? "Sample answer:" : "Correct answer:"}
                          </span>
                          <span className="text-green-600">
                            {question.type === "multiple-choice"
                              ? question.options[Number.parseInt(question.answer)] || question.answer
                              : question.type === "true-false"
                              ? question.answer === "0" ? "True" : "False"
                              : question.answer}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-start text-muted-foreground">
                        <span>You did not answer this question.</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium shrink-0">Correct answer:</span>
                        <span className="text-green-600">
                          {question.type === "multiple-choice"
                            ? question.options[Number.parseInt(question.answer)] || question.answer
                            : question.type === "true-false"
                            ? question.answer === "0" ? "True" : "False"
                            : question.answer}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* QuizzieAI Solve — show for wrong answers AND short answers */}
                {isAnswered && (showAsIncorrect || showAsReview) && (
                  <>
                    {!feedbacks[question.id] && (
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleGenerateFeedback(question, answer)}
                          disabled={loadingFeedback[question.id]}
                        >
                          {loadingFeedback[question.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Analysing...
                            </>
                          ) : (
                            "QuizzieAI Solve"
                          )}
                        </Button>
                      </div>
                    )}
                    {feedbacks[question.id] && (
                      <div className="mt-2 rounded-md border border-[#ddd6fe] bg-[#ede9fe] p-4">
                        <Image
                          src="/images/QuizzieAiLogo.png"
                          alt="QuizzieAI Logo"
                          width={110}
                          height={40}
                        />
                        <p className="text-sm text-[#18181b] p-2 whitespace-pre-line">{feedbacks[question.id]}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}