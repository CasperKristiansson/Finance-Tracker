import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import { Building2 } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { EmptyState } from "@/components/composed/empty-state";
import type { VentureOverview } from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import { CompanyNode } from "@/pages/ventures/components/company-node";
import { FounderNode } from "@/pages/ventures/components/founder-node";
import { OwnershipEdge } from "@/pages/ventures/components/ownership-edge";
import { VentureGraphToolbar } from "@/pages/ventures/components/venture-graph-toolbar";
import {
  applyVentureAutoLayout,
  buildVentureGraph,
  companyIdFromNodeId,
  COMPANY_NODE_HEIGHT,
  COMPANY_NODE_WIDTH,
  FOUNDER_NODE_HEIGHT,
  FOUNDER_NODE_WIDTH,
  layoutPayloadFromGraph,
  viewportFromLayout,
  type VentureAutoLayoutPreset,
  type VentureAutoLayoutSpacing,
  type VentureGraphEdge,
  type VentureGraphNodeRect,
  type VentureGraphNode,
} from "@/pages/ventures/utils/layout";

type VentureGraphProps = {
  overview: VentureOverview;
  selectedCompanyId?: string;
  onSelectCompany: (companyId?: string) => void;
  onLayoutChange: (layout: VentureOverview["layout"]) => void;
  onAddCompany?: () => void;
  className?: string;
  children?: React.ReactNode;
};

const nodeTypes = {
  company: CompanyNode,
  founder: FounderNode,
};

const edgeTypes = {
  ownership: OwnershipEdge,
};

const edgeLabelPositionsFromEdges = (edges: VentureGraphEdge[]) =>
  Object.fromEntries(
    edges
      .map((edge) => [edge.id, edge.data?.labelPosition])
      .filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
  );

const nodeRectsFromGraph = (
  nodes: VentureGraphNode[],
): VentureGraphNodeRect[] =>
  nodes.map((node) => {
    const fallbackWidth =
      node.type === "founder" ? FOUNDER_NODE_WIDTH : COMPANY_NODE_WIDTH;
    const fallbackHeight =
      node.type === "founder" ? FOUNDER_NODE_HEIGHT : COMPANY_NODE_HEIGHT;
    return {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? fallbackWidth,
      height: node.measured?.height ?? node.height ?? fallbackHeight,
    };
  });

type VentureGraphCanvasProps = {
  graphKey: string;
  initialNodes: VentureGraphNode[];
  edges: VentureGraphEdge[];
  initialViewport?: Viewport;
  layoutKey?: string;
  hasCompanies: boolean;
} & Omit<VentureGraphProps, "overview">;

