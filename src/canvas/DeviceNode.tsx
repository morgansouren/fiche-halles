import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { DeviceModel, Port } from "../domain/equipment";
import { protocolBackground, protocolStrokeColors } from "./protocolColors";
import { computePortGroups, type HiddenGroups, type PortGroupDef } from "./portVisibility";
import "./DeviceNode.css";

// CSSProperties n'autorise pas les propriétés personnalisées par défaut ;
// on l'étend pour poser --port-color en style inline (lue ensuite par la
// règle de survol dans DeviceNode.css, qui ne peut pas connaître la
// couleur d'UN port précis autrement qu'en CSS pur).
type HandleStyle = CSSProperties & { "--port-color"?: string };

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
//
// Ce qui est constant (taille, position, transform de base) vit dans
// DeviceNode.css — seule la couleur varie par port, donc seule elle reste
// en style inline ici. C'est ce qui permet à la règle de survol (grossir
// + halo) de fonctionner : un style inline gagne toujours contre une
// règle CSS `:hover`, donc si tout était inline, rien ne pourrait grossir
// au survol.
function handleStyle(port: Port): HandleStyle {
  return {
    background: protocolBackground(port.protocol),
    "--port-color": protocolStrokeColors(port.protocol).colorA,
  };
}

// Empile les boutons d'une même famille (les paquets "Ain 1-8"/"Ain 9-16"/...
// les uns au-dessus des autres) plutôt que de les laisser s'aligner en
// ligne — ça évite qu'un appareil avec beaucoup de paquets s'élargisse
// inutilement (la largeur de la carte ne grandit pas avec le nombre de
// paquets, seule sa hauteur d'en-tête augmente d'une ligne).
function groupTogglesByFamily(groups: PortGroupDef[]): PortGroupDef[][] {
  const families = new Map<string, PortGroupDef[]>();
  for (const group of groups) {
    const family = group.id.includes("-") ? group.id.slice(0, group.id.indexOf("-")) : group.id;
    if (!families.has(family)) families.set(family, []);
    families.get(family)!.push(group);
  }
  return Array.from(families.values());
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
  const toggleFamilies = groupTogglesByFamily(groups);

  return (
    <div className="device-node">
      <div className="device-node-title">{model.name}</div>
      {groups.length > 0 && (
        <div className="device-node-toggles">
          {toggleFamilies.map((family) => (
            <div className="device-node-toggle-family" key={family[0].id}>
              {family.map((group) => (
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
          ))}
        </div>
      )}
      <div className="device-node-body">
        <div className="device-node-column">
          {leftPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <Handle
                id={port.id}
                type={handleTypeFor(port)}
                position={Position.Left}
                className="device-node-handle device-node-handle-left"
                style={handleStyle(port)}
              />
              <span className="device-node-port-label">{port.label}</span>
            </div>
          ))}
        </div>
        <div className="device-node-column">
          {rightPorts.map((port) => (
            <div className="device-node-port" key={port.id}>
              <span className="device-node-port-label">{port.label}</span>
              <Handle
                id={port.id}
                type={handleTypeFor(port)}
                position={Position.Right}
                className="device-node-handle device-node-handle-right"
                style={handleStyle(port)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
