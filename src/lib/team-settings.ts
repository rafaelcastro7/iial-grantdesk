// Who decides, who writes and what we cite — always from data, never from code:
// - decision maker and credentials: the active organization's profile
//   (Organization profile → "Who decides" / "Credentials to cite");
// - links: the organization's website from the same profile;
// - sender: the signed-in user's name (each user can change it for themselves).
// When a value is missing, texts stay neutral ("the decision maker", no citation).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrgProfile } from "@/lib/org.functions";

export type TeamSettings = {
  /** Who receives memos and summaries. Empty = generic wording. */
  decisionMaker: string;
  /** Name used to sign emails. */
  sender: string;
  /** Links shared in introductions (the organization's website). */
  links: string;
  /** A sentence partner emails may cite (research, track record). Empty = none. */
  credentials: string;
  /** What the organization does (its mission), for introductions. Empty = none. */
  about: string;
};

const senderKey = (orgId: string) => `team-sender:${orgId}`;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

let cachedUserName: string | null = null;

/** The signed-in user's display name, from their account (empty when unknown). */
function useUserName(): string {
  const [name, setName] = useState(cachedUserName ?? "");
  useEffect(() => {
    if (cachedUserName !== null) return;
    let alive = true;
    void supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      cachedUserName = String(meta.full_name ?? meta.name ?? "").trim();
      if (alive) setName(cachedUserName);
    });
    return () => {
      alive = false;
    };
  }, []);
  return name;
}

/** Team settings for the active organization, plus a setter for the user's own sender name. */
export function useTeamSettings(orgId: string | null | undefined) {
  const userName = useUserName();
  const fetchProfile = useServerFn(getOrgProfile);
  const { data } = useQuery({
    queryKey: ["org-profile", orgId],
    queryFn: () => fetchProfile({ data: { orgId: orgId as string } }),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });
  const profile = (data?.profile ?? null) as {
    decision_maker_name?: string | null;
    outreach_credentials?: string | null;
    website?: string | null;
    mission?: string | null;
  } | null;
  const storedSender = useSyncExternalStore(
    subscribe,
    () => {
      if (!orgId || typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(senderKey(orgId));
      } catch {
        return null;
      }
    },
    () => null,
  );
  const settings: TeamSettings = {
    decisionMaker: profile?.decision_maker_name?.trim() ?? "",
    sender: storedSender?.trim() || userName,
    links: profile?.website?.trim() ?? "",
    credentials: profile?.outreach_credentials?.trim() ?? "",
    about: firstSentence(profile?.mission ?? ""),
  };
  const setSender = (name: string) => {
    if (!orgId) return;
    try {
      window.localStorage.setItem(senderKey(orgId), name);
    } catch {
      /* storage unavailable: lasts for this view only */
    }
    listeners.forEach((l) => l());
  };
  return { settings, setSender };
}

/** The decision maker's name, or a neutral role, for labels and greetings. */
export function decisionMakerLabel(
  s: Pick<TeamSettings, "decisionMaker">,
  lang: "en" | "es",
): string {
  return s.decisionMaker.trim() || (lang === "es" ? "la dirección" : "the decision maker");
}

/** The first sentence of a text (introductions stay short). */
function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const m = /^(.{20,300}?[.!?])(\s|$)/.exec(t);
  return m ? m[1] : t.slice(0, 300);
}
