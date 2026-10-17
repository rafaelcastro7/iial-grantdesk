import type { SavedDossier } from "./grant-dossier.functions";

/** Keep paid generation results even when persistence fails. */
export function dossierGenerationResult(result: { saved: SavedDossier; persisted: boolean; persistError: string | null }) {
  return { saved: result.saved, unsaved: !result.persisted, error: result.persisted ? null : result.persistError ?? "dossier_save_failed" };
}