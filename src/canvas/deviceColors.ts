import type { CSSProperties } from "react";
import type { DeviceModel } from "../domain/equipment";

// Couleur de carte par famille d'appareil : un repère visuel pour
// distinguer d'un coup d'œil console / DL / DN / ampli sur un montage
// chargé. Classification par catégorie (console) ou par préfixe du nom
// (DL/DN/Nxamp) — un concept purement d'affichage, qui n'a donc pas sa
// place dans le catalogue (domain/catalog.ts).
//
// CSSProperties n'autorise pas les propriétés personnalisées par défaut ;
// on l'étend pour poser --device-right-text en style inline (lue par la
// règle CSS de DeviceNode.css qui ne peut pas connaître la couleur d'UNE
// famille précise autrement qu'en CSS pur).
export type DeviceCardStyle = CSSProperties & { "--device-right-text"?: string };

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
// foncé (--bp-device-dl-b). Le titre (centré, traverse les deux zones)
// garde le texte sombre avec un halo clair (text-shadow) qui le fait
// ressortir même côté bleu. Les ports, eux, n'ont pas ce problème de
// zone traversée : chaque colonne reste entièrement d'un côté du
// dégradé, donc chacune peut prendre la couleur qui lui va le mieux —
// texte sombre à gauche (in, toujours côté violet), texte clair à droite
// (out/inout, toujours côté bleu, via --device-right-text lu par
// DeviceNode.css). Plus fiable qu'un halo seul sur un fond aussi foncé.
const DL_TEXT_SHADOW = "0 0 4px color-mix(in srgb, var(--legibility-halo) 70%, transparent), 0 0 1px var(--legibility-halo)";

const FAMILY_STYLE: Record<DeviceFamily, DeviceCardStyle> = {
  console: { background: "var(--device-console-bg)", color: "var(--device-text-dark)" },
  dl: {
    background: "var(--device-dl-bg)",
    color: "var(--device-text-dark)",
    textShadow: DL_TEXT_SHADOW,
    "--device-right-text": "var(--device-text-light)",
  },
  dn:      { background: "var(--device-dn-bg)", color: "var(--device-text-dark)" },
  nxamp:   { background: "var(--device-nxamp-bg)", color: "var(--device-text-light)" },
  other:   { background: "var(--device-other-bg)", color: "var(--device-text-dark)" },
};

export function deviceCardStyle(model: DeviceModel): DeviceCardStyle {
  return FAMILY_STYLE[familyOf(model)];
}
