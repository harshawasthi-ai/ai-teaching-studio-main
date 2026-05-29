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

## 📂 Repository Structure

This repository is organized as a professional full-stack monorepo:
* **`Frontend/`**: Contains the React 19 SPA, Tailwind CSS v4, and Vercel serverless functions (`api/`).
* **`Backend/`**: Houses n8n workflow configuration `.json` files for AI grading and homework evaluation.
* **`Screenshots/`**: Stores screenshots showcasing the application interface.

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

2. **Navigate to the Frontend directory and install dependencies:**

   ```bash
   cd Frontend
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file inside the `Frontend/` directory and add your Supabase credentials and API webhook endpoints:

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

To compile a production-ready, optimized static bundle locally:

```bash
cd Frontend
npm run build
```

This compiles your Single Page Application (SPA) cleanly into `Frontend/dist/`, outputting a highly performance-optimized `index.html` alongside standard JavaScript/CSS chunks.

### Vercel Deployment

This project is fully configured for deployment on **Vercel** with zero compute cold-starts:

1. **Framework Preset**: Select `Vite` in your Vercel settings.
2. **Root Directory**: Set this to **`Frontend`** (Vercel will treat the subfolder as the root of the project, executing installs and builds within it).
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. The router uses `Frontend/vercel.json` rewrite configuration to seamlessly support HTML5 history navigation and serverless API execution.
