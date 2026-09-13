import type { Port } from "../domain/equipment";

// Groupes de ports que l'on peut masquer/afficher depuis l'en-tête d'un
// appareil, pour réduire la hauteur d'une carte quand on n'a pas besoin
// de voir tous ses ports. Dante, AES50, Snake, Ethernet et Speakon restent
// toujours visibles (portGroupFor renvoie null pour eux) — aucun bouton
// ne les masque.
export type PortGroup = "ain" | "aout" | "axin" | "axout" | "m" | "o";

export const PORT_GROUPS: PortGroup[] = ["ain", "aout", "axin", "axout", "m", "o"];

export const PORT_GROUP_LABELS: Record<PortGroup, string> = {
  ain: "Ain",
  aout: "Aout",
  axin: "AxIn",
  axout: "AxOut",
  m: "M",
  o: "O",
};

// Regroupés sous "O" même si Word Clock a sa propre couleur dans le
// thème : la classification par bouton n'est pas obligée de suivre
// exactement la classification par couleur.
const OTHER_GROUP_PROTOCOLS = new Set(["AES3", "MADI", "Ultranet", "Adat", "VideoSync", "WordClock"]);

export function portGroupFor(port: Port): PortGroup | null {
  if (port.protocol === "Analog") return port.direction === "in" ? "ain" : "aout";
  if (port.protocol === "Aux") return port.direction === "in" ? "axin" : "axout";
  if (port.protocol === "MIDI") return "m";
  if (OTHER_GROUP_PROTOCOLS.has(port.protocol)) return "o";
  return null;
}

export type HiddenGroups = Partial<Record<PortGroup, boolean>>;

// État par défaut à la pose d'un appareil : tous les groupes masqués,
// pour partir d'une carte compacte et n'afficher que ce dont on a besoin.
export function allGroupsHidden(): HiddenGroups {
  return Object.fromEntries(PORT_GROUPS.map((group) => [group, true])) as HiddenGroups;
}
