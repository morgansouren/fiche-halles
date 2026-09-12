import { Position, type Edge, type InternalNode } from "@xyflow/react";

// Routage des câbles : trajectoire en équerre qui évite les boîtes des
// autres appareils et s'écarte des câbles déjà tracés (recherche de
// chemin sur une grille, façon A*). Aucune dépendance React ici : ce
// module ne fait que du calcul géométrique.

export interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CELL_SIZE = 10;
const NODE_MARGIN = 12; // les câbles ne longent jamais une boîte de trop près
const STUB_LENGTH = 24; // distance parcourue perpendiculairement avant de pouvoir tourner
const TURN_PENALTY = 4;
const REUSE_PENALTY = 6; // pénalité par câble déjà passé par une cellule (anti-chevauchement)
const GRID_PADDING = 100;

const DIRECTION_VECTOR: Record<Position, Point> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

function nodeBox(node: InternalNode): Box {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured?.width ?? 0,
    height: node.measured?.height ?? 0,
  };
}

function inflate(box: Box, margin: number): Box {
  return { x: box.x - margin, y: box.y - margin, width: box.width + margin * 2, height: box.height + margin * 2 };
}

function findHandle(node: InternalNode, handleId: string | null | undefined) {
  if (!handleId) return undefined;
  const bounds = node.internals.handleBounds;
  return bounds?.source?.find((h) => h.id === handleId) ?? bounds?.target?.find((h) => h.id === handleId);
}

function handleCenter(node: InternalNode, handle: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: node.internals.positionAbsolute.x + handle.x + handle.width / 2,
    y: node.internals.positionAbsolute.y + handle.y + handle.height / 2,
  };
}

interface Grid {
  originX: number;
  originY: number;
  cols: number;
  rows: number;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function pointToCell(grid: Grid, p: Point) {
  return {
    col: Math.round((p.x - grid.originX) / CELL_SIZE),
    row: Math.round((p.y - grid.originY) / CELL_SIZE),
  };
}

function cellToPoint(grid: Grid, col: number, row: number): Point {
  return { x: grid.originX + col * CELL_SIZE, y: grid.originY + row * CELL_SIZE };
}

function boxToCells(grid: Grid, box: Box): Set<string> {
  const cells = new Set<string>();
  const minCol = Math.floor((box.x - grid.originX) / CELL_SIZE);
  const maxCol = Math.ceil((box.x + box.width - grid.originX) / CELL_SIZE);
  const minRow = Math.floor((box.y - grid.originY) / CELL_SIZE);
  const maxRow = Math.ceil((box.y + box.height - grid.originY) / CELL_SIZE);
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      cells.add(cellKey(col, row));
    }
  }
  return cells;
}

const NEIGHBOR_DIRECTIONS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function directionsEqual(a: Point | null, b: Point): boolean {
  return !!a && a.x === b.x && a.y === b.y;
}

function heuristic(a: { col: number; row: number }, b: { col: number; row: number }): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Recherche de chemin A* sur la grille, 4 directions, avec pénalité de
// virage (chemins plus lisibles) et pénalité de réutilisation de cellule
// (répartit les câbles qui emprunteraient sinon exactement le même trajet).
// Repli : renvoie null si aucun chemin n'existe (grille bloquée).
function findPath(
  grid: Grid,
  start: { col: number; row: number },
  goal: { col: number; row: number },
  startDir: Point,
  blocked: Set<string>,
  usage: Map<string, number>,
): { col: number; row: number }[] | null {
  const startKey = cellKey(start.col, start.row);
  const goalKey = cellKey(goal.col, goal.row);
  const closed = new Set<string>();
  const cameFrom = new Map<string, string>();
  const dirAt = new Map<string, Point>();
  const gScore = new Map<string, number>();

  gScore.set(startKey, 0);
  dirAt.set(startKey, startDir);

  const openList: { key: string; col: number; row: number; f: number }[] = [
    { key: startKey, col: start.col, row: start.row, f: heuristic(start, goal) },
  ];

  while (openList.length > 0) {
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;
    if (closed.has(current.key)) continue;
    if (current.key === goalKey) {
      const path: { col: number; row: number }[] = [{ col: current.col, row: current.row }];
      let key = current.key;
      while (cameFrom.has(key)) {
        key = cameFrom.get(key)!;
        const [col, row] = key.split(",").map(Number);
        path.unshift({ col, row });
      }
      return path;
    }
    closed.add(current.key);

    const currentDir = dirAt.get(current.key) ?? startDir;
    const currentG = gScore.get(current.key) ?? 0;

    for (const dir of NEIGHBOR_DIRECTIONS) {
      const nCol = current.col + dir.x;
      const nRow = current.row + dir.y;
      const nKey = cellKey(nCol, nRow);
      if (closed.has(nKey)) continue;
      if (nCol < 0 || nRow < 0 || nCol >= grid.cols || nRow >= grid.rows) continue;
      if (blocked.has(nKey) && nKey !== goalKey) continue;

      const turnCost = directionsEqual(currentDir, dir) ? 0 : TURN_PENALTY;
      const reuseCost = (usage.get(nKey) ?? 0) * REUSE_PENALTY;
      const tentativeG = currentG + 1 + turnCost + reuseCost;

      if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
        gScore.set(nKey, tentativeG);
        cameFrom.set(nKey, current.key);
        dirAt.set(nKey, dir);
        const f = tentativeG + heuristic({ col: nCol, row: nRow }, goal);
        openList.push({ key: nKey, col: nCol, row: nRow, f });
      }
    }
  }

  return null;
}

