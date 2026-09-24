import { useState } from "react";
import { NodeResizer, NodeToolbar, Position, useStore, useViewport, type Node, type NodeProps } from "@xyflow/react";
import { downloadZoneAsPdf, printZone, type ExportBounds, type PageSize } from "./exportPrint";
import "./RectNode.css";

export type RectNodeType = Node<Record<string, never>, "rect">;

// Taille plancher à la création/au redimensionnement — un simple repère
// pour ne jamais finir avec un rectangle invisible (largeur/hauteur nulles).
export const RECT_MIN_SIZE = 20;

// Hauteur de la barre (boutons + select) + son décalage par défaut par
// rapport au nœud (offset NodeToolbar = 10) — sert à savoir s'il reste assez
// de place en dessous du rectangle avant de la faire passer au-dessus.
const TOOLBAR_SPACE_PX = 60;

// Rectangle de mise en page : créé par l'outil "Rectangle" de la barre
// d'outils (glisser sur le canevas pour le tracer, voir FlowCanvas.tsx),
// indépendant du modèle domaine — purement décoratif, comme TextNode
// (exclu des obstacles de routage des câbles pour la même raison).
//
// Sert aussi de zone d'export : une fois sélectionné, son NodeToolbar
// (positionAbsoluteX/Y + width/height donnent directement ses limites en
// coordonnées canevas, voir exportPrint.ts) propose Imprimer/PDF au
// format choisi — l'app recadre et met à l'échelle elle-même, pas besoin
// de le faire à la main.
export function RectNode({ id, selected, positionAbsoluteX, positionAbsoluteY, width, height }: NodeProps<RectNodeType>) {
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [busy, setBusy] = useState(false);

  const bounds: ExportBounds = {
    x: positionAbsoluteX,
    y: positionAbsoluteY,
    width: width ?? RECT_MIN_SIZE,
    height: height ?? RECT_MIN_SIZE,
  };

  // Position.Bottom évite la collision de z-index avec la barre d'outils
  // permanente (voir plus bas), mais un rectangle dont le bas arrive près
  // du bord bas de l'écran pousserait alors sa propre barre hors de la
  // fenêtre visible — présente dans le DOM, mais physiquement invisible
  // sans qu'aucun scroll n'existe pour la révéler (canevas plein écran,
  // voir "Full-bleed layout"). On calcule donc en coordonnées écran (le
  // node est en coordonnées canevas) s'il reste la place en dessous ;
  // sinon la barre passe au-dessus, où il y a alors forcément de la place
  // puisque le rectangle n'est justement pas près du haut.
  const paneHeight = useStore((store) => store.height);
  const { y: viewportY, zoom } = useViewport();
  const screenBottom = viewportY + (bounds.y + bounds.height) * zoom;
  const toolbarPosition = screenBottom + TOOLBAR_SPACE_PX > paneHeight ? Position.Top : Position.Bottom;

  async function runExport(action: (bounds: ExportBounds, pageSize: PageSize, excludeNodeId?: string) => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action(bounds, pageSize, id);
    } catch (error) {
      console.error(error);
      window.alert("L'export a échoué — voir la console du navigateur pour le détail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rect-node">
      {/* Bottom par défaut (pas Top) + z-index explicite : le NodeToolbar de
          React Flow est porté dans .react-flow__renderer, dont le z-index
          (4, fixé par la librairie) est structurellement inférieur à celui
          du <Panel> qui héberge la barre d'outils permanente en haut du
          canevas (z-index 5) — impossible à rattraper avec un simple
          z-index local, un enfant ne peut jamais dépasser le rang de
          l'empilement de son parent. Un rectangle tracé près du haut de
          l'écran plaçait donc sa barre Imprimer/PDF *sous* la barre
          permanente : présente dans le DOM (cliquable en apparence), mais
          le clic atterrissait en réalité sur l'autre barre par-dessus.
          toolbarPosition ci-dessus repasse à Top quand Bottom pousserait la
          barre sous le bord bas de l'écran (l'autre collision possible,
          bien plus fréquente en usage réel : cadrer un module qui va
          jusqu'en bas de l'écran). */}
      <NodeToolbar
        isVisible={!!selected}
        position={toolbarPosition}
        className="rect-node-toolbar nodrag nopan"
        style={{ zIndex: 1000 }}
      >
        <select
          className="rect-node-toolbar-select"
          value={pageSize}
          onChange={(event) => setPageSize(event.target.value as PageSize)}
          disabled={busy}
        >
          <option value="a4">A4</option>
          <option value="a3">A3</option>
        </select>
        <button type="button" className="rect-node-toolbar-button" onClick={() => runExport(printZone)} disabled={busy}>
          {busy ? "…" : "Imprimer"}
        </button>
        <button type="button" className="rect-node-toolbar-button" onClick={() => runExport(downloadZoneAsPdf)} disabled={busy}>
          {busy ? "…" : "PDF"}
        </button>
      </NodeToolbar>
      <NodeResizer
        isVisible={!!selected}
        minWidth={RECT_MIN_SIZE}
        minHeight={RECT_MIN_SIZE}
        keepAspectRatio={false}
        color="var(--accent)"
      />
    </div>
  );
}
