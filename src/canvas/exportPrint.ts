// Export d'une zone du canevas en PDF (impression ou téléchargement) —
// voir RectNode.tsx, qui appelle ces fonctions depuis son NodeToolbar
// une fois une zone (rectangle) sélectionnée.
//
// Principe (recette documentée par React Flow pour l'export d'image, ici
// adaptée à une zone précise plutôt qu'à tous les nœuds) : on calcule le
// viewport {x, y, zoom} qui ferait tenir exactement `bounds` (la zone
// choisie, en coordonnées canevas) dans une image de la taille voulue —
// getViewportForBounds fait ce calcul — puis on capture
// .react-flow__viewport avec ce transform appliqué via l'option `style`
// de html-to-image (qui ne touche qu'un clone hors-écran, jamais le DOM
// affiché : pas besoin de restaurer quoi que ce soit après coup).
import { getViewportForBounds } from "@xyflow/react";
import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";

export type PageSize = "a4" | "a3";

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PAGE_SIZES_MM: Record<PageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
};

// Marge de page : les imprimantes ont presque toutes une zone non
// imprimable en bord de feuille, et une image collée pile au bord donne
// un rendu moins soigné de toute façon.
const MARGIN_MM = 8;

// Résolution de capture : un compromis netteté/poids de fichier
// raisonnable pour un schéma technique (texte + traits fins), pas une photo.
const DPI = 200;

function mmToPx(mm: number): number {
  return Math.round((mm * DPI) / 25.4);
}

// Oriente la page pour que la zone choisie y tienne le mieux (paysage si
// elle est plus large que haute, portrait sinon) — "l'app adapte la
// sélection pour qu'elle rentre dans la page", pas besoin de le demander.
function pageLayoutFor(bounds: ExportBounds, pageSize: PageSize) {
  const raw = PAGE_SIZES_MM[pageSize];
  const landscape = bounds.width > bounds.height;
  const pageWidthMM = landscape ? raw.height : raw.width;
  const pageHeightMM = landscape ? raw.width : raw.height;
  return {
    landscape,
    pageWidthMM,
    pageHeightMM,
    availableWidthMM: pageWidthMM - 2 * MARGIN_MM,
    availableHeightMM: pageHeightMM - 2 * MARGIN_MM,
  };
}

async function captureAndBuildPdf(bounds: ExportBounds, pageSize: PageSize, excludeNodeId?: string): Promise<jsPDF> {
  const { landscape, availableWidthMM, availableHeightMM } = pageLayoutFor(bounds, pageSize);
  const captureWidth = mmToPx(availableWidthMM);
  const captureHeight = mmToPx(availableHeightMM);

  const viewportEl = document.querySelector(".react-flow__viewport");
  if (!(viewportEl instanceof HTMLElement)) {
    throw new Error("Canevas introuvable pour l'export.");
  }

  const { x, y, zoom } = getViewportForBounds(bounds, captureWidth, captureHeight, 0.1, 4, 0.02);

  // Thème "print" (fond blanc, couleurs de signal resserties — voir
  // theme.css) le temps de la capture seulement : posé sur <html>, où
  // tous les tokens sont lus, puis retiré juste après, succès ou échec.
  document.documentElement.dataset.theme = "print";
  let dataUrl: string;
  try {
    // JPEG plutôt que PNG : jsPDF réencode l'image en l'intégrant au PDF,
    // et compresse nettement moins bien un PNG (essayé d'abord — un schéma
    // à deux appareils gonflait déjà à 10 Mo) qu'un JPEG, qu'il peut
    // réutiliser presque tel quel. Pas de transparence à préserver de
    // toute façon : le fond est toujours blanc opaque (backgroundColor).
    dataUrl = await toJpeg(viewportEl, {
      backgroundColor: "#ffffff",
      quality: 0.92,
      width: captureWidth,
      height: captureHeight,
      pixelRatio: 1,
      style: {
        width: `${captureWidth}px`,
        height: `${captureHeight}px`,
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        transformOrigin: "top left",
      },
      // Le rectangle sert à délimiter la zone à exporter, pas à être lui-
      // même exporté : sans ce filtre, sa bordure et ses poignées de
      // sélection (visibles puisqu'il est sélectionné pour avoir sa barre
      // d'outils) se retrouveraient figées dans le document final.
      filter: excludeNodeId
        ? (domNode) => !(domNode instanceof HTMLElement && domNode.dataset.id === excludeNodeId)
        : undefined,
    });
  } finally {
    delete document.documentElement.dataset.theme;
  }

  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: pageSize });
  doc.addImage(dataUrl, "JPEG", MARGIN_MM, MARGIN_MM, availableWidthMM, availableHeightMM);
  return doc;
}

export async function downloadZoneAsPdf(bounds: ExportBounds, pageSize: PageSize, excludeNodeId?: string): Promise<void> {
  const doc = await captureAndBuildPdf(bounds, pageSize, excludeNodeId);
  doc.save("fiche-halles.pdf");
}

// autoPrint() + ouverture du blob dans un nouvel onglet : le lecteur PDF
// natif du navigateur déclenche alors lui-même sa boîte de dialogue
// d'impression — pas d'iframe cachée à gérer à la main.
export async function printZone(bounds: ExportBounds, pageSize: PageSize, excludeNodeId?: string): Promise<void> {
  const doc = await captureAndBuildPdf(bounds, pageSize, excludeNodeId);
  doc.autoPrint();
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}
