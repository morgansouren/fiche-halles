import type { CSSProperties } from "react";
import type { DeviceModel } from "../domain/equipment";

// Apparence de carte par appareil : rappelle l'aspect physique réel du
// matériel (couleur de châssis/façade relevée sur photos fabricant, plus un
// accent caractéristique quand il y en a un) — un repère visuel pour
// reconnaître d'un coup d'œil chaque appareil sur un montage chargé.
// Concept purement d'affichage, qui n'a donc pas sa place dans le
// catalogue (domain/catalog.ts).
//
// Classification par id de modèle, pas par préfixe du nom : l'apparence
// réelle ne suit pas toujours le nom (ex. le DL16 est noir mat comme une
// M32R, pas bleu roi comme les DL151/153/154/251). Plusieurs modèles
// partagent une apparence quand ils se ressemblent vraiment ; un appareil
// absent de la table (ex. créé depuis l'interface) prend l'apparence
// neutre "other".
//
// CSSProperties n'autorise pas les propriétés personnalisées par défaut ;
// on l'étend pour poser en style inline les variables lues par
// DeviceNode.css (qui ne peut pas connaître l'apparence d'UN appareil
// précis autrement qu'en CSS pur).
export type DeviceCardStyle = CSSProperties & {
  "--device-title-text"?: string;
  "--device-accent"?: string;
  "--device-accent-size"?: string;
  "--device-port-ring"?: string;
};

type DeviceLook =
  | "hd96"
  | "pro1"
  | "midas-black"
  | "m32c"
  | "dl"
  | "dn"
  | "nxamp"
  | "gigacore"
  | "netgear"
  | "ew500"
  | "mac"
  | "blackmagic"
  | "usb-adapter"
  | "rz770"
  | "atem"
  | "speaker"
  | "other";

const LOOK_BY_MODEL_ID: Record<string, DeviceLook> = {
  "speaker-active": "speaker",
  "midas-hd96": "hd96",
  "midas-pro1": "pro1",
  "midas-m32r": "midas-black",
  "dl16": "midas-black",
  "midas-m32c": "m32c",
  "dl151": "dl",
  "dl153": "dl",
  "dl154": "dl",
  "dl251": "dl",
  "dn9680": "dn",
  "dn9650": "dn",
  "nxamp4x4": "nxamp",
  "nxamp4x1": "nxamp",
  "gigacore-luminex": "gigacore",
  "netgear": "netgear",
  "4x-recepteurs-ew500": "ew500",
  "macbook-pro-2015": "mac",
  "blackmagic-hdmi-to-sdi": "blackmagic",
  "blackmagic-sdi-to-hdmi": "blackmagic",
  "usb-to-ethernet": "usb-adapter",
  "panasonic-pt-rz770": "rz770",
  "atem-mini-pro": "atem",
};

// Chaque apparence a sa propre couleur de texte (plus seulement "clair" ou
// "sombre" pour tout le monde) : un blanc ou un noir légèrement teinté vers
// la couleur du fond. C'est ce qui permet de garder un fond proche de la
// luminosité réelle de l'appareil (ex. le gris aluminium Blackmagic, ~63 %,
// où ni le texte clair ni le texte sombre communs n'atteignaient 4,5:1)
// au lieu de l'assombrir ou l'éclaircir pour l'adapter au texte.
//
// title (optionnel) : couleur du nom de l'appareil quand l'appareil a une
// couleur de marquage caractéristique (ex. le jaune du logo Midas sur les
// DL). accent (optionnel) : liseré en bas de carte, pour un détail
// physique marquant (accoudoir bois de la HD96, orange Blackmagic, rouge
// ATEM...) — jamais sur une carte horizontale (layout "horizontal"), dont
// les pastilles sont posées sur ce même bord bas. light : fond clair, où les pastilles de port (toutes autour de
// L 78 %) se confondent avec le fond — elles reçoivent alors un contour
// plein, de la couleur du texte (voir --device-port-ring dans
// DeviceNode.css).
interface LookConfig {
  title?: boolean;
  accent?: boolean;
  light?: boolean;
}

const LOOK_CONFIG: Record<DeviceLook, LookConfig> = {
  hd96: { accent: true },
  pro1: {},
  "midas-black": {},
  m32c: {},
  dl: { title: true },
  dn: { light: true },
  nxamp: {},
  gigacore: {},
  netgear: {},
  // Pas de liseré : carte horizontale, ses pastilles sont posées sur le
  // bord bas, exactement là où il passerait.
  ew500: { light: true },
  mac: { light: true },
  blackmagic: { accent: true, light: true },
  "usb-adapter": {},
  rz770: {},
  atem: { accent: true },
  speaker: {},
  other: { light: true },
};

function lookOf(model: DeviceModel): DeviceLook {
  return LOOK_BY_MODEL_ID[model.id] ?? "other";
}

export function deviceCardStyle(model: DeviceModel): DeviceCardStyle {
  const look = lookOf(model);
  const config = LOOK_CONFIG[look];
  const style: DeviceCardStyle = {
    background: `var(--device-${look}-bg)`,
    color: `var(--device-${look}-text)`,
  };
  if (config.title) style["--device-title-text"] = `var(--device-${look}-title)`;
  // La taille accompagne la couleur : DeviceNode.css s'en sert aussi pour
  // réserver la même hauteur sous la dernière ligne de ports, que le liseré
  // ne recouvre donc jamais. Absente (pas d'accent), cette réserve vaut 0.
  if (config.accent) {
    style["--device-accent"] = `var(--device-${look}-accent)`;
    style["--device-accent-size"] = "5px";
  }
  // currentColor dans une variable n'est résolu qu'à l'endroit où elle est
  // lue (le handle, qui hérite la couleur de texte de la carte) : pas
  // besoin d'un token dédié, le contour prend la couleur du texte.
  if (config.light) style["--device-port-ring"] = "currentColor";
  return style;
}
