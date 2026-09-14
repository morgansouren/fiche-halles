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

export type DeviceCategory = "console" | "converter" | "speaker" | "amplifier" | "switch";

export interface DeviceModel {
  id: string;
  name: string;
  category: DeviceCategory;
  ports: Port[];
}
