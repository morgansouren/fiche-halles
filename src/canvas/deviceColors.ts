import type { DeviceModel } from "../domain/equipment";

// Couleur de carte par famille d'appareil : un repère visuel pour
// distinguer d'un coup d'œil console / DL / DN / ampli sur un montage
// chargé. Classification par catégorie (console) ou par préfixe du nom
// (DL/DN/Nxamp) — un concept purement d'affichage, qui n'a donc pas sa
// place dans le catalogue (domain/catalog.ts).
export interface DeviceCardStyle {
  background: string;
  color: string;
}

type DeviceFamily = "console" | "dl" | "dn" | "nxamp" | "other";

function familyOf(model: DeviceModel): DeviceFamily {
  if (model.category === "console") return "console";
  if (model.name.startsWith("DL")) return "dl";
  if (model.name.startsWith("DN")) return "dn";
  if (model.name.startsWith("Nxamp")) return "nxamp";
  return "other";
}

// Nxamp est la seule famille à fond foncé (violet foncé) : elle seule
// reçoit le texte clair, les quatre autres restent lisibles avec le même
// texte sombre.
const FAMILY_STYLE: Record<DeviceFamily, DeviceCardStyle> = {
  console: { background: "var(--device-console-bg)", color: "var(--device-text-dark)" },
  dl:      { background: "var(--device-dl-bg)", color: "var(--device-text-dark)" },
  dn:      { background: "var(--device-dn-bg)", color: "var(--device-text-dark)" },
  nxamp:   { background: "var(--device-nxamp-bg)", color: "var(--device-text-light)" },
  other:   { background: "var(--device-other-bg)", color: "var(--device-text-dark)" },
};

export function deviceCardStyle(model: DeviceModel): DeviceCardStyle {
  return FAMILY_STYLE[familyOf(model)];
}
