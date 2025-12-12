import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, RefreshCw, Sparkles } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCategoriesApi } from "@/hooks/use-api";
import { formatCategoryLabel, renderCategoryIcon } from "@/lib/category-icons";
import { CategoryType, type CategoryRead } from "@/types/api";
import { categorySchema } from "@/types/schemas";

const formatCategory = (cat: CategoryRead) =>
  formatCategoryLabel(cat.name, cat.icon);

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

const selectableCategoryTypes = [
  CategoryType.INCOME,
  CategoryType.EXPENSE,
] as const;

const categoryTypeOptions = [
  { label: "All types", value: "all" },
  ...selectableCategoryTypes.map((value) => ({ label: value, value })),
] as const;

const categoryFormSchema = categorySchema
  .pick({ name: true, category_type: true, icon: true })
  .extend({
    name: z.string().min(1, "Name is required").trim(),
    icon: z.string().optional(),
  });

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const categoryEditFormSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  category_type: z.nativeEnum(CategoryType),
  icon: z.string().optional(),
  is_archived: z.boolean(),
});

type CategoryEditFormValues = z.infer<typeof categoryEditFormSchema>;

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
      is_archived: false,
    },
  });

  const mergeForm = useForm<MergeFormValues>({
    resolver: zodResolver(mergeSchema),
    defaultValues: {
      sourceCategoryId: "",
      targetCategoryId: "",
      renameTargetTo: "",
    },
  });

  useEffect(() => {
    fetchCategories({ includeArchived: showArchived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!editingCategory) return;
    editForm.reset({
      name: editingCategory.name,
      category_type: editingCategory.category_type,
      icon: editingCategory.icon ?? "",
      is_archived: editingCategory.is_archived,
    });
  }, [editForm, editingCategory]);

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
      items
        .filter((category) => (showArchived ? true : !category.is_archived))
        .filter((category) =>
          typeFilter === "all" ? true : category.category_type === typeFilter,
        ),
    [items, showArchived, typeFilter],
  );

  const incomeCategories = useMemo(
    () =>
      visibleCategories.filter(
        (category) => category.category_type === CategoryType.INCOME,
      ),
    [visibleCategories],
  );

  const expenseCategories = useMemo(
    () =>
      visibleCategories.filter(
        (category) => category.category_type === CategoryType.EXPENSE,
      ),
    [visibleCategories],
  );

  const handleEditSave = editForm.handleSubmit((values) => {
    if (!editingCategory) return;
    updateCategory(editingCategory.id, {
      name: values.name.trim(),
      category_type: values.category_type,
      icon: values.icon?.trim() ? values.icon.trim() : null,
      is_archived: values.is_archived,
    });
    toast.success("Category updated");
    setEditingId(null);
  });

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
          <CardContent className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Income</p>
                  <Badge variant="secondary" className="text-xs">
                    {incomeCategories.length}
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
                  {incomeCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {renderCategoryIcon(
                          cat.icon ?? "",
                          cat.name,
                          "h-6 w-6 text-slate-700 flex items-center justify-center",
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {cat.name}
                          </div>
                          {cat.is_archived ? (
                            <p className="text-xs text-slate-500">Archived</p>
                          ) : null}
                        </div>
                      </div>
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
                  ))}
                  {incomeCategories.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-slate-500">
                      No income categories to show.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Expense
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {expenseCategories.length}
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
                  {expenseCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {renderCategoryIcon(
                          cat.icon ?? "",
                          cat.name,
                          "h-6 w-6 text-slate-700 flex items-center justify-center",
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">
                            {cat.name}
                          </div>
                          {cat.is_archived ? (
                            <p className="text-xs text-slate-500">Archived</p>
                          ) : null}
                        </div>
                      </div>
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
                  ))}
                  {expenseCategories.length === 0 ? (
                    <p className="px-3 py-6 text-sm text-slate-500">
                      No expense categories to show.
                    </p>
                  ) : null}
                </div>
              </div>
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
                  <label className="flex h-10 items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700">
                    Archived
                    <Switch
                      checked={editForm.watch("is_archived")}
                      onCheckedChange={(checked) =>
                        editForm.setValue("is_archived", checked, {
                          shouldDirty: true,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-700">Icon</label>
                  <div className="flex items-center gap-2">
                    {renderCategoryIcon(
                      editForm.watch("icon") || "🎯",
                      editForm.watch("name") || "Category",
                      "h-6 w-6 text-xl leading-none text-slate-700 flex items-center justify-center",
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          aria-label="Pick emoji"
                        >
                          {renderCategoryIcon(
                            editForm.watch("icon") || "🎯",
                            editForm.watch("name") || "Category",
                            "h-5 w-5 text-lg leading-none text-slate-700 flex items-center justify-center",
                          )}
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="p-2">
                        <div className="grid grid-cols-4 gap-1">
                          {emojiPalette.map((emoji) => (
                            <DropdownMenuItem
                              key={emoji}
                              className="flex h-10 w-10 items-center justify-center text-lg"
                              onSelect={() =>
                                editForm.setValue("icon", emoji, {
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
                  <LucideIconPicker
                    inputId="edit-lucide-icon"
                    maxLength={16}
                    value={editForm.watch("icon")}
                    onChange={(icon) =>
                      editForm.setValue("icon", icon, { shouldDirty: true })
                    }
                  />
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
                  {selectableCategoryTypes.map((value) => (
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
                      {renderCategoryIcon(
                        createForm.watch("icon") || "🎯",
                        createForm.watch("name") || "Category",
                        "h-5 w-5 text-lg leading-none text-slate-700 flex items-center justify-center",
                      )}
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
                <div className="space-y-1.5">
                  <label
                    className="text-xs text-slate-500"
                    htmlFor="category-lucide-icon"
                  >
                    Or browse Lucide icons
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
