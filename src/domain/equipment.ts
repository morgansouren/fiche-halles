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
  | "Speakon";

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
}
