import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Header, FloatingBlobs } from "@/components/app/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface LessonRow {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  created_at: string;
  is_published?: boolean;
  published_at?: string | null;
  worksheet?: unknown;
}

interface SubmissionRow {
  id: string;
  lesson_id: string;
  student_id: string;
  student_name: string;
  grade: string;
  worksheet_answers: Record<string, string>;
  homework_answer: string;
  worksheet_submitted_at: string | null;
  homework_submitted_at: string | null;
  submitted_at: string;
  updated_at: string;
  ai_worksheet_score: number | null;
  ai_worksheet_grade: string | null;
  ai_worksheet_feedback: string;
  ai_worksheet_breakdown: Array<Record<string, unknown>>;
  ai_worksheet_graded_at: string | null;
  ai_homework_understanding_level: string | null;
  ai_homework_understanding_score: number | null;
  ai_homework_feedback: string;
  ai_homework_evaluated_at: string | null;
}

interface QuizAttemptRow {
  id: string;
  lesson_id: string;
  student_id: string;
  answers: Record<string, string>;
  updated_at: string;
}

interface StudentProfileRow {
  id: string;
  display_name: string | null;
  grade: string | null;
  role: string | null;
}

type LoadState = "loading" | "ready" | "error";

export default function AnalyticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<StudentProfileRow[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (authLoading || !user || !profile) return;
    let cancelled = false;

    (async () => {
      setState("loading");
      if (profile.role === "teacher") {
        const [lessonResult, submissionResult, studentResult] = await Promise.all([
          supabase
            .from("lessons")
            .select(
              "id,subject,grade,topic,duration,created_at,is_published,published_at,worksheet",
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("lesson_submissions")
            .select(
              "id,lesson_id,student_id,student_name,grade,worksheet_answers,homework_answer,worksheet_submitted_at,homework_submitted_at,ai_worksheet_score,ai_worksheet_grade,ai_worksheet_feedback,ai_worksheet_breakdown,ai_worksheet_graded_at,ai_homework_understanding_level,ai_homework_understanding_score,ai_homework_feedback,ai_homework_evaluated_at,submitted_at,updated_at",
            )
            .eq("teacher_id", user.id)
            .order("submitted_at", { ascending: false }),
          supabase.from("profiles").select("id,display_name,grade,role").eq("role", "student"),
        ]);
        if (cancelled) return;
        if (lessonResult.error || submissionResult.error || studentResult.error) {
          toast.error(
            lessonResult.error?.message ||
              submissionResult.error?.message ||
              studentResult.error?.message ||
              "Unable to load analytics",
          );
          setState("error");
          return;
        }
        setLessons((lessonResult.data || []) as LessonRow[]);
        setSubmissions(((submissionResult.data || []) as SubmissionRow[]).filter(isRealSubmission));
        setQuizAttempts([]);
        setStudentProfiles((studentResult.data || []) as StudentProfileRow[]);
        setState("ready");
        return;
      }

      const [lessonResult, submissionResult, quizResult] = await Promise.all([
        supabase
          .from("lessons")
          .select("id,subject,grade,topic,duration,created_at,is_published,published_at,worksheet")
          .eq("is_published", true)
          .eq("grade", profile.grade || "")
          .order("published_at", { ascending: false }),
        supabase
          .from("lesson_submissions")
          .select(
            "id,lesson_id,student_id,student_name,grade,worksheet_answers,homework_answer,worksheet_submitted_at,homework_submitted_at,ai_worksheet_score,ai_worksheet_grade,ai_worksheet_feedback,ai_worksheet_breakdown,ai_worksheet_graded_at,ai_homework_understanding_level,ai_homework_understanding_score,ai_homework_feedback,ai_homework_evaluated_at,submitted_at,updated_at",
          )
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: false }),
        supabase
          .from("quiz_practice_attempts")
          .select("id,lesson_id,student_id,answers,updated_at")
          .eq("student_id", user.id)
          .order("updated_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (lessonResult.error || submissionResult.error || quizResult.error) {
        toast.error(
          lessonResult.error?.message ||
            submissionResult.error?.message ||
            quizResult.error?.message ||
            "Unable to load analytics",
        );
        setState("error");
        return;
      }
      setLessons((lessonResult.data || []) as LessonRow[]);
      setSubmissions(((submissionResult.data || []) as SubmissionRow[]).filter(isRealSubmission));
      setQuizAttempts((quizResult.data || []) as QuizAttemptRow[]);
      setStudentProfiles([]);
      setState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, profile, user]);

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      {state === "loading" ? (
        <AnalyticsLoading />
      ) : state === "error" ? (
        <AnalyticsError />
      ) : profile?.role === "teacher" ? (
        <TeacherAnalytics
          lessons={lessons}
          submissions={submissions}
          studentProfiles={studentProfiles}
        />
      ) : (
        <StudentAnalytics lessons={lessons} submissions={submissions} quizAttempts={quizAttempts} />
      )}
    </div>
  );
}

function isRealSubmission(submission: SubmissionRow) {
  return Boolean(submission.worksheet_submitted_at || submission.homework_submitted_at);
}

function AnalyticsLoading() {
  return (
    <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div
        className="rounded-3xl border border-white/10 p-10 text-center"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <Loader2 className="w-8 h-8 animate-spin text-blue-300 mx-auto mb-3" />
        <p className="text-white font-semibold">Loading analytics...</p>
      </div>
    </main>
  );
}

function AnalyticsError() {
  return (
    <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="rounded-3xl border border-red-300/20 p-10 text-center bg-red-500/10">
        <p className="text-white font-semibold">Analytics could not be loaded.</p>
        <p className="text-blue-200 text-sm mt-2">Please refresh once and try again.</p>
      </div>
    </main>
  );
}

