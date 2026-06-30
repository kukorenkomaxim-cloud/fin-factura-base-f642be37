import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        …
      </div>
    );
  }
  return <Navigate to={user ? "/documents" : "/login"} />;
}
