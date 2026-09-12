import type { Port, PortDirection, Protocol } from "./equipment";

function protocolsMatch(a: Protocol, b: Protocol): boolean {
  return a === b;
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
