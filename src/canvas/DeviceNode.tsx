import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { useEffect, type CSSProperties } from "react";
import type { DeviceModel, Port } from "../domain/equipment";
import { protocolBackground, protocolStrokeColors } from "./protocolColors";
import { deviceCardStyle, deviceTitleHasBadge } from "./deviceColors";
import { portGroupColor, hasKnownPortGroupColor } from "./portGroupColors";
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
    // Colonnes inversées (entrées à droite, sorties/inout à gauche) — propre
    // à CETTE carte posée sur le canevas, pas au modèle du catalogue : deux
    // appareils reliés face à face (ex. deux consoles en AES50) peuvent
    // ainsi tourner leurs ports l'un vers l'autre, et le câble aller tout
    // droit au lieu de contourner une des deux boîtes. Absent = non inversé.
    flipped?: boolean;
    onToggleFlip: () => void;
    // Calculés par FlowCanvas.tsx à partir de `edges` à chaque rendu (pas
    // stockés dans l'état persistant du nœud) — voir l'outil "Masquer les
    // ports inutilisés" de la barre d'outils. Absents (undefined) tant que
    // ce mode n'a jamais été activé pour ce nœud.
    hideUnusedPorts?: boolean;
    usedPortIds?: Set<string>;
  },
  "device"
>;

