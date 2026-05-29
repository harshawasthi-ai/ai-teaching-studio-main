import { createFileRoute } from "@tanstack/react-router";
import StudentHomePage from "@/pages/StudentHomePage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/student")({
  component: () => (
    <Protected roles={["student"]}>
      <StudentHomePage />
    </Protected>
  ),
});