function TeacherAnalytics({
  lessons,
  submissions,
  studentProfiles,
}: {
  lessons: LessonRow[];
  submissions: SubmissionRow[];
  studentProfiles: StudentProfileRow[];
}) {
  const navigate = useNavigate();
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [lessonFilter, setLessonFilter] = useState("all");
  const [selectedHotspotLessonId, setSelectedHotspotLessonId] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const lessonById = useMemo(
    () => new Map(lessons.map((lesson) => [lesson.id, lesson])),
    [lessons],
  );
  const grades = useMemo(() => uniqueSorted(lessons.map((lesson) => lesson.grade)), [lessons]);
  const subjects = useMemo(() => uniqueSorted(lessons.map((lesson) => lesson.subject)), [lessons]);
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const gradeOk = gradeFilter === "all" || lesson.grade === gradeFilter;
      const subjectOk = subjectFilter === "all" || lesson.subject === subjectFilter;
      const lessonOk = lessonFilter === "all" || lesson.id === lessonFilter;
      return gradeOk && subjectOk && lessonOk;
    });
  }, [gradeFilter, lessonFilter, lessons, subjectFilter]);
  const filteredLessonIds = useMemo(
    () => new Set(filteredLessons.map((lesson) => lesson.id)),
    [filteredLessons],
  );
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => filteredLessonIds.has(submission.lesson_id));
  }, [filteredLessonIds, submissions]);
  const worksheetScores = filteredSubmissions.map((s) => s.ai_worksheet_score).filter(isNumber);
  const homeworkScores = filteredSubmissions
    .map((s) => s.ai_homework_understanding_score)
    .filter(isNumber);
  const uniqueStudents = new Set(filteredSubmissions.map((s) => s.student_id)).size;
  const publishedLessons = filteredLessons.filter((lesson) => lesson.is_published).length;
  const avgWorksheet = average(worksheetScores);
  const avgHomework = average(homeworkScores);
  const lessonRows = useMemo(() => {
    return filteredLessons
      .map((lesson) => {
        const lessonSubmissions = filteredSubmissions.filter(
          (submission) => submission.lesson_id === lesson.id,
        );
        return {
          id: lesson.id,
          name: titleCase(lesson.topic),
          grade: lesson.grade,
          submissions: lessonSubmissions.length,
          worksheet: average(lessonSubmissions.map((s) => s.ai_worksheet_score).filter(isNumber)),
          homework: average(
            lessonSubmissions.map((s) => s.ai_homework_understanding_score).filter(isNumber),
          ),
        };
      })
      .filter((row) => row.submissions > 0 || filteredLessons.length <= 6)
      .slice(0, 8);
  }, [filteredLessons, filteredSubmissions]);
  const lessonsWithSubmissions = useMemo(() => {
    return filteredLessons.filter((lesson) =>
      filteredSubmissions.some((submission) => submission.lesson_id === lesson.id),
    );
  }, [filteredLessons, filteredSubmissions]);
  useEffect(() => {
    if (
      selectedHotspotLessonId &&
      !lessonsWithSubmissions.some((lesson) => lesson.id === selectedHotspotLessonId)
    ) {
      setSelectedHotspotLessonId(lessonsWithSubmissions[0]?.id || "");
      return;
    }
    if (!selectedHotspotLessonId && lessonsWithSubmissions[0]) {
      setSelectedHotspotLessonId(lessonsWithSubmissions[0].id);
    }
  }, [lessonsWithSubmissions, selectedHotspotLessonId]);
  const selectedHotspotLesson = lessonById.get(selectedHotspotLessonId);
  const selectedLessonSubmissions = useMemo(() => {
    if (!selectedHotspotLessonId) return [];
    return filteredSubmissions.filter(
      (submission) => submission.lesson_id === selectedHotspotLessonId,
    );
  }, [filteredSubmissions, selectedHotspotLessonId]);
  const selectedLessonQuestionText = useMemo(() => {
    return buildWorksheetQuestionTextMap(selectedHotspotLesson?.worksheet);
  }, [selectedHotspotLesson?.worksheet]);
  const studentsNeedingAttention = useMemo(
    () => buildAtRiskStudents(filteredSubmissions),
    [filteredSubmissions],
  );
  const questionInsights = useMemo(
    () => buildQuestionInsights(selectedLessonSubmissions, selectedLessonQuestionText),
    [selectedLessonQuestionText, selectedLessonSubmissions],
  );
  const homeworkUnderstanding = useMemo(
    () => buildHomeworkUnderstanding(filteredSubmissions),
    [filteredSubmissions],
  );
  const studentRows = useMemo(
    () => buildStudentAnalyticsRows(filteredSubmissions, lessonById),
    [filteredSubmissions, lessonById],
  );
  const pendingSubmissions = useMemo(
    () => buildPendingSubmissions(filteredLessons, filteredSubmissions, studentProfiles),
    [filteredLessons, filteredSubmissions, studentProfiles],
  );
  const strugglingTopics = useMemo(
    () => buildStrugglingTopics(filteredLessons, filteredSubmissions),
    [filteredLessons, filteredSubmissions],
  );
  const filtersActive = gradeFilter !== "all" || subjectFilter !== "all" || lessonFilter !== "all";
  const resetFilters = () => {
    setGradeFilter("all");
    setSubjectFilter("all");
    setLessonFilter("all");
  };

  return (
    <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <DashboardHeader
        label="Teacher Analytics"
        title="Class Insight Dashboard"
        description="Track lesson reach, AI marking, homework understanding, and students who may need support."
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate({ to: "/submissions" })}
              className="dashboard-action"
            >
              <ClipboardCheck className="w-4 h-4" /> Submissions
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/library" })}
              className="dashboard-action"
            >
              <BookOpen className="w-4 h-4" /> Library
            </button>
          </>
        }
      />

      <section
        className="rounded-3xl border border-white/10 p-4 sm:p-5 mb-6"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <AnalyticsFilter
            label="Grade"
            value={gradeFilter}
            onChange={setGradeFilter}
            options={grades}
            allLabel="All grades"
          />
          <AnalyticsFilter
            label="Subject"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={subjects}
            allLabel="All subjects"
          />
          <label className="block">
            <span className="block text-sm text-blue-200 mb-2">Lesson</span>
            <select
              value={lessonFilter}
              onChange={(event) => setLessonFilter(event.target.value)}
              className="w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-blue-300/60"
            >
              <option value="all">All lessons</option>
              {lessons
                .filter(
                  (lesson) =>
                    (gradeFilter === "all" || lesson.grade === gradeFilter) &&
                    (subjectFilter === "all" || lesson.subject === subjectFilter),
                )
                .map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {titleCase(lesson.topic)} - {lesson.grade}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!filtersActive}
            className="rounded-2xl border border-white/15 px-4 py-3 text-white font-semibold disabled:opacity-40 hover:bg-white/10"
          >
            Reset Filters
          </button>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={<BookOpen />}
          label="Lessons"
          value={filteredLessons.length}
          detail={`${publishedLessons} published`}
        />
        <MetricCard
          icon={<Users />}
          label="Students Reached"
          value={uniqueStudents}
          detail="With submitted work"
        />
        <MetricCard
          icon={<Target />}
          label="Avg Worksheet"
          value={formatScore(avgWorksheet)}
          detail="AI worksheet marks"
        />
        <MetricCard
          icon={<TrendingUp />}
          label="Avg Homework"
          value={formatScore(avgHomework, "/5")}
          detail="Understanding score"
        />
      </div>

      <PendingSubmissionsPanel rows={pendingSubmissions} />

      <StrugglingTopicsPanel rows={strugglingTopics} />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <ChartPanel title="Lesson Performance" subtitle="Average scores by lesson">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={lessonRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#bfdbfe", fontSize: 11 }}
                interval={0}
                angle={-12}
                height={70}
              />
              <YAxis tick={{ fill: "#bfdbfe", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="worksheet" fill="#38bdf8" radius={[6, 6, 0, 0]} name="Worksheet" />
              <Bar dataKey="homework" fill="#34d399" radius={[6, 6, 0, 0]} name="Homework" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          title="Questions Students Struggled With"
          subtitle={
            selectedHotspotLesson
              ? `Only for ${titleCase(selectedHotspotLesson.topic)}`
              : "Choose a lesson to view question-level insight"
          }
        >
          <select
            value={selectedHotspotLessonId}
            onChange={(event) => setSelectedHotspotLessonId(event.target.value)}
            className="mb-4 w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-blue-300/60"
          >
            {lessonsWithSubmissions.length === 0 ? (
              <option value="">No submitted lessons yet</option>
            ) : (
              lessonsWithSubmissions.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {titleCase(lesson.topic)} - {lesson.grade}
                </option>
              ))
            )}
          </select>
          <div className="space-y-3">
            {questionInsights.length === 0 ? (
              <EmptyInsight text="Question-level AI breakdown will appear here after this lesson has worksheet grading." />
            ) : (
              questionInsights.slice(0, 5).map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-white/10 bg-slate-950/20 p-3"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white font-semibold">Q{item.q}</span>
                    <span className="text-blue-200">{item.averagePercent}% average</span>
                  </div>
                  {item.questionText && (
                    <p className="mt-2 text-sm text-white/80 line-clamp-2">{item.questionText}</p>
                  )}
                  <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-400"
                      style={{ width: `${item.averagePercent}%` }}
                    />
                  </div>
                  {item.feedback && <p className="mt-2 text-xs text-white/60">{item.feedback}</p>}
                </div>
              ))
            )}
          </div>
        </ChartPanel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <InsightPanel title="Students Needing Attention">
          {studentsNeedingAttention.length === 0 ? (
            <EmptyInsight text="No weak signals yet. New submissions will make this smarter." />
          ) : (
            studentsNeedingAttention.map((student) => (
              <div key={student.id} className="dashboard-list-row">
                <div>
                  <p className="text-white font-semibold">{student.name}</p>
                  <p className="text-blue-200 text-xs">{student.reason}</p>
                </div>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                  {student.score}
                </span>
              </div>
            ))
          )}
        </InsightPanel>

        <InsightPanel title="Homework Understanding">
          {homeworkUnderstanding.length === 0 ? (
            <EmptyInsight text="Homework understanding levels will appear after homework is evaluated." />
          ) : (
            homeworkUnderstanding.map((item) => (
              <div key={item.level} className="dashboard-list-row">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white font-semibold">{item.level}</span>
                    <span className="text-blue-200">
                      {item.count} student{item.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                  {item.percent}%
                </span>
              </div>
            ))
          )}
        </InsightPanel>
      </div>

      <section
        className="rounded-3xl border border-white/10 p-5 mt-5"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-white text-xl font-bold">Student-wise Analytics</h2>
            <p className="text-blue-300 text-sm mt-1">A quick progress view for each student.</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-blue-200">
            {studentRows.length} student{studentRows.length === 1 ? "" : "s"}
          </span>
        </div>

        {studentRows.length === 0 ? (
          <EmptyInsight text="Student analytics will appear after students submit worksheet or homework." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs text-blue-300">
                  <th className="px-4 py-2 font-semibold">Student</th>
                  <th className="px-4 py-2 font-semibold">Submissions</th>
                  <th className="px-4 py-2 font-semibold">Worksheet Avg</th>
                  <th className="px-4 py-2 font-semibold">Homework Avg</th>
                  <th className="px-4 py-2 font-semibold">Latest Activity</th>
                  <th className="px-4 py-2 font-semibold">Weak Signal</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((student) => {
                  const isExpanded = expandedStudentId === student.id;
                  return (
                    <>
                      <tr key={student.id} className="text-sm">
                        <td className="rounded-l-2xl border-y border-l border-white/10 bg-slate-950/20 px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                            className="flex w-full items-center gap-2 text-left"
                          >
                            <ChevronDown
                              className={`w-4 h-4 text-blue-200 transition ${isExpanded ? "rotate-180" : ""}`}
                            />
                            <span>
                              <span className="block text-white font-semibold">{student.name}</span>
                              <span className="block text-blue-200/70 text-xs">
                                {student.grade}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="border-y border-white/10 bg-slate-950/20 px-4 py-3 text-white/80">
                          {student.submissions}
                        </td>
                        <td className="border-y border-white/10 bg-slate-950/20 px-4 py-3">
                          <ScorePill value={student.worksheetAvg} />
                        </td>
                        <td className="border-y border-white/10 bg-slate-950/20 px-4 py-3">
                          <ScorePill value={student.homeworkAvg} suffix="/5" />
                        </td>
                        <td className="border-y border-white/10 bg-slate-950/20 px-4 py-3 text-blue-100">
                          {formatDate(student.latestActivity)}
                        </td>
                        <td className="rounded-r-2xl border-y border-r border-white/10 bg-slate-950/20 px-4 py-3">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${student.weakSignal === "On track" ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-amber-300/30 bg-amber-400/10 text-amber-100"}`}
                          >
                            {student.weakSignal}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${student.id}-details`}>
                          <td
                            colSpan={6}
                            className="rounded-2xl border border-blue-300/15 bg-blue-500/5 px-4 py-4"
                          >
                            <StudentLessonBreakdown rows={student.lessonRows} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StudentAnalytics({
  lessons,
  submissions,
  quizAttempts,
}: {
  lessons: LessonRow[];
  submissions: SubmissionRow[];
  quizAttempts: QuizAttemptRow[];
}) {
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState("all");
  const subjects = useMemo(() => uniqueSorted(lessons.map((lesson) => lesson.subject)), [lessons]);
  const filteredLessons = useMemo(() => {
    return subjectFilter === "all"
      ? lessons
      : lessons.filter((lesson) => lesson.subject === subjectFilter);
  }, [lessons, subjectFilter]);
  const filteredLessonIds = useMemo(
    () => new Set(filteredLessons.map((lesson) => lesson.id)),
    [filteredLessons],
  );
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => filteredLessonIds.has(submission.lesson_id));
  }, [filteredLessonIds, submissions]);
  const filteredQuizAttempts = useMemo(() => {
    return quizAttempts.filter((attempt) => filteredLessonIds.has(attempt.lesson_id));
  }, [filteredLessonIds, quizAttempts]);
  const lessonById = useMemo(
    () => new Map(filteredLessons.map((lesson) => [lesson.id, lesson])),
    [filteredLessons],
  );
  const worksheetScores = filteredSubmissions.map((s) => s.ai_worksheet_score).filter(isNumber);
  const homeworkScores = filteredSubmissions
    .map((s) => s.ai_homework_understanding_score)
    .filter(isNumber);
  const completedLessons = new Set(filteredSubmissions.map((s) => s.lesson_id)).size;
  const worksheetSubmitted = filteredSubmissions.filter((s) => s.worksheet_submitted_at).length;
  const homeworkSubmitted = filteredSubmissions.filter((s) => s.homework_submitted_at).length;
  const quizAnsweredCount = filteredQuizAttempts.reduce(
    (sum, attempt) => sum + Object.values(attempt.answers || {}).filter(Boolean).length,
    0,
  );
  const studentGuidance = useMemo(
    () => buildStudentGuidance(filteredSubmissions, lessonById, filteredLessons.length),
    [filteredLessons.length, filteredSubmissions, lessonById],
  );
  const topicPerformance = useMemo(
    () => buildStudentTopicPerformance(filteredSubmissions, lessonById),
    [filteredSubmissions, lessonById],
  );
  const trend = filteredSubmissions
    .filter((submission) => isNumber(submission.ai_worksheet_score))
    .slice()
    .reverse()
    .map((submission, index) => ({
      name: lessonById.get(submission.lesson_id)?.topic
        ? titleCase(lessonById.get(submission.lesson_id)!.topic).slice(0, 16)
        : `Lesson ${index + 1}`,
      score: submission.ai_worksheet_score,
    }));

  return (
    <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <DashboardHeader
        label="Student Analytics"
        title="Your Progress Dashboard"
        description="See your completed lessons, worksheet performance, quiz practice, and homework understanding."
        actions={
          <button
            type="button"
            onClick={() => navigate({ to: "/student" })}
            className="dashboard-action"
          >
            <GraduationCap className="w-4 h-4" /> My Lessons
          </button>
        }
      />

      <section
        className="rounded-3xl border border-white/10 p-4 sm:p-5 mb-6"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
          <AnalyticsFilter
            label="Subject"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={subjects}
            allLabel="All subjects"
          />
          <button
            type="button"
            onClick={() => setSubjectFilter("all")}
            disabled={subjectFilter === "all"}
            className="rounded-2xl border border-white/15 px-4 py-3 text-white font-semibold disabled:opacity-40 hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          icon={<BookOpen />}
          label="Assigned Lessons"
          value={filteredLessons.length}
          detail={`${completedLessons} opened/submitted`}
        />
        <MetricCard
          icon={<ClipboardCheck />}
          label="Worksheets"
          value={worksheetSubmitted}
          detail="Submitted"
        />
        <MetricCard
          icon={<CheckCircle2 />}
          label="Homework"
          value={homeworkSubmitted}
          detail="Submitted"
        />
        <MetricCard
          icon={<Target />}
          label="Quiz Practice"
          value={quizAnsweredCount}
          detail="MCQs answered"
        />
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5">
        <ChartPanel title="Worksheet Score Trend" subtitle="AI graded worksheet marks over time">
          {trend.length === 0 ? (
            <EmptyInsight text="Your score trend will appear after your first worksheet is graded." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.10)" />
                <XAxis dataKey="name" tick={{ fill: "#bfdbfe", fontSize: 11 }} />
                <YAxis tick={{ fill: "#bfdbfe", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  name="Score"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <InsightPanel title="Your Averages">
          <AverageRow label="Worksheet average" value={formatScore(average(worksheetScores))} />
          <AverageRow
            label="Homework understanding"
            value={formatScore(average(homeworkScores), "/5")}
          />
          <AverageRow
            label="Lessons completed"
            value={`${completedLessons}/${filteredLessons.length || 0}`}
          />
          <AverageRow label="Quiz practice attempts" value={String(filteredQuizAttempts.length)} />
        </InsightPanel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <InsightPanel title="Your Strengths">
          {studentGuidance.strengths.length === 0 ? (
            <EmptyInsight text="Strengths will appear after AI evaluates your worksheet or homework." />
          ) : (
            studentGuidance.strengths.map((item) => (
              <GuidanceItem key={item} tone="good" text={item} />
            ))
          )}
        </InsightPanel>

        <InsightPanel title="Needs Practice">
          {studentGuidance.weakAreas.length === 0 ? (
            <EmptyInsight text="No clear weak areas yet. Keep submitting work to build your progress profile." />
          ) : (
            studentGuidance.weakAreas.map((item) => (
              <GuidanceItem key={item} tone="needs" text={item} />
            ))
          )}
        </InsightPanel>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <TopicPerformancePanel
          title="Topics You Are Performing Good In"
          rows={topicPerformance.good}
          tone="good"
        />
        <TopicPerformancePanel
          title="Topics That Need Improvement"
          rows={topicPerformance.needsImprovement}
          tone="needs"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <InsightPanel title="Recent Feedback">
          {filteredSubmissions.slice(0, 5).map((submission) => {
            const lesson = lessonById.get(submission.lesson_id);
            const feedback = submission.ai_worksheet_feedback || submission.ai_homework_feedback;
            return (
              <div
                key={submission.id}
                className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white font-semibold">
                    {lesson ? titleCase(lesson.topic) : "Lesson"}
                  </p>
                  <span className="text-xs text-blue-200">
                    {formatDate(submission.updated_at || submission.submitted_at)}
                  </span>
                </div>
                <p className="text-white/75 text-sm mt-2">
                  {feedback || "Submitted. Feedback will appear after evaluation."}
                </p>
              </div>
            );
          })}
          {filteredSubmissions.length === 0 && (
            <EmptyInsight text="Feedback will appear after you submit worksheet or homework." />
          )}
        </InsightPanel>

        <InsightPanel title="Next Useful Actions">
          {studentGuidance.nextActions.map((item) => (
            <ActionHint key={item} text={item} />
          ))}
        </InsightPanel>
      </div>
    </main>
  );
}

function DashboardHeader({
  label,
  title,
  description,
  actions,
}: {
  label: string;
  title: string;
  description: string;
  actions: React.ReactNode;
}) {
  return (
    <section className="library-hero rounded-3xl border border-white/10 p-6 sm:p-8 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="text-blue-200 text-sm font-semibold">{label}</p>
          <h1 className="text-white text-3xl sm:text-4xl font-bold mt-2">{title}</h1>
          <p className="text-blue-200 mt-2 max-w-2xl">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">{actions}</div>
      </div>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactElement;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <section
      className="rounded-3xl border border-white/10 p-5"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 border border-blue-300/20">
          {icon}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{value}</div>
          <div className="text-xs text-blue-300">{label}</div>
        </div>
      </div>
      <p className="text-sm text-white/65 mt-4">{detail}</p>
    </section>
  );
}

function AnalyticsFilter({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-blue-200 mb-2">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/15 bg-slate-900/80 px-4 py-3 text-white outline-none focus:border-blue-300/60"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border border-white/10 p-5"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <h2 className="text-white text-xl font-bold">{title}</h2>
      <p className="text-blue-300 text-sm mt-1 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

function InsightPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-3xl border border-white/10 p-5"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function PendingSubmissionsPanel({
  rows,
}: {
  rows: Array<{
    lessonId: string;
    lessonTitle: string;
    grade: string;
    totalStudents: number;
    missingWorksheet: StudentProfileRow[];
    missingHomework: StudentProfileRow[];
  }>;
}) {
  const pendingCount = rows.reduce(
    (sum, row) => sum + row.missingWorksheet.length + row.missingHomework.length,
    0,
  );
  return (
    <section
      className="rounded-3xl border border-white/10 p-5 mb-6"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white text-xl font-bold">Pending Submissions</h2>
          <p className="text-blue-300 text-sm mt-1">
            Published lessons where students still need to submit worksheet or homework.
          </p>
        </div>
        <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold text-amber-100">
          {pendingCount} pending
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyInsight text="No pending submissions for the current filters." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {rows.slice(0, 6).map((row) => (
            <div
              key={row.lessonId}
              className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold">{row.lessonTitle}</p>
                  <p className="text-blue-200 text-sm mt-1">
                    {row.grade} · {row.totalStudents} student{row.totalStudents === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="rounded-full border border-blue-300/30 bg-blue-400/10 px-3 py-1 text-xs text-blue-100">
                  {row.missingWorksheet.length + row.missingHomework.length} missing
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <PendingList label="Worksheet" students={row.missingWorksheet} />
                <PendingList label="Homework" students={row.missingHomework} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StrugglingTopicsPanel({
  rows,
}: {
  rows: Array<{
    lessonId: string;
    topic: string;
    grade: string;
    subject: string;
    averageScore: number | null;
    submissions: number;
    level: "High" | "Medium" | "Low";
  }>;
}) {
  return (
    <section
      className="rounded-3xl border border-white/10 p-5 mb-6"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-white text-xl font-bold">Topics Students Are Struggling With</h2>
          <p className="text-blue-300 text-sm mt-1">
            Calculated from the lowest average worksheet marks by lesson.
          </p>
        </div>
        <span className="rounded-full border border-red-300/25 bg-red-500/10 px-4 py-1.5 text-sm font-semibold text-red-200">
          Worksheet based
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyInsight text="Struggling topics will appear after worksheets are submitted and graded." />
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {rows.slice(0, 6).map((row) => (
            <div
              key={row.lessonId}
              className="rounded-2xl border border-white/10 bg-slate-950/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-bold">{row.topic}</p>
                  <p className="text-blue-200 text-sm mt-1">
                    {row.subject} · {row.grade}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    row.level === "High"
                      ? "border-red-300/25 bg-red-500/10 text-red-200"
                      : row.level === "Medium"
                        ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
                        : "border-blue-300/30 bg-blue-400/10 text-blue-100"
                  }`}
                >
                  {row.level}
                </span>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold text-white">{formatScore(row.averageScore)}</p>
                  <p className="text-blue-200 text-xs mt-1">avg worksheet score</p>
                </div>
                <p className="text-white/65 text-sm">
                  {row.submissions} submission{row.submissions === 1 ? "" : "s"}
                </p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.level === "High" ? "bg-red-400" : row.level === "Medium" ? "bg-amber-400" : "bg-blue-400"}`}
                  style={{
                    width: `${Math.min(100, Math.max(0, ((row.averageScore || 0) / 10) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PendingList({ label, students }: { label: string; students: StudentProfileRow[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-blue-200 text-xs font-semibold">{label}</p>
        <span className="text-white text-xs font-bold">{students.length}</span>
      </div>
      {students.length === 0 ? (
        <p className="mt-3 text-xs text-emerald-200">All submitted</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {students.slice(0, 4).map((student) => (
            <span
              key={student.id}
              className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2.5 py-1 text-xs text-amber-100"
            >
              {student.display_name || "Student"}
            </span>
          ))}
          {students.length > 4 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
              +{students.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TopicPerformancePanel({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Array<{
    lessonId: string;
    topic: string;
    subject: string;
    worksheetScore: number | null;
    homeworkScore: number | null;
    reason: string;
  }>;
  tone: "good" | "needs";
}) {
  const good = tone === "good";
  return (
    <InsightPanel title={title}>
      {rows.length === 0 ? (
        <EmptyInsight
          text={
            good
              ? "Strong topics will appear after your work is evaluated."
              : "Improvement topics will appear after your work is evaluated."
          }
        />
      ) : (
        rows.slice(0, 5).map((row) => (
          <div
            key={row.lessonId}
            className={`rounded-2xl border p-4 ${good ? "border-emerald-300/20 bg-emerald-400/10" : "border-amber-300/20 bg-amber-400/10"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-white font-bold">{row.topic}</p>
                <p className="text-blue-200 text-sm mt-1">{row.subject}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ScorePill value={row.worksheetScore} />
                <ScorePill value={row.homeworkScore} suffix="/5" />
              </div>
            </div>
            <p className="mt-3 text-sm text-white/75">{row.reason}</p>
          </div>
        ))
      )}
    </InsightPanel>
  );
}

function EmptyInsight({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-white/10 bg-slate-950/20 p-4 text-sm text-white/60">
      {text}
    </p>
  );
}

function AverageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-list-row">
      <span className="text-blue-100">{label}</span>
      <span className="text-white font-bold">{value}</span>
    </div>
  );
}

function ScorePill({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const isWeak = value != null && (suffix === "/5" ? value <= 2 : value < 5);
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${isWeak ? "border-amber-300/30 bg-amber-400/10 text-amber-100" : "border-blue-300/30 bg-blue-400/10 text-blue-100"}`}
    >
      {formatScore(value, suffix)}
    </span>
  );
}

function StudentLessonBreakdown({
  rows,
}: {
  rows: Array<{
    id: string;
    lessonTitle: string;
    worksheetScore: number | null;
    homeworkScore: number | null;
    worksheetFeedback: string;
    homeworkFeedback: string;
    weakQuestions: Array<{
      q: string;
      averagePercent: number;
      questionText: string;
      feedback?: string;
    }>;
    latestActivity: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-white font-bold">{row.lessonTitle}</h3>
              <p className="text-blue-200 text-xs mt-1">
                Latest activity {formatDate(row.latestActivity)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ScorePill value={row.worksheetScore} />
              <ScorePill value={row.homeworkScore} suffix="/5" />
            </div>
          </div>

          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-blue-200 text-xs font-semibold mb-2">Worksheet Feedback</p>
              <p className="text-white/75 text-sm">
                {row.worksheetFeedback || "No worksheet feedback yet."}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-blue-200 text-xs font-semibold mb-2">Homework Feedback</p>
              <p className="text-white/75 text-sm">
                {row.homeworkFeedback || "No homework feedback yet."}
              </p>
            </div>
          </div>

          {row.weakQuestions.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3">
              <p className="text-amber-100 text-xs font-semibold mb-2">Weak Questions</p>
              <div className="space-y-2">
                {row.weakQuestions.slice(0, 3).map((item) => (
                  <div key={item.q} className="text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white font-semibold">Q{item.q}</span>
                      <span className="text-amber-100">{item.averagePercent}%</span>
                    </div>
                    {item.questionText && <p className="text-white/70 mt-1">{item.questionText}</p>}
                    {item.feedback && <p className="text-white/50 text-xs mt-1">{item.feedback}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActionHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/20 p-4">
      <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />
      <p className="text-white/80 text-sm">{text}</p>
    </div>
  );
}

function GuidanceItem({ text, tone }: { text: string; tone: "good" | "needs" }) {
  const good = tone === "good";
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${good ? "border-emerald-300/20 bg-emerald-400/10" : "border-amber-300/20 bg-amber-400/10"}`}
    >
      <CheckCircle2
        className={`w-5 h-5 shrink-0 mt-0.5 ${good ? "text-emerald-300" : "text-amber-300"}`}
      />
      <p className="text-white/85 text-sm">{text}</p>
    </div>
  );
}

function buildAtRiskStudents(submissions: SubmissionRow[]) {
  const byStudent = new Map<string, SubmissionRow[]>();
  submissions.forEach((submission) => {
    const list = byStudent.get(submission.student_id) || [];
    list.push(submission);
    byStudent.set(submission.student_id, list);
  });

  return Array.from(byStudent.entries())
    .map(([id, rows]) => {
      const worksheetAvg = average(rows.map((row) => row.ai_worksheet_score).filter(isNumber));
      const homeworkAvg = average(
        rows.map((row) => row.ai_homework_understanding_score).filter(isNumber),
      );
      const name = rows[0]?.student_name || "Student";
      if (worksheetAvg != null && worksheetAvg < 5) {
        return { id, name, score: formatScore(worksheetAvg), reason: "Low worksheet average" };
      }
      if (homeworkAvg != null && homeworkAvg <= 2) {
        return { id, name, score: `${homeworkAvg}/5`, reason: "Low homework understanding" };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 6) as Array<{ id: string; name: string; score: string; reason: string }>;
}

function buildStudentAnalyticsRows(
  submissions: SubmissionRow[],
  lessonById: Map<string, LessonRow>,
) {
  const byStudent = new Map<string, SubmissionRow[]>();
  submissions.forEach((submission) => {
    const list = byStudent.get(submission.student_id) || [];
    list.push(submission);
    byStudent.set(submission.student_id, list);
  });

  return Array.from(byStudent.entries())
    .map(([id, rows]) => {
      const worksheetAvg = average(rows.map((row) => row.ai_worksheet_score).filter(isNumber));
      const homeworkAvg = average(
        rows.map((row) => row.ai_homework_understanding_score).filter(isNumber),
      );
      const latestActivity = rows
        .map((row) => row.updated_at || row.submitted_at)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const lessonRows = rows
        .slice()
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.submitted_at).getTime() -
            new Date(a.updated_at || a.submitted_at).getTime(),
        )
        .map((row) => {
          const lesson = lessonById.get(row.lesson_id);
          const questionText = buildWorksheetQuestionTextMap(lesson?.worksheet);
          return {
            id: row.id,
            lessonTitle: lesson
              ? `${titleCase(lesson.topic)} - ${lesson.grade}`
              : row.grade || "Lesson",
            worksheetScore: row.ai_worksheet_score,
            homeworkScore: row.ai_homework_understanding_score,
            worksheetFeedback: row.ai_worksheet_feedback,
            homeworkFeedback: row.ai_homework_feedback,
            weakQuestions: buildQuestionInsights([row], questionText).filter(
              (item) => item.averagePercent < 60,
            ),
            latestActivity: row.updated_at || row.submitted_at,
          };
        });
      return {
        id,
        name: rows[0]?.student_name || "Student",
        grade: rows[0]?.grade || "",
        submissions: rows.length,
        worksheetAvg,
        homeworkAvg,
        latestActivity,
        weakSignal: getStudentWeakSignal(worksheetAvg, homeworkAvg),
        lessonRows,
      };
    })
    .sort((a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime());
}

function buildPendingSubmissions(
  lessons: LessonRow[],
  submissions: SubmissionRow[],
  studentProfiles: StudentProfileRow[],
) {
  const studentsByGrade = new Map<string, StudentProfileRow[]>();
  studentProfiles
    .filter((student) => student.role === "student" && student.grade)
    .forEach((student) => {
      const grade = student.grade || "";
      const list = studentsByGrade.get(grade) || [];
      list.push(student);
      studentsByGrade.set(grade, list);
    });

  const submissionsByLessonStudent = new Map<string, SubmissionRow>();
  submissions.forEach((submission) => {
    submissionsByLessonStudent.set(`${submission.lesson_id}:${submission.student_id}`, submission);
  });

  return lessons
    .filter((lesson) => lesson.is_published)
    .map((lesson) => {
      const students = studentsByGrade.get(lesson.grade) || [];
      const missingWorksheet = students.filter((student) => {
        const submission = submissionsByLessonStudent.get(`${lesson.id}:${student.id}`);
        return !submission?.worksheet_submitted_at;
      });
      const missingHomework = students.filter((student) => {
        const submission = submissionsByLessonStudent.get(`${lesson.id}:${student.id}`);
        return !submission?.homework_submitted_at;
      });
      return {
        lessonId: lesson.id,
        lessonTitle: titleCase(lesson.topic),
        grade: lesson.grade,
        totalStudents: students.length,
        missingWorksheet,
        missingHomework,
      };
    })
    .filter(
      (row) =>
        row.totalStudents > 0 &&
        (row.missingWorksheet.length > 0 || row.missingHomework.length > 0),
    )
    .sort(
      (a, b) =>
        b.missingWorksheet.length +
        b.missingHomework.length -
        (a.missingWorksheet.length + a.missingHomework.length),
    );
}

function buildStrugglingTopics(lessons: LessonRow[], submissions: SubmissionRow[]) {
  return lessons
    .map((lesson) => {
      const lessonSubmissions = submissions.filter(
        (submission) => submission.lesson_id === lesson.id,
      );
      const worksheetScores = lessonSubmissions
        .map((submission) => submission.ai_worksheet_score)
        .filter(isNumber);
      const averageScore = average(worksheetScores);
      return {
        lessonId: lesson.id,
        topic: titleCase(lesson.topic),
        grade: lesson.grade,
        subject: lesson.subject,
        averageScore,
        submissions: worksheetScores.length,
        level: getTopicStruggleLevel(averageScore),
      };
    })
    .filter((row) => row.submissions > 0 && row.averageScore != null)
    .sort((a, b) => (a.averageScore ?? 0) - (b.averageScore ?? 0));
}

function getTopicStruggleLevel(score: number | null): "High" | "Medium" | "Low" {
  if (score == null) return "Low";
  if (score < 5) return "High";
  if (score < 7) return "Medium";
  return "Low";
}

function getStudentWeakSignal(worksheetAvg: number | null, homeworkAvg: number | null) {
  if (worksheetAvg != null && worksheetAvg < 5) return "Worksheet needs support";
  if (homeworkAvg != null && homeworkAvg <= 2) return "Homework understanding low";
  if (worksheetAvg == null && homeworkAvg == null) return "Awaiting AI evaluation";
  return "On track";
}

function buildQuestionInsights(
  submissions: SubmissionRow[],
  questionTextByNumber: Map<string, string>,
) {
  const byQuestion = new Map<string, { awarded: number; max: number; feedback: string }[]>();
  submissions.forEach((submission) => {
    (submission.ai_worksheet_breakdown || []).forEach((item) => {
      const q = String(item.q_number || "");
      const awarded = Number(item.marks_awarded);
      const max = Number(item.max_marks);
      if (!q || !Number.isFinite(awarded) || !Number.isFinite(max) || max <= 0) return;
      const list = byQuestion.get(q) || [];
      list.push({ awarded, max, feedback: String(item.feedback || "") });
      byQuestion.set(q, list);
    });
  });
  return Array.from(byQuestion.entries())
    .map(([q, scores]) => {
      const lowFeedback = scores
        .filter((score) => score.awarded < score.max)
        .map((score) => score.feedback)
        .find(Boolean);
      return {
        q,
        questionText: questionTextByNumber.get(q) || "",
        feedback: lowFeedback,
        averagePercent: Math.round(
          average(scores.map((score) => (score.awarded / score.max) * 100)) || 0,
        ),
      };
    })
    .sort((a, b) => a.averagePercent - b.averagePercent);
}

function buildWorksheetQuestionTextMap(worksheet: unknown) {
  const map = new Map<string, string>();
  if (!worksheet || typeof worksheet !== "object") return map;
  const data = worksheet as {
    mcq?: Array<{ q_number?: string | number; question?: unknown }>;
    sections?: Array<{ questions?: Array<{ q_number?: string | number; question?: unknown }> }>;
  };

  const addQuestion = (question: { q_number?: string | number; question?: unknown }) => {
    const qNumber = String(question.q_number || "").trim();
    const text = typeof question.question === "string" ? question.question.trim() : "";
    if (qNumber && text) map.set(qNumber, text);
  };

  (data.mcq || []).forEach(addQuestion);
  (data.sections || []).forEach((section) => {
    (section.questions || []).forEach(addQuestion);
  });
  return map;
}

function buildHomeworkUnderstanding(submissions: SubmissionRow[]) {
  const evaluated = submissions.filter((submission) => submission.ai_homework_evaluated_at);
  if (!evaluated.length) return [];
  const counts = new Map<string, number>();
  evaluated.forEach((submission) => {
    const level = submission.ai_homework_understanding_level || "Not labeled";
    counts.set(level, (counts.get(level) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([level, count]) => ({
      level,
      count,
      percent: Math.round((count / evaluated.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

function buildStudentGuidance(
  submissions: SubmissionRow[],
  lessonById: Map<string, LessonRow>,
  assignedLessonCount: number,
) {
  const strengths: string[] = [];
  const weakAreas: string[] = [];
  const nextActions: string[] = [];

  submissions.forEach((submission) => {
    const lesson = lessonById.get(submission.lesson_id);
    const lessonTitle = lesson ? titleCase(lesson.topic) : "a lesson";
    if (submission.ai_worksheet_score != null) {
      if (submission.ai_worksheet_score >= 8) {
        strengths.push(`Strong worksheet performance in ${lessonTitle}.`);
      } else if (submission.ai_worksheet_score < 5) {
        weakAreas.push(`Revise worksheet answers in ${lessonTitle}.`);
      }
    }

    if (submission.ai_homework_understanding_score != null) {
      if (submission.ai_homework_understanding_score >= 4) {
        strengths.push(`Good homework understanding in ${lessonTitle}.`);
      } else if (submission.ai_homework_understanding_score <= 2) {
        weakAreas.push(`Improve homework explanation in ${lessonTitle}.`);
      }
    }

    const questionText = buildWorksheetQuestionTextMap(lesson?.worksheet);
    buildQuestionInsights([submission], questionText)
      .filter((item) => item.averagePercent < 60)
      .slice(0, 2)
      .forEach((item) => {
        weakAreas.push(
          item.questionText
            ? `Practice Q${item.q}: ${item.questionText}`
            : `Practice worksheet question Q${item.q} in ${lessonTitle}.`,
        );
      });
  });

  const submittedWorksheets = submissions.filter(
    (submission) => submission.worksheet_submitted_at,
  ).length;
  const submittedHomework = submissions.filter(
    (submission) => submission.homework_submitted_at,
  ).length;
  if (submittedWorksheets < assignedLessonCount) {
    nextActions.push("Submit pending worksheets for your assigned lessons.");
  }
  if (submittedHomework < assignedLessonCount) {
    nextActions.push("Complete homework responses where pending.");
  }
  if (weakAreas.length > 0) {
    nextActions.push("Start with the Needs Practice items above before moving to the next lesson.");
  }
  if (nextActions.length === 0) {
    nextActions.push("You are up to date. Keep practicing quizzes after each lesson.");
  }

  return {
    strengths: uniqueLimited(strengths, 5),
    weakAreas: uniqueLimited(weakAreas, 5),
    nextActions: uniqueLimited(nextActions, 4),
  };
}

function buildStudentTopicPerformance(
  submissions: SubmissionRow[],
  lessonById: Map<string, LessonRow>,
) {
  const rows = submissions
    .map((submission) => {
      const lesson = lessonById.get(submission.lesson_id);
      if (!lesson) return null;
      const worksheetScore = submission.ai_worksheet_score;
      const homeworkScore = submission.ai_homework_understanding_score;
      const hasWorksheet = isNumber(worksheetScore);
      const hasHomework = isNumber(homeworkScore);
      if (!hasWorksheet && !hasHomework) return null;

      const signals = [
        hasWorksheet ? normalizeScore(worksheetScore, 10) : null,
        hasHomework ? normalizeScore(homeworkScore, 5) : null,
      ].filter(isNumber);
      const combined = average(signals);
      if (combined == null) return null;

      return {
        lessonId: submission.lesson_id,
        topic: titleCase(lesson.topic),
        subject: lesson.subject,
        worksheetScore: hasWorksheet ? worksheetScore : null,
        homeworkScore: hasHomework ? homeworkScore : null,
        combined,
        reason:
          combined >= 70
            ? "You are showing good understanding in this topic."
            : "This topic may need more revision and practice.",
      };
    })
    .filter(Boolean) as Array<{
    lessonId: string;
    topic: string;
    subject: string;
    worksheetScore: number | null;
    homeworkScore: number | null;
    combined: number;
    reason: string;
  }>;

  return {
    good: rows.filter((row) => row.combined >= 70).sort((a, b) => b.combined - a.combined),
    needsImprovement: rows
      .filter((row) => row.combined < 70)
      .sort((a, b) => a.combined - b.combined),
  };
}

function normalizeScore(score: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((score / max) * 100);
}

function uniqueLimited(values: string[], limit: number) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatScore(value: number | null, suffix = "") {
  if (value == null) return "N/A";
  return `${value}${suffix}`;
}

function titleCase(value: string) {
  return value.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const tooltipStyle = {
  background: "rgba(15,32,68,0.96)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "14px",
  color: "white",
};
