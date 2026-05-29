import { createFileRoute } from "@tanstack/react-router";
import LibraryPage from "@/pages/LibraryPage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/library")({
  component: () => (
    <Protected roles={["teacher"]}>
      <LibraryPage />
    </Protected>
  ),
});
