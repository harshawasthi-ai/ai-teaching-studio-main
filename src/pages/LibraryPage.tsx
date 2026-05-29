import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Search,
  Trash2,
  Sparkles,
  X,
  Loader2,
  Send,
  ClipboardCheck,
  Lock,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Header, FloatingBlobs } from "@/components/app/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LessonRow {
  id: string;
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  language: string;
  created_at: string;
  is_published?: boolean;
  published_at?: string | null;
}

type SortMode = "newest" | "oldest" | "topic";

export default function LibraryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [lessons, setLessons] = useState<LessonRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [deleteTarget, setDeleteTarget] = useState<LessonRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,subject,grade,topic,duration,language,created_at,is_published,published_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        toast.error(`❌ ${error.message}`);
        setLessons([]);
        return;
      }
      setLessons(data || []);
    })();
  }, [user, authLoading]);

  const filtered = useMemo(() => {
    if (!lessons) return [];
    const q = query.toLowerCase().trim();
    const result = lessons.filter((l) => {
      const matchesSearch =
        !q || [l.subject, l.grade, l.topic].some((f) => f?.toLowerCase().includes(q));
      const matchesSubject = subjectFilter === "all" || l.subject === subjectFilter;
      const matchesGrade = gradeFilter === "all" || l.grade === gradeFilter;
      return matchesSearch && matchesSubject && matchesGrade;
    });
    return [...result].sort((a, b) => {
      if (sortMode === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortMode === "topic") return a.topic.localeCompare(b.topic);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [lessons, query, subjectFilter, gradeFilter, sortMode]);

  const subjects = useMemo(() => uniqueOptions(lessons, "subject"), [lessons]);
  const grades = useMemo(() => uniqueOptions(lessons, "grade"), [lessons]);
  const filtersActive =
    Boolean(query.trim()) ||
    subjectFilter !== "all" ||
    gradeFilter !== "all" ||
    sortMode !== "newest";
  const resetFilters = () => {
    setQuery("");
    setSubjectFilter("all");
    setGradeFilter("all");
    setSortMode("newest");
  };

  const openLesson = async (id: string) => {
    navigate({ to: `/lesson/${id}` });
  };

  const requestDeleteLesson = (lesson: LessonRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(lesson);
  };

  const deleteLesson = async () => {
    if (!deleteTarget) return;
    if (!user) return;
    setDeleting(true);
    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", user.id);
    setDeleting(false);
    if (error) {
      toast.error(`❌ ${error.message}`);
      return;
    }
    setLessons((ls) => ls?.filter((l) => l.id !== deleteTarget.id) ?? []);
    toast.success("✅ Lesson deleted");
    setDeleteTarget(null);
  };

  const togglePublished = async (lesson: LessonRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (lesson.is_published) {
      toast.message("This lesson is already published and locked.");
      return;
    }
    const publishedAt = new Date().toISOString();
    setPublishingId(lesson.id);
    const { error } = await supabase
      .from("lessons")
      .update({
        is_published: true,
        published_at: publishedAt,
      })
      .eq("id", lesson.id)
      .eq("user_id", user.id);
    setPublishingId(null);
    if (error) {
      toast.error(`❌ ${error.message}`);
      return;
    }
    setLessons(
      (current) =>
        current?.map((item) =>
          item.id === lesson.id ? { ...item, is_published: true, published_at: publishedAt } : item,
        ) ?? [],
    );
    toast.success(`✅ Published to ${lesson.grade}. This lesson is now locked.`);
  };

  return (
    <div className="min-h-screen relative">
      <FloatingBlobs />
      <Header />
      <section className="library-hero relative py-12 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-4">
              <div className="library-hero-icon">📚</div>
              <div>
                <h1 className="text-4xl font-bold text-white">My Lesson Library</h1>
                <p className="text-blue-300 mt-2">All your generated lesson kits</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate({ to: "/analytics" })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold border border-white/15 hover:bg-white/10"
            >
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button
              onClick={() => navigate({ to: "/submissions" })}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-white font-semibold border border-white/15 hover:bg-white/10"
            >
              <ClipboardCheck className="w-4 h-4" /> Submissions
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="create-lesson-button inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold"
              style={{
                background: "linear-gradient(135deg,#1E6FD9,#4DA3FF)",
                boxShadow: "0 8px 20px rgba(30,111,217,0.4)",
              }}
            >
              <Sparkles className="w-4 h-4" /> Create New Lesson
            </button>
            <div className="library-stat rounded-2xl border border-white/15 backdrop-blur px-5 py-3 text-center">
              <div className="text-2xl font-bold text-white">{lessons?.length ?? 0}</div>
              <div className="text-xs text-blue-300">Total Lessons</div>
            </div>
          </div>
        </div>
      </section>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="relative mb-8">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject, grade or topic..."
            className="library-search w-full rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </div>

        <div className="library-filters mb-8">
          <FilterSelect
            label="Subject"
            value={subjectFilter}
            onChange={setSubjectFilter}
            options={subjects}
          />
          <FilterSelect
            label="Grade"
            value={gradeFilter}
            onChange={setGradeFilter}
            options={grades}
          />
          <label className="library-filter-field">
            <span>Sort</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="topic">Topic A-Z</option>
            </select>
          </label>
          {filtersActive && (
            <button type="button" onClick={resetFilters} className="library-filter-reset">
              Reset
            </button>
          )}
        </div>

        {lessons === null ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-2xl animate-pulse border border-white/10"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-3xl p-12 text-center border border-white/10 backdrop-blur"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-white font-bold text-xl">
              {query ? "No matches" : "No lessons yet"}
            </h3>
            <p className="text-blue-300 mt-1">
              {query ? "Try a different search." : "Generate your first lesson kit"}
            </p>
            <button
              onClick={() => navigate({ to: "/" })}
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-2xl text-white font-semibold"
              style={{
                background: "linear-gradient(135deg,#1E6FD9,#4DA3FF)",
                boxShadow: "0 8px 20px rgba(30,111,217,0.4)",
              }}
            >
              <Sparkles className="w-4 h-4" /> Create First Lesson
            </button>
          </div>
        ) : (
          <>
            <div className="library-section-heading">
              <div>
                <h2>Recent lessons</h2>
                <p>
                  {filtered.length} lesson kit{filtered.length === 1 ? "" : "s"} ready to open
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((l) => (
                <LessonCard
                  key={l.id}
                  lesson={l}
                  publishing={publishingId === l.id}
                  onOpen={() => openLesson(l.id)}
                  onDelete={(e) => requestDeleteLesson(l, e)}
                  onTogglePublished={(e) => togglePublished(l, e)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {deleteTarget && (
        <DeleteLessonDialog
          lesson={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteLesson}
        />
      )}
    </div>
  );
}

function uniqueOptions(lessons: LessonRow[] | null, key: "subject" | "grade") {
  return Array.from(new Set((lessons || []).map((lesson) => lesson[key]).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="library-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All {label.toLowerCase()}s</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function stripFor(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("science") || s.includes("bio")) return "from-emerald-400 to-teal-500";
  if (s.includes("math")) return "from-blue-400 to-indigo-500";
  if (s.includes("history") || s.includes("social")) return "from-amber-400 to-orange-500";
  if (s.includes("language") || s.includes("english")) return "from-pink-400 to-rose-500";
  return "from-indigo-400 to-violet-500";
}

function LessonCard({
  lesson,
  publishing,
  onOpen,
  onDelete,
  onTogglePublished,
}: {
  lesson: LessonRow;
  publishing: boolean;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePublished: (e: React.MouseEvent) => void;
}) {
  const date = new Date(lesson.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div
      onClick={onOpen}
      className="lesson-card relative rounded-2xl border border-white/10 backdrop-blur p-5 cursor-pointer hover:-translate-y-1 transition overflow-hidden"
    >
      <div
        className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${stripFor(lesson.subject)}`}
      />
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="lesson-card-delete absolute top-3 right-3 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg p-1.5 transition"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <h3 className="text-white font-bold text-lg capitalize pr-8 mb-3">{lesson.topic}</h3>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
          {lesson.subject}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
          {lesson.grade}
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-white/60">
          {lesson.duration}
        </span>
        {lesson.language === "Hindi" && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300">
            Hindi
          </span>
        )}
      </div>
      <div className="text-xs text-blue-300/60 mb-4">{date}</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="lesson-card-action py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90"
        >
          View Lesson
        </button>
        <button
          type="button"
          disabled={publishing || lesson.is_published}
          onClick={onTogglePublished}
          className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm border transition disabled:opacity-60 ${
            lesson.is_published
              ? "text-emerald-200 border-emerald-400/30 bg-emerald-500/15 hover:bg-emerald-500/25"
              : "text-blue-200 border-blue-300/25 bg-white/5 hover:bg-blue-400/10"
          }`}
        >
          {publishing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : lesson.is_published ? (
            <Lock className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {lesson.is_published ? "Published" : "Publish"}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/submissions?lesson=${lesson.id}`;
          }}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-blue-200 font-semibold text-sm border border-blue-300/20 bg-white/5 hover:bg-blue-400/10"
        >
          <ClipboardCheck className="w-4 h-4" />
          View Submissions
        </button>
      </div>
      {lesson.is_published && (
        <div className="mt-3 text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 rounded-xl px-3 py-2">
          Visible to {lesson.grade} students.
        </div>
      )}
    </div>
  );
}

function DeleteLessonDialog({
  lesson,
  deleting,
  onCancel,
  onConfirm,
}: {
  lesson: LessonRow;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Cancel delete"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={deleting ? undefined : onCancel}
      />
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/15 p-6 shadow-2xl"
        style={{ background: "rgba(15,32,68,0.96)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-300 border border-red-400/25">
            <Trash2 className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl p-2 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-white text-xl font-bold mt-5">Delete this lesson?</h2>
        <p className="text-blue-200 text-sm mt-2">
          This will permanently remove{" "}
          <span className="text-white font-semibold">{lesson.topic}</span> from your library.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-5 py-3 rounded-xl text-white font-semibold border border-white/15 hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-semibold bg-red-500 hover:bg-red-400 disabled:opacity-60"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete Lesson
          </button>
        </div>
      </div>
    </div>
  );
}