const VentureGraphCanvas: React.FC<VentureGraphCanvasProps> = ({
  initialNodes,
  edges,
  initialViewport,
  layoutKey,
  hasCompanies,
  selectedCompanyId,
  onSelectCompany,
  onLayoutChange,
  onAddCompany,
  className,
  children,
}) => {
  const [nodes, setNodes] = useState<VentureGraphNode[]>(initialNodes);
  const [edgeLabelPositions, setEdgeLabelPositions] = useState<
    Record<string, number>
  >(() => edgeLabelPositionsFromEdges(edges));
  const nodesRef = useRef(nodes);
  const edgeLabelPositionsRef = useRef(edgeLabelPositions);
  const graphViewportRef = useRef<HTMLDivElement>(null);
  const reactFlowRef = useRef<ReactFlowInstance<
    VentureGraphNode,
    VentureGraphEdge
  > | null>(null);
  const viewportRef = useRef<Viewport>(
    initialViewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const persistTimerRef = useRef<number | undefined>(undefined);
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: companyIdFromNodeId(node.id) === selectedCompanyId,
      })),
    [nodes, selectedCompanyId],
  );

  const schedulePersist = useCallback(
    (
      nextNodes: VentureGraphNode[],
      nextViewport: Viewport,
      nextEdgeLabelPositions = edgeLabelPositionsRef.current,
    ) => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        onLayoutChange(
          layoutPayloadFromGraph(
            nextNodes,
            nextViewport,
            layoutKey ?? "default",
            nextEdgeLabelPositions,
          ),
        );
      }, 700);
    },
    [layoutKey, onLayoutChange],
  );

  const handleEdgeLabelPositionChange = useCallback(
    (edgeId: string, position: number) => {
      const clampedPosition = Math.min(0.95, Math.max(0.05, position));
      setEdgeLabelPositions((currentPositions) => {
        const nextPositions = {
          ...currentPositions,
          [edgeId]: clampedPosition,
        };
        edgeLabelPositionsRef.current = nextPositions;
        schedulePersist(nodesRef.current, viewportRef.current, nextPositions);
        return nextPositions;
      });
    },
    [schedulePersist],
  );

  const displayEdges = useMemo(() => {
    const nodeRects = nodeRectsFromGraph(nodes);
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...(edge.data ?? {}),
        labelPosition: edgeLabelPositions[edge.id],
        nodeRects,
        onLabelPositionChange: handleEdgeLabelPositionChange,
      },
    }));
  }, [edges, edgeLabelPositions, handleEdgeLabelPositionChange, nodes]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgeLabelPositionsRef.current = edgeLabelPositions;
  }, [edgeLabelPositions]);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<VentureGraphNode>[]) => {
      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes);
        nodesRef.current = nextNodes;
        return nextNodes;
      });
    },
    [],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<VentureGraphNode>>(
    (_event, _node, currentNodes) => {
      nodesRef.current = currentNodes;
      schedulePersist(currentNodes, viewportRef.current);
    },
    [schedulePersist],
  );

  const handleMoveEnd = useCallback(
    (event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      viewportRef.current = viewport;
      if (event) {
        schedulePersist(nodesRef.current, viewport);
      }
    },
    [schedulePersist],
  );

  const handleViewportCommit = useCallback(
    (viewport: Viewport) => {
      viewportRef.current = viewport;
      schedulePersist(nodesRef.current, viewport);
    },
    [schedulePersist],
  );

  const handleAutoLayout = useCallback(
    (preset: VentureAutoLayoutPreset, spacing: VentureAutoLayoutSpacing) => {
      setNodes((currentNodes) => {
        const nextNodes = applyVentureAutoLayout(currentNodes, preset, {
          spacing,
        });
        const nextEdgeLabelPositions = {};
        nodesRef.current = nextNodes;
        edgeLabelPositionsRef.current = nextEdgeLabelPositions;
        setEdgeLabelPositions(nextEdgeLabelPositions);
        schedulePersist(nextNodes, viewportRef.current, nextEdgeLabelPositions);
        return nextNodes;
      });
    },
    [schedulePersist],
  );

  const focusNodeInViewport = useCallback((node: VentureGraphNode) => {
    const reactFlow = reactFlowRef.current;
    const bounds = graphViewportRef.current?.getBoundingClientRect();
    if (!reactFlow || !bounds) return;

    const currentViewport = reactFlow.getViewport();
    const zoom = Math.min(Math.max(currentViewport.zoom, 0.75), 1.2);
    const nodeWidth = node.measured?.width ?? node.width ?? COMPANY_NODE_WIDTH;
    const nodeHeight =
      node.measured?.height ?? node.height ?? COMPANY_NODE_HEIGHT;
    const centerX = node.position.x + nodeWidth / 2;
    const centerY = node.position.y + nodeHeight / 2;
    const topFocusOffset = Math.min(Math.max(bounds.height * 0.22, 110), 170);
    const nextViewport = {
      x: bounds.width / 2 - centerX * zoom,
      y: topFocusOffset - centerY * zoom,
      zoom,
    };

    viewportRef.current = nextViewport;
    void reactFlow.setViewport(nextViewport, { duration: 260 });
  }, []);

  const handleNodeClick = useCallback<NodeMouseHandler<VentureGraphNode>>(
    (_event, node) => {
      const companyId = companyIdFromNodeId(node.id);
      if (companyId) {
        focusNodeInViewport(node);
        onSelectCompany(companyId);
      }
    },
    [focusNodeInViewport, onSelectCompany],
  );

  return (
    <ReactFlowProvider>
      <div
        ref={graphViewportRef}
        className={cn(
          "relative min-h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
          className,
        )}
      >
        <ReactFlow<VentureGraphNode, VentureGraphEdge>
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={handleMoveEnd}
          onInit={(instance) => {
            reactFlowRef.current = instance;
          }}
          onPaneClick={() => onSelectCompany(undefined)}
          defaultViewport={initialViewport}
          fitView={!initialViewport}
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.35}
          maxZoom={1.8}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={28}
            size={1.2}
            color="#d8e0e8"
          />
          <Panel position="top-right" className="m-4">
            <VentureGraphToolbar
              onViewportCommit={handleViewportCommit}
              onAutoLayout={handleAutoLayout}
              onAddCompany={onAddCompany}
            />
          </Panel>
        </ReactFlow>

        {!hasCompanies ? (
          <div className="pointer-events-none absolute inset-x-8 top-5">
            <EmptyState
              icon={<Building2 className="h-8 w-8" />}
              title="No venture companies yet"
              description="The ownership graph is ready; it will populate once Ventures companies are added."
              className="mx-auto max-w-md border-slate-200 bg-white/92 px-4 py-3 shadow-sm"
            />
          </div>
        ) : null}
        {children}
      </div>
    </ReactFlowProvider>
  );
};

export const VentureGraph: React.FC<VentureGraphProps> = ({
  overview,
  ...props
}) => {
  const graph = useMemo(() => buildVentureGraph(overview), [overview]);
  const initialViewport = useMemo(
    () => viewportFromLayout(overview.layout),
    [overview.layout],
  );
  const graphKey = useMemo(
    () =>
      [
        overview.layout.layout_key ?? "default",
        overview.companies
          .map(
            (summary) =>
              `${summary.company.id}:${summary.company.updated_at}:${summary.company.logo_storage_key ?? ""}`,
          )
          .join(","),
        overview.ownership_edges
          .map(
            (edge) =>
              `${edge.owner_company_id ?? "founder"}:${edge.company_id}:${edge.ownership_pct}`,
          )
          .join(","),
      ].join("|"),
    [overview.companies, overview.layout.layout_key, overview.ownership_edges],
  );

  return (
    <VentureGraphCanvas
      key={graphKey}
      graphKey={graphKey}
      initialNodes={graph.nodes}
      edges={graph.edges}
      initialViewport={initialViewport}
      layoutKey={overview.layout.layout_key}
      hasCompanies={overview.companies.length > 0}
      {...props}
    />
  );
};
