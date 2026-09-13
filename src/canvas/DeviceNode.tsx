import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { DeviceModel, Port } from "../domain/equipment";
import { protocolBackground } from "./protocolColors";
import { PORT_GROUPS, PORT_GROUP_LABELS, portGroupFor, type HiddenGroups, type PortGroup } from "./portVisibility";
import "./DeviceNode.css";

export type DeviceNodeType = Node<
  {
    model: DeviceModel;
    hiddenGroups: HiddenGroups;
    onToggleGroup: (group: PortGroup) => void;
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

  // Un port toujours-visible (portGroupFor === null, ex. Dante/AES50/
  // Snake/Ethernet/Speakon) reste affiché quoi qu'il arrive ; les autres
  // ne s'affichent que si leur groupe n'est pas masqué.
  const visiblePorts = model.ports.filter((port) => {
    const group = portGroupFor(port);
    return group === null || !hiddenGroups[group];
  });
  const leftPorts = visiblePorts.filter((port) => positionFor(port) === Position.Left);
  const rightPorts = visiblePorts.filter((port) => positionFor(port) === Position.Right);

  // On ne propose un bouton que si l'appareil a au moins un port de ce
  // groupe — pas de bouton "M" mort sur une enceinte sans MIDI.
  const availableGroups = PORT_GROUPS.filter((group) => model.ports.some((port) => portGroupFor(port) === group));

  return (
    <div className="device-node">
      <div className="device-node-title">{model.name}</div>
      {availableGroups.length > 0 && (
        <div className="device-node-toggles">
          {availableGroups.map((group) => (
            <button
              key={group}
              type="button"
              className={`device-node-toggle${hiddenGroups[group] ? "" : " device-node-toggle-active"}`}
              onClick={() => onToggleGroup(group)}
              title={`Afficher/masquer les ports ${PORT_GROUP_LABELS[group]}`}
            >
              {PORT_GROUP_LABELS[group]}
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
