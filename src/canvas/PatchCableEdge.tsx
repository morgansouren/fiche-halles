import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import type { Point } from "./routing";

export type PatchCableEdgeType = Edge<{ path?: Point[] }, "patchCable">;

function pointsToPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

// Rendu du câble : suit le tracé calculé par routing.ts (évitement des
// boîtes + anti-chevauchement). Si le routage n'a pas encore de résultat
// (ex. tout premier rendu avant mesure des nœuds), on retombe sur une
// ligne droite simple plutôt que de ne rien afficher.
export function PatchCableEdge({ data, sourceX, sourceY, targetX, targetY, markerEnd, style }: EdgeProps<PatchCableEdgeType>) {
  const points = data?.path;
  const path =
    points && points.length >= 2
      ? pointsToPath(points)
      : pointsToPath([
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY },
        ]);

  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
