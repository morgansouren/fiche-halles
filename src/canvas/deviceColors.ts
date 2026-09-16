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
// foncé (--bp-device-dl-b). Les ports n'ont pas de souci de lisibilité
// (chaque colonne reste entièrement d'un côté du dégradé, donc chacune
// prend la couleur qui lui va le mieux — texte sombre à gauche/in, clair
// à droite/out via --device-right-text). Le titre, lui, est centré et
// traverse les deux zones : plutôt qu'un halo (essayé, jamais pleinement
// convaincant sur un fond aussi foncé), on lui donne un petit badge blanc
// opaque — le texte sombre s'y lit alors aussi bien qu'ailleurs sur la
// carte, quel que soit l'endroit du dégradé où le titre tombe.
interface FamilyConfig {
  style: DeviceCardStyle;
  titleBadge?: boolean;
}

const FAMILY_CONFIG: Record<DeviceFamily, FamilyConfig> = {
  console: { style: { background: "var(--device-console-bg)", color: "var(--device-text-dark)" } },
  dl: {
    style: {
      background: "var(--device-dl-bg)",
      color: "var(--device-text-dark)",
      "--device-right-text": "var(--device-text-light)",
    },
    titleBadge: true,
  },
  dn:      { style: { background: "var(--device-dn-bg)", color: "var(--device-text-dark)" } },
  nxamp:   { style: { background: "var(--device-nxamp-bg)", color: "var(--device-text-light)" } },
  other:   { style: { background: "var(--device-other-bg)", color: "var(--device-text-dark)" } },
};

export function deviceCardStyle(model: DeviceModel): DeviceCardStyle {
  return FAMILY_CONFIG[familyOf(model)].style;
}

export function deviceTitleHasBadge(model: DeviceModel): boolean {
  return FAMILY_CONFIG[familyOf(model)].titleBadge ?? false;
}
