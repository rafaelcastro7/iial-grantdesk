import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@/lib/webhook-auth.server";

// Proactive agent: runs saved searches even when the user is away and puts
// new catalog grants and close deadlines in their inbox. Lexical catalog
// search only (0 AI tokens). Auth: signed webhook like the other hooks.
export const Route = createFileRoute("/api/public/hooks/agent-watch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { result } = await verifyWebhookRequest(request, "agent-watch");
        if (!result.ok) return new Response(result.reason, { status: result.status });
        const { runAgentWatches } = await import("@/lib/agent/watch.server");
        return Response.json(await runAgentWatches());
      },
    },
  },
});
