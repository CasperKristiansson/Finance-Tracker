import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Crown } from "lucide-react";
import React from "react";
import { formatVentureSek } from "@/pages/ventures/utils/format";
import type { VentureFounderNode } from "@/pages/ventures/utils/layout";

export const FounderNode: React.FC<NodeProps<VentureFounderNode>> = ({
  data,
}) => (
  <div className="relative w-[230px] rounded-lg border border-slate-700 bg-slate-950 px-5 py-4 text-white shadow-xl">
    <div className="absolute -top-9 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border-2 border-amber-300 bg-slate-900 text-xl font-semibold shadow-lg">
      C
    </div>
    <div className="pt-5 text-center">
      <div className="flex items-center justify-center gap-2">
        <Crown className="h-4 w-4 text-amber-300" />
        <h3 className="text-xl leading-6 font-semibold">{data.name}</h3>
      </div>
      <p className="mt-1 text-sm text-slate-300">{data.subtitle}</p>
      <p className="mt-3 text-xs text-slate-400">
        {data.companyCount} companies ·{" "}
        {formatVentureSek(data.totalPaperValueSek)}
      </p>
    </div>
    <Handle
      id="source-bottom"
      type="source"
      position={Position.Bottom}
      className="!h-2.5 !w-2.5 !border-2 !border-white !bg-sky-300"
    />
  </div>
);
