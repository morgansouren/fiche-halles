import type { DeviceModel, Port } from "../domain/equipment";

// Groupes de ports que l'on peut masquer/afficher depuis l'en-tête d'un
// appareil, pour réduire la hauteur d'une carte quand on n'a pas besoin
// de voir tous ses ports. Dante, AES50, Snake, Ethernet, Speakon, HDMI et
// MiniDisplayPort restent toujours visibles (ils n'apparaissent dans aucun groupe) — aucun bouton
// ne les masque.
//
// Analog In et Analog Out sont en plus subdivisés par paquets de 8 (un
// bouton par paquet) : un appareil avec 24 entrées analogiques (Pro1) a
// besoin de voir seulement les quelques-unes qu'il utilise pour CE
// montage, pas les 24 d'un coup.

const CHUNK_SIZE = 8;

// Regroupés sous "O" même si Word Clock a sa propre couleur dans le
// thème : la classification par bouton n'est pas obligée de suivre
// exactement la classification par couleur. USB et Thunderbolt y sont
// aussi : ports de données/périphériques, secondaires sur la plupart des
// appareils (ex. Macbook) — un appareil où ils sont au contraire
// principaux (ex. adaptateur USB to ethernet) les laisse simplement
// visibles à la pose. RGB/DVI/Serial/Remote : entrées vidéo historiques
// et ports de contrôle d'un projecteur, rarement câblés face au HDMI/SDI/
// Digital Link qu'on utilise en pratique.
const OTHER_GROUP_PROTOCOLS = new Set([
  "AES3",
  "MADI",
  "Ultranet",
  "Adat",
  "VideoSync",
  "WordClock",
  "USB",
  "Thunderbolt",
  "RGB",
  "DVI",
  "Serial",
  "Remote",
]);

export interface PortGroupDef {
  id: string;
  label: string;
  ports: Port[];
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function rangeLabel(prefix: string, chunkIndex: number, chunkLength: number): string {
  const start = chunkIndex * CHUNK_SIZE + 1;
  const end = chunkIndex * CHUNK_SIZE + chunkLength;
  return start === end ? `${prefix} ${start}` : `${prefix} ${start}-${end}`;
}

// Calcule, pour un appareil donné, la liste des groupes de ports
// masquables (et les ports que contrôle chacun). Recalculé à partir du
// catalogue (pur), aucun état ici — l'état "masqué/visible" vit dans les
// données du nœud (voir FlowCanvas.tsx).
export function computePortGroups(allPorts: Port[]): PortGroupDef[] {
  const groups: PortGroupDef[] = [];
  // Ports marqués alwaysVisible : hors de tout groupe, donc jamais masqués
  // et sans bouton propre (un groupe vide n'est jamais créé ci-dessous).
  const ports = allPorts.filter((p) => !p.alwaysVisible);

  const analogIn = ports.filter((p) => p.protocol === "Analog" && p.direction === "in");
  const analogOut = ports.filter((p) => p.protocol === "Analog" && p.direction === "out");
  const auxIn = ports.filter((p) => p.protocol === "Aux" && p.direction === "in");
  const auxOut = ports.filter((p) => p.protocol === "Aux" && p.direction === "out");
  const midi = ports.filter((p) => p.protocol === "MIDI");
  const other = ports.filter((p) => OTHER_GROUP_PROTOCOLS.has(p.protocol));

  chunk(analogIn, CHUNK_SIZE).forEach((group, i) => {
    groups.push({ id: `ain-${i + 1}`, label: rangeLabel("Ain", i, group.length), ports: group });
  });
  chunk(analogOut, CHUNK_SIZE).forEach((group, i) => {
    groups.push({ id: `aout-${i + 1}`, label: rangeLabel("Aout", i, group.length), ports: group });
  });
  if (auxIn.length > 0) groups.push({ id: "axin", label: "AxIn", ports: auxIn });
  if (auxOut.length > 0) groups.push({ id: "axout", label: "AxOut", ports: auxOut });
  if (midi.length > 0) groups.push({ id: "m", label: "M", ports: midi });
  if (other.length > 0) groups.push({ id: "o", label: "O", ports: other });

  return groups;
}

export type HiddenGroups = Record<string, boolean>;

// État par défaut à la pose d'un appareil : tous les groupes masqués (pour
// partir d'une carte compacte), sauf les Analog In d'un amplificateur — un
// Nxamp n'a que 4 entrées, les montrer d'emblée n'encombre pas la carte
// comme le ferait un canal 1-24/48 de console, et c'est justement ce
// qu'on veut voir en premier sur un ampli. Les boutons restent cliquables
// pour les masquer si besoin, ce n'est qu'un état de départ différent.
//
// Même raisonnement, étendu à toute la discipline vidéo : ces appareils
// ont peu de ports (ex. une seule sortie Minijack sur un Macbook), les
// cacher derrière un bouton ne ferait rien gagner — tous leurs groupes
// partent visibles.
//
// Un appareil peut aussi déclarer sa propre liste dans le catalogue
// (DeviceModel.initiallyHiddenGroups), qui prime alors sur les deux
// règles ci-dessus — pour les cas où seul l'usage réel de l'appareil dit
// quels ports montrer d'abord (ex. Macbook : HDMI/Minijack oui, USB/
// Thunderbolt derrière "O"), ce qu'aucune règle générale ne devine.
export function defaultHiddenGroups(model: DeviceModel): HiddenGroups {
  const explicit = model.initiallyHiddenGroups;
  return Object.fromEntries(
    computePortGroups(model.ports).map((group) => {
      if (explicit) return [group.id, explicit.includes(group.id)];
      const visibleByDefault =
        model.discipline === "video" || (model.category === "amplifier" && group.id.startsWith("ain"));
      return [group.id, !visibleByDefault];
    }),
  );
}
