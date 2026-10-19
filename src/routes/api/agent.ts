import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { handleAgentChat } = await import("@/lib/agent/agent.server");
          return await handleAgentChat(request);
        } catch (e) {
          // Surface the cause instead of a bare 502 so the chat can show it.
          const msg = e instanceof Error ? e.message : String(e);
          console.error("agent chat crashed", e);
          return Response.json({ error: msg.slice(0, 300) }, { status: 500 });
        }
      },
    },
  },
});
