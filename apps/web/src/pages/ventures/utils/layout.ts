import type { Edge, Node, Viewport } from "@xyflow/react";
import { MarkerType, Position } from "@xyflow/react";
import { graphlib, layout as dagreLayout } from "dagre";
import type { VentureOverview } from "@/features/ventures/venturesSlice";
import { statusTheme } from "@/pages/ventures/utils/format";

export const FOUNDER_NODE_ID = "founder-root";
export const COMPANY_NODE_WIDTH = 260;
export const COMPANY_NODE_HEIGHT = 150;
export const FOUNDER_NODE_WIDTH = 230;
export const FOUNDER_NODE_HEIGHT = 122;

export type VentureCompanySummary = VentureOverview["companies"][number];

export type VentureCompanyNodeData = Record<string, unknown> & {
  summary: VentureCompanySummary;
};

export type VentureFounderNodeData = Record<string, unknown> & {
  name: string;
  subtitle: string;
  companyCount: number;
  totalPaperValueSek: string;
};

export type VentureCompanyNode = Node<VentureCompanyNodeData, "company">;
export type VentureFounderNode = Node<VentureFounderNodeData, "founder">;
export type VentureGraphNode = VentureCompanyNode | VentureFounderNode;
export type VentureGraphEdge = Edge<Record<string, unknown>, "smoothstep">;

export const companyNodeId = (companyId: string) => `company:${companyId}`;

export const companyIdFromNodeId = (nodeId: string) =>
  nodeId.startsWith("company:") ? nodeId.slice("company:".length) : undefined;

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sortedCompanies = (companies: VentureOverview["companies"]) =>
  [...companies].sort((left, right) => {
    const orderDelta =
      (left.company.display_order ?? 0) - (right.company.display_order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return left.company.name.localeCompare(right.company.name);
  });

const computeRowFallbackPositions = (overview: VentureOverview) => {
  const positions = new Map<string, { x: number; y: number }>();
  const companies = sortedCompanies(overview.companies);
  const rowCounts =
    companies.length > 4
      ? [Math.ceil(companies.length / 2), Math.floor(companies.length / 2)]
      : [companies.length];
  const spacing = 360;
  let cursor = 0;

  rowCounts.forEach((count, rowIndex) => {
    const y = rowIndex === 0 ? 260 : 490;
    const startX = -((count - 1) * spacing) / 2;
    for (let index = 0; index < count; index += 1) {
      const summary = companies[cursor];
      if (!summary) continue;
      positions.set(companyNodeId(summary.company.id), {
        x: startX + index * spacing - COMPANY_NODE_WIDTH / 2,
        y,
      });
      cursor += 1;
    }
  });

  return positions;
};

const computeDagreFallbackPositions = (overview: VentureOverview) => {
  const positions = new Map<string, { x: number; y: number }>();
  const graph = new graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    nodesep: 60,
    ranksep: 130,
    marginx: 80,
    marginy: 40,
  });

  graph.setNode(FOUNDER_NODE_ID, {
    width: FOUNDER_NODE_WIDTH,
    height: FOUNDER_NODE_HEIGHT,
  });

  for (const summary of sortedCompanies(overview.companies)) {
    graph.setNode(companyNodeId(summary.company.id), {
      width: COMPANY_NODE_WIDTH,
      height: COMPANY_NODE_HEIGHT,
    });
  }

  const edgeTargets = new Set<string>();
  for (const edge of overview.ownership_edges) {
    const source = edge.owner_company_id
      ? companyNodeId(edge.owner_company_id)
      : FOUNDER_NODE_ID;
    const target = companyNodeId(edge.company_id);
    if (graph.hasNode(source) && graph.hasNode(target)) {
      graph.setEdge(source, target);
      edgeTargets.add(target);
    }
  }

  for (const summary of overview.companies) {
    const target = companyNodeId(summary.company.id);
    if (!edgeTargets.has(target)) {
      graph.setEdge(FOUNDER_NODE_ID, target);
    }
  }

  dagreLayout(graph);

  for (const nodeId of graph.nodes()) {
    if (nodeId === FOUNDER_NODE_ID) continue;
    const dagreNode = graph.node(nodeId) as { x: number; y: number };
    positions.set(nodeId, {
      x: dagreNode.x - COMPANY_NODE_WIDTH / 2,
      y: dagreNode.y - COMPANY_NODE_HEIGHT / 2,
    });
  }

  return positions;
};

const fallbackPositionsFor = (overview: VentureOverview) => {
  const hasCompanyOwnership = overview.ownership_edges.some(
    (edge) => edge.owner_company_id,
  );
  if (!hasCompanyOwnership && overview.companies.length > 4) {
    return computeRowFallbackPositions(overview);
  }
  return computeDagreFallbackPositions(overview);
};

