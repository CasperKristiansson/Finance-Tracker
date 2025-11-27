import {
  Cpu,
  Loader2,
  MonitorSmartphone,
  Moon,
  RefreshCw,
  Save,
  SunMedium,
  UploadCloud,
  Wand2,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectIsDemo, selectUser } from "@/features/auth/authSlice";
import type { BankTemplate } from "@/features/settings/settingsSlice";
import { useSettings } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/types/api";

const themeOptions: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "light",
    label: "Light",
    description: "Bright, high-contrast surfaces for daylight focus.",
    icon: SunMedium,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Dimmed panels with cool accents for evening sessions.",
    icon: Moon,
  },
  {
    value: "system",
    label: "Follow system",
    description: "Switch automatically with your OS appearance.",
    icon: MonitorSmartphone,
  },
];

const emptyTemplate = (): BankTemplate => ({
  id: "",
  name: "",
  description: "",
  mapping: { date: "", description: "", amount: "" },
});

const formatTimestamp = (value?: string) => {
  if (!value) return "Not synced yet";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const Settings: React.FC = () => {
  const user = useAppSelector(selectUser);
  const isDemo = useAppSelector(selectIsDemo);
  const {
    theme,
    templates,
    envInfo,
    apiBaseUrl,
    loading,
    saving,
    error,
    lastSavedAt,
    loadSettings,
    saveSettings,
    changeTheme,
    upsertTemplate,
    deleteTemplate,
  } = useSettings();
  const { setTheme, resolvedTheme } = useTheme();

  const [editingId, setEditingId] = useState<string | null>(
    templates[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<BankTemplate>(
    templates[0]
      ? { ...templates[0], mapping: { ...templates[0].mapping } }
      : emptyTemplate(),
  );

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  useEffect(() => {
    if (editingId === null) return;
    const current = templates.find((tpl) => tpl.id === editingId);
    if (current) {
      setDraft({ ...current, mapping: { ...current.mapping } });
    } else if (templates.length) {
      setEditingId(templates[0].id);
      setDraft({
        ...templates[0],
        mapping: { ...templates[0].mapping },
      });
    }
  }, [editingId, templates]);

  const handleThemeChange = (next: ThemePreference) => {
    setTheme(next);
    changeTheme(next);
  };

  const handleTemplateSave = () => {
    if (!draft.id.trim() || !draft.name.trim()) {
      toast.error("Template needs an id and name");
      return;
    }
    if (
      !draft.mapping.date ||
      !draft.mapping.description ||
      !draft.mapping.amount
    ) {
      toast.error("Please map date, description, and amount columns.");
      return;
    }

    const payload: BankTemplate = {
      ...draft,
      id: draft.id.trim(),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      mapping: {
        date: draft.mapping.date.trim(),
        description: draft.mapping.description.trim(),
        amount: draft.mapping.amount.trim(),
      },
      isDefault: draft.isDefault,
    };

    upsertTemplate(payload);
    setEditingId(payload.id);
    toast.success("Template saved", {
      description: "Cached locally. Sync to API when ready.",
    });
  };

  const startNewTemplate = () => {
    setEditingId(null);
    setDraft(emptyTemplate());
  };

  const headerStatus = useMemo(() => {
    if (saving) return "Saving to API";
    if (loading) return "Loading";
    if (error) return "Offline";
    return "Ready";
  }, [error, loading, saving]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Settings
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Personalize your workspace
          </h1>
          <p className="text-sm text-slate-500">
            Theme, profile context, bank templates, and environment diagnostics.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status: {headerStatus} · Last saved: {formatTimestamp(lastSavedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-slate-300"
            onClick={loadSettings}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            variant="default"
            className="gap-2"
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sync to API
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-none bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-800 text-white shadow-xl">
          <CardHeader className="relative z-10">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
              <Wand2 className="h-4 w-4" />
              Theme & appearance
            </CardTitle>
            <p className="text-sm text-slate-200/90">
              Crisp UI with intentional motion. Pick the vibe that keeps you in
              flow.
            </p>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {themeOptions.map((option) => {
              const selected = theme === option.value;
              return (
                <Button
                  key={option.value}
                  variant={selected ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start border border-white/10 bg-white/5 text-left text-white transition hover:bg-white/10",
                    selected && "ring-2 ring-white/60",
                  )}
                  onClick={() => handleThemeChange(option.value)}
                >
                  <option.icon className="h-5 w-5" />
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="text-xs text-white/80">
                      {option.description}
                    </span>
                  </div>
                  {selected ? (
                    <Badge className="ml-auto bg-emerald-500 text-slate-900">
                      Active
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
            <p className="text-xs text-white/70">
              Current: {resolvedTheme || theme}
            </p>
          </CardContent>
          <div className="absolute -top-6 -left-6 h-28 w-28 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute right-0 bottom-0 h-24 w-24 rounded-full bg-indigo-500/20 blur-2xl" />
        </Card>

        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-700">Profile</CardTitle>
            <p className="text-sm text-slate-500">
              Cognito-backed session details. Tokens stay client-side.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-semibold text-slate-900">
                {user.email || "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mode</span>
              <Badge variant={isDemo ? "secondary" : "default"}>
                {isDemo ? "Demo" : "Authenticated"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">API base</span>
              <span className="font-mono text-xs text-slate-900">
                {apiBaseUrl || "Not set"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
              <Cpu className="h-4 w-4 text-slate-500" />
              Environment
            </CardTitle>
            <p className="text-sm text-slate-500">
              Quick visibility into the client-side env vars powering requests.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            {envInfo.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-xs tracking-wide text-slate-500 uppercase">
                    {entry.label || entry.key}
                  </span>
                  <span className="font-mono text-xs text-slate-900">
                    {entry.value}
                  </span>
                </div>
                {entry.value === "Not set" ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700"
                  >
                    Missing
                  </Badge>
                ) : (
                  <Badge variant="secondary">Set</Badge>
                )}
              </div>
            ))}
            {error ? (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <XCircle className="h-4 w-4" />
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_18px_48px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <UploadCloud className="h-5 w-5 text-slate-600" />
              Bank templates
            </CardTitle>
            <p className="text-sm text-slate-500">
              Map bank export columns once and reuse them in the imports
              stepper.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={startNewTemplate}
            >
              <Wand2 className="h-4 w-4" />
              New template
            </Button>
            <Button
              variant="ghost"
              className="gap-2"
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Sync now
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 lg:col-span-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100/80">
                    <TableHead className="text-slate-600">Template</TableHead>
                    <TableHead className="text-slate-600">
                      Date column
                    </TableHead>
                    <TableHead className="text-slate-600">
                      Description column
                    </TableHead>
                    <TableHead className="text-slate-600">
                      Amount column
                    </TableHead>
                    <TableHead className="text-right text-slate-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} className="hover:bg-white">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">
                            {template.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {template.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-800">
                        {template.mapping.date}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-800">
                        {template.mapping.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-800">
                        {template.mapping.amount}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "border border-transparent text-slate-700",
                              editingId === template.id && "border-slate-300",
                            )}
                            onClick={() => setEditingId(template.id)}
                          >
                            Edit
                          </Button>
                          {!template.isDefault ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-700"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Template details
                  </p>
                  <p className="text-sm text-slate-700">
                    {editingId ? "Update mappings" : "Create a template"}
                  </p>
                </div>
                {draft.isDefault ? (
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <Badge variant="outline">Custom</Badge>
                )}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Template name
                  </label>
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                    placeholder="Nordea personal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Template id
                  </label>
                  <Input
                    value={draft.id}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    placeholder="nordea"
                    disabled={draft.isDefault}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Description
                  </label>
                  <Input
                    value={draft.description || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                    placeholder="CSV export mapping"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Date column
                    </label>
                    <Input
                      value={draft.mapping.date}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          mapping: { ...draft.mapping, date: e.target.value },
                        })
                      }
                      placeholder="date"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Description column
                    </label>
                    <Input
                      value={draft.mapping.description}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          mapping: {
                            ...draft.mapping,
                            description: e.target.value,
                          },
                        })
                      }
                      placeholder="text"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Amount column
                    </label>
                    <Input
                      value={draft.mapping.amount}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          mapping: { ...draft.mapping, amount: e.target.value },
                        })
                      }
                      placeholder="amount"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Notes
                    </label>
                    <Input
                      value={draft.isDefault ? "Protected" : "Editable"}
                      disabled
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="default"
                    className="gap-2"
                    onClick={handleTemplateSave}
                  >
                    <Save className="h-4 w-4" />
                    Save template
                  </Button>
                  {!draft.isDefault && draft.id ? (
                    <Button
                      variant="ghost"
                      className="gap-2 text-rose-700"
                      onClick={() => deleteTemplate(draft.id)}
                    >
                      <XCircle className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