// Fusionne les points alignés consécutifs pour ne garder que les coudes
// réels (sinon on aurait un point par cellule de grille traversée).
function simplify(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const result: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const cur = points[i];
    const next = points[i + 1];
    const dx1 = cur.x - prev.x;
    const dy1 = cur.y - prev.y;
    const dx2 = next.x - cur.x;
    const dy2 = next.y - cur.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    const sameDirection = Math.sign(dx1) === Math.sign(dx2) && Math.sign(dy1) === Math.sign(dy2);
    if (!(cross === 0 && sameDirection)) {
      result.push(cur);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

export function computeRoutes(nodeLookup: Map<string, InternalNode>, edges: Edge[]): Map<string, Point[]> {
  const routes = new Map<string, Point[]>();
  const usage = new Map<string, number>();

  const measuredNodes = Array.from(nodeLookup.values()).filter((n) => n.internals.handleBounds && n.measured?.width);
  if (measuredNodes.length === 0) return routes;

  const boxes = measuredNodes.map((n) => ({ id: n.id, box: nodeBox(n) }));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { box } of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  minX -= GRID_PADDING;
  minY -= GRID_PADDING;
  maxX += GRID_PADDING;
  maxY += GRID_PADDING;

  const grid: Grid = {
    originX: minX,
    originY: minY,
    cols: Math.max(1, Math.ceil((maxX - minX) / CELL_SIZE)),
    rows: Math.max(1, Math.ceil((maxY - minY) / CELL_SIZE)),
  };

  const blockedByNode = new Map<string, Set<string>>();
  for (const { id, box } of boxes) {
    blockedByNode.set(id, boxToCells(grid, inflate(box, NODE_MARGIN)));
  }

  for (const edge of edges) {
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceHandle = findHandle(sourceNode, edge.sourceHandle);
    const targetHandle = findHandle(targetNode, edge.targetHandle);
    if (!sourceHandle || !targetHandle) continue;

    const startPoint = handleCenter(sourceNode, sourceHandle);
    const endPoint = handleCenter(targetNode, targetHandle);
    const startDir = DIRECTION_VECTOR[sourceHandle.position];
    const endDir = DIRECTION_VECTOR[targetHandle.position];

    const stubStart: Point = { x: startPoint.x + startDir.x * STUB_LENGTH, y: startPoint.y + startDir.y * STUB_LENGTH };
    const stubEnd: Point = { x: endPoint.x + endDir.x * STUB_LENGTH, y: endPoint.y + endDir.y * STUB_LENGTH };

    const blocked = new Set<string>();
    for (const [nodeId, cells] of blockedByNode) {
      if (nodeId === edge.source || nodeId === edge.target) continue;
      for (const c of cells) blocked.add(c);
    }

    const startCell = pointToCell(grid, stubStart);
    const goalCell = pointToCell(grid, stubEnd);
    const cellPath = findPath(grid, startCell, goalCell, startDir, blocked, usage);

    let waypoints: Point[];
    if (cellPath) {
      const gridPoints = cellPath.map((c) => cellToPoint(grid, c.col, c.row));
      waypoints = simplify([startPoint, stubStart, ...gridPoints, stubEnd, endPoint]);
      for (const c of cellPath) {
        const key = cellKey(c.col, c.row);
        usage.set(key, (usage.get(key) ?? 0) + 1);
      }
    } else {
      // repli si aucun chemin n'a été trouvé (grille bloquée) : au moins
      // respecter les tronçons perpendiculaires en sortie/entrée de port
      waypoints = [startPoint, stubStart, stubEnd, endPoint];
    }

    routes.set(edge.id, waypoints);
  }

  return routes;
}
