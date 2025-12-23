import { zodResolver } from "@hookform/resolvers/zod";
import { ArchiveRestore, Loader2, Save } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/hooks/use-api";

const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => value === "" || /^[A-Z]{3}$/.test(value),
    "Use a 3-letter currency code (e.g. SEK, USD).",
  );

const profileSchema = z.object({
  first_name: z.string().min(1, "First name required").trim(),
  last_name: z.string().min(1, "Last name required").trim(),
  currency_code: currencyCodeSchema,
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const formatTimestamp = (value?: string) => {
  if (!value) return "Not saved yet";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const Settings: React.FC = () => {
  const {
    firstName,
    lastName,
    currencyCode,
    loading,
    saving,
    backingUp,
    error,
    lastSavedAt,
    saveSettings,
    runBackup,
    changeFirstName,
    changeLastName,
    changeCurrencyCode,
  } = useSettings();
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      currency_code: currencyCode ?? "SEK",
    },
  });

  const watchedProfile = profileForm.watch();
  const missingProfile =
    !watchedProfile.first_name || !watchedProfile.last_name;

  const handleProfileSubmit = profileForm.handleSubmit((values) => {
    changeFirstName(values.first_name);
    changeLastName(values.last_name);
    changeCurrencyCode(values.currency_code || undefined);
    saveSettings();
  });

  useEffect(() => {
    profileForm.reset({
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      currency_code: currencyCode ?? "SEK",
    });
  }, [currencyCode, firstName, lastName, profileForm]);

  const headerStatus = useMemo(() => {
    if (saving) return "Saving";
    if (loading) return "Loading";
    if (error) return "Needs attention";
    return "Ready";
  }, [error, loading, saving]);

  return (
    <MotionPage className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-col gap-2">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Settings
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Profile details
          </h1>
          <p className="text-sm text-slate-500">
            Add your name to personalize labels across the app.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status: {headerStatus} · Last saved: {formatTimestamp(lastSavedAt)}
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
        <CardHeader>
          <CardTitle className="text-sm text-slate-700">
            Profile details
          </CardTitle>
          <p className="text-sm text-slate-500">
            Saved to your account and synced across devices.
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
                placeholder="Ada"
                autoComplete="given-name"
                {...profileForm.register("first_name")}
              />
              {profileForm.formState.errors.first_name ? (
                <p className="text-xs text-rose-600">
                  {profileForm.formState.errors.first_name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency-code">Currency</Label>
              <Input
                id="currency-code"
                placeholder="SEK"
                autoComplete="off"
                {...profileForm.register("currency_code")}
              />
              <p className="text-xs text-slate-500">
                3-letter ISO code used for default currency formatting.
              </p>
              {profileForm.formState.errors.currency_code ? (
                <p className="text-xs text-rose-600">
                  {profileForm.formState.errors.currency_code.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                placeholder="Lovelace"
                autoComplete="family-name"
                {...profileForm.register("last_name")}
              />
              {profileForm.formState.errors.last_name ? (
                <p className="text-xs text-rose-600">
                  {profileForm.formState.errors.last_name.message}
                </p>
              ) : null}
            </div>
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
            {error ? (
              <p className="text-sm text-rose-600 md:col-span-2">{error}</p>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
        <CardHeader>
          <CardTitle className="text-sm text-slate-700">Data backups</CardTitle>
          <p className="text-sm text-slate-500">
            Create a one-click archive of all transactions across every user.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-slate-600">
              <p>Run a fresh backup to secure transaction history.</p>
              <p className="text-xs text-slate-500">
                Progress is not shown here, but data is saved to the backup
                store.
              </p>
            </div>
            <Button
              type="button"
              onClick={runBackup}
              disabled={backingUp}
              className="gap-2"
              variant="secondary"
            >
              {backingUp ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="h-4 w-4" />
              )}
              Run transactions backup
            </Button>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  );
};
