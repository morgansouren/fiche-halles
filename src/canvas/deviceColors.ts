import type { DeviceModel } from "../domain/equipment";

// Couleur de carte par famille d'appareil : un repère visuel pour
// distinguer d'un coup d'œil console / DL / DN / ampli sur un montage
// chargé. Classification par catégorie (console) ou par préfixe du nom
// (DL/DN/Nxamp) — un concept purement d'affichage, qui n'a donc pas sa
// place dans le catalogue (domain/catalog.ts).
export interface DeviceCardStyle {
  background: string;
  color: string;
  textShadow?: string;
}

type DeviceFamily = "console" | "dl" | "dn" | "nxamp" | "other";

function familyOf(model: DeviceModel): DeviceFamily {
  if (model.category === "console") return "console";
  if (model.name.startsWith("DL")) return "dl";
  if (model.name.startsWith("DN")) return "dn";
  if (model.name.startsWith("Nxamp")) return "nxamp";
  return "other";
}

// Nxamp est la seule famille à fond uniformément foncé (violet foncé) :
// elle seule reçoit le texte clair, les quatre autres gardent le même
// texte sombre.
//
// DL est un cas à part : son dégradé va du violet clair jusqu'à un bleu
// foncé (--bp-device-dl-b), donc ni le texte sombre ni le texte clair ne
// resteraient lisibles sur toute la largeur de la carte à eux seuls (un
// même titre centré traverse les deux zones). On garde le texte sombre
// (parfait côté violet) et on ajoute un halo clair (text-shadow, hérité
// par tout le texte de la carte) qui le fait ressortir aussi côté bleu —
// une correction visuelle, pas un contraste plat garanti par les tokens.
const DL_TEXT_SHADOW = "0 0 4px color-mix(in srgb, var(--legibility-halo) 70%, transparent), 0 0 1px var(--legibility-halo)";

const FAMILY_STYLE: Record<DeviceFamily, DeviceCardStyle> = {
  console: { background: "var(--device-console-bg)", color: "var(--device-text-dark)" },
  dl:      { background: "var(--device-dl-bg)", color: "var(--device-text-dark)", textShadow: DL_TEXT_SHADOW },
  dn:      { background: "var(--device-dn-bg)", color: "var(--device-text-dark)" },
  nxamp:   { background: "var(--device-nxamp-bg)", color: "var(--device-text-light)" },
  other:   { background: "var(--device-other-bg)", color: "var(--device-text-dark)" },
};

export function deviceCardStyle(model: DeviceModel): DeviceCardStyle {
  return FAMILY_STYLE[familyOf(model)];
}
