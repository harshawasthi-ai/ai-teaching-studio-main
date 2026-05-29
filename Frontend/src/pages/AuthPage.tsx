import { useState, FormEvent } from "react";
import { useNavigate, Navigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { FloatingBlobs } from "@/components/app/Layout";
import type { UserRole } from "@/contexts/AuthContext";

const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);

export default function AuthPage() {
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [grade, setGrade] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">Loading…</div>
    );
  if (user) return <Navigate to={profile?.role === "student" ? "/student" : "/"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    if (mode === "signup" && password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (mode === "signup" && role === "student" && !grade) {
      setErr("Please select your grade");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              role,
              grade: role === "student" ? grade : null,
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            "If this email is new, check your inbox to finish signup. If it is already registered, please sign in instead.",
          );
          setMode("signin");
          setPassword("");
          setConfirm("");
          return;
        }
        if (data.user && data.session) {
          const { error: profileError } = await supabase.from("profiles").upsert({
            id: data.user.id,
            display_name: name,
            role,
            grade: role === "student" ? grade : null,
          });
          if (profileError) throw profileError;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      <FloatingBlobs />
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 backdrop-blur-xl p-8"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center h-14 w-14 rounded-2xl text-2xl mb-3"
            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
          >
            🎓
          </div>
          <h1 className="text-2xl font-bold text-white">AI Teaching Studio</h1>
          <p className="text-sm text-blue-200 mt-1">Lesson kits, generated instantly</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === m ? "text-white" : "text-white/50"}`}
              style={mode === m ? { background: "linear-gradient(135deg,#4f46e5,#7c3aed)" } : {}}
            >
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <Input label="Full Name" value={name} onChange={setName} required />
              <div>
                <span className="text-xs text-blue-200 mb-1.5 block">Account Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["teacher", "student"] as const).map((nextRole) => (
                    <button
                      key={nextRole}
                      type="button"
                      onClick={() => setRole(nextRole)}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold border transition ${role === nextRole ? "text-white" : "text-white/60 hover:text-white"}`}
                      style={
                        role === nextRole
                          ? {
                              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                              borderColor: "rgba(255,255,255,0.16)",
                            }
                          : {
                              background: "rgba(255,255,255,0.05)",
                              borderColor: "rgba(255,255,255,0.12)",
                            }
                      }
                    >
                      {nextRole === "teacher" ? "Teacher" : "Student"}
                    </button>
                  ))}
                </div>
              </div>
              {role === "student" && (
                <label className="block">
                  <span className="text-xs text-blue-200 mb-1.5 block">Grade</span>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                    className="w-full rounded-xl px-4 py-3 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <option value="" className="bg-slate-900">
                      Select grade
                    </option>
                    {GRADES.map((item) => (
                      <option key={item} value={item} className="bg-slate-900">
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          <Input label="Email" type="email" value={email} onChange={setEmail} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            required
          />
          {mode === "signup" && (
            <Input
              label="Confirm Password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              required
            />
          )}
          {notice && (
            <div className="text-sm text-blue-200 bg-blue-500/10 border border-blue-300/30 rounded-xl px-3 py-2">
              {notice}
            </div>
          )}
          {err && (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-3 py-2">
              {err}
            </div>
          )}
          <button
            disabled={busy}
            type="submit"
            className="w-full py-3 rounded-2xl font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              boxShadow: "0 10px 30px rgba(79,70,229,0.4)",
            }}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="block mx-auto mt-5 text-sm text-blue-300 hover:text-blue-200"
        >
          {mode === "signin"
            ? "Don't have an account? Sign up →"
            : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-blue-200 mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        className="w-full rounded-xl px-4 py-3 text-white outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
      />
    </label>
  );
}
