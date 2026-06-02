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
import { VentureGraphToolbar } from "@/pages/ventures/components/venture-graph-toolbar";
import {
  buildVentureGraph,
  companyIdFromNodeId,
  layoutPayloadFromGraph,
  viewportFromLayout,
  type VentureGraphEdge,
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
  const nodesRef = useRef(nodes);
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

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    [],
  );

  const schedulePersist = useCallback(
    (nextNodes: VentureGraphNode[], nextViewport: Viewport) => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = window.setTimeout(() => {
        onLayoutChange(
          layoutPayloadFromGraph(
            nextNodes,
            nextViewport,
            layoutKey ?? "default",
          ),
        );
      }, 700);
    },
    [layoutKey, onLayoutChange],
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

  const handleNodeClick = useCallback<NodeMouseHandler<VentureGraphNode>>(
    (_event, node) => {
      const companyId = companyIdFromNodeId(node.id);
      if (companyId) {
        onSelectCompany(companyId);
      }
    },
    [onSelectCompany],
  );

  return (
    <ReactFlowProvider>
      <div
        className={cn(
          "relative min-h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
          className,
        )}
      >
        <ReactFlow<VentureGraphNode, VentureGraphEdge>
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onMoveEnd={handleMoveEnd}
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
        overview.companies.map((summary) => summary.company.id).join(","),
        (overview.layout.nodes ?? [])
          .map((node) => `${node.company_id}:${node.x}:${node.y}`)
          .join(","),
      ].join("|"),
    [overview.companies, overview.layout.layout_key, overview.layout.nodes],
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
