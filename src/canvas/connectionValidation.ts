import type { Connection, Edge, Node } from "@xyflow/react";
import { canConnectPorts } from "../domain/compatibility";
import type { Port } from "../domain/equipment";
import type { DeviceNodeType } from "./DeviceNode";

function findPort(nodes: Node[], nodeId: string | null, handleId: string | null | undefined): Port | undefined {
  if (!nodeId || !handleId) return undefined;
  const node = nodes.find((n) => n.id === nodeId) as DeviceNodeType | undefined;
  return node?.data.model.ports.find((port) => port.id === handleId);
}

// Un port déjà relié par un câble ne peut pas en accepter un second.
function isPortAlreadyUsed(edges: Edge[], nodeId: string, handleId: string): boolean {
  return edges.some(
    (edge) =>
      (edge.source === nodeId && edge.sourceHandle === handleId) ||
      (edge.target === nodeId && edge.targetHandle === handleId),
  );
}

// Pont entre l'API isValidConnection de React Flow et les règles métier
// du domaine (protocole compatible + direction compatible + port libre).
export function createIsValidConnection(nodes: Node[], edges: Edge[]) {
  return (connection: Connection | Edge): boolean => {
    const { source, target, sourceHandle, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle) return false;
    if (source === target) return false;

    const sourcePort = findPort(nodes, source, sourceHandle);
    const targetPort = findPort(nodes, target, targetHandle);
    if (!sourcePort || !targetPort) return false;

    if (isPortAlreadyUsed(edges, source, sourceHandle)) return false;
    if (isPortAlreadyUsed(edges, target, targetHandle)) return false;

    return canConnectPorts(sourcePort, targetPort);
  };
}
