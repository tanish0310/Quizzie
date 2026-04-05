# Quizzie 🧠

> The test prep platform where students don't just take tests — they create them.

Quizzie is a full-stack AI-powered quiz platform built with Next.js. Students can generate tests from their own study materials using AI, take tests with a built-in timer, and get instant feedback. Teachers can create and assign tests to classrooms, track student performance, and view detailed per-student results.

---

## Features

### For Students
- **AI Test Generation** — Upload one or more PDFs or paste text, and Gemini generates a full test in seconds
- **Multiple Question Types** — Multiple choice, true/false, and short answer
- **Smart Grading** — Multiple choice and true/false are graded instantly; short answer questions are graded by Gemini with partial credit support
- **QuizzieAI Solve** — On the results page, get a personalised explanation of why your answer was wrong and what the correct concept is
- **Test Timer** — Built-in countdown timer with auto-submit when time expires
- **Auto-save** — Answers are saved every 3 seconds so progress is never lost
- **Dashboard** — Track pending tests, completed tests, average scores, highest and lowest scores

### For Teachers
- **Classroom Management** — Create classrooms, invite students, assign tests
- **Student Results** — View individual student answer breakdowns with correct/incorrect highlights
- **Test Analytics** — See submission counts, average scores, highest and lowest scores per test

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + Radix UI (shadcn/ui) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma |
| Auth | NextAuth.js with Prisma Adapter |
| AI | Google Gemini (gemini-2.5-flash) |
| PDF Parsing | pdfjs-dist |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (for the database)
- A Google Gemini API key from [aistudio.google.com](https://aistudio.google.com/apikey)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/quizzie.git
cd quizzie

# Install dependencies
npm install
# or
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL=your_supabase_connection_string

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

To generate a `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### Database Setup

```bash
# Push the Prisma schema to your database
npx prisma db push

# (Optional) Seed the database
npx prisma db seed
```

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
quizzie/
├── app/
│   ├── actions/          # Server actions (auth, test, classroom, user)
│   ├── api/              # API routes
│   │   ├── tests/        # Test CRUD, feedback, results
│   │   ├── classrooms/   # Classroom management
│   │   └── auth/         # NextAuth handlers
│   ├── create-test/      # Multi-step test creation page
│   ├── dashboard/        # Student dashboard
│   ├── myspace/          # Personal and assigned tests
│   ├── take-test/[id]/   # Test-taking interface
│   ├── test-details/[id]/ # Test overview and student results (teacher view)
│   ├── test-results/[id]/ # Results page after completing a test
│   └── classrooms/       # Classroom pages
├── components/
│   ├── ui/               # shadcn/ui base components
│   ├── test-taker.tsx    # Test-taking UI with timer and auto-save
│   ├── test-results-view.tsx  # Results review with QuizzieAI Solve
│   └── ...               # Other feature components
├── lib/
│   ├── auth.ts           # NextAuth config
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Shared utilities
└── prisma/
    └── schema.prisma     # Database schema
```

---

## How Test Generation Works

1. User uploads one or more PDFs and/or pastes text as source material
2. Text is extracted client-side using `pdfjs-dist` — no file upload to the server
3. Extracted text is sent to the Next.js API route along with test configuration
4. The API calls Gemini with a structured prompt requesting JSON output
5. Gemini returns a `{ questions: [...] }` object which is saved to the database via Prisma
6. User is redirected to the test details page

---

## How AI Grading Works

**Multiple choice / True-False** — Graded instantly by exact index comparison.

**Short answer** — When an answer is saved, Gemini evaluates it against the sample answer and returns:
```json
{ "isCorrect": true, "partialScore": 0.75 }
```
Partial credit is awarded proportionally. If the Gemini call fails, it falls back to exact string match.

**QuizzieAI Solve** — On the results page, clicking this button sends the question, correct answer, and the student's specific wrong answer to Gemini, which explains the mistake and reinforces the correct concept.

---

## Key Routes

| Route | Description |
|---|---|
| `/dashboard` | Student dashboard with stats |
| `/myspace` | Personal and assigned test lists |
| `/create-test` | Multi-step AI test generator |
| `/take-test/[id]` | Timed test-taking interface |
| `/test-results/[id]` | Your results after completing a test |
| `/test-results/[id]/student/[userId]` | Individual student results (teacher only) |
| `/test-details/[id]` | Test overview, questions, and submission stats |
| `/classrooms/[id]` | Classroom page |
| `/account` | Profile and security settings |

---

## Notes

- The Gemini free tier supports `gemini-2.5-flash`. If you hit quota limits, check [ai.dev/rate-limit](https://ai.dev/rate-limit) and ensure your API key was created at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — not the Google Cloud Console.
- PDF text extraction runs entirely in the browser. Large PDFs may take a few seconds to process before the form submits.
- Short answer grading makes one Gemini API call per question during auto-save, so tests with many short answer questions will use more quota.

---

## License

MIT
