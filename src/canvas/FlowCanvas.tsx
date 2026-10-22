import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  ConnectionMode,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  useStoreApi,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCatalog } from "../domain/CatalogContext";
import { DeviceNode, type DeviceNodeType } from "./DeviceNode";
import { TextNode, TEXT_NODE_MIN_WIDTH, TEXT_NODE_MIN_HEIGHT, type TextNodeType } from "./TextNode";
import { RectNode, RECT_MIN_SIZE, type RectNodeType } from "./RectNode";
import { createIsValidConnection } from "./connectionValidation";
import { DEVICE_MODEL_MIME_TYPE } from "../palette/Palette";
import { PatchCableEdge } from "./PatchCableEdge";
import { protocolStrokeColors } from "./protocolColors";
import { defaultHiddenGroups } from "./portVisibility";
import { computeRoutes, type HandleInfo, type RoutingNode } from "./routing";
import { Toolbar, type Tool } from "./Toolbar";

const nodeTypes = { device: DeviceNode, text: TextNode, rect: RectNode };
const edgeTypes = { patchCable: PatchCableEdge };
const defaultEdgeOptions = { type: "patchCable" };

type CanvasNode = DeviceNodeType | TextNodeType | RectNodeType;

let nodeIdCounter = 0;
function nextNodeId(prefix: string): string {
  nodeIdCounter += 1;
  return `${prefix}-${nodeIdCounter}`;
}

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const storeApi = useStoreApi();
  const { catalog } = useCatalog();
  // Par défaut, glisser sur le canevas déplace la vue (comportement React
  // Flow standard). En mode sélection, un glisser-clic-gauche trace une
  // boîte de sélection à la place ; le déplacement reste possible au
  // clic-droit/molette (voir panOnDrag ci-dessous) — convention reprise
  // des outils de dessin (Figma...), pas propre à React Flow. En mode
  // texte, cliquer sur le canevas pose une note (onPaneClick ci-dessous) ;
  // le drag garde son comportement de déplacement normal de la vue.
  const [activeTool, setActiveTool] = useState<Tool>("pan");
  // Vue "épurée" indépendante des outils ci-dessus (pas un mode de
  // glisser sur le canevas) : masque les ports sans câble et, avec eux,
  // les boutons de groupe qui n'auraient alors plus lieu d'être. Ne
  // modifie jamais `hiddenGroups` — juste un filtre d'affichage en plus,
  // réversible sans perdre les choix de groupes de chacun.
  const [hideUnusedPorts, setHideUnusedPorts] = useState(false);

  // Le routage (évitement des boîtes, anti-chevauchement) est recalculé
  // pour tous les câbles dès qu'un nœud bouge ou qu'un câble change ;
  // onEdgesChange/onConnect continuent d'agir sur `edges`, pas sur ce
  // tableau dérivé qui ne sert qu'à l'affichage.
  //
  // On se cale sur `nodes` (notre état contrôlé, qui change bien à
  // chaque frame de déplacement) plutôt que sur le store interne de
  // React Flow, dont la référence ne change pas forcément pendant un
  // drag. La position/taille vient donc de `nodes`, et on va chercher
  // un instantané frais des handles (leur position à l'intérieur du
  // nœud) directement dans le store à chaque recalcul.
  //
  // Exception : inverser une carte (bouton ⇄) déplace ses ports sans changer
  // sa taille ni rien dans `nodes` au moment de la remesure — React Flow
  // remesure alors ses handles (updateNodeInternals, voir DeviceNode.tsx)
  // mais seul son store le sait. Cette signature (côté + position de chaque
  // handle, relative au nœud donc stable pendant un simple déplacement) ne
  // change qu'à ce moment-là et relance le calcul. Une chaîne plutôt qu'un
  // objet : useStore compare par ===, deux chaînes identiques ne
  // redéclenchent pas de rendu.
  const handleBoundsKey = useStore((state) => {
    let key = "";
    for (const [nodeId, node] of state.nodeLookup) {
      const bounds = node.internals.handleBounds;
      for (const h of [...(bounds?.source ?? []), ...(bounds?.target ?? [])]) {
        key += `${nodeId}/${h.id}:${h.position}@${h.x},${h.y};`;
      }
    }
    return key;
  });

  const routedEdges = useMemo(() => {
    const nodeLookup = storeApi.getState().nodeLookup;
    // Seuls les appareils sont des obstacles pour le routage : une note de
    // texte est un calque purement décoratif, jamais un objet physique
    // que les câbles devraient contourner.
    const routingNodes: RoutingNode[] = nodes
      .filter((node): node is DeviceNodeType => node.type === "device")
      .map((node) => {
        const bounds = nodeLookup.get(node.id)?.internals.handleBounds;
        const handles: HandleInfo[] = [];
        for (const h of [...(bounds?.source ?? []), ...(bounds?.target ?? [])]) {
          if (h.id != null) {
            handles.push({ id: h.id, x: h.x, y: h.y, width: h.width, height: h.height, position: h.position });
          }
        }
        return {
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width: node.measured?.width ?? 0,
          height: node.measured?.height ?? 0,
          handles,
        };
      });

    const routes = computeRoutes(routingNodes, edges);
    return edges.map((edge) => {
      // La couleur du câble suit le protocole du port de départ (les deux
      // bouts partagent forcément le même protocole ou une paire compatible
      // comme Aux/Analog, qui rendent d'ailleurs dans la même couleur).
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const sourcePort =
        sourceNode?.type === "device" ? sourceNode.data.model.ports.find((p) => p.id === edge.sourceHandle) : undefined;
      const strokeColors = sourcePort ? protocolStrokeColors(sourcePort.protocol) : undefined;
      return { ...edge, data: { ...edge.data, path: routes.get(edge.id), strokeColors } };
    });
    // handleBoundsKey n'est pas lu dans le calcul : c'est seulement un
    // déclencheur (voir plus haut), d'où la désactivation de la règle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, storeApi, handleBoundsKey]);

  // Injecte hideUnusedPorts + l'ensemble des ports connectés dans les
  // données de chaque appareil, juste pour l'affichage — jamais stocké
  // dans `nodes` (même logique que routedEdges ci-dessus) : ça reste à
  // jour tout seul à chaque changement de câblage, sans avoir à
  // réécrire `nodes` à chaque fois qu'un câble apparaît ou disparaît.
  const displayNodes = useMemo(() => {
    if (!hideUnusedPorts) return nodes;
    return nodes.map((node): CanvasNode => {
      if (node.type !== "device") return node;
      const usedPortIds = new Set<string>();
      for (const edge of edges) {
        if (edge.source === node.id && edge.sourceHandle) usedPortIds.add(edge.sourceHandle);
        if (edge.target === node.id && edge.targetHandle) usedPortIds.add(edge.targetHandle);
      }
      return { ...node, data: { ...node.data, hideUnusedPorts, usedPortIds } };
    });
  }, [nodes, edges, hideUnusedPorts]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Bascule un groupe de ports masqué/visible pour un nœud donné. Défini
  // une seule fois (dépend seulement de setNodes, stable) ; chaque nœud
  // reçoit une fermeture qui lui est propre au moment de sa création.
  const onToggleGroup = useCallback(
    (nodeId: string, group: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId && node.type === "device"
            ? { ...node, data: { ...node.data, hiddenGroups: { ...node.data.hiddenGroups, [group]: !node.data.hiddenGroups[group] } } }
            : node,
        ),
      );
    },
    [setNodes],
  );

  // Même principe pour l'inversion gauche/droite des ports d'un appareil.
  const onToggleFlip = useCallback(
    (nodeId: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId && node.type === "device" ? { ...node, data: { ...node.data, flipped: !node.data.flipped } } : node,
        ),
      );
    },
    [setNodes],
  );

  // Même principe pour le texte d'une note : chaque TextNode reçoit sa
  // propre fermeture au moment de sa création (voir onPaneClick).
  const onChangeText = useCallback(
    (nodeId: string, text: string) => {
      setNodes((current) =>
        current.map((node) => (node.id === nodeId && node.type === "text" ? { ...node, data: { ...node.data, text } } : node)),
      );
    },
    [setNodes],
  );

  // Appelé par TextNode à chaque mesure du texte pendant l'édition, avec
  // la taille naturelle (non étirée) du texte tapé. On y applique le
  // ratio d'étirement déjà en place (largeur/hauteur actuelles du nœud
  // divisées par l'ancienne référence) plutôt que de l'écraser : rouvrir
  // une note déjà agrandie pour la corriger continue à l'écrire à la
  // même taille visuelle, elle ne retombe jamais à sa taille naturelle
  // toute seule — seul un redimensionnement manuel (NodeResizer) change
  // ce ratio.
  const onAutoFitText = useCallback(
    (nodeId: string, fitWidth: number, fitHeight: number) => {
      setNodes((current) =>
        current.map((node) => {
          if (node.id !== nodeId || node.type !== "text") return node;
          const prevBaseWidth = node.data.baseWidth ?? fitWidth;
          const prevBaseHeight = node.data.baseHeight ?? fitHeight;
          const scaleX = (node.width ?? prevBaseWidth) / prevBaseWidth;
          const scaleY = (node.height ?? prevBaseHeight) / prevBaseHeight;
          return {
            ...node,
            width: fitWidth * scaleX,
            height: fitHeight * scaleY,
            data: { ...node.data, baseWidth: fitWidth, baseHeight: fitHeight },
          };
        }),
      );
    },
    [setNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const modelId = event.dataTransfer.getData(DEVICE_MODEL_MIME_TYPE);
      const model = catalog.find((candidate) => candidate.id === modelId);
      if (!model) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = nextNodeId("device");
      const newNode: DeviceNodeType = {
        id,
        type: "device",
        position,
        data: {
          model,
          hiddenGroups: defaultHiddenGroups(model),
          onToggleGroup: (group) => onToggleGroup(id, group),
          onToggleFlip: () => onToggleFlip(id),
        },
      };
      setNodes((current) => current.concat(newNode));
    },
    [screenToFlowPosition, setNodes, onToggleGroup, onToggleFlip, catalog],
  );

  // Outil "Texte" : un clic sur le canevas (pane) pose une note vide, déjà
  // sélectionnée et en édition (voir TextNode.tsx, qui entre en édition
  // dès que son texte est vide) ; l'outil se désactive juste après, pour
  // qu'un simple clic ne pose pas une note à chaque fois qu'on clique
  // ensuite sur le canevas.
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool !== "text") return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = nextNodeId("text");
      const newNode: TextNodeType = {
        id,
        type: "text",
        position,
        width: TEXT_NODE_MIN_WIDTH,
        height: TEXT_NODE_MIN_HEIGHT,
        selected: true,
        data: {
          text: "",
          onChangeText: (text) => onChangeText(id, text),
          onAutoFit: (w, h) => onAutoFitText(id, w, h),
          baseWidth: TEXT_NODE_MIN_WIDTH,
          baseHeight: TEXT_NODE_MIN_HEIGHT,
        },
      };
      setNodes((current) => current.map((node): CanvasNode => ({ ...node, selected: false })).concat(newNode));
      setActiveTool("pan");
    },
    [activeTool, screenToFlowPosition, setNodes, onChangeText, onAutoFitText],
  );

  // Outil "Rectangle" : cliquer-glisser sur le canevas (pane, jamais sur
  // un nœud existant — voir la vérification du target) trace un
  // rectangle en direct. Contrairement à l'outil Texte (un clic suffit),
  // ceci demande de suivre un vrai glisser ; React Flow n'expose pas de
  // onPaneMouseDown/Up dédiés, donc ces gestionnaires sont posés en DOM
  // brut sur le conteneur englobant (même élément que onDrop/onDragOver).
  // Un ref (pas un state) pour le point de départ : aucun rendu n'est
  // nécessaire tant que le rectangle lui-même ne change pas — c'est
  // setNodes qui déclenche déjà les rendus utiles pendant le glisser.
  const drawingRectRef = useRef<{ id: string; startX: number; startY: number } | null>(null);

  const onCanvasMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (activeTool !== "rect") return;
      if (!(event.target instanceof HTMLElement) || !event.target.classList.contains("react-flow__pane")) return;
      const start = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const id = nextNodeId("rect");
      drawingRectRef.current = { id, startX: start.x, startY: start.y };
      const newNode: RectNodeType = {
        id,
        type: "rect",
        position: start,
        width: RECT_MIN_SIZE,
        height: RECT_MIN_SIZE,
        zIndex: -1,
        data: {},
      };
      setNodes((current) => current.map((node): CanvasNode => ({ ...node, selected: false })).concat(newNode));
    },
    [activeTool, screenToFlowPosition, setNodes],
  );

  const onCanvasMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const drawing = drawingRectRef.current;
      if (!drawing) return;
      const current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const x = Math.min(drawing.startX, current.x);
      const y = Math.min(drawing.startY, current.y);
      const width = Math.max(RECT_MIN_SIZE, Math.abs(current.x - drawing.startX));
      const height = Math.max(RECT_MIN_SIZE, Math.abs(current.y - drawing.startY));
      setNodes((nodes) =>
        nodes.map((node) => (node.id === drawing.id ? { ...node, position: { x, y }, width, height } : node)),
      );
    },
    [screenToFlowPosition, setNodes],
  );

  // Un simple mousedown+mouseup (sans déplacement notable) déclenche
  // toujours un "click" natif juste après — React Flow s'en sert pour
  // désélectionner tout ce qui est sélectionné sur le pane. Sélectionner
  // le rectangle ici, dans onMouseUp, se ferait donc aussitôt défaire par
  // ce clic qui suit. On mémorise juste qu'un clic est à ignorer, et
  // onCanvasClickCapture (capture = avant que quoi que ce soit d'autre,
  // React Flow y compris, ne le voie) l'arrête net avec stopPropagation.
  const suppressNextClickRef = useRef(false);

  // Pas de onMouseUp={...} en prop React ici : React Flow arrête lui-même
  // la propagation du mouseup qui termine un geste sur le pane (pour
  // qu'il ne soit pas aussi lu comme un simple clic ailleurs) — ce
  // mouseup n'atteint donc jamais un écouteur posé plus haut dans l'arbre
  // via la délégation React habituelle, capture ou bulle. Un écouteur natif
  // sur window, en phase de CAPTURE, s'exécute avant que quoi que ce soit
  // (React Flow y compris) ne puisse l'arrêter — capture va toujours de la
  // racine vers la cible, rien de plus profond ne peut intercepter avant.
  useEffect(() => {
    function handleWindowMouseUp(event: MouseEvent) {
      const drawing = drawingRectRef.current;
      if (!drawing) return;
      // stopPropagation ici, pas seulement sur le clic qui suit : si le
      // tracé se termine pile sur un appareil existant, React Flow
      // sélectionne CET appareil dès ce même mouseup (le même réflexe
      // "gérer sa propre sélection dès le relâchement, pas au clic
      // suivant" que celui qu'on vient d'adopter nous-mêmes) — écraserait
      // sinon la sélection du rectangle qu'on pose juste en dessous.
      event.stopPropagation();
      drawingRectRef.current = null;
      suppressNextClickRef.current = true;
      setNodes((current) => current.map((node) => (node.id === drawing.id ? { ...node, selected: true } : node)));
      setActiveTool("pan");
    }
    window.addEventListener("mouseup", handleWindowMouseUp, true);
    return () => window.removeEventListener("mouseup", handleWindowMouseUp, true);
  }, [setNodes]);

  const onCanvasClickCapture = useCallback((event: React.MouseEvent) => {
    if (!suppressNextClickRef.current) return;
    suppressNextClickRef.current = false;
    event.stopPropagation();
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!createIsValidConnection(nodes, edges)(connection)) return;
      setEdges((current) => addEdge(connection, current));
    },
    [nodes, edges, setEdges],
  );

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onClickCapture={onCanvasClickCapture}
    >
      <ReactFlow
        nodes={displayNodes}
        edges={routedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={createIsValidConnection(nodes, edges)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={defaultEdgeOptions}
        selectionOnDrag={activeTool === "select"}
        panOnDrag={activeTool === "select" || activeTool === "rect" ? [1, 2] : true}
        onPaneClick={onPaneClick}
        // Ctrl (Windows/Linux) fonctionne déjà par défaut (Meta sur Mac) ;
        // Shift s'ajoute explicitement comme second déclencheur équivalent
        // pour le clic-ajout à la sélection — un tableau accepte plusieurs
        // touches indifféremment, pas seulement une combinaison unique.
        multiSelectionKeyCode={["Control", "Meta", "Shift"]}
      >
        <Background />
        <Panel position="top-center">
          <Toolbar
            activeTool={activeTool}
            onSelectTool={(tool) => setActiveTool((current) => (current === tool ? "pan" : tool))}
            hideUnusedPorts={hideUnusedPorts}
            onToggleHideUnusedPorts={() => setHideUnusedPorts((v) => !v)}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
