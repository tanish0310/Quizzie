// @ts-nocheck
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Eye,
  MoreHorizontal,
  Clock,
  FileText,
  BarChart3,
  CheckCircle,
  XCircle,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

export default function TestDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [studentFilter, setStudentFilter] = useState("all")

  useEffect(() => {
    const fetchTest = async () => {
      try {
        const response = await fetch(`/api/tests/${params.id}`)
        if (!response.ok) {
          if (response.status === 404) setError("Test not found.")
          else if (response.status === 403) setError("You don't have permission to view this test.")
          else setError("Failed to load test.")
          return
        }
        const data = await response.json()
        setTest(data)
      } catch (err) {
        setError("An error occurred while loading the test.")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) fetchTest()
  }, [params.id])

  // Derived stats from allResults (all student submissions)
  const allResults = test?.allResults ?? []
  const totalSubmissions = allResults.length
  const averageScore =
    totalSubmissions > 0
      ? Math.round(allResults.reduce((sum, r) => sum + (r.score ?? 0), 0) / totalSubmissions)
      : null

  const highestScore = totalSubmissions > 0 ? Math.round(Math.max(...allResults.map(r => r.score ?? 0))) : null
  const lowestScore = totalSubmissions > 0 ? Math.round(Math.min(...allResults.map(r => r.score ?? 0))) : null

  const questionTypeCounts = test?.questions?.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1
    return acc
  }, {}) ?? {}

  const questionTypeLabels = {
    "multiple-choice": "Multiple Choice",
    "true-false": "True / False",
    "short-answer": "Short Answer",
  }

  const creatorName = test
    ? `${test.creator?.firstName ?? ""} ${test.creator?.lastName ?? ""}`.trim()
    : ""

  const createdAt = test
    ? new Date(test.createdAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : ""

  const filteredResults =
    studentFilter === "all"
      ? allResults
      : studentFilter === "high"
      ? allResults.filter(r => (r.score ?? 0) >= 70)
      : allResults.filter(r => (r.score ?? 0) < 70)

  const getStudentName = (result) => {
    const first = result.user?.firstName ?? ""
    const last = result.user?.lastName ?? ""
    const full = `${first} ${last}`.trim()
    return full || "Unknown Student"
  }

  const getInitials = (result) => {
    const first = result.user?.firstName?.[0] ?? ""
    const last = result.user?.lastName?.[0] ?? ""
    return `${first}${last}`.toUpperCase() || "?"
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-6 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">{error}</h2>
        <Button variant="outline" onClick={() => router.push("/myspace")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to My Space
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto text-muted-foreground mb-1"
            onClick={() => router.push("/myspace")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            My Space
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{test.name}</h1>
          <p className="text-muted-foreground">
            {test.classroom ? test.classroom.name : "Personal Test"} • Created on {createdAt}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/take-test/${test.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className="capitalize">{test.status}</Badge>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{test.timeLimit ? `${test.timeLimit} min` : "No time limit"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Submissions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubmissions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSubmissions === 1 ? "student has" : "students have"} submitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {averageScore !== null ? `${averageScore}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Based on completed submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{test.questions?.length ?? 0}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(questionTypeCounts).map(([type, count]) => (
                <Badge key={type} variant="outline" className="text-xs">
                  {questionTypeLabels[type] ?? type} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          {test.isCreator && (
            <TabsTrigger value="results">
              Results {totalSubmissions > 0 && `(${totalSubmissions})`}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Test Details</CardTitle>
                <CardDescription>Information about this test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Subject</h3>
                  <p className="mt-1">{test.subject}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Classroom</h3>
                  <p className="mt-1">
                    {test.classroom ? (
                      <Link href={`/classrooms/${test.classroom.id}`} className="underline underline-offset-2">
                        {test.classroom.name}
                      </Link>
                    ) : "Personal Test"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Created By</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {creatorName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <span>{creatorName}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
                  <p className="mt-1">{createdAt}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Time Limit</h3>
                  <p className="mt-1">{test.timeLimit ? `${test.timeLimit} minutes` : "No limit"}</p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" asChild className="w-full">
                  <Link href={`/take-test/${test.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Test
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Submission Summary</CardTitle>
                <CardDescription>Overview of student submissions</CardDescription>
              </CardHeader>
              <CardContent>
                {totalSubmissions === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <MoreHorizontal className="h-8 w-8" />
                    <p className="text-sm">No submissions yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score range bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Average Score</span>
                        <span className="font-medium text-foreground">{averageScore}%</span>
                      </div>
                      <Progress value={averageScore} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs mb-1">Highest Score</p>
                        <p className="text-xl font-bold text-green-600">{highestScore}%</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-muted-foreground text-xs mb-1">Lowest Score</p>
                        <p className="text-xl font-bold text-red-500">{lowestScore}%</p>
                      </div>
                    </div>

                    {/* Recent submissions preview */}
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium">Recent Submissions</p>
                      {allResults.slice(0, 4).map((result) => (
                        <div key={result.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">{getInitials(result)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{getStudentName(result)}</span>
                          </div>
                          <Badge variant={result.score >= 70 ? "default" : "secondary"}>
                            {Math.round(result.score ?? 0)}%
                          </Badge>
                        </div>
                      ))}
                      {allResults.length > 4 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => setActiveTab("results")}
                        >
                          View all {allResults.length} submissions
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              {totalSubmissions > 0 && (
                <CardFooter>
                  <Button size="sm" className="w-full" onClick={() => setActiveTab("results")}>
                    View All Results
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle>Question Bank</CardTitle>
              <CardDescription>{test.questions?.length ?? 0} questions in this test</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {test.questions?.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-muted-foreground text-sm font-medium min-w-[24px]">
                          {index + 1}.
                        </span>
                        <p className="font-medium">{question.text}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">
                          {questionTypeLabels[question.type] ?? question.type}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {question.points} pt{question.points !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    {question.options && question.options.length > 0 && (
                      <div className="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {question.options.map((option, optIndex) => (
                          <div
                            key={optIndex}
                            className={`text-sm px-3 py-2 rounded-md border ${
                              String(optIndex) === String(question.answer)
                                ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 font-medium"
                                : "border-border bg-muted/30"
                            }`}
                          >
                            {String(optIndex) === String(question.answer) && (
                              <CheckCircle className="inline h-3 w-3 mr-1.5" />
                            )}
                            {option}
                          </div>
                        ))}
                      </div>
                    )}

                    {question.type === "short-answer" && (
                      <div className="ml-7">
                        <p className="text-xs text-muted-foreground mb-1">Sample Answer</p>
                        <p className="text-sm bg-muted/30 border rounded-md px-3 py-2">{question.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab — only for creators */}
        {test.isCreator && (
          <TabsContent value="results">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Student Results</CardTitle>
                  <CardDescription>
                    {totalSubmissions} submission{totalSubmissions !== 1 ? "s" : ""} received
                  </CardDescription>
                </div>
                <Select value={studentFilter} onValueChange={setStudentFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="high">Passed (≥70%)</SelectItem>
                    <SelectItem value="low">Failed (&lt;70%)</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {totalSubmissions === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <p className="text-sm">No submissions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(result)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{getStudentName(result)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {result.completedAt
                              ? new Date(result.completedAt).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric", year: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={result.score >= 70 ? "default" : "secondary"}>
                              {Math.round(result.score ?? 0)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/test-results/${test.id}/student/${result.user.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}