import { useReactFlow, type Viewport } from "@xyflow/react";
import { Maximize2, Minus, Plus } from "lucide-react";
import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  VentureGraphEdge,
  VentureGraphNode,
} from "@/pages/ventures/utils/layout";

type VentureGraphToolbarProps = {
  onViewportCommit: (viewport: Viewport) => void;
};

const ToolbarButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-none border-r border-slate-200 last:border-r-0 hover:bg-slate-50"
        aria-label={label}
        onClick={onClick}
      >
        {icon}
      </Button>
    </TooltipTrigger>
    <TooltipContent sideOffset={6}>{label}</TooltipContent>
  </Tooltip>
);

export const VentureGraphToolbar: React.FC<VentureGraphToolbarProps> = ({
  onViewportCommit,
}) => {
  const reactFlow = useReactFlow<VentureGraphNode, VentureGraphEdge>();

  const commitAfter = useCallback(
    async (action: () => Promise<boolean>) => {
      await action();
      window.setTimeout(() => onViewportCommit(reactFlow.getViewport()), 0);
    },
    [onViewportCommit, reactFlow],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <ToolbarButton
        label="Zoom in"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => void commitAfter(() => reactFlow.zoomIn())}
      />
      <ToolbarButton
        label="Zoom out"
        icon={<Minus className="h-4 w-4" />}
        onClick={() => void commitAfter(() => reactFlow.zoomOut())}
      />
      <ToolbarButton
        label="Fit view"
        icon={<Maximize2 className="h-4 w-4" />}
        onClick={() =>
          void commitAfter(() =>
            reactFlow.fitView({ duration: 180, padding: 0.18 }),
          )
        }
      />
    </div>
  );
};
