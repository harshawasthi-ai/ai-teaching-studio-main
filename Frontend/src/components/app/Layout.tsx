import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Moon, Sun, BookOpen, LogOut, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const isStudent = profile?.role === "student";
  const homeRoute = isStudent ? "/student" : "/";

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl border-b border-white/10 dark:border-white/10 light:border-slate-200"
      style={{ background: theme === "dark" ? "rgba(10,22,40,0.8)" : "rgba(240,244,255,0.8)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to={homeRoute} className="flex items-center gap-3 min-w-0">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-lg shrink-0"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            🎓
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground truncate">AI Teaching Studio</div>
            <div className="text-xs text-blue-300 hidden sm:block">
              {isStudent
                ? "Complete your assigned lesson kits"
                : "Generate a complete lesson kit in 60 seconds"}
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/analytics"
            className={`header-action text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg transition ${pathname === "/analytics" ? "text-white" : "text-white/70"}`}
          >
            <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Analytics</span>
          </Link>
          {!isStudent && (
            <Link
              to="/library"
              className={`header-action text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg transition ${pathname === "/library" ? "text-white" : "text-white/70"}`}
            >
              <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Library</span>
            </Link>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="header-action p-2 rounded-lg text-white/80 transition"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="h-9 w-9 rounded-full text-white font-semibold text-sm"
              style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
            >
              {initial}
            </button>
            {open && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl border backdrop-blur-xl p-3 shadow-2xl z-50"
                style={{
                  background: theme === "dark" ? "rgba(15,32,68,0.95)" : "rgba(255,255,255,0.96)",
                  borderColor: theme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(37,99,235,0.16)",
                }}
              >
                <div
                  className="text-xs truncate mb-1 px-2"
                  style={{ color: theme === "dark" ? "rgba(255,255,255,0.6)" : "#64748b" }}
                >
                  {user?.email}
                </div>
                {profile && (
                  <div
                    className="text-xs capitalize mb-2 px-2"
                    style={{ color: theme === "dark" ? "rgba(147,197,253,0.9)" : "#2563eb" }}
                  >
                    {profile.role}
                    {profile.grade ? ` · ${profile.grade}` : ""}
                  </div>
                )}
                <button
                  onClick={async () => {
                    await signOut();
                    navigate({ to: "/auth" });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl transition"
                  style={{ color: theme === "dark" ? "white" : "#172033" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(37,99,235,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function FloatingBlobs() {
  return (
    <>
      <div className="pointer-events-none fixed -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-blue-600 blur-3xl opacity-20" />
      <div className="pointer-events-none fixed -bottom-32 -right-32 w-[32rem] h-[32rem] rounded-full bg-indigo-600 blur-3xl opacity-15" />
    </>
  );
}
