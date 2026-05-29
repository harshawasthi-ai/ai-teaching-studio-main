import { createFileRoute } from "@tanstack/react-router";
import AnalyticsPage from "@/pages/AnalyticsPage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/analytics")({
  component: () => (
    <Protected roles={["teacher", "student"]}>
      <AnalyticsPage />
    </Protected>
  ),
});
