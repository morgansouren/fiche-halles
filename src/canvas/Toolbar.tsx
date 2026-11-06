import "./Toolbar.css";

export type Tool = "pan" | "select" | "text" | "rect";

export interface ToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  // "Masquer les ports inutilisés" est un simple bouton bascule (l'état
  // reste actif tant qu'on ne reclique pas dessus), pas un outil de
  // glisser sur le canevas comme les deux autres — d'où une paire
  // props/état séparée plutôt qu'une troisième valeur de Tool.
  hideUnusedPorts: boolean;
  onToggleHideUnusedPorts: () => void;
  // Vide le canevas (après confirmation, voir FlowCanvas.tsx) — le schéma
  // étant enregistré automatiquement, c'est la seule façon de repartir de
  // zéro d'un coup.
  onNewCanvas: () => void;
}

// Barre d'outils de mise en page du canevas. Trois outils de glisser
// (sélection multiple par boîte, note de texte libre, rectangle) et un
// bouton bascule de vue (masquer les ports inutilisés) ; les futurs
// outils viendront s'ajouter ici, dans le même panneau.
export function Toolbar({ activeTool, onSelectTool, hideUnusedPorts, onToggleHideUnusedPorts, onNewCanvas }: ToolbarProps) {
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
      <button
        type="button"
        className={`canvas-toolbar-button${activeTool === "rect" ? " canvas-toolbar-button-active" : ""}`}
        onClick={() => onSelectTool("rect")}
        title="Cliquer-glisser sur le canevas pour tracer un rectangle de mise en page"
      >
        Rectangle
      </button>
      <button
        type="button"
        className={`canvas-toolbar-button${hideUnusedPorts ? " canvas-toolbar-button-active" : ""}`}
        onClick={onToggleHideUnusedPorts}
        title="Masquer les ports sans câble (et leurs boutons de groupe) pour une vue épurée"
      >
        Masquer ports inutilisés
      </button>
      <button
        type="button"
        className="canvas-toolbar-button"
        onClick={onNewCanvas}
        title="Effacer tout le schéma pour repartir d'une page blanche (le schéma en cours est enregistré automatiquement dans ce navigateur)"
      >
        Nouveau schéma
      </button>
    </div>
  );
}
