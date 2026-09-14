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
