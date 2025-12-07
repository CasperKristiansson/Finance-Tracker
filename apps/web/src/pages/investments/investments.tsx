import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Check,
  Loader2,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { z } from "zod";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useInvestmentsApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { InvestmentSnapshot } from "@/types/api";

const pasteFormSchema = z.object({
  pasteValue: z.string().min(1, "Paste some text").trim(),
});

type PasteFormValues = z.infer<typeof pasteFormSchema>;

type DraftStatus = "idle" | "parsing" | "parsed" | "error";

const draftSchema = z.object({
  id: z.string(),
  label: z.string(),
  raw_text: z.string().min(1, "Paste the export text"),
  snapshot_date: z.string().optional(),
  portfolio_value: z.union([z.number(), z.string()]).nullable().optional(),
  account_name: z.string().nullable().optional(),
  report_type: z.string().nullable().optional(),
  use_bedrock: z.boolean().optional(),
  bedrock_model_id: z.string().nullable().optional(),
  bedrock_max_tokens: z.union([z.string(), z.number()]).nullable().optional(),
  parsed_payload: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["idle", "parsing", "parsed", "error"]).default("idle"),
  error: z.string().optional(),
});

const draftsFormSchema = z.object({
  drafts: z.array(draftSchema),
});

type DraftFormValues = z.input<typeof draftsFormSchema>;

type Draft = DraftFormValues["drafts"][number];

type DerivedHolding = Record<string, unknown> & {
  name?: string;
  quantity?: number | string | null;
  market_value_sek?: number | string | null;
  value_sek?: number | string | null;
  currency?: string | null;
};

const coerceNumber = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const extractHoldings = (
  payload?: Record<string, unknown>,
): DerivedHolding[] => {
  if ((payload as { holdings?: unknown })?.holdings) {
    const list = (payload as { holdings: unknown }).holdings;
    if (Array.isArray(list)) {
      return list as DerivedHolding[];
    }
  }
  if (!payload) return [];
  const fromHoldings = (payload as { holdings?: unknown }).holdings;
  const fromRows = (payload as { rows?: unknown }).rows;
  if (Array.isArray(fromHoldings)) return fromHoldings as DerivedHolding[];
  if (Array.isArray(fromRows)) return fromRows as DerivedHolding[];
  return [];
};

const deriveHoldingsValue = (holding: DerivedHolding): number => {
  return (
    coerceNumber(holding.market_value_sek) ??
    coerceNumber(holding.value_sek) ??
    coerceNumber(holding.value) ??
    0
  );
};

const sumHoldings = (payload?: Record<string, unknown>): number => {
  return extractHoldings(payload).reduce(
    (sum, h) => sum + deriveHoldingsValue(h),
    0,
  );
};

const exportCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const text = String(val).replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const deriveSnapshotValue = (snapshot: InvestmentSnapshot): number => {
  const val =
    coerceNumber(snapshot.portfolio_value) ??
    coerceNumber((snapshot as { portfolio_value?: string }).portfolio_value);
  if (val !== undefined) return val;
  if (snapshot.holdings?.length) {
    return snapshot.holdings.reduce(
      (sum, h) => sum + (coerceNumber(h.value_sek) ?? 0),
      0,
    );
  }
  const payload =
    (snapshot.cleaned_payload as Record<string, unknown>) ??
    (snapshot.parsed_payload as Record<string, unknown>);
  return sumHoldings(payload);
};

const getSnapshotHoldings = (
  snapshot: InvestmentSnapshot,
): DerivedHolding[] => {
  if (snapshot.holdings?.length) {
    return snapshot.holdings as DerivedHolding[];
  }
  const payload =
    (snapshot.cleaned_payload as { cleaned_rows?: unknown; holdings?: unknown })
      ?.cleaned_rows ??
    (snapshot.cleaned_payload as { holdings?: unknown })?.holdings ??
    snapshot.parsed_payload;
  if (Array.isArray(payload)) return payload as DerivedHolding[];
  if (payload && typeof payload === "object") {
    if (Array.isArray((payload as { holdings?: unknown }).holdings)) {
      return (payload as { holdings: unknown[] }).holdings as DerivedHolding[];
    }
  }
  return [];
};

