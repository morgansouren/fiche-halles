import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NodeResizer, useViewport, type Node, type NodeProps } from "@xyflow/react";
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
// Tant qu'on édite, la taille naturelle du texte tapé est mesurée en
// continu (clone invisible du même style, ci-dessous) et transmise à
// FlowCanvas.tsx (onAutoFit), qui l'applique en conservant le ratio
// d'étirement déjà en place — une note jamais redimensionnée grandit/
// rétrécit avec son texte (scale=1), une note déjà agrandie continue de
// s'écrire à la même taille visuelle plutôt que de retomber à sa taille
// naturelle. Double-clic pour rééditer : le curseur se place à la fin du
// texte existant, pas question de le retaper.
export function TextNode({ data, selected, width, height }: NodeProps<TextNodeType>) {
  const [isEditing, setIsEditing] = useState(data.text === "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  // getBoundingClientRect() renvoie une taille en pixels-écran, déjà
  // multipliée par le zoom courant du canevas (tout le contenu du flow
  // est à l'intérieur d'un conteneur mis à l'échelle par React Flow). Or
  // node.width/height (ce que data.onAutoFit pose) sont en unités de
  // canevas, pas en pixels-écran — sans cette division, la mesure était
  // fausse dès que le zoom s'écartait de 1, l'erreur s'accumulant à
  // chaque frappe jusqu'à coincer la boîte près de son minimum (elle
  // semblait alors ne jamais suivre au-delà du premier mot tapé).
  const { zoom } = useViewport();

  useEffect(() => {
    if (!isEditing || !textareaRef.current) return;
    const el = textareaRef.current;
    el.focus();
    // Curseur à la fin du texte existant plutôt qu'au début (comportement
    // par défaut du navigateur au focus d'un <textarea> déjà rempli) :
    // rouvrir une note pour la corriger doit reprendre là où elle
    // s'arrête, pas devant le premier caractère.
    el.setSelectionRange(el.value.length, el.value.length);
  }, [isEditing]);

  useLayoutEffect(() => {
    if (!isEditing || !measureRef.current) return;
    const rect = measureRef.current.getBoundingClientRect();
    const fitWidth = Math.max(TEXT_NODE_MIN_WIDTH, Math.ceil(rect.width / zoom));
    const fitHeight = Math.max(TEXT_NODE_MIN_HEIGHT, Math.ceil(rect.height / zoom));
    data.onAutoFit(fitWidth, fitHeight);
    // data.onAutoFit est une fermeture stable (voir FlowCanvas.tsx) ; seul
    // le texte (et le zoom, dont dépend la conversion écran -> canevas)
    // doit redéclencher une mesure, pas l'identité de la fermeture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, data.text, zoom]);

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
