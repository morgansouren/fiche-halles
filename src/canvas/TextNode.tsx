import { useEffect, useRef, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import "./TextNode.css";

export type TextNodeType = Node<{ text: string; onChangeText: (text: string) => void }, "text">;

// Note libre : créée par l'outil "Texte" de la barre d'outils (voir
// FlowCanvas.tsx), indépendante du modèle domaine (ce n'est pas un
// appareil) — sert à annoter le montage (adresse IP, fréquence
// d'échantillonnage, nom d'un point de connexion...).
//
// Largeur/hauteur redimensionnables indépendamment (NodeResizer,
// keepAspectRatio=false par défaut) : contrairement à DeviceNode, dont la
// taille est mesurée automatiquement depuis son contenu, TextNode utilise
// node.width/node.height (posés à la création dans FlowCanvas.tsx) — le
// composant se contente de remplir cette boîte à 100%.
export function TextNode({ data, selected }: NodeProps<TextNodeType>) {
  const [isEditing, setIsEditing] = useState(data.text === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  return (
    <div className="text-node">
      <NodeResizer isVisible={!!selected} minWidth={40} minHeight={24} keepAspectRatio={false} color="var(--accent)" />
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
  );
}
