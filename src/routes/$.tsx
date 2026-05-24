import { createFileRoute } from "@tanstack/react-router";
import { AppStateScreen } from "@/components/app/AppStateScreen";

export const Route = createFileRoute("/$")({
  component: () => <AppStateScreen state="not-found" />,
});
