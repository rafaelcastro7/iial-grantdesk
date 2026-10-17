import { daysUntil } from "./grant-journey.shared";

export type GrantAvailability = "open" | "closed" | "conflict" | "unknown";

/** A corrected future date does not silently override an explicit closure. */
export function grantAvailability(input: {
  deadline?: string | null;
  status?: string | null;
  deadlineKind?: string | null;
}, today = new Date()): GrantAvailability {
  const days = daysUntil(input.deadline, today);
  const explicitlyClosed = input.status === "expired" || input.status === "archived" || input.deadlineKind === "closed";
  if (explicitlyClosed && days != null && days >= 0) return "conflict";
  if (explicitlyClosed || (days != null && days < 0)) return "closed";
  return days != null || input.deadlineKind === "rolling" ? "open" : "unknown";
}