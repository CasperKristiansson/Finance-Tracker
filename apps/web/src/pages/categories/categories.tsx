import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Merge, Pencil, Plus, RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LucideIconPicker } from "@/components/lucide-icon-picker";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCategoriesApi } from "@/hooks/use-api";
import { formatCategoryLabel, renderCategoryIcon } from "@/lib/category-icons";
import { CategoryType, type CategoryRead } from "@/types/api";
import { categorySchema } from "@/types/schemas";

const formatCategory = (cat: CategoryRead) =>
  formatCategoryLabel(cat.name, cat.icon);

const selectableCategoryTypes = [
  CategoryType.INCOME,
  CategoryType.EXPENSE,
] as const;

const categoryFormSchema = categorySchema
  .pick({ name: true, category_type: true, icon: true, color_hex: true })
  .extend({
    name: z.string().min(1, "Name is required").trim(),
    icon: z.string().optional(),
    color_hex: z
      .string()
      .trim()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color")
      .optional()
      .or(z.literal("")),
  });

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const categoryEditFormSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  category_type: z.enum(CategoryType),
  icon: z.string().optional(),
  color_hex: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Invalid hex color")
    .optional()
    .or(z.literal("")),
  is_archived: z.boolean(),
});

type CategoryEditFormValues = z.infer<typeof categoryEditFormSchema>;

type TypeFilter = "all" | CategoryType;
type ArchivedFilter = "active" | "archived" | "all";
type SortKey = "az" | "most_used" | "newest";

const formatCurrency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const formatShortDate = (value?: string | null) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const usageText = (cat: CategoryRead) => {
  const count = Number(cat.transaction_count ?? 0);
  const total = Number(cat.lifetime_total ?? 0);
  const lastUsed = formatShortDate(cat.last_used_at ?? null);
  return `${count} tx • last ${lastUsed} • ${formatCurrency(total)}`;
};

