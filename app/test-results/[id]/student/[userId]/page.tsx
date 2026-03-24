// @ts-nocheck
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, ArrowLeft, HelpCircle } from "lucide-react"
import Link from "next/link"

export default async function StudentResultPage({ params }) {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/login")

  const { id: testId, userId } = params

  // Fetch the test
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: true,
      creator: { select: { id: true, firstName: true, lastName: true } },
      classroom: { select: { id: true, name: true } },
    },
  })

  if (!test) redirect("/myspace?error=test-not-found")

  // Only the creator or classroom owner can view student results
  const isCreator = test.creator.id === session.user.id
  let canAccess = isCreator

  if (!canAccess && test.classroom) {
    const classroom = await prisma.classroom.findUnique({
      where: { id: test.classroomId },
      select: { ownerId: true },
    })
    if (classroom?.ownerId === session.user.id) canAccess = true
  }

  if (!canAccess) redirect("/myspace")

  // Fetch the specific student's result
  const testResult = await prisma.testResult.findUnique({
    where: { testId_userId: { testId, userId } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      answers: { include: { question: true } },
    },
  })

  if (!testResult || !testResult.completedAt) redirect(`/test-details/${testId}`)

  const studentName = `${testResult.user?.firstName ?? ""} ${testResult.user?.lastName ?? ""}`.trim() || "Unknown Student"
  const completionDate = new Date(testResult.completedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  })

  const totalPossibleScore = test.questions.reduce((sum, q) => sum + q.points, 0)
  const earnedScore = testResult.answers.reduce((sum, a) => sum + (a.score ?? 0), 0)
  const percentage = totalPossibleScore > 0 ? (earnedScore / totalPossibleScore) * 100 : 0

  const correctAnswers = testResult.answers.filter(a => a.isCorrect).length
  const totalQuestions = test.questions.length

  const formatTimeSpent = (seconds: number) => {
    if (!seconds) return "N/A"
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes} min ${remainingSeconds} sec`
  }

  const questionTypeLabels = {
    "multiple-choice": "Multiple Choice",
    "true-false": "True / False",
    "short-answer": "Short Answer",
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="p-0 h-auto text-muted-foreground mb-1" asChild>
            <Link href={`/test-details/${testId}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Test Details
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{test.name}</h1>
          <p className="text-muted-foreground">
            Results for <span className="font-medium text-foreground">{studentName}</span> • {completionDate}
          </p>
        </div>
      </div>

      {/* Score Summary */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="relative h-32 w-32">
                <svg className="h-full w-full" viewBox="0 0 100 100">
                  <circle className="stroke-muted stroke-[8] fill-none" cx="50" cy="50" r="40" />
                  <circle
                    className="stroke-primary stroke-[8] fill-none"
                    cx="50" cy="50" r="40"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * percentage) / 100}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{percentage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                {correctAnswers} of {totalQuestions} questions correct
              </p>
              <p className="text-sm text-muted-foreground">
                Time spent: {formatTimeSpent(testResult.timeSpent)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Student</span>
              <span className="font-medium">{studentName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Score</span>
              <Badge variant={percentage >= 70 ? "default" : "secondary"}>
                {percentage.toFixed(0)}%
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Points Earned</span>
              <Badge variant="outline">{earnedScore} / {totalPossibleScore}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Time Spent</span>
              <Badge variant="outline">{formatTimeSpent(testResult.timeSpent)}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Correct Answers</span>
              <Badge variant="outline">{correctAnswers} / {totalQuestions}</Badge>
            </div>
            <Separator />
            <div className="text-center text-sm text-muted-foreground">
              {percentage >= 70 ? "Passed ✓" : "Did not pass"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Question Review */}
      <Card>
        <CardHeader>
          <CardTitle>Answer Review</CardTitle>
          <CardDescription>
            Detailed breakdown of {studentName}'s answers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {test.questions.map((question, index) => {
            const answer = testResult.answers.find(a => a.questionId === question.id)
            const isAnswered = !!answer
            const isShortAnswer = question.type === "short-answer"
            const showAsCorrect = isAnswered && answer.isCorrect
            const showAsIncorrect = isAnswered && !answer.isCorrect && !isShortAnswer
            const showAsReview = isAnswered && !answer.isCorrect && isShortAnswer

            const correctAnswerText =
              question.type === "multiple-choice"
                ? question.options[Number.parseInt(question.answer)] || question.answer
                : question.type === "true-false"
                ? question.answer === "0" ? "True" : "False"
                : question.answer

            const userAnswerText = answer
              ? question.type === "multiple-choice"
                ? question.options[Number.parseInt(answer.text)] || answer.text
                : question.type === "true-false"
                ? answer.text === "0" ? "True" : "False"
                : answer.text
              : null

            return (
              <div key={question.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-muted-foreground text-sm font-medium min-w-[24px]">
                      {index + 1}.
                    </span>
                    <div>
                      <p className="font-medium">{question.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {questionTypeLabels[question.type] ?? question.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {answer?.score ?? 0} / {question.points} pts
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {showAsCorrect && (
                      <Badge className="bg-green-600">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Correct
                      </Badge>
                    )}
                    {showAsIncorrect && (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Incorrect
                      </Badge>
                    )}
                    {showAsReview && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                        <HelpCircle className="mr-1 h-3 w-3" />
                        AI Graded
                      </Badge>
                    )}
                    {!isAnswered && (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" />
                        Unanswered
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="ml-7 grid gap-2 text-sm">
                  {isAnswered ? (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="font-medium shrink-0">Student's answer:</span>
                        <span className={
                          showAsCorrect ? "text-green-600" :
                          showAsReview ? "text-amber-700" :
                          "text-red-600"
                        }>
                          {userAnswerText}
                        </span>
                      </div>
                      {(showAsIncorrect || showAsReview) && (
                        <div className="flex items-start gap-2">
                          <span className="font-medium shrink-0">
                            {isShortAnswer ? "Sample answer:" : "Correct answer:"}
                          </span>
                          <span className="text-green-600">{correctAnswerText}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground">No answer provided.</span>
                      <span className="font-medium shrink-0">Correct:</span>
                      <span className="text-green-600">{correctAnswerText}</span>
                    </div>
                  )}
                </div>

                {/* Options display for multiple choice */}
                {question.type === "multiple-choice" && question.options?.length > 0 && (
                  <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {question.options.map((option, optIndex) => {
                      const isCorrectOption = String(optIndex) === String(question.answer)
                      const isStudentChoice = answer && String(optIndex) === String(answer.text)
                      return (
                        <div
                          key={optIndex}
                          className={`text-sm px-3 py-2 rounded-md border ${
                            isCorrectOption
                              ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                              : isStudentChoice
                              ? "border-red-400 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                              : "border-border bg-muted/30"
                          }`}
                        >
                          {isCorrectOption && <CheckCircle className="inline h-3 w-3 mr-1.5" />}
                          {isStudentChoice && !isCorrectOption && <XCircle className="inline h-3 w-3 mr-1.5" />}
                          {option}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}