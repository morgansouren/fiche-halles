// Sauvegarde automatique du schéma en cours dans le navigateur
// (localStorage), pour retrouver son travail en rouvrant la page — même
// mécanisme que les appareils personnalisés (domain/customDevices.ts),
// donc mêmes limites : propre à CE navigateur sur CET ordinateur, rien
// n'est envoyé nulle part ni partagé.
//
// On n'enregistre pas les nœuds tels quels, mais un instantané réduit à
// ce qui ne se recalcule pas :
// - les fonctions posées dans `data` (onToggleGroup, onChangeText...) ne
//   passent pas en JSON : FlowCanvas.tsx les rebranche au chargement ;
// - un appareil est enregistré par l'id de son modèle, pas par le modèle
//   complet : au rechargement il reprend le modèle ACTUEL du catalogue
//   (ports renommés, apparence...), pas une copie figée du jour de la
//   pose. Un modèle disparu entre-temps (appareil personnalisé supprimé,
//   entrée temporaire retirée du catalogue) fait disparaître la carte, et
//   ses câbles avec — voir restoreCanvas ;
// - pas d'état d'interaction (sélection, glisser en cours, tailles
//   mesurées par React Flow) : il se reconstruit tout seul.

import type { Edge, Viewport, XYPosition } from "@xyflow/react";
import type { DeviceModel } from "../domain/equipment";
import type { HiddenGroups } from "./portVisibility";

const STORAGE_KEY = "fiche-halles:canvas";

// Numéro de format : si la forme de l'instantané change un jour, un
// ancien enregistrement est ignoré plutôt que mal relu.
const FORMAT_VERSION = 1;

export type SavedNode =
  | { id: string; type: "device"; position: XYPosition; modelId: string; hiddenGroups: HiddenGroups; flipped?: boolean }
  | {
      id: string;
      type: "text";
      position: XYPosition;
      width?: number;
      height?: number;
      text: string;
      baseWidth?: number;
      baseHeight?: number;
    }
  | { id: string; type: "rect"; position: XYPosition; width?: number; height?: number; zIndex?: number };

export interface SavedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface SavedCanvas {
  version: typeof FORMAT_VERSION;
  nodes: SavedNode[];
  edges: SavedEdge[];
  viewport?: Viewport;
}

export function loadCanvas(): SavedCanvas | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== FORMAT_VERSION || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
    return parsed as SavedCanvas;
  } catch {
    // JSON corrompu ou stockage indisponible : on démarre sur un canevas
    // vide plutôt que de faire planter l'appli.
    return null;
  }
}

export function saveCanvas(canvas: Omit<SavedCanvas, "version">): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: FORMAT_VERSION, ...canvas }));
  } catch {
    // Stockage indisponible (navigation privée, quota...) : le schéma
    // reste utilisable, il ne survivra juste pas à un rechargement.
  }
}

export function toSavedEdge(edge: Edge): SavedEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  };
}

// Écarte ce que le catalogue actuel ne permet plus de reconstruire : les
// appareils dont le modèle a disparu, puis tout câble dont un bout ne
// tombe plus sur un port existant (nœud écarté, ou port retiré/renommé
// dans le catalogue — React Flow afficherait sinon un câble orphelin et
// une erreur en console).
export function restoreCanvas(
  saved: SavedCanvas,
  catalog: readonly DeviceModel[],
): { nodes: { saved: SavedNode; model?: DeviceModel }[]; edges: SavedEdge[] } {
  const modelsById = new Map(catalog.map((model) => [model.id, model]));
  const nodes: { saved: SavedNode; model?: DeviceModel }[] = [];
  const portIdsByNode = new Map<string, Set<string> | null>();
  for (const node of saved.nodes) {
    if (node.type === "device") {
      const model = modelsById.get(node.modelId);
      if (!model) continue;
      nodes.push({ saved: node, model });
      portIdsByNode.set(node.id, new Set(model.ports.map((port) => port.id)));
    } else {
      nodes.push({ saved: node });
      portIdsByNode.set(node.id, null);
    }
  }
  const handleExists = (nodeId: string, handle: string | null | undefined) => {
    if (!portIdsByNode.has(nodeId)) return false;
    const ports = portIdsByNode.get(nodeId);
    return !ports || !handle || ports.has(handle);
  };
  const edges = saved.edges.filter(
    (edge) => handleExists(edge.source, edge.sourceHandle) && handleExists(edge.target, edge.targetHandle),
  );
  return { nodes, edges };
}

// Plus grand numéro d'identifiant déjà utilisé ("device-12" -> 12), pour
// que les nouveaux nœuds posés après un rechargement ne reprennent pas un
// identifiant existant (le compteur de FlowCanvas.tsx repartirait de 0).
export function highestNodeNumber(nodes: readonly { id: string }[]): number {
  let highest = 0;
  for (const node of nodes) {
    const number = Number(node.id.match(/-(\d+)$/)?.[1] ?? 0);
    if (number > highest) highest = number;
  }
  return highest;
}
