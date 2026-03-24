// @ts-nocheck

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface AssignedTestsListProps {
  viewType: string;
  searchQuery: string;
  selectedSubject: string;
}

interface TestItem {
  id: string;
  name: string;
  subject: string;
  assignedBy: string;
  classroom: string;
  dueDate: string;
  status: string;
  score?: string;
}

export function AssignedTestsList({ viewType, searchQuery, selectedSubject }: AssignedTestsListProps) {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTests() {
      try {
        const queryParams = new URLSearchParams({
          type: 'assigned',
          search: searchQuery,
          subject: selectedSubject
        });
        const res = await fetch(`/api/tests?${queryParams}`);
        if (!res.ok) throw new Error("Failed to fetch assigned tests");
        const data = await res.json();
        console.log("Fetched assigned tests:", data);

        const formattedTests = data.map((test: any) => ({
          id: test.id,
          name: test.name || "Untitled Test",
          subject: test.subject || "No Subject",
          assignedBy: `${test.creator.firstName} ${test.creator.lastName}` || "Unknown",
          classroom: test.classroom?.name || "No Classroom",
          dueDate: test.dueDate ? format(new Date(test.dueDate), "MMM dd, yyyy") : "No Due Date",
          status: test.results.length > 0
            ? (test.results[0].completedAt ? "Completed" : "Pending")
            : "Pending",
          score: test.results?.length > 0 ? `${Math.round(test.results[0].score)}%` : "-",
        }));

        setTests(formattedTests);
      } catch (err) {
        console.error("Error fetching assigned tests:", err);
        setError("Failed to load assigned tests.");
      } finally {
        setLoading(false);
      }
    }
    fetchTests();
  }, [searchQuery, selectedSubject]);

  if (loading) {
    return viewType === "grid" ? (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <Skeleton className="h-6 w-[200px]" />
                <Skeleton className="h-5 w-[80px]" />
              </div>
              <Skeleton className="h-4 w-[120px] mt-2" />
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-4 w-[60px] mb-1" />
                    <Skeleton className="h-5 w-[80px]" />
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-[120px]" />
            </CardFooter>
          </Card>
        ))}
      </div>
    ) : (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableHead key={i}><Skeleton className="h-4 w-[100px]" /></TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-[100px]" /></TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (error) return <p className="text-red-500">{error}</p>;

  if (tests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No assigned tests found. Join a classroom to get started.</p>
      </div>
    );
  }

  if (viewType === "grid") {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tests.map((test) => (
          <Card key={test.id} className="flex flex-col h-full">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{test.name}</CardTitle>
                <Badge
                  variant={
                    test.status === "Completed" ? "outline" : "secondary"
                  }
                >
                  {test.status}
                </Badge>
              </div>
              <CardDescription>{test.classroom}</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Subject</p>
                  <p className="font-medium">{test.subject}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{test.dueDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned By</p>
                  <p className="font-medium">{test.assignedBy}</p>
                </div>
                {test.score && test.score !== "-" && (
                  <div>
                    <p className="text-muted-foreground">Score</p>
                    <p className="font-medium">{test.score}</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2 flex-wrap">
              <Button asChild variant="default">
                <Link href={test.status === "Completed" ? `/test-results/${test.id}` : `/take-test/${test.id}`}>
                  {test.status === "Completed" ? "View Results" : "Take Test"}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/test-details/${test.id}`}>
                  View Details
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Classroom</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tests.map((test) => (
            <TableRow key={test.id}>
              <TableCell className="font-medium">{test.name}</TableCell>
              <TableCell>{test.subject}</TableCell>
              <TableCell>{test.classroom}</TableCell>
              <TableCell>{test.dueDate}</TableCell>
              <TableCell>
                <Badge
                  className={
                    test.status === "Completed"
                      ? "bg-green-500 text-white"
                      : "bg-gray-300 text-black"
                  }
                >
                  {test.status}
                </Badge>
              </TableCell>
              <TableCell>{test.score || "-"}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/test-details/${test.id}`}>
                      Details
                    </Link>
                  </Button>
                  <Button asChild variant="default" size="sm">
                    <Link href={test.status === "Completed" ? `/test-results/${test.id}` : `/take-test/${test.id}`}>
                      {test.status === "Completed" ? "Results" : "Take Test"}
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}