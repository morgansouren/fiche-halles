// Persistance des appareils créés par l'utilisateur (voir
// palette/CreateDeviceForm.tsx) — dans le navigateur (localStorage),
// séparément du catalogue intégré (catalog.ts, qui reste un fichier
// source que l'utilisateur édite lui-même à la main). Les deux sont
// combinés au même niveau par CatalogContext.tsx.

import type { DeviceModel } from "./equipment";

const STORAGE_KEY = "fiche-halles:custom-devices";

export function loadCustomDevices(): DeviceModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // JSON corrompu, ou localStorage indisponible (navigation privée,
    // quota dépassé...) — on repart d'un catalogue personnalisé vide
    // plutôt que de faire planter le chargement de l'appli.
    return [];
  }
}

export function saveCustomDevices(devices: DeviceModel[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch {
    // Stockage indisponible : l'appareil reste utilisable pour la session
    // en cours, juste pas persisté après un rechargement de la page.
  }
}

// Identifiant/slug lisible à partir du nom saisi ("DL999 Bêta" -> "dl999-beta").
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // enlève les accents (é -> e, ê -> e...)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "device";
}

// Ajoute un suffixe numérique si l'identifiant de base existe déjà
// (collision avec le catalogue intégré ou un autre appareil personnalisé).
export function uniqueId(base: string, existingIds: ReadonlySet<string>): string {
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
