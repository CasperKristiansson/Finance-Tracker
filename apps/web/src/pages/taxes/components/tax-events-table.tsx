import { Loader2 } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaxEventType, type TaxEventListResponse } from "@/types/api";
import { taxEventTone, toNumber } from "../taxes-utils";

type TaxEventsTableProps = {
  events: TaxEventListResponse | null;
  eventsLoading: boolean;
  eventsLoadingMore: boolean;
  detailsId: string | null;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
};

export const TaxEventsTable: React.FC<TaxEventsTableProps> = ({
  events,
  eventsLoading,
  eventsLoadingMore,
  detailsId,
  onSelect,
  onLoadMore,
}) => {
  if (eventsLoading && !events?.events?.length) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!events?.events?.length && !eventsLoading) {
    return (
      <p className="text-sm text-slate-500">No tax events recorded yet.</p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(events?.events ?? []).map((item) => {
            const sign = item.event_type === TaxEventType.REFUND ? -1 : 1;
            const amount = sign * toNumber(item.amount);
            return (
              <TableRow
                key={item.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-slate-50 focus-visible:bg-slate-50",
                  detailsId === item.id ? "bg-slate-50" : undefined,
                )}
                onClick={() => onSelect(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(item.id);
                  }
                }}
                tabIndex={0}
              >
                <TableCell className="whitespace-nowrap">
                  {new Date(item.occurred_at).toLocaleDateString("sv-SE")}
                </TableCell>
                <TableCell className="min-w-[240px]">
                  <div className="font-medium text-slate-900">
                    {item.description || item.authority || "Tax"}
                  </div>
                  {item.note ? (
                    <div className="text-xs text-slate-500">{item.note}</div>
                  ) : null}
                </TableCell>
                <TableCell>{item.account_name ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                      taxEventTone[item.event_type],
                    )}
                  >
                    {item.event_type}
                  </span>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {currency(amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {events?.has_more ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={onLoadMore}
            disabled={eventsLoading || eventsLoadingMore}
          >
            {eventsLoadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
};
