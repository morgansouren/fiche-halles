import { useEffect, useRef, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import "./TextNode.css";

export type TextNodeType = Node<{ text: string; onChangeText: (text: string) => void }, "text">;

// Taille de la boîte à la création (scale = 1) — voir FlowCanvas.tsx, qui
// pose ces mêmes valeurs comme width/height initiales du nœud. Réutilisées
// ici comme référence pour le scale ci-dessous : une seule source de vérité
// pour "la taille à laquelle le texte n'est ni agrandi ni étiré".
export const TEXT_NODE_BASE_WIDTH = 160;
export const TEXT_NODE_BASE_HEIGHT = 32;

// Note libre : créée par l'outil "Texte" de la barre d'outils (voir
// FlowCanvas.tsx), indépendante du modèle domaine (ce n'est pas un
// appareil) — sert à annoter le montage (adresse IP, fréquence
// d'échantillonnage, nom d'un point de connexion...).
//
// Le but explicite du redimensionnement n'est pas de faire réagir la mise
// en page (retour à la ligne, troncature...) mais de faire grossir/rétrécir
// ou étirer le texte lui-même, sans jamais toucher au font-size : le
// contenu est rendu à sa taille "normale" (TEXT_NODE_BASE_WIDTH/HEIGHT)
// puis visuellement mis à l'échelle par CSS transform pour correspondre à
// la taille actuelle du nœud (width/height, posés par NodeResizer,
// keepAspectRatio=false donc scaleX/scaleY indépendants — un étirement,
// pas un simple agrandissement uniforme).
export function TextNode({ data, selected, width, height }: NodeProps<TextNodeType>) {
  const [isEditing, setIsEditing] = useState(data.text === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const scaleX = (width ?? TEXT_NODE_BASE_WIDTH) / TEXT_NODE_BASE_WIDTH;
  const scaleY = (height ?? TEXT_NODE_BASE_HEIGHT) / TEXT_NODE_BASE_HEIGHT;

  return (
    <div className="text-node">
      {/* Le scaler est rendu AVANT NodeResizer exprès : en peinture normale,
          un élément plus tard dans le DOM recouvre les précédents, donc si
          NodeResizer passait après lui, ses poignées (7x7px aux coins, 2px
          sur les bords) seraient invisibles au clic, recouvertes par le
          scaler qui occupe toute la boîte. Dans cet ordre, seules ces
          petites zones de bord appartiennent à NodeResizer ; le reste de
          la boîte (l'essentiel) reste cliquable normalement pour éditer/
          déplacer. */}
      <div
        className="text-node-scaler"
        style={{ width: TEXT_NODE_BASE_WIDTH, height: TEXT_NODE_BASE_HEIGHT, transform: `scale(${scaleX}, ${scaleY})` }}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="text-node-textarea nodrag nopan"
            value={data.text}
            onChange={(event) => data.onChangeText(event.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur();
            }}
            placeholder="Note…"
          />
        ) : (
          <div className="text-node-display" onDoubleClick={() => setIsEditing(true)}>
            {data.text}
          </div>
        )}
      </div>
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={24} keepAspectRatio={false} color="var(--accent)" />
    </div>
  );
}
