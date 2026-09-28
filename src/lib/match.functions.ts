import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ACCESS_TOKEN_MESSAGE } from "./session";

export const findMatches = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      clientId: z.string().uuid(),
      accessToken: z.string().min(10, ACCESS_TOKEN_MESSAGE),
    }),
  )
  .handler(async ({ data }) => {
    // Imported here, not at the top of the file: only handler bodies stay off
    // the browser bundle, and these modules reach provider keys.
    const { callerClient } = await import("@/server/caller");
    const { ProfileTooThinError, runMatch } = await import("@/server/match");
    try {
      const result = await runMatch(callerClient(data.accessToken), data.clientId);
      return { ok: true as const, result };
    } catch (error) {
      if (error instanceof ProfileTooThinError) {
        return {
          ok: false as const,
          error:
            "This profile has nothing to search on yet. Add the sectors this client works in, then run matching again.",
        };
      }
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });
