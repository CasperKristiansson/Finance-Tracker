import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  Filter,
  Link2,
  NotebookText,
  Pencil,
  Pin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { EmptyState } from "@/components/composed/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectIsDemo } from "@/features/auth/authSlice";
import type {
  VentureCompanyDetail,
  VenturePresign,
} from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import { ValuationHistoryChart } from "@/pages/ventures/components/valuation-history-chart";
import {
  formatVentureDate,
  formatVenturePercent,
  formatVentureSek,
  titleCase,
} from "@/pages/ventures/utils/format";
import type { EndpointRequest } from "@/types/contracts";

type VentureLoading = {
  createDocument: boolean;
  deleteDocument: boolean;
  presignUpload: boolean;
};

type VentureErrors = Partial<
  Record<"createDocument" | "deleteDocument" | "presignUpload", string>
>;

type PresignUpload = (
  data: EndpointRequest<"presignVentureUpload">,
  requestId?: string,
) => void;

type WorkspaceTabsProps = {
  detail: VentureCompanyDetail;
  loading: VentureLoading;
  errors: VentureErrors;
  presignsByRequestId: Record<string, VenturePresign | undefined>;
  onAddValuation: () => void;
  onAddNote: () => void;
  onEditNote: (note: VentureCompanyDetail["notes"][number]) => void;
  createDocument: (
    companyId: string,
    data: EndpointRequest<"createVentureDocument">,
  ) => void;
  deleteDocument: (companyId: string, documentId: string) => void;
  presignUpload: PresignUpload;
};

const fieldClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const today = () => new Date().toISOString().slice(0, 10);

const documentStatusClassName = (status: string | undefined) =>
  ({
    verified: "border-emerald-200 bg-emerald-50 text-emerald-700",
    linked: "border-teal-200 bg-teal-50 text-teal-700",
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    pending_review: "border-amber-200 bg-amber-50 text-amber-800",
    missing: "border-rose-200 bg-rose-50 text-rose-700",
  })[status ?? ""] ?? "border-slate-200 bg-slate-50 text-slate-700";

const eventAccent = (eventType: string) => {
  const value = eventType.toLowerCase();
  if (value.includes("valuation") || value.includes("review")) {
    return {
      icon: <TrendingUp className="h-4 w-4" />,
      className: "border-amber-200 bg-amber-50 text-amber-800",
      dot: "bg-amber-500",
    };
  }
  if (value.includes("ownership")) {
    return {
      icon: <ShieldCheck className="h-4 w-4" />,
      className: "border-sky-200 bg-sky-50 text-sky-700",
      dot: "bg-sky-500",
    };
  }
  if (value.includes("note")) {
    return {
      icon: <NotebookText className="h-4 w-4" />,
      className: "border-orange-200 bg-orange-50 text-orange-800",
      dot: "bg-orange-500",
    };
  }
  if (value.includes("document")) {
    return {
      icon: <FileText className="h-4 w-4" />,
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
      dot: "bg-indigo-500",
    };
  }
  return {
    icon: <CalendarDays className="h-4 w-4" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-teal-700",
  };
};

const formatBytes = (value: number | null | undefined) => {
  if (!value) return "No size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter(Boolean) as string[])).sort((left, right) =>
    left.localeCompare(right),
  );

const linkedDocumentTitles = (
  detail: VentureCompanyDetail,
  ids: string[] | undefined,
) =>
  (ids ?? [])
    .map((id) => detail.documents.find((document) => document.id === id)?.title)
    .filter(Boolean) as string[];

const TimelineContext: React.FC<{
  detail: VentureCompanyDetail;
  event: VentureCompanyDetail["timeline"][number];
}> = ({ detail, event }) => {
  const valuation = event.valuation_event_id
    ? detail.valuations.find((item) => item.id === event.valuation_event_id)
    : undefined;
  const ownership = event.ownership_event_id
    ? detail.ownership_events.find(
        (item) => item.id === event.ownership_event_id,
      )
    : undefined;
  const note = event.note_id
    ? detail.notes.find((item) => item.id === event.note_id)
    : undefined;
  const document = event.document_id
    ? detail.documents.find((item) => item.id === event.document_id)
    : undefined;

  if (!valuation && !ownership && !note && !document) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {valuation ? (
        <Badge variant="outline" className="border-amber-200 bg-white">
          {formatVentureSek(valuation.paper_value_sek)}
        </Badge>
      ) : null}
      {ownership ? (
        <Badge variant="outline" className="border-sky-200 bg-white">
          {formatVenturePercent(ownership.direct_ownership_pct)}
        </Badge>
      ) : null}
      {note ? (
        <Badge variant="outline" className="border-orange-200 bg-white">
          Note: {note.title}
        </Badge>
      ) : null}
      {document ? (
        <Badge variant="outline" className="border-indigo-200 bg-white">
          Evidence: {document.title}
        </Badge>
      ) : null}
    </div>
  );
};

export const TimelineTab: React.FC<{ detail: VentureCompanyDetail }> = ({
  detail,
}) => {
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("all");
  const eventTypes = useMemo(
    () => uniqueValues(detail.timeline.map((event) => event.event_type)),
    [detail.timeline],
  );
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...detail.timeline]
      .filter((event) => eventType === "all" || event.event_type === eventType)
      .filter((event) => {
        if (!query) return true;
        return [event.title, event.description, event.event_type]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));
      })
      .sort((left, right) => right.event_date.localeCompare(left.event_date));
  }, [detail.timeline, eventType, search]);
  const groups = useMemo(() => {
    const byYear = new Map<string, typeof filteredEvents>();
    filteredEvents.forEach((event) => {
      const year = event.event_date.slice(0, 4) || "No date";
      byYear.set(year, [...(byYear.get(year) ?? []), event]);
    });
    return Array.from(byYear.entries()).sort((left, right) =>
      right[0].localeCompare(left[0]),
    );
  }, [filteredEvents]);

  const counts = useMemo(
    () =>
      eventTypes.map((type) => ({
        type,
        count: detail.timeline.filter((event) => event.event_type === type)
          .length,
      })),
    [detail.timeline, eventTypes],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-950">
                Timeline
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Events grouped by year with linked evidence and venture context.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search timeline"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {groups.length ? (
          <div className="space-y-8">
            {groups.map(([year, events]) => (
              <div key={year} className="grid gap-4 md:grid-cols-[6rem_1fr]">
                <div className="text-2xl font-semibold text-slate-950">
                  {year}
                </div>
                <div className="relative space-y-3 border-l border-teal-700/25 pl-5">
                  {events.map((event) => {
                    const accent = eventAccent(event.event_type);
                    return (
                      <article
                        key={event.id}
                        className="relative rounded-lg border border-slate-200 bg-slate-50/60 p-4 shadow-sm"
                      >
                        <span
                          className={cn(
                            "absolute top-5 -left-[27px] h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm",
                            accent.dot,
                          )}
                        />
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn("gap-1.5", accent.className)}
                              >
                                {accent.icon}
                                {titleCase(event.event_type)}
                              </Badge>
                              <span className="text-xs text-slate-500">
                                {formatVentureDate(event.event_date)}
                              </span>
                            </div>
                            <h3 className="mt-2 text-base font-semibold text-slate-950">
                              {event.title}
                            </h3>
                            {event.description ? (
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {event.description}
                              </p>
                            ) : null}
                            <TimelineContext detail={detail} event={event} />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="min-h-72"
            title={
              detail.timeline.length
                ? "No matching timeline events"
                : "No timeline events yet"
            }
            description={
              detail.timeline.length
                ? "Adjust the search or event type filter to see more company history."
                : "Valuations, ownership updates, notes, and documents will build the company history here."
            }
            icon={<CalendarDays className="h-6 w-6" />}
          />
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-950">
              Timeline filters
            </h3>
            <Filter className="h-4 w-4 text-slate-500" />
          </div>
          <div className="space-y-2">
            <Button
              type="button"
              variant={eventType === "all" ? "default" : "outline"}
              className="w-full justify-between"
              onClick={() => setEventType("all")}
            >
              All events
              <span>{detail.timeline.length}</span>
            </Button>
            {counts.map(({ type, count }) => (
              <Button
                key={type}
                type="button"
                variant={eventType === type ? "default" : "outline"}
                className="w-full justify-between"
                onClick={() => setEventType(type)}
              >
                {titleCase(type)}
                <span>{count}</span>
              </Button>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-950">
            Timeline stats
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Events logged</span>
              <span className="font-semibold text-slate-950">
                {detail.timeline.length}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Valuation events</span>
              <span className="font-semibold text-slate-950">
                {detail.valuations.length}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Linked documents</span>
              <span className="font-semibold text-slate-950">
                {detail.documents.length}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2">
              <span className="text-slate-500">Latest update</span>
              <span className="font-semibold text-teal-700">
                {formatVentureDate(detail.summary.last_activity_at)}
              </span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
};

export const ValuationTab: React.FC<{
  detail: VentureCompanyDetail;
  onAddValuation: () => void;
}> = ({ detail, onAddValuation }) => {
  const [source, setSource] = useState("all");
  const [liquidity, setLiquidity] = useState("all");
  const valuationSources = useMemo(
    () =>
      uniqueValues(
        detail.valuations.map((valuation) => valuation.valuation_source),
      ),
    [detail.valuations],
  );
  const liquidityLevels = useMemo(
    () =>
      uniqueValues(
        detail.valuations.map((valuation) => valuation.liquidity_level),
      ),
    [detail.valuations],
  );
  const sortedValuations = useMemo(
    () =>
      [...detail.valuations]
        .filter(
          (valuation) =>
            source === "all" || valuation.valuation_source === source,
        )
        .filter(
          (valuation) =>
            liquidity === "all" || valuation.liquidity_level === liquidity,
        )
        .sort((left, right) => right.event_date.localeCompare(left.event_date)),
    [detail.valuations, liquidity, source],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Venture-only valuation
          </h2>
          <p className="text-sm text-slate-500">
            Paper, risk-adjusted, and realized values are shown only inside
            Ventures.
          </p>
        </div>
        <Button type="button" onClick={onAddValuation}>
          <Plus className="h-4 w-4" />
          Add valuation
        </Button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_0.62fr]">
        <ValuationHistoryChart detail={detail} />
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">
            Latest position
          </h3>
          <div className="mt-4 grid gap-3">
            <MetricLine
              label="Paper value"
              value={formatVentureSek(detail.summary.paper_value_sek)}
            />
            <MetricLine
              label="Risk-adjusted value"
              value={formatVentureSek(detail.summary.risk_adjusted_value_sek)}
            />
            <MetricLine
              label="Realized value"
              value={formatVentureSek(detail.summary.realized_value_sek)}
            />
            <MetricLine
              label="Ownership"
              value={formatVenturePercent(detail.summary.ownership_pct)}
            />
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            These figures remain excluded from main net worth, reports,
            investments, and ledger views.
          </div>
        </section>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-950">
              Valuation events
            </h3>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <select
              className={fieldClass}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="all">All sources</option>
              {valuationSources.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select
              className={fieldClass}
              value={liquidity}
              onChange={(event) => setLiquidity(event.target.value)}
            >
              <option value="all">All liquidity</option>
              {liquidityLevels.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sortedValuations.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Paper</TableHead>
                  <TableHead>Risk-adjusted</TableHead>
                  <TableHead>Realized</TableHead>
                  <TableHead>Haircut</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Liquidity</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedValuations.map((valuation) => (
                  <TableRow key={valuation.id}>
                    <TableCell>
                      {formatVentureDate(valuation.event_date)}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-48">
                        <p className="font-medium text-slate-950">
                          {valuation.label}
                        </p>
                        {valuation.note ? (
                          <p className="mt-1 max-w-72 truncate text-xs text-slate-500">
                            {valuation.note}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatVentureSek(valuation.paper_value_sek)}
                    </TableCell>
                    <TableCell>
                      {formatVentureSek(valuation.risk_adjusted_value_sek)}
                    </TableCell>
                    <TableCell>
                      {formatVentureSek(valuation.realized_value_sek)}
                    </TableCell>
                    <TableCell>
                      {valuation.haircut_percentage ?? "0"}%
                    </TableCell>
                    <TableCell>
                      {titleCase(valuation.valuation_source)}
                    </TableCell>
                    <TableCell>
                      {titleCase(valuation.liquidity_level)}
                    </TableCell>
                    <TableCell>
                      {valuation.confidence_score
                        ? `${valuation.confidence_score} / 5`
                        : "Not set"}
                    </TableCell>
                    <TableCell>
                      <EvidenceBadges
                        titles={linkedDocumentTitles(
                          detail,
                          valuation.linked_document_ids,
                        )}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            className="min-h-60"
            title={
              detail.valuations.length
                ? "No matching valuations"
                : "No valuations recorded"
            }
            description={
              detail.valuations.length
                ? "Adjust the source or liquidity filters to see more valuation events."
                : "Add the first annual valuation to start tracking paper and risk-adjusted value."
            }
            icon={<TrendingUp className="h-6 w-6" />}
            action={
              <Button type="button" size="sm" onClick={onAddValuation}>
                Add valuation
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
};

const MetricLine: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between gap-4 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-semibold text-slate-950">{value}</span>
  </div>
);

const EvidenceBadges: React.FC<{ titles: string[] }> = ({ titles }) =>
  titles.length ? (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {titles.slice(0, 2).map((title) => (
        <Badge key={title} variant="outline" className="bg-white">
          {title}
        </Badge>
      ))}
      {titles.length > 2 ? (
        <Badge variant="outline" className="bg-white">
          +{titles.length - 2}
        </Badge>
      ) : null}
    </div>
  ) : (
    <span className="text-xs text-slate-400">No evidence</span>
  );

export const NotesTab: React.FC<{
  detail: VentureCompanyDetail;
  onAddNote: () => void;
  onEditNote: (note: VentureCompanyDetail["notes"][number]) => void;
}> = ({ detail, onAddNote, onEditNote }) => {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState<"pinned" | "newest" | "oldest">("pinned");
  const tags = useMemo(
    () => uniqueValues(detail.notes.flatMap((note) => note.tags)),
    [detail.notes],
  );
  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...detail.notes]
      .filter((note) => tag === "all" || note.tags.includes(tag))
      .filter((note) => {
        if (!query) return true;
        return [note.title, note.body_markdown, note.tags.join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        if (sort === "pinned" && left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }
        return sort === "oldest"
          ? left.note_date.localeCompare(right.note_date)
          : right.note_date.localeCompare(left.note_date);
      });
  }, [detail.notes, search, sort, tag]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Notes</h2>
          <p className="text-sm text-slate-500">
            Markdown notes with flexible tags for context, reflections, risks,
            and decisions.
          </p>
        </div>
        <Button type="button" onClick={onAddNote}>
          <Plus className="h-4 w-4" />
          Add note
        </Button>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_12rem]">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search notes"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            className={fieldClass}
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
          >
            <option value="pinned">Pinned first</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={tag === "all" ? "default" : "outline"}
            onClick={() => setTag("all")}
          >
            All tags
          </Button>
          {tags.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={tag === item ? "default" : "outline"}
              onClick={() => setTag(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </section>
      {filteredNotes.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredNotes.map((note) => (
            <NoteCard
              key={note.id}
              detail={detail}
              note={note}
              onEditNote={onEditNote}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="min-h-72"
          title={detail.notes.length ? "No matching notes" : "No notes yet"}
          description={
            detail.notes.length
              ? "Adjust search, tag, or sorting controls to find the note."
              : "Add Markdown notes to capture company context with flexible tags."
          }
          icon={<NotebookText className="h-6 w-6" />}
          action={
            <Button type="button" size="sm" onClick={onAddNote}>
              Add note
            </Button>
          }
        />
      )}
    </div>
  );
};

const NoteCard: React.FC<{
  detail: VentureCompanyDetail;
  note: VentureCompanyDetail["notes"][number];
  onEditNote: (note: VentureCompanyDetail["notes"][number]) => void;
}> = ({ detail, note, onEditNote }) => {
  const timelineEvent = note.timeline_event_id
    ? detail.timeline.find((event) => event.id === note.timeline_event_id)
    : undefined;
  const documentTitles = linkedDocumentTitles(detail, note.document_ids);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {note.pinned ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-200 bg-amber-50 text-amber-800"
              >
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            ) : null}
            <span className="text-xs text-slate-500">
              {formatVentureDate(note.note_date)}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-950">
            {note.title}
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onEditNote(note)}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>
      <div className="mt-4 space-y-2 overflow-hidden text-sm leading-6 break-words text-slate-700 [&_a]:font-medium [&_a]:text-teal-700 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-100 [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:list-disc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {note.body_markdown}
        </ReactMarkdown>
      </div>
      {note.tags.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {note.tags.map((item) => (
            <Badge key={item} variant="outline" className="bg-white">
              {item}
            </Badge>
          ))}
        </div>
      ) : null}
      {timelineEvent || documentTitles.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {timelineEvent ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Timeline: {timelineEvent.title}</span>
            </span>
          ) : null}
          {documentTitles.map((title) => (
            <span
              key={title}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{title}</span>
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
};

export const DocumentsTab: React.FC<
  Pick<
    WorkspaceTabsProps,
    | "detail"
    | "loading"
    | "errors"
    | "presignsByRequestId"
    | "createDocument"
    | "deleteDocument"
    | "presignUpload"
  >
> = ({
  detail,
  loading,
  errors,
  presignsByRequestId,
  createDocument,
  deleteDocument,
  presignUpload,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [linkedEventType, setLinkedEventType] = useState("all");
  const [groupBy, setGroupBy] = useState<"category" | "status" | "none">(
    "category",
  );
  const [sort, setSort] = useState<"recent" | "oldest" | "title">("recent");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{
    requestId: string;
    documentId: string;
  }>();
  const handledDownloadRequestsRef = useRef(new Set<string>());
  const categories = useMemo(
    () => uniqueValues(detail.documents.map((document) => document.category)),
    [detail.documents],
  );
  const statuses = useMemo(
    () => uniqueValues(detail.documents.map((document) => document.status)),
    [detail.documents],
  );
  const documentTypes = useMemo(
    () =>
      uniqueValues(detail.documents.map((document) => document.document_type)),
    [detail.documents],
  );
  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...detail.documents]
      .filter(
        (document) => category === "all" || document.category === category,
      )
      .filter((document) => status === "all" || document.status === status)
      .filter(
        (document) =>
          documentType === "all" || document.document_type === documentType,
      )
      .filter((document) => {
        if (linkedEventType === "all") return true;
        if (linkedEventType === "timeline") return !!document.timeline_event_id;
        if (linkedEventType === "valuation") {
          return !!document.valuation_event_id;
        }
        if (linkedEventType === "ownership") {
          return !!document.ownership_event_id;
        }
        return (
          !document.timeline_event_id &&
          !document.valuation_event_id &&
          !document.ownership_event_id
        );
      })
      .filter((document) => {
        if (!query) return true;
        return [
          document.title,
          document.file_name,
          document.document_type,
          document.category,
          document.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        if (sort === "title") return left.title.localeCompare(right.title);
        const leftDate = left.document_date ?? left.uploaded_at;
        const rightDate = right.document_date ?? right.uploaded_at;
        return sort === "oldest"
          ? leftDate.localeCompare(rightDate)
          : rightDate.localeCompare(leftDate);
      });
  }, [
    category,
    detail.documents,
    documentType,
    linkedEventType,
    search,
    sort,
    status,
  ]);
  const groups = useMemo(() => {
    if (groupBy === "none") return [["Documents", filteredDocuments] as const];
    const grouped = new Map<string, typeof filteredDocuments>();
    filteredDocuments.forEach((document) => {
      const key =
        groupBy === "category"
          ? titleCase(document.category)
          : titleCase(document.status);
      grouped.set(key, [...(grouped.get(key) ?? []), document]);
    });
    return Array.from(grouped.entries()).sort((left, right) =>
      left[0].localeCompare(right[0]),
    );
  }, [filteredDocuments, groupBy]);

  useEffect(() => {
    if (!pendingDownload) return;
    const presign = presignsByRequestId[pendingDownload.requestId];
    if (!presign) return;
    if (handledDownloadRequestsRef.current.has(pendingDownload.requestId)) {
      return;
    }
    handledDownloadRequestsRef.current.add(pendingDownload.requestId);
    window.open(presign.url, "_blank", "noopener,noreferrer");
    toast.success("Download started");
  }, [pendingDownload, presignsByRequestId]);

  useEffect(() => {
    if (!pendingDownload || loading.presignUpload || !errors.presignUpload) {
      return;
    }
    toast.error("Download failed", { description: errors.presignUpload });
    const timer = window.setTimeout(() => setPendingDownload(undefined), 0);
    return () => window.clearTimeout(timer);
  }, [errors.presignUpload, loading.presignUpload, pendingDownload]);

  const requestDownload = (
    document: VentureCompanyDetail["documents"][number],
  ) => {
    if (document.external_url) {
      window.open(document.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!document.storage_key) return;
    const requestId = `document-download-${document.id}-${Date.now()}`;
    setPendingDownload({ requestId, documentId: document.id });
    presignUpload(
      {
        operation: "download",
        purpose: "document",
        company_id: detail.summary.company.id,
        document_id: document.id,
        storage_key: document.storage_key,
        file_name: document.file_name,
        mime_type: document.mime_type,
        file_size_bytes: document.file_size_bytes,
      },
      requestId,
    );
  };

  const requestDelete = (
    document: VentureCompanyDetail["documents"][number],
  ) => {
    const confirmed = window.confirm(
      `Delete document metadata for "${document.title}"? The stored file is not previewed or hard-deleted by this action.`,
    );
    if (confirmed) {
      deleteDocument(detail.summary.company.id, document.id);
    }
  };

  const completeCount = detail.documents.filter((document) =>
    ["verified", "linked"].includes(document.status ?? ""),
  ).length;
  const missingCount = detail.document_health.missing_categories?.length ?? 0;
  const healthTotal = Math.max(
    completeCount + missingCount,
    detail.documents.length,
  );
  const healthPct = healthTotal
    ? Math.round((completeCount / healthTotal) * 100)
    : 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
      <section className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-700" />
                <h2 className="text-lg font-semibold text-slate-950">
                  Documents
                </h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Evidence files for valuations and ownership. Preview is
                intentionally omitted.
              </p>
            </div>
            <Button
              type="button"
              disabled={isDemo}
              title={
                isDemo ? "Demo mode cannot upload S3 documents." : undefined
              }
              onClick={() => setUploadOpen(true)}
            >
              <UploadCloud className="h-4 w-4" />
              Upload document
            </Button>
          </div>
          {isDemo ? (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Demo mode does not have access to the private S3 document bucket,
              so uploads are unavailable in this environment.
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(18rem,1fr)_9.5rem_9.5rem_9.5rem_10rem_10rem_9.5rem]">
            <div className="relative">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search documents"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select
              className={fieldClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select
              className={fieldClass}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              <option value="all">All types</option>
              {documentTypes.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select
              className={fieldClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select
              className={fieldClass}
              value={linkedEventType}
              onChange={(event) => setLinkedEventType(event.target.value)}
            >
              <option value="all">All links</option>
              <option value="timeline">Timeline linked</option>
              <option value="valuation">Valuation linked</option>
              <option value="ownership">Ownership linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
            <select
              className={fieldClass}
              value={groupBy}
              onChange={(event) =>
                setGroupBy(event.target.value as typeof groupBy)
              }
            >
              <option value="category">Group category</option>
              <option value="status">Group status</option>
              <option value="none">No grouping</option>
            </select>
            <select
              className={fieldClass}
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
            >
              <option value="recent">Sort recent</option>
              <option value="oldest">Sort oldest</option>
              <option value="title">Sort title</option>
            </select>
          </div>
        </div>

        {groups.length && filteredDocuments.length ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {groups.map(([group, documents]) => (
              <div
                key={group}
                className="border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-950">
                    {group}
                  </h3>
                  <Badge variant="outline" className="bg-white">
                    {documents.length}
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Linked event</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>
                            <div className="max-w-80 min-w-60">
                              <p className="truncate font-medium text-slate-950">
                                {document.title}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {document.file_name ?? "Metadata only"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {titleCase(document.document_type)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatVentureDate(
                              document.document_date ?? document.uploaded_at,
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                documentStatusClassName(document.status),
                              )}
                            >
                              {titleCase(document.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <LinkedEventLabel
                              detail={detail}
                              document={document}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatBytes(document.file_size_bytes)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                disabled={
                                  !document.external_url &&
                                  !document.storage_key
                                }
                                aria-label={`Download ${document.title}`}
                                title={
                                  !document.external_url &&
                                  !document.storage_key
                                    ? "No downloadable file is attached."
                                    : "Download document"
                                }
                                onClick={() => requestDownload(document)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                disabled={loading.deleteDocument}
                                aria-label={`Delete ${document.title}`}
                                onClick={() => requestDelete(document)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="min-h-72"
            title={
              detail.documents.length
                ? "No matching documents"
                : "No documents recorded"
            }
            description={
              detail.documents.length
                ? "Adjust search, category, status, grouping, or sort controls."
                : "Upload the first S3-backed document or add evidence metadata."
            }
            icon={<FileText className="h-6 w-6" />}
            action={
              isDemo ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  S3 uploads unavailable in demo mode
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  Upload document
                </Button>
              )
            }
          />
        )}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">
                Document health
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Verified or linked documents against current gaps.
              </p>
            </div>
            {healthPct >= 80 ? (
              <CheckCircle2 className="h-5 w-5 text-teal-700" />
            ) : (
              <CircleAlert className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div className="mt-5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-3xl font-semibold text-slate-950">
                {healthPct}%
              </span>
              <span className="text-sm text-slate-500">
                {completeCount} complete
              </span>
            </div>
            <Progress
              className="mt-3"
              value={healthPct}
              indicatorClassName="bg-teal-700"
            />
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-950">
            Missing documents
          </h3>
          {detail.document_health.missing_categories?.length ? (
            <div className="mt-3 space-y-2">
              {detail.document_health.missing_categories.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <CircleAlert className="h-4 w-4 text-amber-600" />
                  {titleCase(item)}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No missing categories reported.
            </p>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-950">
            Health warnings
          </h3>
          {detail.document_health.warnings?.length ? (
            <div className="mt-3 space-y-2">
              {detail.document_health.warnings.map((warning) => (
                <div
                  key={`${warning.code}-${warning.message}`}
                  className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                  {warning.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No document health warnings.
            </p>
          )}
        </section>
      </aside>

      <DocumentUploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        detail={detail}
        loading={loading}
        errors={errors}
        presignsByRequestId={presignsByRequestId}
        presignUpload={presignUpload}
        createDocument={createDocument}
      />
    </div>
  );
};

const LinkedEventLabel: React.FC<{
  detail: VentureCompanyDetail;
  document: VentureCompanyDetail["documents"][number];
}> = ({ detail, document }) => {
  const event = document.timeline_event_id
    ? detail.timeline.find((item) => item.id === document.timeline_event_id)
    : undefined;
  const valuation = document.valuation_event_id
    ? detail.valuations.find((item) => item.id === document.valuation_event_id)
    : undefined;
  const ownership = document.ownership_event_id
    ? detail.ownership_events.find(
        (item) => item.id === document.ownership_event_id,
      )
    : undefined;
  const label = event?.title ?? valuation?.label ?? ownership?.reason;

  return label ? (
    <span className="inline-flex max-w-48 items-center gap-1.5 truncate text-sm text-slate-600">
      <Link2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  ) : (
    <span className="text-xs text-slate-400">No linked event</span>
  );
};

const DocumentUploadSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: VentureCompanyDetail;
  loading: VentureLoading;
  errors: VentureErrors;
  presignsByRequestId: Record<string, VenturePresign | undefined>;
  presignUpload: PresignUpload;
  createDocument: (
    companyId: string,
    data: EndpointRequest<"createVentureDocument">,
  ) => void;
}> = ({
  open,
  onOpenChange,
  detail,
  loading,
  errors,
  presignsByRequestId,
  presignUpload,
  createDocument,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("pdf");
  const [category, setCategory] = useState("valuation");
  const [status, setStatus] =
    useState<EndpointRequest<"createVentureDocument">["status"]>(
      "pending_review",
    );
  const [documentDate, setDocumentDate] = useState(() => today());
  const [timelineEventId, setTimelineEventId] = useState("");
  const [valuationEventId, setValuationEventId] = useState("");
  const [ownershipEventId, setOwnershipEventId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string>();
  const [stage, setStage] = useState<
    "idle" | "presigning" | "uploading" | "creating"
  >("idle");
  const [pendingUpload, setPendingUpload] = useState<{
    requestId: string;
    file: File;
    payload: EndpointRequest<"createVentureDocument">;
  }>();
  const createStartedRef = useRef(false);
  const isSubmitting =
    loading.createDocument ||
    loading.presignUpload ||
    stage === "presigning" ||
    stage === "uploading" ||
    stage === "creating";

  const reset = useCallback(() => {
    setTitle("");
    setDocumentType("pdf");
    setCategory("valuation");
    setStatus("pending_review");
    setDocumentDate(today());
    setTimelineEventId("");
    setValuationEventId("");
    setOwnershipEventId("");
    setFile(null);
    setLocalError(undefined);
    setStage("idle");
    setPendingUpload(undefined);
    createStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (!pendingUpload || stage !== "presigning") return;
    const presign = presignsByRequestId[pendingUpload.requestId];
    if (!presign) return;
    const upload = async () => {
      setStage("uploading");
      try {
        const response = await fetch(presign.url, {
          method: presign.method,
          headers: presign.headers,
          body: pendingUpload.file,
        });
        if (!response.ok) {
          throw new Error("Document upload failed.");
        }
        createStartedRef.current = false;
        setStage("creating");
        createDocument(detail.summary.company.id, {
          ...pendingUpload.payload,
          storage_key: presign.storage_key,
          file_name: pendingUpload.file.name,
          mime_type: pendingUpload.file.type,
          file_size_bytes: pendingUpload.file.size,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Document upload failed.";
        setLocalError(message);
        toast.error("Document upload failed", { description: message });
        setStage("idle");
        setPendingUpload(undefined);
        createStartedRef.current = false;
      }
    };
    void upload();
  }, [
    createDocument,
    detail.summary.company.id,
    pendingUpload,
    presignsByRequestId,
    stage,
  ]);

  useEffect(() => {
    if (
      stage !== "presigning" ||
      loading.presignUpload ||
      !errors.presignUpload
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLocalError(errors.presignUpload);
      setStage("idle");
      setPendingUpload(undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [errors.presignUpload, loading.presignUpload, stage]);

  useEffect(() => {
    if (stage !== "creating") return;
    if (loading.createDocument) {
      createStartedRef.current = true;
      return;
    }
    if (!createStartedRef.current) return;
    const timer = window.setTimeout(() => {
      if (!errors.createDocument) {
        toast.success("Document uploaded");
        reset();
        onOpenChange(false);
      } else {
        setLocalError(errors.createDocument);
        setStage("idle");
        setPendingUpload(undefined);
        createStartedRef.current = false;
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    errors.createDocument,
    loading.createDocument,
    onOpenChange,
    reset,
    stage,
  ]);

  const submit = () => {
    if (isDemo) {
      setLocalError("Demo mode cannot upload private S3 documents.");
      return;
    }
    if (!title.trim()) {
      setLocalError("Document title is required.");
      return;
    }
    if (!file) {
      setLocalError("Choose a file to upload.");
      return;
    }
    setLocalError(undefined);
    const requestId = `document-upload-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const payload: EndpointRequest<"createVentureDocument"> = {
      title: title.trim(),
      document_type: documentType.trim() || "file",
      category: category.trim() || "other",
      status,
      document_date: documentDate || null,
      timeline_event_id: timelineEventId || null,
      valuation_event_id: valuationEventId || null,
      ownership_event_id: ownershipEventId || null,
    };
    setPendingUpload({ requestId, file, payload });
    setStage("presigning");
    presignUpload(
      {
        operation: "upload",
        purpose: "document",
        company_id: detail.summary.company.id,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size_bytes: file.size,
      },
      requestId,
    );
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) reset();
        onOpenChange(nextOpen);
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[88vh] gap-0 overflow-hidden rounded-t-xl border-slate-200 bg-slate-50 p-0"
      >
        <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-slate-300" />
        <SheetHeader className="border-b border-slate-200 bg-white px-6 py-5 text-left">
          <SheetTitle className="text-2xl font-semibold tracking-normal text-slate-950">
            Upload document
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-600">
            Upload a private S3-backed evidence file. No preview is generated.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_0.58fr]">
            <div className="space-y-4">
              {localError || errors.createDocument || errors.presignUpload ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {localError ?? errors.createDocument ?? errors.presignUpload}
                </div>
              ) : null}
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Title">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </Field>
                  <Field label="Document date">
                    <Input
                      type="date"
                      value={documentDate}
                      onChange={(event) => setDocumentDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Document type">
                    <Input
                      value={documentType}
                      onChange={(event) => setDocumentType(event.target.value)}
                    />
                  </Field>
                  <Field label="Category">
                    <Input
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      className={fieldClass}
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as typeof status)
                      }
                    >
                      <option value="verified">Verified</option>
                      <option value="linked">Linked</option>
                      <option value="draft">Draft</option>
                      <option value="pending_review">Pending review</option>
                      <option value="missing">Missing</option>
                    </select>
                  </Field>
                </div>
              </section>
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <Label>File</Label>
                <label className="mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:bg-slate-100">
                  <UploadCloud className="h-8 w-8 text-slate-400" />
                  <span className="mt-2 text-sm font-medium text-slate-700">
                    Choose a document
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    {file
                      ? `${file.name} · ${formatBytes(file.size)}`
                      : "PDF, spreadsheet, or other evidence file"}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(event) =>
                      setFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </section>
            </div>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-950">
                Optional links
              </h3>
              <div className="mt-4 space-y-4">
                <Field label="Timeline event">
                  <select
                    className={fieldClass}
                    value={timelineEventId}
                    onChange={(event) => setTimelineEventId(event.target.value)}
                  >
                    <option value="">No linked event</option>
                    {detail.timeline.map((event) => (
                      <option key={event.id} value={event.id}>
                        {formatVentureDate(event.event_date)} - {event.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Valuation event">
                  <select
                    className={fieldClass}
                    value={valuationEventId}
                    onChange={(event) =>
                      setValuationEventId(event.target.value)
                    }
                  >
                    <option value="">No linked valuation</option>
                    {detail.valuations.map((valuation) => (
                      <option key={valuation.id} value={valuation.id}>
                        {formatVentureDate(valuation.event_date)} -{" "}
                        {valuation.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ownership event">
                  <select
                    className={fieldClass}
                    value={ownershipEventId}
                    onChange={(event) =>
                      setOwnershipEventId(event.target.value)
                    }
                  >
                    <option value="">No linked ownership</option>
                    {detail.ownership_events.map((ownership) => (
                      <option key={ownership.id} value={ownership.id}>
                        {formatVentureDate(ownership.effective_date)} -{" "}
                        {ownership.reason ?? "Ownership update"}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Upload/download uses private presigned URLs. No document
                  preview is shown in this workspace.
                </div>
              </div>
            </section>
          </div>
        </div>
        <SheetFooter className="border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || isDemo}
              title={
                isDemo
                  ? "Demo mode cannot upload private S3 documents."
                  : undefined
              }
              onClick={submit}
            >
              <UploadCloud className="h-4 w-4" />
              {stage === "uploading" ? "Uploading" : "Upload document"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="min-w-0 space-y-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);
