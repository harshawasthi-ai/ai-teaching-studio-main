# 🎓 AI Teaching Studio

AI Teaching Studio is a premium, full-stack educational web application designed for teachers and students. It instantly generates comprehensive, AI-graded lesson kits, worksheets, homework assignments, and slide decks using state-of-the-art AI orchestration, client-side database management, and serverless workflows.

---

## ✨ Features

- **🤖 AI Lesson Kit Generator**: Teachers can instantly output customized lesson plans, worksheet activities, homework sheets, and presentation slides matching specific target grades and subjects.
- **✍️ Multi-Section Interactive Worksheets**: Structured collections featuring Multiple Choice Questions (MCQs), Short Answer, and Extended Response exercises with automated scoring keys.
- **📝 Live Student Portal**: Direct entryway for students to view assignments, input answers, and receive instant, structured AI grading.
- **📊 Analytics Dashboard**: Beautiful visual metrics tracking student performance, submission rates, and class averages.
- **🎨 Premium Glassmorphic UI**: High-fidelity dark mode with dynamic animations, modern typography, responsive components, and fluid layout adjustments.

---

## 🛠️ Technology Stack

- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Tooling**: [Vite 7](https://vite.dev/)
- **Routing**: [TanStack Router](https://tanstack.com/router/latest) (Client-side SPA Mode)
- **State Management & Fetching**: [TanStack Query v5](https://tanstack.com/query/latest)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime + Row Level Security)
- **Backend Functions**: Vercel Serverless Functions (`/api` runtime environment)
- **Deployment**: [Vercel](https://vercel.com/) (Static Web Hosting + Node.js Serverless APIs)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18+) and [npm](https://www.npmjs.com/) installed.

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/harshawasthi-ai/ai-teaching-studio-main.git
   cd ai-teaching-studio-main
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your Supabase credentials and API webhook endpoints:

   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   N8N_LESSON_WEBHOOK_URL=your_n8n_lesson_webhook
   N8N_GRADING_WEBHOOK_URL=your_n8n_grading_webhook
   N8N_HOMEWORK_EVALUATION_WEBHOOK_URL=your_n8n_homework_webhook
   N8N_WEBHOOK_SECRET=your_secret_key
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser to view the application!

---

## 📦 Building and Deployment

### Production Compilation

To compile a production-ready, optimized static bundle:

```bash
npm run build
```

This compiles your Single Page Application (SPA) cleanly into the `dist/` directory, outputting a highly performance-optimized `index.html` alongside standard JavaScript/CSS chunks.

### Vercel Deployment

This project is fully configured for deployment on **Vercel** with zero compute cold-starts:

1. **Framework Preset**: Select `Vite` in your Vercel settings.
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. The router uses the `vercel.json` rewrite configuration to seamlessly support HTML5 history navigation and serverless API execution.
