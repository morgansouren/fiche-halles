import type { Port, PortDirection, Protocol } from "./equipment";

// Paires de protocoles différents mais physiquement raccordables entre
// eux (ex. Aux et Analog sont tous deux de l'audio analogique standard,
// juste routés différemment sur la console).
const compatibleProtocolPairs: [Protocol, Protocol][] = [["Aux", "Analog"]];

function protocolsMatch(a: Protocol, b: Protocol): boolean {
  if (a === b) return true;
  return compatibleProtocolPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function directionsCompatible(a: PortDirection, b: PortDirection): boolean {
  if (a === "inout" || b === "inout") return true;
  return a !== b; // une sortie ne peut se brancher que sur une entrée
}

// Deux groupes de ports (VLAN d'un switch réseau) dérogent à la règle
// générale "même protocole" :
// - "Link" (liaison inter-switch) : malgré son protocole Ethernet comme
//   n'importe quel autre port du switch, ne se connecte JAMAIS à un port
//   Ethernet ordinaire — seulement à un autre port "Link". Règle plus
//   stricte que la correspondance de protocole, pas une exception à elle.
// - "Son" : le VLAN audio d'un switch transporte aussi bien de l'Ethernet
//   générique que du Dante (le Dante circule sur IP/Ethernet) — règle plus
//   permissive que la correspondance de protocole, en plus d'elle.
function isLinkPort(port: Port): boolean {
  return port.group === "Link";
}

function isSoundPort(port: Port): boolean {
  return port.group === "Son";
}

// Règle métier : deux ports ne peuvent être reliés que si leurs directions
// sont compatibles (pas de sortie vers sortie, ni d'entrée vers entrée) et
// si leur protocole correspond — sous réserve des dérogations par groupe
// ci-dessus, qui priment sur la simple correspondance de protocole.
export function canConnectPorts(a: Port, b: Port): boolean {
  if (!directionsCompatible(a.direction, b.direction)) return false;

  if (isLinkPort(a) || isLinkPort(b)) return isLinkPort(a) && isLinkPort(b);

  if (protocolsMatch(a.protocol, b.protocol)) return true;
  return (isSoundPort(a) && b.protocol === "Dante") || (isSoundPort(b) && a.protocol === "Dante");
}
