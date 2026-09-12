import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
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
import { createIsValidConnection } from "./connectionValidation";
import { DEVICE_MODEL_MIME_TYPE } from "../palette/Palette";
import { PatchCableEdge } from "./PatchCableEdge";
import { protocolStrokeColors } from "./protocolColors";
import { computeRoutes, type HandleInfo, type RoutingNode } from "./routing";

const nodeTypes = { device: DeviceNode };
const edgeTypes = { patchCable: PatchCableEdge };
const defaultEdgeOptions = { type: "patchCable" };

let nodeIdCounter = 0;
function nextNodeId(): string {
  nodeIdCounter += 1;
  return `device-${nodeIdCounter}`;
}

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();
  const storeApi = useStoreApi();

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
    const routingNodes: RoutingNode[] = nodes.map((node) => {
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
      const sourcePort = sourceNode?.data.model.ports.find((p) => p.id === edge.sourceHandle);
      const strokeColors = sourcePort ? protocolStrokeColors(sourcePort.protocol) : undefined;
      return { ...edge, data: { ...edge.data, path: routes.get(edge.id), strokeColors } };
    });
  }, [nodes, edges, storeApi]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const modelId = event.dataTransfer.getData(DEVICE_MODEL_MIME_TYPE);
      const model = catalog.find((candidate) => candidate.id === modelId);
      if (!model) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newNode: DeviceNodeType = {
        id: nextNodeId(),
        type: "device",
        position,
        data: { model },
      };
      setNodes((current) => current.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!createIsValidConnection(nodes, edges)(connection)) return;
      setEdges((current) => addEdge(connection, current));
    },
    [nodes, edges, setEdges],
  );

  return (
    <div style={{ width: "100%", height: "100%" }} onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={routedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={createIsValidConnection(nodes, edges)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode="loose"
        defaultEdgeOptions={defaultEdgeOptions}
      >
        <Background />
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