// Les ports "in" apparaissent à gauche, les ports "out" et "inout" à droite
// — ou l'inverse si la carte est inversée (bouton ⇄ du titre).
function positionFor(port: Port, flipped: boolean): Position {
  const inSide = flipped ? Position.Right : Position.Left;
  const outSide = flipped ? Position.Left : Position.Right;
  return port.direction === "in" ? inSide : outSide;
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

// Pour un switch réseau à VLAN, le protocole (toujours Ethernet) ne
// distingue pas les ports entre eux : c'est leur groupe qui prend le rôle
// de --port-color/background que joue le protocole ailleurs. Un appareil
// sans VLAN reconnue (port.group absent, ex. Netgear — ou juste posé pour
// afficher un intitulé sans code couleur, ex. "Analog Out" sur un rack
// HF) garde la couleur de protocole habituelle plutôt qu'un repli générique.
function switchHandleStyle(port: Port): HandleStyle {
  if (!hasKnownPortGroupColor(port.group)) return handleStyle(port);
  const color = portGroupColor(port.group);
  return { background: color, "--port-color": color };
}

// Extrait le numéro final d'un intitulé de port ("Analog Out 3" -> "3"),
// pour l'afficher en petit au-dessus du point plutôt que le libellé
// complet (déjà lisible au survol via l'attribut title). Renvoie le
// libellé tel quel s'il ne se termine pas par un nombre (cas rare).
function portNumberLabel(port: Port): string {
  return port.label.match(/(\d+)\s*$/)?.[1] ?? port.label;
}

// Rassemble les ports consécutifs d'un même groupe (VLAN), dans l'ordre du
// catalogue — un switch affiche tous ses ports d'un coup, groupés par
// intitulé, jamais par colonne gauche/droite comme les autres appareils.
function groupPortsByVlan(ports: Port[]): { label: string; ports: Port[] }[] {
  const groups = new Map<string, Port[]>();
  for (const port of ports) {
    const label = port.group ?? "";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(port);
  }
  return Array.from(groups.entries()).map(([label, groupPorts]) => ({ label, ports: groupPorts }));
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

export function DeviceNode({ id, data }: NodeProps<DeviceNodeType>) {
  const { model, hiddenGroups, onToggleGroup, hideUnusedPorts, usedPortIds, onToggleFlip } = data;
  const flipped = data.flipped ?? false;
  // Une rangée horizontale, tous les ports toujours visibles, aucun
  // bouton de groupe — pour les appareils dont les ports se présentent
  // ainsi physiquement (switches réseau, racks HF...), pas seulement les
  // switches : voir DeviceModel.layout dans domain/equipment.ts.
  const isHorizontal = model.layout === "horizontal";

  // Inverser les colonnes déplace chaque port d'un bord à l'autre SANS
  // changer la taille de la carte (mêmes colonnes, juste échangées) — or
  // React Flow ne remesure les ports (handleBounds, que lit le routage des
  // câbles) que quand la taille change. Sans ce rappel explicite, les
  // câbles continueraient de partir de l'ancien côté. L'effet tourne après
  // que le DOM inversé est en place, donc la mesure est la bonne.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [flipped, id, updateNodeInternals]);

  // "Masquer les ports inutilisés" est un filtre en plus de celui des
  // groupes, pas un remplacement : un port peut très bien appartenir à un
  // groupe visible ET être inutilisé. Ne dépend pas du protocole/de la
  // catégorie — s'applique pareil aux deux mises en page (colonnes ou
  // switch horizontal).
  const isUsed = (port: Port) => !hideUnusedPorts || (usedPortIds?.has(port.id) ?? false);

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
    const groupVisible = groupId === undefined || !hiddenGroups[groupId];
    return groupVisible && isUsed(port);
  });
  const leftPorts = visiblePorts.filter((port) => positionFor(port, flipped) === Position.Left);
  const rightPorts = visiblePorts.filter((port) => positionFor(port, flipped) === Position.Right);
  const toggleFamilies = groupTogglesByFamily(groups);

  return (
    <div className="device-node" style={deviceCardStyle(model)}>
      <div className="device-node-title">
        {deviceTitleHasBadge(model) ? <span className="device-node-title-badge">{model.name}</span> : model.name}
        {/* Pas de bouton sur une carte horizontale : ses ports sont tous en
            bas, il n'y a pas de gauche/droite à échanger. */}
        {!isHorizontal && (
          <button
            type="button"
            className={["device-node-flip", flipped && "device-node-toggle-active"].filter(Boolean).join(" ")}
            onClick={onToggleFlip}
            title="Inverser les ports gauche/droite"
          >
            ⇄
          </button>
        )}
      </div>
      {!isHorizontal && !hideUnusedPorts && groups.length > 0 && (
        <div className="device-node-toggles">
          {toggleFamilies.map((family) => (
            <div className="device-node-toggle-family" key={family[0].id}>
              {family.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={[
                    "device-node-toggle",
                    group.id.includes("out") && "device-node-toggle-out",
                    group.id.includes("in") && "device-node-toggle-in",
                    !hiddenGroups[group.id] && "device-node-toggle-active",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
      {isHorizontal ? (
        <div className="device-node-switch-body">
          {groupPortsByVlan(model.ports)
            .map((vlan) => ({ ...vlan, ports: vlan.ports.filter(isUsed) }))
            .filter((vlan) => vlan.ports.length > 0)
            .map((vlan) => (
            <div className="device-node-switch-group" key={vlan.label}>
              {/* Un switch sans VLAN (ex. Netgear) n'a qu'un seul groupe
                  au label vide (port.group jamais renseigné) : pas de
                  bandeau à afficher dans ce cas, juste la rangée de ports.
                  Le carré témoin de couleur, lui, ne s'affiche que pour une
                  VLAN reconnue — "Analog Out" sur un rack HF n'est qu'un
                  intitulé, pas un code couleur. */}
              {vlan.label && (
                <div className="device-node-switch-group-label">
                  {hasKnownPortGroupColor(vlan.label) && (
                    <span className="device-node-switch-group-swatch" style={{ background: portGroupColor(vlan.label) }} />
                  )}
                  {vlan.label}
                </div>
              )}
              <div className="device-node-switch-group-ports">
                {vlan.ports.map((port) => (
                  <div className="device-node-switch-port" key={port.id} title={port.label}>
                    <span className="device-node-switch-port-number">{portNumberLabel(port)}</span>
                    <Handle
                      id={port.id}
                      type={handleTypeFor(port)}
                      position={Position.Bottom}
                      className="device-node-handle device-node-handle-bottom"
                      style={switchHandleStyle(port)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
}
