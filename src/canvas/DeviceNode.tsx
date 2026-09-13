import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { DeviceModel, Port } from "../domain/equipment";
import { protocolBackground } from "./protocolColors";
import { computePortGroups, type HiddenGroups } from "./portVisibility";
import "./DeviceNode.css";

export type DeviceNodeType = Node<
  {
    model: DeviceModel;
    hiddenGroups: HiddenGroups;
    onToggleGroup: (group: string) => void;
  },
  "device"
>;

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

// La couleur du cercle vient du protocole du port (src/canvas/protocolColors.ts,
// tokens définis dans src/styles/theme.css) — c'est ce qui permet
// d'identifier un port au coup d'œil sans lire son étiquette.
function leftHandleStyle(port: Port) {
  return {
    position: "static" as const,
    transform: "none",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    marginLeft: -HANDLE_SIZE / 2,
    background: protocolBackground(port.protocol),
    borderColor: "rgba(0, 0, 0, 0.4)",
  };
}
function rightHandleStyle(port: Port) {
  return {
    position: "static" as const,
    transform: "none",
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    marginRight: -HANDLE_SIZE / 2,
    background: protocolBackground(port.protocol),
    borderColor: "rgba(0, 0, 0, 0.4)",
  };
}

export function DeviceNode({ data }: NodeProps<DeviceNodeType>) {
  const { model, hiddenGroups, onToggleGroup } = data;

  // Les groupes (et les paquets de 8 pour Analog In/Out) sont recalculés
  // depuis le catalogue ; seul l'état masqué/visible vient des données du
  // nœud. Un port qui n'appartient à aucun groupe (Dante/AES50/Snake/
  // Ethernet/Speakon) reste toujours affiché.
  const groups = computePortGroups(model.ports);
  const portIdToGroupId = new Map<string, string>();
  for (const group of groups) {
    for (const port of group.ports) portIdToGroupId.set(port.id, group.id);
  }

  const visiblePorts = model.ports.filter((port) => {
    const groupId = portIdToGroupId.get(port.id);
    return groupId === undefined || !hiddenGroups[groupId];
  });
  const leftPorts = visiblePorts.filter((port) => positionFor(port) === Position.Left);
  const rightPorts = visiblePorts.filter((port) => positionFor(port) === Position.Right);

  return (
    <div className="device-node">
      <div className="device-node-title">{model.name}</div>
      {groups.length > 0 && (
        <div className="device-node-toggles">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`device-node-toggle${hiddenGroups[group.id] ? "" : " device-node-toggle-active"}`}
              onClick={() => onToggleGroup(group.id)}
              title={`Afficher/masquer les ports ${group.label}`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}
      <div className="device-node-body">
        <div className="device-node-column">
          {leftPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Left} style={leftHandleStyle(port)} />
              <span className="device-node-port-label">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="device-node-column">
          {rightPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <span className="device-node-port-label">{port.label}</span>
              <Handle id={port.id} type={handleTypeFor(port)} position={Position.Right} style={rightHandleStyle(port)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
