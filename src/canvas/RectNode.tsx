import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import "./RectNode.css";

export type RectNodeType = Node<Record<string, never>, "rect">;

// Taille plancher à la création/au redimensionnement — un simple repère
// pour ne jamais finir avec un rectangle invisible (largeur/hauteur nulles).
export const RECT_MIN_SIZE = 20;

// Rectangle de mise en page : créé par l'outil "Rectangle" de la barre
// d'outils (glisser sur le canevas pour le tracer, voir FlowCanvas.tsx),
// indépendant du modèle domaine — purement décoratif, comme TextNode
// (exclu des obstacles de routage des câbles pour la même raison).
export function RectNode({ selected }: NodeProps<RectNodeType>) {
  return (
    <div className="rect-node">
      <NodeResizer isVisible={!!selected} minWidth={RECT_MIN_SIZE} minHeight={RECT_MIN_SIZE} keepAspectRatio={false} color="var(--accent)" />
    </div>
  );
}
