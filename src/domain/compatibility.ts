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

// Règle métier : deux ports ne peuvent être reliés que s'ils partagent
// le même protocole et si leurs directions sont compatibles (pas de
// sortie vers sortie, ni d'entrée vers entrée).
export function canConnectPorts(a: Port, b: Port): boolean {
  return protocolsMatch(a.protocol, b.protocol) && directionsCompatible(a.direction, b.direction);
}
