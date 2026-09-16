import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import "./TextNode.css";

export type TextNodeType = Node<
  {
    text: string;
    onChangeText: (text: string) => void;
    // Appelé à chaque mesure du texte pendant l'édition (voir plus bas) :
    // FlowCanvas.tsx pose à la fois width/height du nœud ET baseWidth/
    // baseHeight sur cet appel, pour que la boîte colle immédiatement au
    // texte tapé.
    onAutoFit: (width: number, height: number) => void;
    // Référence d'échelle ("scale = 1") établie à la dernière mesure en
    // édition — voir le commentaire au-dessus du composant.
    baseWidth?: number;
    baseHeight?: number;
  },
  "text"
>;

// Taille plancher (mesure minimale, et taille de la boîte à la création
// avant la première mesure) — reprise telle quelle par NodeResizer comme
// minWidth/minHeight, pour qu'on ne puisse jamais redimensionner en
// dessous de ce que l'auto-ajustement lui-même produirait.
export const TEXT_NODE_MIN_WIDTH = 40;
export const TEXT_NODE_MIN_HEIGHT = 24;

// Note libre : créée par l'outil "Texte" de la barre d'outils (voir
// FlowCanvas.tsx), indépendante du modèle domaine (ce n'est pas un
// appareil) — sert à annoter le montage (adresse IP, fréquence
// d'échantillonnage, nom d'un point de connexion...).
//
// Le but explicite du redimensionnement n'est pas de faire réagir la mise
// en page (retour à la ligne, troncature...) mais de faire grossir/rétrécir
// ou étirer le texte lui-même, sans jamais toucher au font-size : le
// contenu est rendu à sa taille "normale" (baseWidth/baseHeight) puis
// visuellement mis à l'échelle par CSS transform pour correspondre à la
// taille actuelle du nœud (width/height, posés par NodeResizer,
// keepAspectRatio=false donc scaleX/scaleY indépendants — un étirement,
// pas un simple agrandissement uniforme).
//
// Tant qu'on édite, la boîte colle exactement au texte tapé (mesuré via
// un clone invisible du même style, ci-dessous) : le texte reste à sa
// taille "vraie" pendant la saisie, jamais déformé, et la boîte grandit
// ET rétrécit avec lui — c'est cette taille, à chaque mesure, qui devient
// la nouvelle référence d'échelle pour un étirement ultérieur (une fois
// sorti d'édition, via les poignées de NodeResizer).
export function TextNode({ data, selected, width, height }: NodeProps<TextNodeType>) {
  const [isEditing, setIsEditing] = useState(data.text === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing || !measureRef.current) return;
    const rect = measureRef.current.getBoundingClientRect();
    const fitWidth = Math.max(TEXT_NODE_MIN_WIDTH, Math.ceil(rect.width));
    const fitHeight = Math.max(TEXT_NODE_MIN_HEIGHT, Math.ceil(rect.height));
    data.onAutoFit(fitWidth, fitHeight);
    // data.onAutoFit est une fermeture stable (voir FlowCanvas.tsx) ; seul
    // le texte doit redéclencher une mesure, pas son identité à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, data.text]);

  const baseWidth = data.baseWidth ?? TEXT_NODE_MIN_WIDTH;
  const baseHeight = data.baseHeight ?? TEXT_NODE_MIN_HEIGHT;
  const scaleX = (width ?? baseWidth) / baseWidth;
  const scaleY = (height ?? baseHeight) / baseHeight;

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
        style={{ width: baseWidth, height: baseHeight, transform: `scale(${scaleX}, ${scaleY})` }}
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
      {/* Clone invisible servant uniquement à mesurer la taille naturelle
          du texte tapé (même classe que l'affichage, donc même police/
          padding — voir .text-node-measure dans TextNode.css qui l'extrait
          du flux et lui laisse une largeur/hauteur libres). Un espace de
          secours évite une mesure nulle quand le texte est encore vide. */}
      <span ref={measureRef} className="text-node-display text-node-measure" aria-hidden="true">
        {data.text || " "}
      </span>
      <NodeResizer
        isVisible={!!selected}
        minWidth={TEXT_NODE_MIN_WIDTH}
        minHeight={TEXT_NODE_MIN_HEIGHT}
        keepAspectRatio={false}
        color="var(--accent)"
      />
    </div>
  );
}
