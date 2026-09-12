import { Position } from "@xyflow/react";

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

export interface HandleInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  position: Position;
}

// Représentation minimale d'un nœud dont routing.ts a besoin : la
// position/taille vient de l'état React (fiable à chaque frame de
// déplacement) et les handles viennent d'un instantané du store React
// Flow — les deux sont fournis par l'appelant (FlowCanvas), routing.ts
// ne connaît pas les types internes de React Flow.
export interface RoutingNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  handles: HandleInfo[];
}

export interface RoutingEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

const CELL_SIZE = 10;
const NODE_MARGIN = 12; // les câbles ne longent jamais une boîte de trop près
const STUB_LENGTH_CELLS = 3; // cellules parcourues perpendiculairement avant de pouvoir tourner
const TURN_PENALTY = 4;
const REUSE_PENALTY = 6; // pénalité par câble déjà passé par une cellule (anti-chevauchement)
const GRID_PADDING = 100;

const DIRECTION_VECTOR: Record<Position, Point> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

function inflate(box: Box, margin: number): Box {
  return { x: box.x - margin, y: box.y - margin, width: box.width + margin * 2, height: box.height + margin * 2 };
}

function handleCenter(node: RoutingNode, handle: HandleInfo): Point {
  return { x: node.x + handle.x + handle.width / 2, y: node.y + handle.y + handle.height / 2 };
}

interface Grid {
  originX: number;
  originY: number;
  cols: number;
  rows: number;
}

interface Cell {
  col: number;
  row: number;
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

function pointToCell(grid: Grid, p: Point): Cell {
  return {
    col: Math.round((p.x - grid.originX) / CELL_SIZE),
    row: Math.round((p.y - grid.originY) / CELL_SIZE),
  };
}

function cellToPoint(grid: Grid, cell: Cell): Point {
  return { x: grid.originX + cell.col * CELL_SIZE, y: grid.originY + cell.row * CELL_SIZE };
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

function heuristic(a: Cell, b: Cell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

// Avance cellule par cellule dans une direction fixe, en s'arrêtant net
// si la cellule suivante est bloquée (une autre boîte est trop proche du
// port) — garantit qu'un tronçon perpendiculaire ne traverse jamais un
// obstacle, même s'il ne peut pas atteindre sa longueur idéale.
function walkStub(grid: Grid, start: Cell, dir: Point, maxSteps: number, blocked: Set<string>): Cell[] {
  const cells: Cell[] = [start];
  let current = start;
  for (let i = 0; i < maxSteps; i++) {
    const next = { col: current.col + dir.x, row: current.row + dir.y };
    if (next.col < 0 || next.row < 0 || next.col >= grid.cols || next.row >= grid.rows) break;
    if (blocked.has(cellKey(next.col, next.row))) break;
    cells.push(next);
    current = next;
  }
  return cells;
}

// Recherche de chemin A* sur la grille, 4 directions, avec pénalité de
// virage (chemins plus lisibles) et pénalité de réutilisation de cellule
// (répartit les câbles qui emprunteraient sinon exactement le même trajet).
// Repli : renvoie null si aucun chemin n'existe (grille bloquée).
function findPath(
  grid: Grid,
  start: Cell,
  goal: Cell,
  startDir: Point,
  blocked: Set<string>,
  usage: Map<string, number>,
): Cell[] | null {
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
      const path: Cell[] = [{ col: current.col, row: current.row }];
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

export function computeRoutes(nodes: RoutingNode[], edges: RoutingEdge[]): Map<string, Point[]> {
  const routes = new Map<string, Point[]>();
  const usage = new Map<string, number>();
  if (nodes.length === 0) return routes;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
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
  for (const n of nodes) {
    blockedByNode.set(n.id, boxToCells(grid, inflate({ x: n.x, y: n.y, width: n.width, height: n.height }, NODE_MARGIN)));
  }

  for (const edge of edges) {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceHandle = sourceNode.handles.find((h) => h.id === edge.sourceHandle);
    const targetHandle = targetNode.handles.find((h) => h.id === edge.targetHandle);
    if (!sourceHandle || !targetHandle) continue;

    const startPoint = handleCenter(sourceNode, sourceHandle);
    const endPoint = handleCenter(targetNode, targetHandle);
    const startDir = DIRECTION_VECTOR[sourceHandle.position];
    const endDir = DIRECTION_VECTOR[targetHandle.position];

    // Chaque tronçon de sortie/entrée ignore uniquement la boîte de SON
    // PROPRE appareil (pour pouvoir la quitter) ; le trajet principal, lui,
    // respecte les deux boîtes — sinon le câble peut couper à travers
    // l'intérieur de l'appareil cible pour l'atteindre par un autre côté.
    const blockedForSourceStub = new Set<string>();
    const blockedForTargetStub = new Set<string>();
    const blockedForSearch = new Set<string>();
    for (const [nodeId, cells] of blockedByNode) {
      for (const c of cells) {
        blockedForSearch.add(c);
        if (nodeId !== edge.source) blockedForSourceStub.add(c);
        if (nodeId !== edge.target) blockedForTargetStub.add(c);
      }
    }

    const startStubCells = walkStub(grid, pointToCell(grid, startPoint), startDir, STUB_LENGTH_CELLS, blockedForSourceStub);
    const endStubCells = walkStub(grid, pointToCell(grid, endPoint), endDir, STUB_LENGTH_CELLS, blockedForTargetStub);

    const aStarStart = startStubCells[startStubCells.length - 1];
    const aStarGoal = endStubCells[endStubCells.length - 1];
    const cellPath = findPath(grid, aStarStart, aStarGoal, startDir, blockedForSearch, usage);

    let waypoints: Point[];
    const usedCells: Cell[] = [...startStubCells];
    if (cellPath) {
      usedCells.push(...cellPath.slice(1));
      usedCells.push(...[...endStubCells].reverse().slice(1));
      const middlePoints = cellPath.map((c) => cellToPoint(grid, c));
      const endStubPoints = [...endStubCells].reverse().map((c) => cellToPoint(grid, c));
      waypoints = simplify([startPoint, ...middlePoints, ...endStubPoints, endPoint]);
    } else {
      // repli si aucun chemin n'a été trouvé (grille bloquée) : au moins
      // respecter les tronçons perpendiculaires en sortie/entrée de port
      console.warn(`[routing] findPath a échoué pour ${edge.id} — repli en ligne droite entre les tronçons`);
      usedCells.push(...[...endStubCells].reverse());
      const stubPoints = startStubCells.map((c) => cellToPoint(grid, c));
      const endStubPoints = [...endStubCells].reverse().map((c) => cellToPoint(grid, c));
      waypoints = simplify([startPoint, ...stubPoints, ...endStubPoints, endPoint]);
    }

    for (const c of usedCells) {
      const key = cellKey(c.col, c.row);
      usage.set(key, (usage.get(key) ?? 0) + 1);
    }

    routes.set(edge.id, waypoints);
  }

  return routes;
}
