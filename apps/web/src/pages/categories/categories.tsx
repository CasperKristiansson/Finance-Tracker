import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RefreshCw, Save, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { categorySchema } from "@/types/schemas";

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

const categoryFormSchema = categorySchema
  .pick({ name: true, category_type: true, icon: true })
  .extend({
    name: z.string().min(1, "Name is required").trim(),
    icon: z.string().optional(),
  });

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const categoryGridSchema = z.object({
  categories: z.array(
    categorySchema.extend({
      name: z.string().min(1, "Name is required").trim(),
      icon: z.string().nullable().optional(),
    }),
  ),
});

type CategoryGridValues = z.infer<typeof categoryGridSchema>;

const mergeSchema = z
  .object({
    sourceCategoryId: z.string().min(1, "Pick a source"),
    targetCategoryId: z.string().min(1, "Pick a target"),
    renameTargetTo: z.string().optional(),
  })
  .refine(
    (val) =>
      val.sourceCategoryId.trim() !== "" &&
      val.targetCategoryId.trim() !== "" &&
      val.sourceCategoryId !== val.targetCategoryId,
    {
      path: ["targetCategoryId"],
      message: "Pick distinct source and target",
    },
  );

type MergeFormValues = z.infer<typeof mergeSchema>;

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
  const [showNewSheet, setShowNewSheet] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const createForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      category_type: CategoryType.EXPENSE,
      icon: "",
    },
  });

  const gridForm = useForm<CategoryGridValues>({
    resolver: zodResolver(categoryGridSchema),
    defaultValues: { categories: items },
    mode: "onBlur",
  });

  const mergeForm = useForm<MergeFormValues>({
    resolver: zodResolver(mergeSchema),
    defaultValues: {
      sourceCategoryId: "",
      targetCategoryId: "",
      renameTargetTo: "",
    },
  });

  const watchedCategories = gridForm.watch("categories");

  useEffect(() => {
    fetchCategories({ includeArchived: showArchived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gridForm.reset({ categories: items });
  }, [gridForm, items]);

  const handleRefresh = () => {
    fetchCategories({ includeArchived: showArchived });
  };

  const handleCreate = createForm.handleSubmit((values) => {
    createCategory({
      name: values.name.trim(),
      category_type: values.category_type,
      icon: values.icon?.trim() || undefined,
    });
    toast.success("Category created");
    createForm.reset({
      name: "",
      category_type: values.category_type,
      icon: "",
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

  const handleMerge = mergeForm.handleSubmit((values) => {
    mergeCategory({
      sourceCategoryId: values.sourceCategoryId,
      targetCategoryId: values.targetCategoryId,
      renameTargetTo: values.renameTargetTo?.trim() || undefined,
    });
    toast.success("Merge requested");
    mergeForm.reset({
      sourceCategoryId: "",
      targetCategoryId: "",
      renameTargetTo: "",
    });
  });

  const visibleCategories = useMemo(
    () =>
      (watchedCategories && watchedCategories.length
        ? watchedCategories
        : items
      )
        .filter((c) => (showArchived ? true : !c.is_archived))
        .filter((c) =>
          typeFilter === "all" ? true : c.category_type === typeFilter,
        ),
    [items, showArchived, typeFilter, watchedCategories],
  );

  const saveInline = (id: string) => {
    const currentList = gridForm.getValues("categories") ?? [];
    const current = currentList.find((c) => c.id === id);
    if (!current) return;
    const trimmedName = current.name?.trim();
    if (!trimmedName) {
      toast.error("Name cannot be empty");
      return;
    }
    const original = items.find((cat) => cat.id === id);
    const payload: Partial<CategoryRead> = {};
    if (!original || original.name !== trimmedName) {
      payload.name = trimmedName;
    }
    if (!original || original.category_type !== current.category_type) {
      payload.category_type = current.category_type as CategoryType;
    }
    if ((original?.icon ?? "") !== (current.icon ?? "")) {
      payload.icon = current.icon?.trim() || null;
    }
    if (Object.keys(payload).length === 0) {
      toast.message("No changes to save");
      return;
    }
    updateCategory(id, payload);
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
              const index = (watchedCategories ?? items).findIndex(
                (c) => c.id === cat.id,
              );
              if (index < 0) return null;
              const rowDirty = Boolean(
                gridForm.formState.dirtyFields.categories?.[index],
              );
              const iconValue =
                watchedCategories?.[index]?.icon ?? cat.icon ?? "🎯";

              return (
                <div
                  key={cat.id}
                  className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">{iconValue}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {watchedCategories?.[index]?.name ?? cat.name}
                        </span>
                        <Badge
                          className={
                            categoryBadges[
                              (watchedCategories?.[index]?.category_type ||
                                cat.category_type) as CategoryType
                            ]
                          }
                          variant="outline"
                        >
                          {watchedCategories?.[index]?.category_type ??
                            cat.category_type}
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
                      placeholder="Name"
                      {...gridForm.register(
                        `categories.${index}.name` as const,
                      )}
                    />
                    <select
                      className="w-32 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800"
                      {...gridForm.register(
                        `categories.${index}.category_type` as const,
                      )}
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
                            {iconValue || "🎯"}
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
                                gridForm.setValue(
                                  `categories.${index}.icon`,
                                  emoji,
                                  { shouldDirty: true },
                                )
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
                      onClick={() => {
                        updateCategory(cat.id, {
                          is_archived: !cat.is_archived,
                        });
                        gridForm.setValue(
                          `categories.${index}.is_archived`,
                          !cat.is_archived,
                          { shouldDirty: false },
                        );
                      }}
                    >
                      {cat.is_archived ? "Restore" : "Archive"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveInline(cat.id)}
                      disabled={!rowDirty}
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
                {...mergeForm.register("sourceCategoryId")}
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
                {...mergeForm.register("targetCategoryId")}
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
                {...mergeForm.register("renameTargetTo")}
                placeholder="(optional)"
              />
              {mergeForm.formState.errors.targetCategoryId ? (
                <p className="text-xs text-rose-600">
                  {mergeForm.formState.errors.targetCategoryId?.message}
                </p>
              ) : null}
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
                        {createForm.watch("icon") || "🎯"}
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
                            createForm.setValue("icon", emoji, {
                              shouldDirty: true,
                            })
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
