import { BaseEdge, type Edge, type EdgeProps } from "@xyflow/react";
import type { Point } from "./routing";

export interface StrokeColors {
  colorA: string;
  colorB?: string;
}

export type PatchCableEdgeType = Edge<{ path?: Point[]; strokeColors?: StrokeColors }, "patchCable">;

function pointsToPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

// Longueur d'un segment de rayure (px) pour les protocoles à deux couleurs.
const STRIPE_DASH = 6;

// Rendu du câble : suit le tracé calculé par routing.ts (évitement des
// boîtes + anti-chevauchement), coloré selon le protocole du port de
// départ (src/canvas/protocolColors.ts). Un stroke SVG ne pouvant pas
// prendre un dégradé CSS, un protocole "à rayures" (colorB défini) se
// dessine comme deux tracés superposés au même dasharray, décalés d'un
// cran l'un par rapport à l'autre.
//
// Sélectionné : on bascule sur une couleur unie d'accent plutôt que la
// couleur du protocole — sinon la couleur de sélection native de React
// Flow ne se verrait jamais (un style inline gagne toujours contre sa
// règle CSS `.selected`). L'épaisseur au survol, elle, vient d'une règle
// CSS sur `.react-flow__edge-path` (voir theme.css) : on ne fixe donc
// jamais `strokeWidth` en inline ici, pour laisser cette règle s'appliquer.
export function PatchCableEdge({ data, sourceX, sourceY, targetX, targetY, markerEnd, style, selected }: EdgeProps<PatchCableEdgeType>) {
  const points = data?.path;
  const path =
    points && points.length >= 2
      ? pointsToPath(points)
      : pointsToPath([
          { x: sourceX, y: sourceY },
          { x: targetX, y: targetY },
        ]);

  if (selected) {
    return <BaseEdge path={path} markerEnd={markerEnd} style={{ ...style, stroke: "var(--accent)" }} />;
  }

  const colors = data?.strokeColors;

  if (colors?.colorB) {
    return (
      <>
        <BaseEdge path={path} markerEnd={markerEnd} style={{ ...style, stroke: colors.colorA, strokeDasharray: STRIPE_DASH }} />
        <path
          className="react-flow__edge-path"
          d={path}
          fill="none"
          style={{ stroke: colors.colorB, strokeDasharray: STRIPE_DASH, strokeDashoffset: STRIPE_DASH }}
          pointerEvents="none"
        />
      </>
    );
  }

  return <BaseEdge path={path} markerEnd={markerEnd} style={colors ? { ...style, stroke: colors.colorA } : style} />;
}