const sparklinePath = (values: number[], width: number, height: number) => {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const xStep = (width - pad * 2) / (values.length - 1);

  return values
    .map((value, idx) => {
      const x = pad + idx * xStep;
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

export const Categories: React.FC = () => {
  const {
    items,
    loading,
    error,
    fetchCategories,
    updateCategory,
    createCategory,
    mergeCategory,
  } = useCategoriesApi();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [archivedFilter, setArchivedFilter] =
    useState<ArchivedFilter>("active");
  const [sortKey, setSortKey] = useState<SortKey>("az");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeRename, setMergeRename] = useState<string>("");
  const [showNewSheet, setShowNewSheet] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      category_type: CategoryType.EXPENSE,
      icon: "",
      color_hex: "",
    },
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const editingCategory = useMemo(
    () =>
      editingId
        ? (items.find((category) => category.id === editingId) ?? null)
        : null,
    [editingId, items],
  );

  const editForm = useForm<CategoryEditFormValues>({
    resolver: zodResolver(categoryEditFormSchema),
    defaultValues: {
      name: "",
      category_type: CategoryType.EXPENSE,
      icon: "",
      color_hex: "",
      is_archived: false,
    },
  });

  useEffect(() => {
    if (!editingCategory) return;
    editForm.reset({
      name: editingCategory.name,
      category_type: editingCategory.category_type,
      icon: editingCategory.icon ?? "",
      color_hex: editingCategory.color_hex ?? "",
      is_archived: editingCategory.is_archived,
    });
  }, [editForm, editingCategory]);

  useEffect(() => {
    fetchCategories({ includeArchived: archivedFilter !== "active" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivedFilter]);

  const handleRefresh = () => {
    fetchCategories({ includeArchived: archivedFilter !== "active" });
  };

  const handleCreate = createForm.handleSubmit((values) => {
    createCategory({
      name: values.name.trim(),
      category_type: values.category_type,
      icon: values.icon?.trim() || undefined,
      color_hex: values.color_hex?.trim() ? values.color_hex.trim() : undefined,
    });
    toast.success("Category created");
    createForm.reset({
      name: "",
      category_type: values.category_type,
      icon: "",
      color_hex: "",
    });
    setShowNewSheet(false);
  });

  const escapeCsv = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const parseCsvRows = (text: string) => {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return [];
    const [headerLine, ...dataLines] = lines;
    const headers = headerLine.split(",").map((h) => h.trim());
    return dataLines.map((line) => {
      const parts = line
        .split(",")
        .map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));
      const row: Record<string, string> = {};
      headers.forEach((key, idx) => {
        row[key] = parts[idx] ?? "";
      });
      return row;
    });
  };

  const exportCategories = () => {
    const header = [
      "name",
      "category_type",
      "color_hex",
      "icon",
      "is_archived",
    ];
    const rows = items.map((cat) => [
      escapeCsv(cat.name),
      escapeCsv(cat.category_type),
      escapeCsv(cat.color_hex ?? ""),
      escapeCsv(cat.icon ?? ""),
      escapeCsv(cat.is_archived ? "true" : "false"),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "categories.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCategories = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsvRows(text);
      rows.forEach((row) => {
        const name = row["name"]?.trim();
        const category_type = row["category_type"]?.trim() as CategoryType;
        if (!name || !category_type) return;
        const icon = row["icon"] || undefined;
        const color_hex = row["color_hex"] || undefined;
        createCategory({ name, category_type, icon, color_hex });
      });
      fetchCategories({ includeArchived: archivedFilter !== "active" });
      toast.success("Import started");
    };
    reader.readAsText(file);
  };

  const handleEditSave = editForm.handleSubmit((values) => {
    if (!editingCategory) return;
    updateCategory(editingCategory.id, {
      name: values.name.trim(),
      category_type: values.category_type,
      icon: values.icon?.trim() ? values.icon.trim() : null,
      color_hex: values.color_hex?.trim() ? values.color_hex.trim() : null,
      is_archived: values.is_archived,
    });
    toast.success("Category updated");
    setEditingId(null);
  });

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((category) => {
      if (archivedFilter === "active" && category.is_archived) return false;
      if (archivedFilter === "archived" && !category.is_archived) return false;
      if (typeFilter !== "all" && category.category_type !== typeFilter)
        return false;

      if (!q) return true;
      const haystack = `${category.name} ${category.icon ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [archivedFilter, items, search, typeFilter]);

  const sortedCategories = useMemo(() => {
    const copy = [...filteredCategories];
    copy.sort((a, b) => {
      if (sortKey === "most_used") {
        const diff =
          Number(b.transaction_count ?? 0) - Number(a.transaction_count ?? 0);
        if (diff !== 0) return diff;
        const aLast = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
        const bLast = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
        if (bLast !== aLast) return bLast - aLast;
        return a.name.localeCompare(b.name);
      }
      if (sortKey === "newest") {
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (bCreated !== aCreated) return bCreated - aCreated;
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return copy;
  }, [filteredCategories, sortKey]);

  const mergeSource = useMemo(
    () => (mergeSourceId ? items.find((c) => c.id === mergeSourceId) : null),
    [items, mergeSourceId],
  );

  const mergeTargets = useMemo(() => {
    if (!mergeSource) return [];
    return items
      .filter((cat) => !cat.is_archived)
      .filter((cat) => cat.id !== mergeSource.id)
      .filter((cat) => cat.category_type === mergeSource.category_type)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, mergeSource]);

  const openMerge = (sourceId: string) => {
    setMergeSourceId(sourceId);
    setMergeTargetId("");
    setMergeRename("");
    setMergeOpen(true);
  };

  const submitMerge = () => {
    if (!mergeSourceId || !mergeTargetId) return;
    mergeCategory({
      sourceCategoryId: mergeSourceId,
      targetCategoryId: mergeTargetId,
      renameTargetTo: mergeRename.trim() || undefined,
    });
    toast.success("Merge requested");
    setMergeOpen(false);
    setMergeSourceId(null);
    setMergeTargetId("");
    setMergeRename("");
  };

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Categories
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Organize how money moves
          </h1>
          <p className="text-sm text-slate-500">
            Add emoji or glyph icons for faster scanning and toggle archived
            sets when needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCategories}>
              Export CSV
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportCategories(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
            >
              Import CSV
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Categories</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => setShowNewSheet(true)}
              >
                <Plus className="h-4 w-4" /> Add category
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search categories…"
                  className="sm:max-w-xs"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={typeFilter === "all" ? "default" : "outline"}
                    onClick={() => setTypeFilter("all")}
                  >
                    All
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      typeFilter === CategoryType.INCOME ? "default" : "outline"
                    }
                    onClick={() => setTypeFilter(CategoryType.INCOME)}
                  >
                    Income
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      typeFilter === CategoryType.EXPENSE
                        ? "default"
                        : "outline"
                    }
                    onClick={() => setTypeFilter(CategoryType.EXPENSE)}
                  >
                    Expense
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
                  value={archivedFilter}
                  onChange={(e) =>
                    setArchivedFilter(e.target.value as ArchivedFilter)
                  }
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                  <option value="all">All</option>
                </select>

                <select
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="az">A → Z</option>
                  <option value="most_used">Most used</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
              {sortedCategories.map((cat) => {
                const series = (cat.recent_months ?? []).map((p) =>
                  Number(p.total ?? 0),
                );
                const hasSeries = series.length >= 2;
                const delta = hasSeries
                  ? series[series.length - 1] - series[0]
                  : 0;
                const deltaPct =
                  hasSeries && series[0] !== 0
                    ? (delta / Math.abs(series[0])) * 100
                    : null;

                const accent =
                  cat.color_hex ??
                  (cat.category_type === CategoryType.INCOME
                    ? "#10b981"
                    : "#ef4444");

                return (
                  <div
                    key={cat.id}
                    className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="h-3 w-3 shrink-0 rounded-full border border-slate-200"
                        style={{ backgroundColor: cat.color_hex ?? "#e2e8f0" }}
                        title={cat.color_hex ?? "No color"}
                      />
                      {renderCategoryIcon(
                        cat.icon ?? "",
                        cat.name,
                        "h-6 w-6 text-slate-700 flex items-center justify-center",
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate font-medium text-slate-900">
                            {cat.name}
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              cat.category_type === CategoryType.INCOME
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            }
                          >
                            {cat.category_type}
                          </Badge>
                          {cat.is_archived ? (
                            <Badge variant="outline">Archived</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-slate-500">
                          {usageText(cat)}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden w-32 flex-col items-end gap-1 lg:flex">
                        {hasSeries ? (
                          <>
                            <svg
                              width="112"
                              height="28"
                              viewBox="0 0 112 28"
                              className="overflow-visible"
                            >
                              <path
                                d={sparklinePath(series, 112, 28)}
                                fill="none"
                                stroke={accent}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <span className="text-[11px] font-semibold text-slate-600 tabular-nums">
                              {deltaPct !== null
                                ? `${delta >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%`
                                : formatCurrency(delta)}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => openMerge(cat.id)}
                        disabled={cat.is_archived}
                        title={
                          cat.is_archived
                            ? "Unarchive to merge"
                            : "Merge into another category"
                        }
                      >
                        <Merge className="h-4 w-4" />
                        Merge
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => setEditingId(cat.id)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </div>
                  </div>
                );
              })}
              {sortedCategories.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">
                  No categories match your filters.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={Boolean(editingCategory)}
          onOpenChange={(open) => {
            if (!open) setEditingId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit category</DialogTitle>
              <DialogDescription>
                Update name, type, icon, or archive this category.
              </DialogDescription>
            </DialogHeader>
            {editingCategory ? (
              <form className="space-y-4" onSubmit={handleEditSave}>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="edit-category-name"
                  >
                    Name
                  </label>
                  <Input
                    id="edit-category-name"
                    placeholder="e.g., Groceries"
                    {...editForm.register("name")}
                  />
                  {editForm.formState.errors.name ? (
                    <p className="text-xs text-rose-600">
                      {editForm.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm text-slate-700">Type</label>
                    <select
                      className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800"
                      {...editForm.register("category_type")}
                    >
                      {selectableCategoryTypes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm text-transparent select-none">
                      Archived
                    </label>
                    <div className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
                      <span>Archived</span>
                      <Switch
                        aria-label="Archived"
                        checked={editForm.watch("is_archived")}
                        onCheckedChange={(checked) =>
                          editForm.setValue("is_archived", checked, {
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm text-slate-700">Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editForm.watch("color_hex") || "#94a3b8"}
                      onChange={(e) =>
                        editForm.setValue("color_hex", e.target.value, {
                          shouldDirty: true,
                        })
                      }
                      className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
                      aria-label="Pick color"
                    />
                    <Input
                      {...editForm.register("color_hex")}
                      placeholder="#64748b"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        editForm.setValue("color_hex", "", {
                          shouldDirty: true,
                        })
                      }
                    >
                      Clear
                    </Button>
                  </div>
                  {editForm.formState.errors.color_hex ? (
                    <p className="text-xs text-rose-600">
                      {editForm.formState.errors.color_hex.message}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-700">Icon</label>
                  <div className="space-y-1.5">
                    <label
                      className="text-xs text-slate-500"
                      htmlFor="edit-lucide-icon"
                    >
                      Browse Lucide icons
                    </label>
                    <LucideIconPicker
                      inputId="edit-lucide-icon"
                      maxLength={16}
                      value={editForm.watch("icon")}
                      onChange={(icon) =>
                        editForm.setValue("icon", icon, { shouldDirty: true })
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Save changes</Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={mergeOpen}
          onOpenChange={(open) => {
            setMergeOpen(open);
            if (!open) {
              setMergeSourceId(null);
              setMergeTargetId("");
              setMergeRename("");
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Merge className="h-5 w-5" />
                Merge categories
              </DialogTitle>
              <DialogDescription>
                Transactions and budgets from the source category will move to
                the target. The source category will be archived.
              </DialogDescription>
            </DialogHeader>

            {mergeSource ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-slate-900">
                      Source: {formatCategory(mergeSource)}
                    </div>
                    <Badge variant="secondary">
                      {mergeSource.category_type}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Impact: {usageText(mergeSource)}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-700">Target</label>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                  >
                    <option value="">Pick target…</option>
                    {mergeTargets.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {formatCategory(cat)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">
                    Only {mergeSource.category_type} categories are available as
                    targets.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-700">
                    Rename target to (optional)
                  </label>
                  <Input
                    value={mergeRename}
                    onChange={(e) => setMergeRename(e.target.value)}
                    placeholder="(optional)"
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                Pick a source category from the list.
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMergeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="gap-2"
                onClick={submitMerge}
                disabled={!mergeSource || !mergeTargetId || loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Merge now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {showNewSheet ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  New category
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Add category
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewSheet(false)}
              >
                Close
              </Button>
            </div>
            <form className="space-y-3" onSubmit={handleCreate}>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Name</label>
                <Input
                  placeholder="Groceries"
                  {...createForm.register("name")}
                />
                {createForm.formState.errors.name ? (
                  <p className="text-xs text-rose-600">
                    {createForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Type</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                  {...createForm.register("category_type")}
                >
                  {selectableCategoryTypes.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={createForm.watch("color_hex") || "#94a3b8"}
                    onChange={(e) =>
                      createForm.setValue("color_hex", e.target.value)
                    }
                    className="h-10 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1"
                    aria-label="Pick color"
                  />
                  <Input
                    {...createForm.register("color_hex")}
                    placeholder="#64748b"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => createForm.setValue("color_hex", "")}
                  >
                    Clear
                  </Button>
                </div>
                {createForm.formState.errors.color_hex ? (
                  <p className="text-xs text-rose-600">
                    {createForm.formState.errors.color_hex.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Icon</label>
                <div className="space-y-1.5">
                  <label
                    className="text-xs text-slate-500"
                    htmlFor="category-lucide-icon"
                  >
                    Browse Lucide icons
                  </label>
                  <LucideIconPicker
                    inputId="category-lucide-icon"
                    maxLength={16}
                    value={createForm.watch("icon")}
                    onChange={(icon) =>
                      createForm.setValue("icon", icon, { shouldDirty: true })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShowNewSheet(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <Plus className="mr-2 h-4 w-4" /> Add category
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </MotionPage>
  );
};
