import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { DeviceModel, Port } from "../domain/equipment";
import "./DeviceNode.css";

export type DeviceNodeType = Node<{ model: DeviceModel }, "device">;

// Les ports "in" apparaissent à gauche, les ports "out" et "inout" à droite.
function positionFor(port: Port): Position {
  return port.direction === "in" ? Position.Left : Position.Right;
}

function handleTypeFor(port: Port): "source" | "target" {
  return port.direction === "in" ? "target" : "source";
}

// Chaque port est une ligne normale du flux du document (pas un handle
// positionné en pourcentage sur toute la hauteur du nœud) : la boîte
// grandit donc automatiquement pour accueillir n'importe quel nombre de
// ports, sans chevauchement, quel que soit le modèle d'appareil.
const inlineHandleStyle = { position: "static" as const, transform: "none" };

export function DeviceNode({ data }: NodeProps<DeviceNodeType>) {
  const { model } = data;
  const leftPorts = model.ports.filter((port) => positionFor(port) === Position.Left);
  const rightPorts = model.ports.filter((port) => positionFor(port) === Position.Right);

  return (
    <div className="device-node">
      <div className="device-node-title">{model.name}</div>
      <div className="device-node-body">
        <div className="device-node-column">
          {leftPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Left} style={inlineHandleStyle} />
              <span className="device-node-port-label">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="device-node-column">
          {rightPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <span className="device-node-port-label">{port.label}</span>
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Right} style={inlineHandleStyle} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
