import { useCallback, useMemo, useRef, useState } from "react";
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
  useStoreApi,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { catalog } from "../domain/catalog";
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
  }, [nodes, edges, storeApi]);

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
        data: { model, hiddenGroups: defaultHiddenGroups(model), onToggleGroup: (group) => onToggleGroup(id, group) },
      };
      setNodes((current) => current.concat(newNode));
    },
    [screenToFlowPosition, setNodes, onToggleGroup],
  );

  // Voir plus bas (onCanvasMouseUp) : mémorise l'id du rectangle qu'on
  // vient de finir de tracer, pour que onPaneClick (déclenché juste après
  // par React Flow, une fois sa propre désélection de pane appliquée) le
  // sélectionne pour de bon.
  const lastDrawnRectIdRef = useRef<string | null>(null);

  // Outil "Texte" : un clic sur le canevas (pane) pose une note vide, déjà
  // sélectionnée et en édition (voir TextNode.tsx, qui entre en édition
  // dès que son texte est vide) ; l'outil se désactive juste après, pour
  // qu'un simple clic ne pose pas une note à chaque fois qu'on clique
  // ensuite sur le canevas.
  //
  // Sert aussi à finaliser la sélection d'un rectangle tout juste tracé
  // (voir onCanvasMouseUp) : un simple mousedown+mouseup sur le même
  // point déclenche toujours un "click" ensuite, que React Flow utilise
  // pour désélectionner tout ce qui est sélectionné sur le pane — si on
  // sélectionnait le rectangle dès le mouseup, ce clic la déferait
  // aussitôt. En la posant ici, dans le même callback que React Flow
  // appelle *après* sa propre désélection, la sélection survit — exactement
  // le mécanisme qui permet déjà à une note de texte de rester
  // sélectionnée après sa création juste au-dessus.
  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (lastDrawnRectIdRef.current) {
        const id = lastDrawnRectIdRef.current;
        lastDrawnRectIdRef.current = null;
        setNodes((current) => current.map((node) => (node.id === id ? { ...node, selected: true } : node)));
        return;
      }
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

  const onCanvasMouseUp = useCallback(() => {
    const drawing = drawingRectRef.current;
    if (!drawing) return;
    drawingRectRef.current = null;
    lastDrawnRectIdRef.current = drawing.id;
    setActiveTool("pan");
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
      onMouseUp={onCanvasMouseUp}
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
