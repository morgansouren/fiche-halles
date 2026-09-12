import type { Protocol } from "../domain/equipment";

// Associe chaque protocole du domaine à une clé de couleur du thème
// (src/styles/theme.css, tokens --signal-*). Plusieurs protocoles
// physiquement de même famille partagent la même clé (ex. Aux/Analog).
// Les protocoles sans couleur dédiée dans le thème retombent sur "other".
const PROTOCOL_COLOR_KEY: Record<Protocol, string> = {
  Analog: "analog",
  Aux: "analog",
  AES50: "aes50",
  Dante: "dante",
  Ethernet: "ethernet",
  MIDI: "midi",
  WordClock: "wordclock",
  Snake: "snake",
  Speakon: "speakon",
  AES3: "other",
  MADI: "other",
  Ultranet: "other",
  Adat: "other",
  VideoSync: "other",
};

// Protocoles rendus à rayures (deux couleurs) plutôt qu'en couleur unie —
// doit rester synchronisé avec les tokens à deux couleurs de theme.css.
const STRIPED_PROTOCOLS = new Set(["snake", "speakon"]);

function colorKey(protocol: Protocol): string {
  return PROTOCOL_COLOR_KEY[protocol] ?? "other";
}

// Couleur (unie ou motif rayé) à utiliser en `background` CSS pour un
// élément HTML (ex. le cercle d'un port) — fonctionne pour les deux cas
// car un token à rayures est déjà un repeating-linear-gradient.
export function protocolBackground(protocol: Protocol): string {
  return `var(--signal-${colorKey(protocol)})`;
}

// Couleur(s) à utiliser pour le tracé SVG d'un câble. Un stroke SVG ne
// peut pas prendre un gradient CSS directement : les protocoles rayés
// renvoient deux couleurs à plat, à dessiner en deux tracés superposés
// (voir PatchCableEdge) ; les autres renvoient une seule couleur.
export function protocolStrokeColors(protocol: Protocol): { colorA: string; colorB?: string } {
  const key = colorKey(protocol);
  if (STRIPED_PROTOCOLS.has(key)) {
    return { colorA: `var(--signal-${key}-a)`, colorB: `var(--signal-${key}-b)` };
  }
  return { colorA: `var(--signal-${key})` };
}
