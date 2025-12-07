import { Loader2, Plus, RefreshCw, Save, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useCategoriesApi } from "@/hooks/use-api";
import { CategoryType, type CategoryRead } from "@/types/api";

const categoryBadges: Record<CategoryType, string> = {
  [CategoryType.INCOME]:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  [CategoryType.EXPENSE]: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  [CategoryType.ADJUSTMENT]: "bg-slate-50 text-slate-700 ring-1 ring-slate-100",
  [CategoryType.LOAN]: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  [CategoryType.INTEREST]: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
};

const formatCategory = (cat: CategoryRead) =>
  `${cat.icon ? `${cat.icon} ` : ""}${cat.name}`;

const emojiPalette = [
  "💸",
  "🛒",
  "🍽️",
  "🚗",
  "🏠",
  "🎯",
  "🧾",
  "🎁",
  "🧠",
  "📈",
  "💼",
  "💳",
  "🏦",
  "🏥",
  "🎟️",
  "🍿",
  "🧳",
  "🎮",
  "🎧",
  "🚌",
  "✈️",
  "🛠️",
  "📚",
  "🧰",
  "🌱",
  "🐾",
  "🍼",
];

const categoryTypeOptions = [
  { label: "All types", value: "all" },
  ...Object.values(CategoryType).map((value) => ({ label: value, value })),
] as const;

