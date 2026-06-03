import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  type EdgeProps,
  useReactFlow,
} from "@xyflow/react";
import React, { useCallback } from "react";
import type { VentureGraphEdge } from "@/pages/ventures/utils/layout";

type Point = { x: number; y: number };
type Rect = { id: string; x: number; y: number; width: number; height: number };

const EDGE_CLEARANCE = 34;
const NODE_CLEARANCE = 26;
const CORNER_RADIUS = 18;

const clampLabelPosition = (position: number) =>
  Math.min(0.95, Math.max(0.05, position));

const inflateRect = (rect: Rect, padding: number): Rect => ({
  id: rect.id,
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

const rangesOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) => Math.max(startA, startB) <= Math.min(endA, endB);

const rectIntersectsVertical = (
  rect: Rect,
  x: number,
  y1: number,
  y2: number,
) =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  rangesOverlap(
    Math.min(y1, y2),
    Math.max(y1, y2),
    rect.y,
    rect.y + rect.height,
  );

const rectIntersectsHorizontal = (
  rect: Rect,
  y: number,
  x1: number,
  x2: number,
) =>
  y >= rect.y &&
  y <= rect.y + rect.height &&
  rangesOverlap(
    Math.min(x1, x2),
    Math.max(x1, x2),
    rect.x,
    rect.x + rect.width,
  );

const uniquePoints = (points: Point[]) =>
  points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });

const roundedOrthogonalPath = (rawPoints: Point[]) => {
  const points = uniquePoints(rawPoints);
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incomingDistance = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
    );
    const outgoingDistance = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(
      CORNER_RADIUS,
      incomingDistance / 2,
      outgoingDistance / 2,
    );

    if (radius <= 0) {
      commands.push(`L ${current.x} ${current.y}`);
      continue;
    }

    const beforeCorner = {
      x: current.x + ((previous.x - current.x) / incomingDistance) * radius,
      y: current.y + ((previous.y - current.y) / incomingDistance) * radius,
    };
    const afterCorner = {
      x: current.x + ((next.x - current.x) / outgoingDistance) * radius,
      y: current.y + ((next.y - current.y) / outgoingDistance) * radius,
    };

    commands.push(`L ${beforeCorner.x} ${beforeCorner.y}`);
    commands.push(
      `Q ${current.x} ${current.y} ${afterCorner.x} ${afterCorner.y}`,
    );
  }

  const lastPoint = points[points.length - 1];
  commands.push(`L ${lastPoint.x} ${lastPoint.y}`);
  return commands.join(" ");
};

const routeOrthogonalEdge = ({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  nodeRects,
}: {
  source?: string;
  target?: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  nodeRects: Rect[];
}) => {
  const startLaneY = sourceY + EDGE_CLEARANCE;
  const endLaneY = targetY - EDGE_CLEARANCE;
  const obstacles = nodeRects
    .filter((rect) => rect.id !== source && rect.id !== target)
    .map((rect) => inflateRect(rect, NODE_CLEARANCE));

  if (targetY <= sourceY + EDGE_CLEARANCE * 2 || endLaneY <= startLaneY) {
    return undefined;
  }

  const blockers = obstacles.filter((rect) =>
    rectIntersectsVertical(rect, targetX, startLaneY, endLaneY),
  );
  let routeX = targetX;

  if (blockers.length) {
    const allXValues = obstacles.flatMap((rect) => [
      rect.x,
      rect.x + rect.width,
    ]);
    const candidates = [
      ...blockers.flatMap((rect) => [
        rect.x - NODE_CLEARANCE,
        rect.x + rect.width + NODE_CLEARANCE,
      ]),
      Math.min(...allXValues, sourceX, targetX) - NODE_CLEARANCE * 2,
      Math.max(...allXValues, sourceX, targetX) + NODE_CLEARANCE * 2,
    ];

    const scoredCandidates = candidates.map((candidateX) => {
      const verticalHits = obstacles.filter((rect) =>
        rectIntersectsVertical(rect, candidateX, startLaneY, endLaneY),
      ).length;
      const topHorizontalHits = obstacles.filter((rect) =>
        rectIntersectsHorizontal(rect, startLaneY, sourceX, candidateX),
      ).length;
      const bottomHorizontalHits = obstacles.filter((rect) =>
        rectIntersectsHorizontal(rect, endLaneY, candidateX, targetX),
      ).length;
      return {
        candidateX,
        hits: verticalHits + topHorizontalHits + bottomHorizontalHits,
        distance:
          Math.abs(candidateX - targetX) +
          Math.abs(candidateX - sourceX) * 0.25,
      };
    });

    scoredCandidates.sort(
      (left, right) => left.hits - right.hits || left.distance - right.distance,
    );
    routeX = scoredCandidates[0]?.candidateX ?? targetX;
  }

  return roundedOrthogonalPath([
    { x: sourceX, y: sourceY },
    { x: sourceX, y: startLaneY },
    { x: routeX, y: startLaneY },
    { x: routeX, y: endLaneY },
    { x: targetX, y: endLaneY },
    { x: targetX, y: targetY },
  ]);
};