export const viewportFromLayout = (
  layout: VentureOverview["layout"],
): Viewport | undefined => {
  if (!layout.viewport) return undefined;
  return {
    x: toNumber(layout.viewport.x),
    y: toNumber(layout.viewport.y),
    zoom: toNumber(layout.viewport.zoom) || 1,
  };
};

export const buildVentureGraph = (
  overview: VentureOverview,
): { nodes: VentureGraphNode[]; edges: VentureGraphEdge[] } => {
  const persistedPositions = new Map(
    (overview.layout.nodes ?? []).map((node) => [
      companyNodeId(node.company_id),
      {
        x: toNumber(node.x),
        y: toNumber(node.y),
      },
    ]),
  );
  const fallbackPositions = fallbackPositionsFor(overview);

  const nodes: VentureGraphNode[] = [
    {
      id: FOUNDER_NODE_ID,
      type: "founder",
      position: {
        x: -FOUNDER_NODE_WIDTH / 2,
        y: 20,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        name: "Casper",
        subtitle: "Founder & Owner",
        companyCount: overview.kpis.company_count,
        totalPaperValueSek: overview.kpis.total_paper_value_sek,
      },
      sourcePosition: Position.Bottom,
    },
    ...sortedCompanies(overview.companies).map<VentureCompanyNode>(
      (summary) => {
        const nodeId = companyNodeId(summary.company.id);
        return {
          id: nodeId,
          type: "company",
          position: persistedPositions.get(nodeId) ??
            fallbackPositions.get(nodeId) ?? {
              x: 0,
              y: 260,
            },
          draggable: true,
          selectable: true,
          connectable: false,
          data: { summary },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        };
      },
    ),
  ];

  const explicitEdgeTargets = new Set<string>();
  const edges = overview.ownership_edges
    .map<VentureGraphEdge | undefined>((ownershipEdge, index) => {
      const targetSummary = overview.companies.find(
        (summary) => summary.company.id === ownershipEdge.company_id,
      );
      const source = ownershipEdge.owner_company_id
        ? companyNodeId(ownershipEdge.owner_company_id)
        : FOUNDER_NODE_ID;
      const target = companyNodeId(ownershipEdge.company_id);
      if (!nodes.some((node) => node.id === source)) return undefined;
      if (!nodes.some((node) => node.id === target)) return undefined;
      explicitEdgeTargets.add(target);

      const color = statusTheme(targetSummary?.company.status).edge;
      return {
        id: `ownership-${source}-${target}-${index}`,
        type: "smoothstep",
        source,
        target,
        sourceHandle: "source-bottom",
        targetHandle: "target-top",
        label: `${toNumber(ownershipEdge.ownership_pct).toLocaleString(
          "sv-SE",
          {
            maximumFractionDigits: 1,
          },
        )}%`,
        data: {
          ownerType: ownershipEdge.owner_type,
          ownershipPct: ownershipEdge.ownership_pct,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
        pathOptions: { borderRadius: 20, offset: 34 },
        style: {
          stroke: color,
          strokeOpacity: 0.42,
          strokeWidth: 1.8,
        },
        labelStyle: {
          fill: "#475569",
          fontSize: 11,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "rgba(255,255,255,0.86)",
        },
        selectable: false,
      };
    })
    .filter((edge): edge is VentureGraphEdge => Boolean(edge));

  const fallbackEdges = overview.companies
    .map<VentureGraphEdge | undefined>((summary) => {
      const target = companyNodeId(summary.company.id);
      if (explicitEdgeTargets.has(target)) return undefined;

      const color = statusTheme(summary.company.status).edge;
      return {
        id: `tracked-${FOUNDER_NODE_ID}-${target}`,
        type: "smoothstep",
        source: FOUNDER_NODE_ID,
        target,
        sourceHandle: "source-bottom",
        targetHandle: "target-top",
        data: {
          ownerType: "person",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
        pathOptions: { borderRadius: 20, offset: 34 },
        style: {
          stroke: color,
          strokeDasharray: "5 6",
          strokeOpacity: 0.32,
          strokeWidth: 1.6,
        },
        selectable: false,
      };
    })
    .filter((edge): edge is VentureGraphEdge => Boolean(edge));

  return { nodes, edges: [...edges, ...fallbackEdges] };
};

export const layoutPayloadFromGraph = (
  nodes: VentureGraphNode[],
  viewport: Viewport,
  layoutKey = "default",
): VentureOverview["layout"] => ({
  layout_key: layoutKey,
  nodes: nodes
    .filter((node): node is VentureCompanyNode => node.type === "company")
    .map((node) => ({
      company_id: companyIdFromNodeId(node.id) ?? node.id,
      x: String(Math.round(node.position.x)),
      y: String(Math.round(node.position.y)),
      pinned: true,
    })),
  viewport: {
    x: String(Math.round(viewport.x)),
    y: String(Math.round(viewport.y)),
    zoom: String(Number(viewport.zoom.toFixed(4))),
  },
});
