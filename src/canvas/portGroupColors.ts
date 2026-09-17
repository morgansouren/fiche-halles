// Couleur des ports par groupe (ex. VLAN d'un switch réseau) — utilisée à
// la place de la couleur de protocole quand tous les ports d'un appareil
// partagent le même protocole (un switch n'a que de l'Ethernet) : c'est
// alors le groupe, pas le protocole, qui distingue visuellement les ports
// entre eux. Voir protocolColors.ts pour l'équivalent par protocole.
const PORT_GROUP_COLORS: Record<string, string> = {
  "Lumière": "var(--switch-group-light)",
  "Son": "var(--switch-group-sound)",
  "Vidéo": "var(--switch-group-video)",
  "Mgmt": "var(--switch-group-mgmt)",
  "Link": "var(--switch-group-link)",
};

const FALLBACK_COLOR = "var(--device-text-dark)";

export function portGroupColor(group: string | undefined): string {
  if (!group) return FALLBACK_COLOR;
  return PORT_GROUP_COLORS[group] ?? FALLBACK_COLOR;
}

// Un `group` qui n'est pas une VLAN connue (ex. "Analog Out" sur un rack
// HF, posé juste pour afficher un bandeau/regrouper les ports, sans
// intention de code couleur) ne doit pas faire basculer les points sur
// le repli générique — voir switchHandleStyle() dans DeviceNode.tsx.
export function hasKnownPortGroupColor(group: string | undefined): boolean {
  return !!group && group in PORT_GROUP_COLORS;
}
