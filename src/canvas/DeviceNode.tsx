import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { DeviceModel, Port } from "../domain/equipment";

export type DeviceNodeType = Node<{ model: DeviceModel }, "device">;

// Les ports "in" apparaissent à gauche, les ports "out" et "inout" à droite.
// (Purement fonctionnel : la disposition visuelle définitive revient à
// l'utilisateur, ceci ne fait que garantir que chaque port a un handle
// cliquable et visible.)
function positionFor(port: Port): Position {
  return port.direction === "in" ? Position.Left : Position.Right;
}

function handleTypeFor(port: Port): "source" | "target" {
  return port.direction === "in" ? "target" : "source";
}

export function DeviceNode({ data }: NodeProps<DeviceNodeType>) {
  const { model } = data;
  const leftPorts = model.ports.filter((port) => positionFor(port) === Position.Left);
  const rightPorts = model.ports.filter((port) => positionFor(port) === Position.Right);

  return (
    <div className="device-node">
      <div className="device-node-title">{model.name}</div>
      {leftPorts.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type={handleTypeFor(port)}
          position={Position.Left}
          title={port.label}
          style={{ top: `${((index + 1) / (leftPorts.length + 1)) * 100}%` }}
        />
      ))}
      {rightPorts.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type={handleTypeFor(port)}
          position={Position.Right}
          title={port.label}
          style={{ top: `${((index + 1) / (rightPorts.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
}
