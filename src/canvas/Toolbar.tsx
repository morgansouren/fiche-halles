import "./Toolbar.css";

export interface ToolbarProps {
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
}

// Barre d'outils de mise en page du canevas. Un seul outil pour l'instant
// (sélection multiple par boîte) ; les futurs outils de dessin
// (rectangle, texte libre) viendront s'ajouter ici, dans le même panneau.
export function Toolbar({ selectionMode, onToggleSelectionMode }: ToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <button
        type="button"
        className={`canvas-toolbar-button${selectionMode ? " canvas-toolbar-button-active" : ""}`}
        onClick={onToggleSelectionMode}
        title="Sélection multiple par boîte (clic-glisser gauche) — clic-glisser droit ou molette pour se déplacer"
      >
        Sélection
      </button>
    </div>
  );
}
