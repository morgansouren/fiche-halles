import "./Toolbar.css";

export type Tool = "pan" | "select" | "text";

export interface ToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
}

// Barre d'outils de mise en page du canevas. Deux outils pour l'instant
// (sélection multiple par boîte, note de texte libre) ; les futurs outils
// de dessin (rectangle...) viendront s'ajouter ici, dans le même panneau.
export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <button
        type="button"
        className={`canvas-toolbar-button${activeTool === "select" ? " canvas-toolbar-button-active" : ""}`}
        onClick={() => onSelectTool("select")}
        title="Sélection multiple par boîte (clic-glisser gauche) — clic-glisser droit ou molette pour se déplacer"
      >
        Sélection
      </button>
      <button
        type="button"
        className={`canvas-toolbar-button${activeTool === "text" ? " canvas-toolbar-button-active" : ""}`}
        onClick={() => onSelectTool("text")}
        title="Cliquer sur le canevas pour poser une note de texte libre"
      >
        Texte
      </button>
    </div>
  );
}
