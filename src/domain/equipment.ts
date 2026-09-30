// Modèle de données du domaine : indépendant de React / React Flow.
// Décrit les types d'appareils et leurs ports, sans logique d'affichage.

export type Protocol =
  | "Analog"
  | "Dante"
  | "AES50"
  | "AES3"
  | "MADI"
  | "Snake"
  | "Ethernet"
  | "MIDI"
  | "WordClock"
  | "Ultranet"
  | "VideoSync"
  | "Aux"
  | "Adat"
  | "Speakon"
  | "USB"
  | "Thunderbolt"
  | "HDMI"
  | "MiniDisplayPort"
  | "SDI";

export type PortDirection = "in" | "out" | "inout";

export interface Port {
  id: string;
  label: string;
  protocol: Protocol;
  direction: PortDirection;
  // Précision physique optionnelle (ex. "optique ou cuivre"), purement
  // informative : n'intervient pas dans la validation des connexions.
  media?: string;
  // Sous-groupe optionnel (ex. VLAN d'un switch réseau) : regroupe des
  // ports sous un même intitulé/couleur sur la carte. Purement descriptif
  // — n'intervient dans aucune règle de connexion.
  group?: string;
  // Toujours visible sur la carte : le port n'entre dans aucun groupe
  // masquable (voir computePortGroups, canvas/portVisibility.ts). Un
  // groupe qui ne contiendrait que des ports ainsi marqués disparaît, son
  // bouton avec — ex. le Minijack du Macbook, seule sortie analogique,
  // qu'un bouton "Aout 1" ne ferait que cacher sans rien gagner.
  alwaysVisible?: boolean;
}

// Catégories connues (autocomplétion) + n'importe quelle chaîne — un
// utilisateur peut créer un appareil dans une nouvelle catégorie de son
// choix (voir l'outil de création d'appareil, palette/CreateDeviceForm.tsx).
// Le `string & {}` est une astuce TypeScript : ça garde l'autocomplétion
// des littéraux ci-dessous tout en acceptant n'importe quelle autre chaîne
// (un simple `string` ferait perdre l'autocomplétion).
export type DeviceCategory =
  | "console"
  | "converter"
  | "speaker"
  | "amplifier"
  | "switch"
  | "rf"
  | "video-source"
  | "video-converter"
  | "video-controller"
  | "projector"
  | (string & {});

// Discipline technique — l'onglet de la palette sous lequel l'appareil
// apparaît (palette/Palette.tsx). Contrairement à DeviceCategory, ensemble
// fermé : ce sont les quatre pôles techniques de la salle, pas quelque
// chose qu'un utilisateur invente à la volée depuis le formulaire.
export type Discipline = "son" | "video" | "lumiere" | "reseau";

export interface DeviceModel {
  id: string;
  name: string;
  discipline: Discipline;
  category: DeviceCategory;
  ports: Port[];
  // Affichage en une seule rangée horizontale, tous les ports toujours
  // visibles (pas de bouton masquer/afficher par groupe) — pour les
  // appareils dont les ports se présentent physiquement ainsi (switches
  // réseau, racks HF...). Par défaut (absent) : les deux colonnes
  // habituelles, avec groupes masquables.
  layout?: "horizontal";
  // Groupes de ports masqués à la pose de l'appareil sur le canevas, par
  // identifiant de groupe ("o", "m", "axin", "axout", "ain-1", "aout-2"...
  // — voir computePortGroups, canvas/portVisibility.ts). Présent, il
  // remplace entièrement la règle par défaut pour cet appareil : les
  // groupes listés partent masqués, tous les autres visibles. Ex. un
  // Macbook : ["o"] garde USB/Thunderbolt derrière le bouton "O" et
  // laisse HDMI/Minijack visibles. Absent : règle par défaut.
  initiallyHiddenGroups?: string[];
}
