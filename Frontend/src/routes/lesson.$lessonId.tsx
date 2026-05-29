import { createFileRoute } from "@tanstack/react-router";
import OutputPage from "@/pages/OutputPage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/lesson/$lessonId")({
  component: () => (
    <Protected>
      <OutputPage />
    </Protected>
  ),
});
