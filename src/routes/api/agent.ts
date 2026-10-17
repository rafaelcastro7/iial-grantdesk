import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleAgentChat } = await import("@/lib/agent/agent.server");
        return handleAgentChat(request);
      },
    },
  },
});
