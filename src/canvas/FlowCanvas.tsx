import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { catalog } from "../domain/catalog";
import { DeviceNode, type DeviceNodeType } from "./DeviceNode";
import { createIsValidConnection } from "./connectionValidation";
import { DEVICE_MODEL_MIME_TYPE } from "../palette/Palette";
import { PatchCableEdge } from "./PatchCableEdge";
import { computeRoutes } from "./routing";

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
  const nodeLookup = useStore((state) => state.nodeLookup);

  // Le routage (évitement des boîtes, anti-chevauchement) est recalculé
  // pour tous les câbles dès qu'un nœud bouge ou qu'un câble change ;
  // onEdgesChange/onConnect continuent d'agir sur `edges`, pas sur ce
  // tableau dérivé qui ne sert qu'à l'affichage.
  const routedEdges = useMemo(() => {
    const routes = computeRoutes(nodeLookup, edges);
    return edges.map((edge) => ({ ...edge, data: { ...edge.data, path: routes.get(edge.id) } }));
  }, [nodeLookup, edges]);

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
