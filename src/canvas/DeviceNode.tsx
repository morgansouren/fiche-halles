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
// Un handle React Flow par défaut fait 6px et se positionne par
// pourcentage ; ici on le fixe en flux normal, à cheval sur la bordure
// du nœud (moitié dedans, moitié dehors), comme un vrai connecteur.
const HANDLE_SIZE = 8;
const leftHandleStyle = {
  position: "static" as const,
  transform: "none",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  marginLeft: -HANDLE_SIZE / 2,
};
const rightHandleStyle = {
  position: "static" as const,
  transform: "none",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  marginRight: -HANDLE_SIZE / 2,
};

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
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Left} style={leftHandleStyle} />
              <span className="device-node-port-label">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="device-node-column">
          {rightPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <span className="device-node-port-label">{port.label}</span>
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Right} style={rightHandleStyle} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
