import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type UserRole } from "@/contexts/AuthContext";
import { AppStateScreen } from "@/components/app/AppStateScreen";

export function Protected({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, profile, loading } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (loading) return <AppStateScreen state="loading" />;
  if (!user) return <Navigate to="/auth" replace search={{ from: pathname }} />;
  if (roles && (!profile || !roles.includes(profile.role))) {
    if (!profile) {
      return (
        <AppStateScreen
          state="not-found"
          title="Profile setup needed"
          message="Your account profile could not be loaded. Please sign out and sign in again."
        />
      );
    }
    return <Navigate to={profile.role === "student" ? "/student" : "/"} replace />;
  }

  return <>{children}</>;
}
