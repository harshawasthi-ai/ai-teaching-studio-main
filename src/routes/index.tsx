import { createFileRoute } from "@tanstack/react-router";
import InputPage from "@/pages/InputPage";
import { Protected } from "@/components/app/ProtectedRoute";

export const Route = createFileRoute("/")({
  component: () => (
    <Protected roles={["teacher"]}>
      <InputPage />
    </Protected>
  ),
});