export const Categories: React.FC = () => {
  const {
    items,
    loading,
    error,
    includeArchived,
    fetchCategories,
    updateCategory,
    createCategory,
    mergeCategory,
  } = useCategoriesApi();

  const [showArchived, setShowArchived] = useState(includeArchived);
  const [typeFilter, setTypeFilter] =
    useState<(typeof categoryTypeOptions)[number]["value"]>("all");
  const [form, setForm] = useState<{
    name: string;
    category_type: CategoryType;
    icon?: string;
  }>({
    name: "",
    category_type: CategoryType.EXPENSE,
    icon: "",
  });
  const [editBuffer, setEditBuffer] = useState<
    Record<
      string,
      {
        icon?: string;
        name?: string;
        category_type?: CategoryType;
      }
    >
  >({});
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [mergeState, setMergeState] = useState<{
    sourceCategoryId: string;
    targetCategoryId: string;
    renameTargetTo?: string;
  }>({ sourceCategoryId: "", targetCategoryId: "", renameTargetTo: "" });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchCategories({ includeArchived: showArchived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => {
    fetchCategories({ includeArchived: showArchived });
  };

  const handleCreate = () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createCategory({
      ...form,
      icon: form.icon || undefined,
    });
    toast.success("Category created");
    setForm((prev) => ({ ...prev, name: "", icon: "" }));
    setShowNewSheet(false);
  };

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
    const header = ["name", "category_type", "icon", "is_archived"];
    const rows = items.map((cat) => [
      escapeCsv(cat.name),
      escapeCsv(cat.category_type),
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
        createCategory({ name, category_type, icon });
      });
      fetchCategories();
      toast.success("Import started");
    };
    reader.readAsText(file);
  };

  const handleMerge = () => {
    if (
      !mergeState.sourceCategoryId ||
      !mergeState.targetCategoryId ||
      mergeState.sourceCategoryId === mergeState.targetCategoryId
    ) {
      toast.error("Pick distinct source and target");
      return;
    }
    mergeCategory({
      sourceCategoryId: mergeState.sourceCategoryId,
      targetCategoryId: mergeState.targetCategoryId,
      renameTargetTo: mergeState.renameTargetTo || undefined,
    });
    toast.success("Merge requested");
    setMergeState({
      sourceCategoryId: "",
      targetCategoryId: "",
      renameTargetTo: "",
    });
  };

  const visibleCategories = useMemo(
    () =>
      items
        .filter((c) => (showArchived ? true : !c.is_archived))
        .filter((c) =>
          typeFilter === "all" ? true : c.category_type === typeFilter,
        ),
    [items, showArchived, typeFilter],
  );

  const saveInline = (id: string) => {
    const payload = editBuffer[id];
    if (!payload) return;
    if (payload.name !== undefined && !payload.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    updateCategory(id, payload);
    setEditBuffer((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast.success("Category updated");
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
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={showArchived}
                  onChange={(e) => {
                    setShowArchived(e.target.checked);
                    fetchCategories({ includeArchived: e.target.checked });
                  }}
                />
                <span>Show archived</span>
              </label>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-xs tracking-wide text-slate-500 uppercase">
                  Type
                </span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as typeof typeFilter)
                  }
                >
                  {categoryTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
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
          <CardContent className="divide-y divide-slate-100">
            {visibleCategories.map((cat) => {
              const pending = editBuffer[cat.id] ?? {};
              const appliedIcon = pending.icon ?? cat.icon ?? "";
              const appliedName = pending.name ?? cat.name;
              const appliedType = pending.category_type ?? cat.category_type;
              return (
                <div
                  key={cat.id}
                  className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">
                      {appliedIcon || "🗂️"}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {appliedName}
                        </span>
                        <Badge
                          className={categoryBadges[appliedType]}
                          variant="outline"
                        >
                          {appliedType}
                        </Badge>
                        {cat.is_archived ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-40"
                      value={appliedName}
                      onChange={(e) =>
                        setEditBuffer((prev) => ({
                          ...prev,
                          [cat.id]: { ...prev[cat.id], name: e.target.value },
                        }))
                      }
                      placeholder="Name"
                    />
                    <select
                      className="w-32 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                      value={appliedType}
                      onChange={(e) =>
                        setEditBuffer((prev) => ({
                          ...prev,
                          [cat.id]: {
                            ...prev[cat.id],
                            category_type: e.target.value as CategoryType,
                          },
                        }))
                      }
                    >
                      {Object.values(CategoryType).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          aria-label="Pick emoji"
                        >
                          <span className="text-lg leading-none">
                            {pending.icon ?? cat.icon ?? "🎯"}
                          </span>
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="p-2">
                        <div className="grid grid-cols-4 gap-1">
                          {emojiPalette.map((emoji) => (
                            <DropdownMenuItem
                              key={emoji}
                              className="flex h-10 w-10 items-center justify-center text-lg"
                              onSelect={() =>
                                setEditBuffer((prev) => ({
                                  ...prev,
                                  [cat.id]: { ...prev[cat.id], icon: emoji },
                                }))
                              }
                            >
                              {emoji}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateCategory(cat.id, {
                          is_archived: !cat.is_archived,
                        })
                      }
                    >
                      {cat.is_archived ? "Restore" : "Archive"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveInline(cat.id)}
                      disabled={!editBuffer[cat.id]}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
            {visibleCategories.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">
                No categories to show.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Merge / Rename</CardTitle>
            <p className="text-sm text-slate-500">
              Move transactions and budgets from one category into another.
              Optionally rename the target after merging.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Source</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={mergeState.sourceCategoryId}
                onChange={(e) =>
                  setMergeState((prev) => ({
                    ...prev,
                    sourceCategoryId: e.target.value,
                  }))
                }
              >
                <option value="">Pick source</option>
                {items.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {formatCategory(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Target</label>
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                value={mergeState.targetCategoryId}
                onChange={(e) =>
                  setMergeState((prev) => ({
                    ...prev,
                    targetCategoryId: e.target.value,
                  }))
                }
              >
                <option value="">Pick target</option>
                {items.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {formatCategory(cat)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-600">Rename target to</label>
              <Input
                value={mergeState.renameTargetTo}
                onChange={(e) =>
                  setMergeState((prev) => ({
                    ...prev,
                    renameTargetTo: e.target.value,
                  }))
                }
                placeholder="(optional)"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={handleMerge}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Merge categories
              </Button>
            </div>
          </CardContent>
        </Card>
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
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Groceries"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Type</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                  value={form.category_type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      category_type: e.target.value as CategoryType,
                    }))
                  }
                >
                  {Object.values(CategoryType).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Icon</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="gap-2"
                      aria-label="Pick emoji"
                    >
                      <span className="text-lg leading-none">
                        {form.icon || "🎯"}
                      </span>
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {emojiPalette.map((emoji) => (
                        <DropdownMenuItem
                          key={emoji}
                          className="flex h-10 w-10 items-center justify-center text-lg"
                          onSelect={() =>
                            setForm((prev) => ({ ...prev, icon: emoji }))
                          }
                        >
                          {emoji}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewSheet(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add category
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </MotionPage>
  );
};
