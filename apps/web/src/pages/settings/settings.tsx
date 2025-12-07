import {
  Cpu,
  Loader2,
  MonitorSmartphone,
  Moon,
  RefreshCw,
  Save,
  SunMedium,
  Wand2,
  XCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useEffect, useMemo, useState } from "react";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectIsDemo, selectUser } from "@/features/auth/authSlice";
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
    firstName,
    lastName,
    envInfo,
    apiBaseUrl,
    loading,
    saving,
    error,
    lastSavedAt,
    loadSettings,
    saveSettings,
    changeTheme,
    changeFirstName,
    changeLastName,
  } = useSettings();
  const { setTheme, resolvedTheme } = useTheme();
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  const missingProfile = !firstName || !lastName;

  const handleThemeChange = (next: ThemePreference) => {
    setTheme(next);
    changeTheme(next);
  };

  const handleProfileSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmedFirst = (firstName || "").trim();
    const trimmedLast = (lastName || "").trim();
    if (!trimmedFirst || !trimmedLast) {
      setProfileError("Please add both first and last name.");
      return;
    }
    changeFirstName(trimmedFirst);
    changeLastName(trimmedLast);
    setProfileError(null);
    saveSettings();
  };

  const headerStatus = useMemo(() => {
    if (saving) return "Saving to API";
    if (loading) return "Loading";
    if (error) return "Offline";
    return "Ready";
  }, [error, loading, saving]);

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Settings
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Personalize your workspace
          </h1>
          <p className="text-sm text-slate-500">
            Theme, profile context, and environment diagnostics.
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
              <span className="text-slate-500">Name</span>
              <span className="font-semibold text-slate-900">
                {[firstName, lastName].filter(Boolean).join(" ") || "Not set"}
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

        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)] lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm text-slate-700">
              Profile details
            </CardTitle>
            <p className="text-sm text-slate-500">
              Add a friendly name to replace the Cognito user id shown across
              the app.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-2"
              onSubmit={handleProfileSubmit}
            >
              <div className="space-y-2">
                <Label htmlFor="first-name">First name</Label>
                <Input
                  id="first-name"
                  value={firstName ?? ""}
                  onChange={(e) => changeFirstName(e.target.value)}
                  placeholder="Ada"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">Last name</Label>
                <Input
                  id="last-name"
                  value={lastName ?? ""}
                  onChange={(e) => changeLastName(e.target.value)}
                  placeholder="Lovelace"
                  required
                />
              </div>
              {profileError ? (
                <div className="text-sm text-rose-600 md:col-span-2">
                  {profileError}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit" disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save profile
                </Button>
                {missingProfile ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 text-amber-700"
                  >
                    Incomplete
                  </Badge>
                ) : (
                  <Badge variant="secondary">Up to date</Badge>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </MotionPage>
  );
};