const createSvgPath = (edgePath: string) => {
  if (typeof document === "undefined") return undefined;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", edgePath);
  return path;
};

const pointAtPathPosition = (
  edgePath: string,
  position: number,
  fallback: { x: number; y: number },
) => {
  const path = createSvgPath(edgePath);
  if (!path) return fallback;

  try {
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return fallback;
    const point = path.getPointAtLength(length * clampLabelPosition(position));
    return { x: point.x, y: point.y };
  } catch {
    return fallback;
  }
};

const nearestPathPosition = (
  edgePath: string,
  flowPoint: { x: number; y: number },
) => {
  const path = createSvgPath(edgePath);
  if (!path) return 0.5;

  try {
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return 0.5;

    let bestPosition = 0.5;
    let bestDistance = Number.POSITIVE_INFINITY;
    const samples = 96;
    for (let index = 0; index <= samples; index += 1) {
      const position = index / samples;
      const point = path.getPointAtLength(length * position);
      const distance = Math.hypot(point.x - flowPoint.x, point.y - flowPoint.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPosition = position;
      }
    }
    return clampLabelPosition(bestPosition);
  } catch {
    return 0.5;
  }
};

export const OwnershipEdge: React.FC<EdgeProps<VentureGraphEdge>> = ({
  id,
  source,
  sourceX,
  sourceY,
  target,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  label,
  style,
  markerEnd,
  markerStart,
  pathOptions,
  interactionWidth,
  data,
}) => {
  const { screenToFlowPosition } = useReactFlow();
  const rawPathOptions: unknown = pathOptions;
  const resolvedPathOptions =
    rawPathOptions && typeof rawPathOptions === "object"
      ? (rawPathOptions as Record<string, unknown>)
      : {};
  const borderRadius =
    typeof resolvedPathOptions.borderRadius === "number"
      ? resolvedPathOptions.borderRadius
      : 20;
  const offset =
    typeof resolvedPathOptions.offset === "number"
      ? resolvedPathOptions.offset
      : 34;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius,
    offset,
  });
  const routedPath = routeOrthogonalEdge({
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    nodeRects: data?.nodeRects ?? [],
  });
  const resolvedEdgePath = routedPath ?? edgePath;
  const labelPosition =
    typeof data?.labelPosition === "number" ? data.labelPosition : 0.5;
  const labelPoint = pointAtPathPosition(resolvedEdgePath, labelPosition, {
    x: labelX,
    y: labelY,
  });

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const updatePosition = (clientX: number, clientY: number) => {
        const flowPoint = screenToFlowPosition({ x: clientX, y: clientY });
        data?.onLabelPositionChange?.(
          id,
          nearestPathPosition(resolvedEdgePath, flowPoint),
        );
      };
      updatePosition(event.clientX, event.clientY);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updatePosition(moveEvent.clientX, moveEvent.clientY);
      };
      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [data, id, resolvedEdgePath, screenToFlowPosition],
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={resolvedEdgePath}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={interactionWidth}
      />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute z-30 cursor-grab rounded-full border border-slate-200 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            style={{
              transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};