export const Investments: React.FC = () => {
  const {
    snapshots,
    transactions,
    metrics,
    loading,
    saving,
    parseLoading,
    parsedResults,
    lastSavedClientId,
    fetchSnapshots,
    fetchTransactions,
    fetchMetrics,
    parseExport,
    saveSnapshot,
    clearDraft,
  } = useInvestmentsApi();

  const pasteForm = useForm<PasteFormValues>({
    resolver: zodResolver(pasteFormSchema),
    defaultValues: { pasteValue: "" },
  });

  const draftForm = useForm<DraftFormValues>({
    resolver: zodResolver(draftsFormSchema),
    defaultValues: { drafts: [] },
  });

  const {
    fields: draftFields,
    append: appendDraft,
    remove: removeDraft,
  } = useFieldArray({
    control: draftForm.control,
    name: "drafts",
  });

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [range, setRange] = useState<"3M" | "6M" | "1Y" | "ALL">("6M");

  useEffect(() => {
    fetchSnapshots();
    fetchTransactions();
    fetchMetrics();
  }, [fetchSnapshots, fetchTransactions, fetchMetrics]);

  useEffect(() => {
    draftFields.forEach((field, idx) => {
      const parsed = parsedResults[field.id];
      if (!parsed) return;
      const payload = (parsed as { parsed_payload?: Record<string, unknown> })
        .parsed_payload;
      const current = draftForm.getValues(`drafts.${idx}`);
      draftForm.setValue(`drafts.${idx}.parsed_payload`, payload ?? {});
      draftForm.setValue(
        `drafts.${idx}.snapshot_date`,
        (parsed as { snapshot_date?: string }).snapshot_date ||
          current.snapshot_date,
      );
      draftForm.setValue(
        `drafts.${idx}.portfolio_value`,
        coerceNumber(
          (parsed as { portfolio_value?: number | string }).portfolio_value,
        ) ?? current.portfolio_value,
      );
      draftForm.setValue(
        `drafts.${idx}.report_type`,
        (parsed as { report_type?: string }).report_type ??
          current.report_type ??
          "portfolio_report",
      );
      draftForm.setValue(`drafts.${idx}.status`, "parsed");
      draftForm.setValue(`drafts.${idx}.error`, undefined);
    });
  }, [parsedResults, draftFields, draftForm]);

  useEffect(() => {
    if (!lastSavedClientId) return;
    const index = draftFields.findIndex((d) => d.id === lastSavedClientId);
    if (index >= 0) {
      removeDraft(index);
    }
    clearDraft(lastSavedClientId);
  }, [clearDraft, draftFields, lastSavedClientId, removeDraft]);

  const draftValues = draftForm.watch("drafts") ?? [];

  const addDraft = (raw_text: string, label?: string) => {
    const text = raw_text.trim();
    if (!text) return;
    appendDraft({
      id: crypto.randomUUID(),
      label: label || `Paste ${draftFields.length + 1}`,
      raw_text: text,
      status: "idle",
      report_type: "portfolio_report",
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setIsUploading(true);
    try {
      const entries = await Promise.all(
        Array.from(files).map(async (file) => {
          const text = await file.text();
          return { text, name: file.name };
        }),
      );
      entries.forEach((entry) => addDraft(entry.text, entry.name));
    } finally {
      setIsUploading(false);
    }
  };

  const handleParse = (draftId: string) => {
    const index = draftFields.findIndex((d) => d.id === draftId);
    if (index < 0) return;
    draftForm.setValue(`drafts.${index}.status`, "parsing");
    draftForm.setValue(`drafts.${index}.error`, undefined);
    const rawText = draftForm.getValues(`drafts.${index}.raw_text`) || "";
    parseExport(draftId, rawText);
  };

  const updateHolding = (
    draftId: string,
    index: number,
    key: string,
    value: string,
  ) => {
    const draftIndex = draftFields.findIndex((d) => d.id === draftId);
    if (draftIndex < 0) return;
    const payload =
      draftForm.getValues(`drafts.${draftIndex}.parsed_payload`) || {};
    const holdings = extractHoldings(payload);
    const next = holdings.map((h, idx) =>
      idx === index ? { ...h, [key]: value } : h,
    );
    draftForm.setValue(`drafts.${draftIndex}.parsed_payload`, {
      ...payload,
      holdings: next,
    });
  };

  const handleSave = async (draftId: string) => {
    const index = draftFields.findIndex((d) => d.id === draftId);
    if (index < 0) return;
    const valid = await draftForm.trigger([
      `drafts.${index}.raw_text`,
      `drafts.${index}.portfolio_value`,
      `drafts.${index}.snapshot_date`,
    ]);
    if (!valid) {
      const error = draftForm.formState.errors.drafts?.[index];
      toast.error("Fix draft before saving", {
        description:
          error?.raw_text?.message ||
          error?.portfolio_value?.toString() ||
          "Check the highlighted fields.",
      });
      return;
    }
    const draft = draftForm.getValues(`drafts.${index}`);
    const portfolioValue =
      draft.portfolio_value === undefined || draft.portfolio_value === null
        ? undefined
        : (coerceNumber(draft.portfolio_value) ?? undefined);
    const bedrockTokens =
      draft.bedrock_max_tokens === undefined ||
      draft.bedrock_max_tokens === null
        ? undefined
        : (coerceNumber(draft.bedrock_max_tokens) ?? undefined);
    saveSnapshot({
      clientId: draft.id,
      raw_text: draft.raw_text,
      parsed_payload: draft.parsed_payload,
      snapshot_date: draft.snapshot_date,
      portfolio_value: portfolioValue,
      report_type: draft.report_type || "portfolio_report",
      account_name: draft.account_name,
      use_bedrock: draft.use_bedrock,
      bedrock_model_id: draft.bedrock_model_id,
      bedrock_max_tokens: bedrockTokens,
    });
  };

  const holdingsDelta = useMemo(() => {
    if (snapshots.length < 2) return [];
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(b.snapshot_date).getTime() -
        new Date(a.snapshot_date).getTime(),
    );
    const latest = sorted[0];
    const previous = sorted[1];
    const latestMap = new Map(
      getSnapshotHoldings(latest).map((h) => [
        (h.name ?? "Unknown") as string,
        deriveHoldingsValue(h),
      ]),
    );
    const prevMap = new Map(
      getSnapshotHoldings(previous).map((h) => [
        (h.name ?? "Unknown") as string,
        deriveHoldingsValue(h),
      ]),
    );

    const names = new Set([...latestMap.keys(), ...prevMap.keys()]);
    return Array.from(names).map((name) => {
      const current = latestMap.get(name) ?? 0;
      const prior = prevMap.get(name) ?? 0;
      const delta = current - prior;
      const deltaPct = prior ? (delta / prior) * 100 : null;
      return { name, current, prior, delta, deltaPct };
    });
  }, [snapshots]);

  const latestSnapshot = useMemo(() => {
    if (!snapshots.length) return undefined;
    return [...snapshots].sort(
      (a, b) =>
        new Date(b.snapshot_date).getTime() -
        new Date(a.snapshot_date).getTime(),
    )[0];
  }, [snapshots]);

  const draftList = draftValues.length ? draftValues : draftFields;

  const renderDraft = (field: Draft, index: number) => {
    const draft = draftValues[index] ?? field;
    const holdings = extractHoldings(draft.parsed_payload);
    const status = (draft.status as DraftStatus) || "idle";
    const isParsing = parseLoading[draft.id];
    const badgeTone =
      status === "parsed"
        ? "bg-emerald-50 text-emerald-700"
        : status === "parsing"
          ? "bg-blue-50 text-blue-700"
          : "bg-slate-100 text-slate-700";

    return (
      <motion.div variants={fadeInUp} {...subtleHover}>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
          <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-slate-800">
                {draft.label}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Paste raw text, adjust fields, parse, then save.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs", badgeTone)}>
                {status === "parsed"
                  ? "Parsed"
                  : status === "parsing"
                    ? "Parsing"
                    : "Draft"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-500 hover:text-slate-800"
                onClick={() => removeDraft(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs tracking-wide text-slate-600 uppercase">
                  Raw export
                </Label>
                <Textarea
                  rows={8}
                  className="font-mono text-sm"
                  {...draftForm.register(`drafts.${index}.raw_text` as const)}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600">
                      Snapshot date
                    </Label>
                    <Input
                      type="date"
                      value={draft.snapshot_date ?? ""}
                      onChange={(e) =>
                        draftForm.setValue(
                          `drafts.${index}.snapshot_date`,
                          e.target.value,
                        )
                      }
                      className="h-9 w-36"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600">
                      Value (SEK)
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={draft.portfolio_value ?? ""}
                      onChange={(e) =>
                        draftForm.setValue(
                          `drafts.${index}.portfolio_value`,
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className="h-9 w-32"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600">
                      Use Bedrock
                    </Label>
                    <Controller
                      control={draftForm.control}
                      name={`drafts.${index}.use_bedrock` as const}
                      render={({ field: controllerField }) => (
                        <Switch
                          checked={Boolean(controllerField.value)}
                          onCheckedChange={(val) =>
                            controllerField.onChange(val)
                          }
                        />
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-600">Model</Label>
                    <select
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 shadow-sm"
                      value={draft.bedrock_model_id ?? ""}
                      onChange={(e) =>
                        draftForm.setValue(
                          `drafts.${index}.bedrock_model_id`,
                          e.target.value || undefined,
                        )
                      }
                    >
                      <option value="">Default (Haiku)</option>
                      <option value="anthropic.claude-haiku-4-5-20251001-v1:0">
                        Claude 4.5 Haiku
                      </option>
                      <option value="anthropic.claude-3-5-sonnet-20241022-v2:0">
                        Claude 3.5 Sonnet
                      </option>
                    </select>
                    <Label className="text-xs text-slate-600">Max tokens</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      className="h-9 w-20"
                      value={draft.bedrock_max_tokens ?? ""}
                      onChange={(e) =>
                        draftForm.setValue(
                          `drafts.${index}.bedrock_max_tokens`,
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      min={100}
                      max={2000}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleParse(draft.id)}
                    disabled={isParsing}
                  >
                    {isParsing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}
                    Parse
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSave(draft.id)}
                    disabled={saving || status === "parsing"}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save snapshot
                  </Button>
                </div>
                {draft.error ? (
                  <p className="text-sm text-rose-600">{draft.error}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-wide text-slate-600 uppercase">
                  Parsed preview (edit before saving)
                </Label>
                {holdings.length ? (
                  <div className="rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/3">Holding</TableHead>
                          <TableHead className="w-1/5">Qty</TableHead>
                          <TableHead className="w-1/5">Value (SEK)</TableHead>
                          <TableHead className="w-1/5">Currency</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((holding, idx) => (
                          <TableRow key={`${draft.id}-${idx}`}>
                            <TableCell>
                              <Input
                                value={(holding.name as string) ?? ""}
                                onChange={(e) =>
                                  updateHolding(
                                    draft.id,
                                    idx,
                                    "name",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                value={
                                  holding.quantity !== undefined &&
                                  holding.quantity !== null
                                    ? String(holding.quantity)
                                    : ""
                                }
                                onChange={(e) =>
                                  updateHolding(
                                    draft.id,
                                    idx,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                inputMode="decimal"
                                value={
                                  coerceNumber(holding.market_value_sek) ??
                                  coerceNumber(holding.value_sek) ??
                                  ""
                                }
                                onChange={(e) =>
                                  updateHolding(
                                    draft.id,
                                    idx,
                                    "market_value_sek",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={(holding.currency as string) ?? "SEK"}
                                onChange={(e) =>
                                  updateHolding(
                                    draft.id,
                                    idx,
                                    "currency",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <Card className="border-dashed border-slate-200 bg-slate-50/50">
                    <CardContent className="py-6 text-sm text-slate-600">
                      No holdings parsed yet. Click <strong>Parse</strong> to
                      extract holdings. You can still save with raw text if you
                      prefer.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const valueSeries = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) =>
        new Date(a.snapshot_date).getTime() -
        new Date(b.snapshot_date).getTime(),
    );
    const cutoff = (() => {
      const now = new Date();
      if (range === "3M") return new Date(now.setMonth(now.getMonth() - 3));
      if (range === "6M") return new Date(now.setMonth(now.getMonth() - 6));
      if (range === "1Y")
        return new Date(now.setFullYear(now.getFullYear() - 1));
      return null;
    })();
    const filtered = cutoff
      ? sorted.filter((snap) => new Date(snap.snapshot_date) >= cutoff)
      : sorted;
    return filtered.map((snap) => ({
      date: snap.snapshot_date,
      value: deriveSnapshotValue(snap),
    }));
  }, [snapshots, range]);

  const totalValue =
    coerceNumber(metrics?.total_value) ??
    coerceNumber(valueSeries.at(-1)?.value) ??
    0;
  const invested = coerceNumber(metrics?.invested) ?? 0;
  const realizedPl = coerceNumber(metrics?.realized_pl) ?? 0;
  const unrealizedPl = coerceNumber(metrics?.unrealized_pl) ?? 0;
  const twr = coerceNumber(metrics?.twr);
  const irr = coerceNumber(metrics?.irr);
  const benchmarkChange = coerceNumber(metrics?.benchmark_change_pct);

  return (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Investments
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Paste Nordnet reports, review, approve
          </h1>
          <p className="text-sm text-slate-500">
            Handle multiple exports in one session, edit holdings inline, and
            save dated snapshots to see value trends.
          </p>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          className="flex items-center gap-2 text-sm text-slate-600"
        >
          {loading || isUploading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Loading
            </span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Saving
            </span>
          ) : null}
        </motion.div>
      </StaggerWrap>
      <StaggerWrap className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200">
            <CardContent className="space-y-1 py-4">
              <p className="text-xs text-slate-500 uppercase">Total value</p>
              <p className="text-2xl font-semibold text-slate-900">
                {totalValue.toLocaleString("sv-SE", {
                  maximumFractionDigits: 0,
                })}{" "}
                SEK
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200">
            <CardContent className="space-y-1 py-4">
              <p className="text-xs text-slate-500 uppercase">Invested</p>
              <p className="text-lg font-semibold text-slate-900">
                {invested.toLocaleString("sv-SE", {
                  maximumFractionDigits: 0,
                })}{" "}
                SEK
              </p>
              <p className="text-xs text-slate-500">
                Realized P/L:{" "}
                {realizedPl.toLocaleString("sv-SE", {
                  maximumFractionDigits: 0,
                })}{" "}
                SEK
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200">
            <CardContent className="space-y-1 py-4">
              <p className="text-xs text-slate-500 uppercase">Unrealized P/L</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  unrealizedPl >= 0 ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {unrealizedPl.toLocaleString("sv-SE", {
                  maximumFractionDigits: 0,
                })}{" "}
                SEK
              </p>
              <p className="text-xs text-slate-500">
                TWR:{" "}
                {twr !== undefined && twr !== null
                  ? `${(twr * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200">
            <CardContent className="space-y-1 py-4">
              <p className="text-xs text-slate-500 uppercase">IRR</p>
              <p className="text-lg font-semibold text-slate-900">
                {irr !== undefined && irr !== null
                  ? `${(irr * 100).toFixed(1)}%`
                  : "-"}
              </p>
              <p className="text-xs text-slate-500">
                Benchmark:{" "}
                {benchmarkChange !== undefined && benchmarkChange !== null
                  ? `${(benchmarkChange * 100).toFixed(1)}%`
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Add Nordnet exports (paste or drop files)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs tracking-wide text-slate-600 uppercase">
                  Paste raw text
                </Label>
                <Textarea
                  rows={6}
                  placeholder="Paste the full Nordnet export text here..."
                  className="font-mono text-sm"
                  {...pasteForm.register("pasteValue")}
                />
                {pasteForm.formState.errors.pasteValue ? (
                  <p className="text-xs text-rose-600">
                    {pasteForm.formState.errors.pasteValue.message}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  onClick={() =>
                    void pasteForm.handleSubmit((values) => {
                      addDraft(values.pasteValue);
                      pasteForm.reset({ pasteValue: "" });
                    })()
                  }
                  disabled={!pasteForm.watch("pasteValue")?.trim()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add pasted export
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs tracking-wide text-slate-600 uppercase">
                  Upload text file
                </Label>
                <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center">
                  <label className="flex flex-col items-center gap-2 text-sm text-slate-600">
                    <UploadCloud className="h-6 w-6 text-slate-500" />
                    <span>Drop .txt/.md or click to choose files</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.csv"
                      className="hidden"
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </Button>
                  </label>
                </div>
              </div>
            </div>
            {draftList.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">
                    Drafts ({draftList.length})
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Parse each draft, then save to persist.
                  </div>
                </div>
                <div className="space-y-3">
                  {draftFields.map((field, idx) =>
                    renderDraft(field as Draft, idx),
                  )}
                </div>
              </div>
            ) : (
              <Card className="border-dashed border-slate-200 bg-slate-50/70">
                <CardContent className="space-y-4 py-8 text-center text-sm text-slate-600">
                  <div className="flex justify-center">
                    <div className="h-24 w-24 animate-pulse rounded-full bg-gradient-to-b from-slate-200 to-slate-100" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-base font-medium text-slate-800">
                      Paste your Nordnet report
                    </p>
                    <p>
                      Drop multiple exports here, parse them with AI, edit
                      holdings inline, and save snapshots to see your portfolio
                      trend.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <UploadCloud className="h-4 w-4" />
                      Paste or upload text
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Wand2 className="h-4 w-4" />
                      Parse & edit holdings
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                      <Save className="h-4 w-4" />
                      Approve & save snapshot
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm text-slate-800">
                  Portfolio value trend
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  {["3M", "6M", "1Y", "ALL"].map((opt) => (
                    <Button
                      key={opt}
                      size="sm"
                      variant={range === opt ? "secondary" : "ghost"}
                      onClick={() => setRange(opt as typeof range)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-[220px]">
              {valueSeries.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueSeries}>
                    <defs>
                      <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0ea5e9"
                      fillOpacity={1}
                      fill="url(#trend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="h-36 animate-pulse rounded bg-slate-100" />
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Save at least one snapshot to see value over time.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-800">
                Holdings delta (latest vs previous)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {holdingsDelta.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holding</TableHead>
                      <TableHead className="text-right">Now</TableHead>
                      <TableHead className="text-right">Prev</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdingsDelta.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.current.toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          {row.prior.toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            row.delta >= 0
                              ? "text-emerald-600"
                              : "text-rose-600",
                          )}
                        >
                          {row.delta.toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}
                          {row.deltaPct !== null
                            ? ` (${row.deltaPct.toFixed(1)}%)`
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="space-y-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded bg-slate-100"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Save at least two snapshots to compare holdings.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-800">
                Latest snapshot holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestSnapshot ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holding</TableHead>
                      <TableHead className="text-right">Value (SEK)</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSnapshotHoldings(latestSnapshot).map((holding, idx) => (
                      <TableRow key={`${latestSnapshot.id}-${idx}`}>
                        <TableCell className="font-medium">
                          {(holding.name as string) ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {deriveHoldingsValue(holding).toLocaleString(
                            "sv-SE",
                            {
                              maximumFractionDigits: 0,
                            },
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          {holding.quantity ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded bg-slate-100"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Save a snapshot to see holdings here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm text-slate-800">
                Recent investment transactions
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCsv(
                    transactions.slice(0, 200).map((tx) => ({
                      date: tx.occurred_at,
                      description: tx.description ?? "",
                      account: tx.account_name ?? "",
                      asset: tx.asset ?? "",
                      amount: tx.amount,
                      amount_sek: tx.amount_sek ?? "",
                      type: tx.transaction_type ?? "",
                    })),
                    "investment-transactions.csv",
                  )
                }
                disabled={!transactions.length}
              >
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {transactions.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (SEK)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.slice(0, 10).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-slate-600">
                          {tx.occurred_at.slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-slate-700 capitalize">
                          {tx.transaction_type}
                        </TableCell>
                        <TableCell className="text-slate-800">
                          {tx.description || tx.holding_name || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            (Number(tx.amount_sek) || 0) >= 0
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}
                        >
                          {Number(tx.amount_sek).toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-500">
                  Save a snapshot with transactions to see them here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionPage>
  );
};

export default Investments;
