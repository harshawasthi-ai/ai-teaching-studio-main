import { createFileRoute } from "@tanstack/react-router";
import SubmissionsPage from "@/pages/SubmissionsPage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/submissions")({
  component: () => (
    <Protected roles={["teacher"]}>
      <SubmissionsPage />
    </Protected>
  ),
});
