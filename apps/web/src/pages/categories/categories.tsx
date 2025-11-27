import { Check, Loader2, RefreshCw, Save } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export const Categories: React.FC = () => {
  const {
    items,
    loading,
    error,
    includeArchived,
    fetchCategories,
    updateCategory,
    createCategory,
  } = useCategoriesApi();

  const [showArchived, setShowArchived] = useState(includeArchived);
  const [form, setForm] = useState<{
    name: string;
    category_type: CategoryType;
    color_hex?: string;
    icon?: string;
  }>({
    name: "",
    category_type: CategoryType.EXPENSE,
    color_hex: "#7c3aed",
    icon: "",
  });
  const [editBuffer, setEditBuffer] = useState<
    Record<string, { icon?: string; color_hex?: string }>
  >({});

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
      color_hex: form.color_hex || undefined,
      icon: form.icon || undefined,
    });
    toast.success("Category created");
    setForm((prev) => ({ ...prev, name: "", icon: "" }));
  };

  const visibleCategories = useMemo(
    () => items.filter((c) => (showArchived ? true : !c.is_archived)),
    [items, showArchived],
  );

  const saveInline = (id: string) => {
    const payload = editBuffer[id];
    if (!payload) return;
    updateCategory(id, payload);
    setEditBuffer((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast.success("Category updated");
  };

  return (
    <div className="space-y-4">
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-700">
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
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Categories</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            {visibleCategories.map((cat) => {
              const pending = editBuffer[cat.id] ?? {};
              const appliedIcon = pending.icon ?? cat.icon ?? "";
              const appliedColor =
                pending.color_hex ?? cat.color_hex ?? "#e2e8f0";
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
                          {formatCategory(cat)}
                        </span>
                        <Badge
                          className={categoryBadges[cat.category_type]}
                          variant="outline"
                        >
                          {cat.category_type}
                        </Badge>
                        {cat.is_archived ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">
                        Color swatch:&nbsp;
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-slate-200 align-middle"
                          style={{ backgroundColor: appliedColor }}
                        />
                        <span className="ml-1 text-xs text-slate-500">
                          {appliedColor}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="w-28"
                      value={pending.icon ?? cat.icon ?? ""}
                      placeholder="🎯"
                      onChange={(e) =>
                        setEditBuffer((prev) => ({
                          ...prev,
                          [cat.id]: { ...prev[cat.id], icon: e.target.value },
                        }))
                      }
                    />
                    <Input
                      className="w-28"
                      value={pending.color_hex ?? cat.color_hex ?? ""}
                      onChange={(e) =>
                        setEditBuffer((prev) => ({
                          ...prev,
                          [cat.id]: {
                            ...prev[cat.id],
                            color_hex: e.target.value,
                          },
                        }))
                      }
                    />
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
            <CardTitle>New category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <label className="text-sm text-slate-600">Color</label>
                <Input
                  value={form.color_hex}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, color_hex: e.target.value }))
                  }
                  placeholder="#00aa88"
                />
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-sm text-slate-600">Icon</label>
                <Input
                  value={form.icon}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, icon: e.target.value }))
                  }
                  placeholder="🛒"
                />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Add category
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
