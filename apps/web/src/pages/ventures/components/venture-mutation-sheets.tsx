import {
  Building2,
  FileImage,
  Link2,
  Loader2,
  NotebookText,
  Save,
  ShieldCheck,
  TrendingUp,
  UploadCloud,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { selectIsDemo } from "@/features/auth/authSlice";
import type {
  VentureCompanyDetail,
  VentureOverview,
  VenturePresign,
} from "@/features/ventures/venturesSlice";
import { cn } from "@/lib/utils";
import {
  formatVentureDate,
  formatVenturePercent,
  formatVentureSek,
  initialsForName,
  statusTheme,
  titleCase,
  toFiniteNumber,
} from "@/pages/ventures/utils/format";
import type { EndpointRequest } from "@/types/contracts";

type Accounts = Array<{
  id: string;
  name: string;
  account_type: string;
}>;

type VentureLoading = {
  createCompany: boolean;
  createValuation: boolean;
  createOwnershipEvent: boolean;
  createNote: boolean;
  updateNote: boolean;
  presignUpload: boolean;
};

type VentureErrors = Partial<
  Record<
    | "createCompany"
    | "createValuation"
    | "createOwnershipEvent"
    | "createNote"
    | "updateNote"
    | "presignUpload",
    string
  >
>;

type PresignUpload = (
  data: EndpointRequest<"presignVentureUpload">,
  requestId?: string,
) => void;

const fieldClass =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const today = () => new Date().toISOString().slice(0, 10);

const cleanDecimal = (value: string) => value.replace(/\s+/g, "").trim();

const decimalOrUndefined = (value: string) => {
  const cleaned = cleanDecimal(value);
  return cleaned ? cleaned : undefined;
};

const riskAdjustedFromHaircut = (paperValue: string, haircut: string) => {
  const paper = toFiniteNumber(cleanDecimal(paperValue));
  const haircutNumber = Math.min(100, Math.max(0, toFiniteNumber(haircut)));
  return paper * ((100 - haircutNumber) / 100);
};

const tagsFromInput = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  helper?: string;
  error?: string;
}> = ({ label, children, helper, error }) => (
  <div className="min-w-0 space-y-1.5">
    <Label>{label}</Label>
    {children}
    {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
  </div>
);

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ title, children, icon }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
    </div>
    {children}
  </section>
);

const ErrorBanner: React.FC<{ message?: string; localError?: string }> = ({
  message,
  localError,
}) =>
  message || localError ? (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {localError ?? message}
    </div>
  ) : null;

const DemoMutationBanner: React.FC = () => (
  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    Demo mode can inspect this form, but saving changes is disabled because
    Ventures mutations require authenticated API access.
  </div>
);

const SheetFrame: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}> = ({ open, onOpenChange, title, description, children, footer }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side="bottom"
      className="max-h-[92vh] gap-0 overflow-hidden rounded-t-xl border-slate-200 bg-slate-50 p-0"
    >
      <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-slate-300" />
      <SheetHeader className="border-b border-slate-200 bg-white px-6 py-5 text-left">
        <SheetTitle className="text-2xl font-semibold tracking-normal text-slate-950">
          {title}
        </SheetTitle>
        <SheetDescription className="text-sm text-slate-600">
          {description}
        </SheetDescription>
      </SheetHeader>
      <div className="overflow-y-auto px-6 py-5">{children}</div>
      <SheetFooter className="border-t border-slate-200 bg-white px-6 py-4">
        {footer}
      </SheetFooter>
    </SheetContent>
  </Sheet>
);

const LogoPreview: React.FC<{
  name: string;
  color: string;
  logoUrl?: string;
  onRemove?: () => void;
}> = ({ name, color, logoUrl, onRemove }) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg text-lg font-semibold text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initialsForName(name || "New")
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-950">
        {name || "New company"}
      </p>
      <p className="text-xs text-slate-500">
        {logoUrl ? "Logo preview selected" : "Initials fallback will be used"}
      </p>
    </div>
    {logoUrl && onRemove ? (
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    ) : null}
  </div>
);

const MiniCompanyPreview: React.FC<{
  name: string;
  role?: string;
  companyType?: string;
  status?: string;
  color: string;
  logoUrl?: string;
  paperValue?: string;
  ownership?: string;
  liquidity?: string;
}> = ({
  name,
  role,
  companyType,
  status,
  color,
  logoUrl,
  paperValue,
  ownership,
  liquidity,
}) => {
  const theme = statusTheme(status);
  return (
    <div className="rounded-lg border border-teal-200 bg-white p-4 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initialsForName(name || "New")
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {name || "New company"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {[titleCase(role), titleCase(companyType)].join(" · ")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0", theme.badge)}>
          {titleCase(status)}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div>
          <p className="text-xs text-slate-500">Paper value</p>
          <p className="font-semibold text-slate-950">
            {formatVentureSek(paperValue)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Ownership</p>
          <p className="font-semibold text-slate-950">
            {formatVenturePercent(ownership)}
          </p>
        </div>
      </div>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        {titleCase(liquidity)}
      </div>
    </div>
  );
};

const AfterValueRow: React.FC<{
  label: string;
  before: string;
  after: string;
  positive?: boolean;
}> = ({ label, before, after, positive }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
    <div className="mt-1 flex items-center justify-between gap-3 text-sm">
      <span className="font-medium text-slate-700">{before}</span>
      <span className="text-slate-400">-&gt;</span>
      <span
        className={cn(
          "font-semibold",
          positive ? "text-teal-700" : "text-slate-950",
        )}
      >
        {after}
      </span>
    </div>
  </div>
);

const DocumentLinkPicker: React.FC<{
  documents: VentureCompanyDetail["documents"];
  selectedIds: string[];
  onToggle: (documentId: string) => void;
}> = ({ documents, selectedIds, onToggle }) => (
  <div className="max-h-36 overflow-y-auto rounded-md border border-slate-200 bg-white p-2">
    {documents.length ? (
      documents.map((document) => (
        <label
          key={document.id}
          className="flex items-center gap-2 py-1 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(document.id)}
            onChange={() => onToggle(document.id)}
          />
          <span className="truncate">{document.title}</span>
        </label>
      ))
    ) : (
      <p className="text-xs text-slate-500">No documents available.</p>
    )}
  </div>
);

type AddCompanySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: VentureOverview["companies"];
  accounts: Accounts;
  loading: VentureLoading;
  errors: VentureErrors;
  presignsByRequestId: Record<string, VenturePresign | undefined>;
  presignUpload: PresignUpload;
  createCompany: (data: EndpointRequest<"createVentureCompany">) => void;
};

export const AddCompanySheet: React.FC<AddCompanySheetProps> = ({
  open,
  onOpenChange,
  companies,
  accounts,
  loading,
  errors,
  presignsByRequestId,
  presignUpload,
  createCompany,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [description, setDescription] = useState("");
  const [companyType, setCompanyType] =
    useState<EndpointRequest<"createVentureCompany">["company_type"]>(
      "private_company",
    );
  const [status, setStatus] =
    useState<EndpointRequest<"createVentureCompany">["status"]>("ongoing");
  const [role, setRole] =
    useState<EndpointRequest<"createVentureCompany">["role"]>("founder");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");
  const [country, setCountry] = useState("Sweden");
  const [foundedOn, setFoundedOn] = useState("");
  const [joinedOn, setJoinedOn] = useState(() => today());
  const [nodeColor, setNodeColor] = useState("#0f766e");
  const [ownerType, setOwnerType] =
    useState<EndpointRequest<"createVentureOwnershipEvent">["owner_type"]>(
      "person",
    );
  const [ownerCompanyId, setOwnerCompanyId] = useState("");
  const [ownershipPct, setOwnershipPct] = useState("100");
  const [fullyDilutedPct, setFullyDilutedPct] = useState("");
  const [shareClass, setShareClass] = useState("Common shares");
  const [includeInitialValuation, setIncludeInitialValuation] = useState(true);
  const [valuationMode, setValuationMode] =
    useState<EndpointRequest<"createVentureCompany">["valuation_mode"]>(
      "manual",
    );
  const [linkedAccountIds, setLinkedAccountIds] = useState<string[]>([]);
  const [paperValue, setPaperValue] = useState("");
  const [haircut, setHaircut] = useState("75");
  const [liquidity, setLiquidity] =
    useState<EndpointRequest<"createVentureValuation">["liquidity_level"]>(
      "restricted",
    );
  const [confidence, setConfidence] = useState("3");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [localError, setLocalError] = useState<string>();
  const [pendingUpload, setPendingUpload] = useState<{
    requestId: string;
    file: File;
    payload: EndpointRequest<"createVentureCompany">;
  }>();
  const [stageState, setStageState] = useState<
    "idle" | "presigning" | "uploading" | "creating"
  >("idle");

  const reset = useCallback(() => {
    setName("");
    setLegalName("");
    setDescription("");
    setCompanyType("private_company");
    setStatus("ongoing");
    setRole("founder");
    setIndustry("");
    setStage("");
    setCountry("Sweden");
    setFoundedOn("");
    setJoinedOn(today());
    setNodeColor("#0f766e");
    setOwnerType("person");
    setOwnerCompanyId("");
    setOwnershipPct("100");
    setFullyDilutedPct("");
    setShareClass("Common shares");
    setIncludeInitialValuation(true);
    setValuationMode("manual");
    setLinkedAccountIds([]);
    setPaperValue("");
    setHaircut("75");
    setLiquidity("restricted");
    setConfidence("3");
    setLogoFile(null);
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogoUrl(undefined);
    setLocalError(undefined);
    setPendingUpload(undefined);
    setStageState("idle");
  }, [logoUrl]);

  useEffect(() => {
    if (stageState !== "creating" || loading.createCompany) return;
    const timer = window.setTimeout(() => {
      if (!errors.createCompany) {
        reset();
        onOpenChange(false);
      } else {
        setStageState("idle");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    errors.createCompany,
    loading.createCompany,
    onOpenChange,
    reset,
    stageState,
  ]);

  useEffect(() => {
    if (!pendingUpload || stageState !== "presigning") return;
    const presign = presignsByRequestId[pendingUpload.requestId];
    if (!presign) return;

    const uploadLogo = async () => {
      setStageState("uploading");
      try {
        const response = await fetch(presign.url, {
          method: presign.method,
          headers: presign.headers,
          body: pendingUpload.file,
        });
        if (!response.ok) {
          throw new Error("Logo upload failed.");
        }

        setStageState("creating");
        createCompany({
          ...pendingUpload.payload,
          logo_storage_key: presign.storage_key,
          logo_file_name: pendingUpload.file.name,
          logo_content_type: pendingUpload.file.type,
        });
      } catch (error) {
        setLocalError(
          error instanceof Error ? error.message : "Logo upload failed.",
        );
        toast.error("Logo upload failed");
        setStageState("idle");
        setPendingUpload(undefined);
      }
    };
    void uploadLogo();
  }, [createCompany, pendingUpload, presignsByRequestId, stageState]);

  useEffect(() => {
    if (stageState !== "presigning") return;
    if (!loading.presignUpload && errors.presignUpload) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStageState("idle");
      setPendingUpload(undefined);
    }
  }, [errors.presignUpload, loading.presignUpload, stageState]);

  const riskAdjusted = riskAdjustedFromHaircut(paperValue, haircut);
  const isSubmitting =
    loading.createCompany ||
    loading.presignUpload ||
    stageState === "presigning" ||
    stageState === "uploading" ||
    stageState === "creating";
  const submitStatusLabel =
    stageState === "presigning" || loading.presignUpload
      ? "Preparing logo upload"
      : stageState === "uploading"
        ? "Uploading logo"
        : stageState === "creating" || loading.createCompany
          ? "Creating company"
          : undefined;

  const buildPayload = (): EndpointRequest<"createVentureCompany"> | null => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError("Company name is required.");
      return null;
    }
    if (ownerType === "company" && !ownerCompanyId) {
      setLocalError("Choose the holding company owner.");
      return null;
    }
    if (
      valuationMode === "account_balance_sync" &&
      linkedAccountIds.length === 0
    ) {
      setLocalError(
        "Choose at least one account that drives synced venture value.",
      );
      return null;
    }

    const payload: EndpointRequest<"createVentureCompany"> = {
      name: trimmedName,
      legal_name: legalName.trim() || null,
      description: description.trim() || null,
      company_type: companyType,
      status,
      role,
      valuation_mode: valuationMode,
      industry: industry.trim() || null,
      stage: stage.trim() || null,
      country: country.trim() || null,
      founded_on: foundedOn || null,
      joined_on: joinedOn || null,
      node_color: nodeColor,
      initial_ownership: {
        owner_type: ownerType,
        owner_company_id: ownerType === "company" ? ownerCompanyId : null,
        effective_date: joinedOn || today(),
        reason: "Initial ownership",
        direct_ownership_pct: cleanDecimal(ownershipPct),
        fully_diluted_ownership_pct: decimalOrUndefined(fullyDilutedPct),
        share_class: shareClass.trim() || null,
      },
    };

    if (valuationMode === "account_balance_sync") {
      payload.account_links = linkedAccountIds.map((accountId) => ({
        account_id: accountId,
        include_in_synced_value: true,
        weight: "1",
      }));
    } else if (includeInitialValuation && cleanDecimal(paperValue)) {
      payload.initial_valuation = {
        event_date: joinedOn || today(),
        label: "Initial valuation",
        event_type: "initial_valuation",
        paper_value_sek: cleanDecimal(paperValue),
        haircut_percentage: cleanDecimal(haircut),
        valuation_source: "founder_estimate",
        liquidity_level: liquidity,
        confidence_score: Number(confidence) || null,
        include_in_venture_totals: true,
      };
    }

    return payload;
  };

  const toggleLinkedAccount = (accountId: string, checked: boolean) => {
    setLinkedAccountIds((current) => {
      if (checked) {
        return current.includes(accountId) ? current : [...current, accountId];
      }
      return current.filter((selectedId) => selectedId !== accountId);
    });
  };

  const handleLogoFile = (file?: File | null) => {
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    if (!file) {
      setLogoFile(null);
      setLogoUrl(undefined);
      return;
    }
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  };

  const submit = () => {
    setLocalError(undefined);
    if (isDemo) {
      setLocalError("Demo mode cannot save Ventures company changes.");
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    if (logoFile) {
      const requestId = `logo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPendingUpload({ requestId, file: logoFile, payload });
      setStageState("presigning");
      presignUpload(
        {
          operation: "upload",
          purpose: "logo",
          file_name: logoFile.name,
          mime_type: logoFile.type,
          file_size_bytes: logoFile.size,
        },
        requestId,
      );
      return;
    }

    setStageState("creating");
    createCompany(payload);
  };

  return (
    <SheetFrame
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) reset();
        onOpenChange(nextOpen);
      }}
      title="Add company"
      description="Create a private company, ownership position, and optional venture-only valuation."
      footer={
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
            aria-busy={isSubmitting}
            title={
              isDemo
                ? "Demo mode cannot save Ventures company changes."
                : undefined
            }
            onClick={submit}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {submitStatusLabel ?? "Add company"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <ErrorBanner
            message={errors.createCompany ?? errors.presignUpload}
            localError={localError}
          />
          {submitStatusLabel ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{submitStatusLabel}</span>
            </div>
          ) : null}
          {isDemo ? <DemoMutationBanner /> : null}
          <Section
            title="Basic details"
            icon={<Building2 className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Company name">
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field label="Legal name">
                <Input
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                />
              </Field>
              <Field label="Company type">
                <select
                  className={fieldClass}
                  value={companyType}
                  onChange={(event) =>
                    setCompanyType(event.target.value as typeof companyType)
                  }
                >
                  <option value="startup">Startup</option>
                  <option value="private_company">Private company</option>
                  <option value="consulting">Consulting</option>
                  <option value="holding">Holding</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={fieldClass}
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="idea">Idea</option>
                  <option value="stale">Stale</option>
                  <option value="exited">Exited</option>
                  <option value="failed">Failed</option>
                </select>
              </Field>
              <Field label="Role">
                <select
                  className={fieldClass}
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as typeof role)
                  }
                >
                  <option value="founder">Founder</option>
                  <option value="co-founder">Co-founder</option>
                  <option value="owner">Owner</option>
                  <option value="advisor">Advisor</option>
                  <option value="investor">Investor</option>
                  <option value="board observer">Board observer</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Joined date">
                <Input
                  type="date"
                  value={joinedOn}
                  onChange={(event) => setJoinedOn(event.target.value)}
                />
              </Field>
              <Field label="Founded date">
                <Input
                  type="date"
                  value={foundedOn}
                  onChange={(event) => setFoundedOn(event.target.value)}
                />
              </Field>
              <Field label="Node color">
                <Input
                  type="color"
                  value={nodeColor}
                  onChange={(event) => setNodeColor(event.target.value)}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Industry">
                <Input
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                />
              </Field>
              <Field label="Stage">
                <Input
                  value={stage}
                  onChange={(event) => setStage(event.target.value)}
                />
              </Field>
              <Field label="Country">
                <Input
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Short note"
              helper="Shown in headers and company context."
            >
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </Section>

          <Section
            title="Logo"
            icon={<FileImage className="h-4 w-4 text-teal-700" />}
          >
            {isDemo ? (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Demo mode does not have access to the private S3 logo bucket, so
                logo upload is unavailable here.
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <label
                className={cn(
                  "flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center hover:bg-slate-100",
                  isDemo
                    ? "cursor-not-allowed opacity-70 hover:bg-slate-50"
                    : "cursor-pointer",
                )}
              >
                <UploadCloud className="h-8 w-8 text-slate-400" />
                <span className="mt-2 text-sm font-medium text-slate-700">
                  {isDemo
                    ? "Logo upload unavailable"
                    : "Upload or replace logo"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {isDemo
                    ? "Use initials fallback in demo mode"
                    : "PNG, JPG, or WebP up to 5 MB"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={isDemo}
                  onChange={(event) => handleLogoFile(event.target.files?.[0])}
                />
              </label>
              <LogoPreview
                name={name}
                color={nodeColor}
                logoUrl={logoUrl}
                onRemove={() => handleLogoFile(null)}
              />
            </div>
          </Section>

          <Section
            title="Ownership"
            icon={<ShieldCheck className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Owner type">
                <select
                  className={fieldClass}
                  value={ownerType}
                  onChange={(event) =>
                    setOwnerType(event.target.value as typeof ownerType)
                  }
                >
                  <option value="person">Casper</option>
                  <option value="company">Holding company</option>
                </select>
              </Field>
              {ownerType === "company" ? (
                <Field label="Holding company">
                  <select
                    className={fieldClass}
                    value={ownerCompanyId}
                    onChange={(event) => setOwnerCompanyId(event.target.value)}
                  >
                    <option value="">Choose company</option>
                    {companies.map((summary) => (
                      <option
                        key={summary.company.id}
                        value={summary.company.id}
                      >
                        {summary.company.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Ownership %">
                <Input
                  value={ownershipPct}
                  onChange={(event) => setOwnershipPct(event.target.value)}
                />
              </Field>
              <Field label="Fully diluted %">
                <Input
                  value={fullyDilutedPct}
                  onChange={(event) => setFullyDilutedPct(event.target.value)}
                />
              </Field>
              <Field label="Share class">
                <Input
                  value={shareClass}
                  onChange={(event) => setShareClass(event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Valuation mode"
            icon={<TrendingUp className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mode">
                <select
                  className={fieldClass}
                  value={valuationMode}
                  onChange={(event) =>
                    setValuationMode(event.target.value as typeof valuationMode)
                  }
                >
                  <option value="manual">Manual venture valuation</option>
                  <option value="account_balance_sync">
                    Account-linked valuation
                  </option>
                </select>
              </Field>
              {valuationMode === "account_balance_sync" ? (
                <Field
                  label="Linked accounts"
                  helper="Selected balances are summed for venture paper value only."
                >
                  <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white">
                    {accounts.length ? (
                      accounts.map((account) => {
                        const checked = linkedAccountIds.includes(account.id);
                        return (
                          <label
                            key={account.id}
                            className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                              checked={checked}
                              onChange={(event) =>
                                toggleLinkedAccount(
                                  account.id,
                                  event.target.checked,
                                )
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-slate-800">
                                {account.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {titleCase(account.account_type)}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        No active accounts available.
                      </div>
                    )}
                  </div>
                  {linkedAccountIds.length ? (
                    <p className="text-xs text-slate-500">
                      {linkedAccountIds.length} account
                      {linkedAccountIds.length === 1 ? "" : "s"} selected.
                    </p>
                  ) : null}
                </Field>
              ) : (
                <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Initial valuation
                    </p>
                    <p className="text-xs text-slate-500">
                      Optional first paper value event.
                    </p>
                  </div>
                  <Switch
                    checked={includeInitialValuation}
                    onCheckedChange={setIncludeInitialValuation}
                  />
                </div>
              )}
            </div>
            {valuationMode === "manual" && includeInitialValuation ? (
              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <Field label="Paper value (SEK)">
                  <Input
                    value={paperValue}
                    onChange={(event) => setPaperValue(event.target.value)}
                  />
                </Field>
                <Field label="Haircut %">
                  <Input
                    value={haircut}
                    onChange={(event) => setHaircut(event.target.value)}
                  />
                </Field>
                <Field label="Liquidity">
                  <select
                    className={fieldClass}
                    value={liquidity}
                    onChange={(event) =>
                      setLiquidity(event.target.value as typeof liquidity)
                    }
                  >
                    <option value="none">None</option>
                    <option value="restricted">Restricted</option>
                    <option value="possible_secondary">
                      Possible secondary
                    </option>
                    <option value="liquid">Liquid</option>
                  </select>
                </Field>
                <Field label="Confidence">
                  <select
                    className={fieldClass}
                    value={confidence}
                    onChange={(event) => setConfidence(event.target.value)}
                  >
                    <option value="1">1 - Low</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5 - High</option>
                  </select>
                </Field>
              </div>
            ) : null}
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Live node preview">
            <MiniCompanyPreview
              name={name}
              role={role}
              companyType={companyType}
              status={status}
              color={nodeColor}
              logoUrl={logoUrl}
              paperValue={valuationMode === "manual" ? paperValue : "0"}
              ownership={ownershipPct}
              liquidity={liquidity}
            />
          </Section>
          <Section title="Value preview">
            <div className="space-y-3">
              <AfterValueRow
                label="Paper value"
                before="New"
                after={
                  valuationMode === "account_balance_sync"
                    ? "Synced from account"
                    : formatVentureSek(paperValue)
                }
                positive
              />
              <AfterValueRow
                label="Risk-adjusted"
                before="New"
                after={
                  valuationMode === "account_balance_sync"
                    ? "Same as account value"
                    : formatVentureSek(riskAdjusted)
                }
                positive
              />
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Venture values remain in Ventures and are excluded from main net
                worth.
              </div>
            </div>
          </Section>
        </aside>
      </div>
    </SheetFrame>
  );
};

type AddValuationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail?: VentureCompanyDetail;
  loading: VentureLoading;
  errors: VentureErrors;
  createValuation: (
    companyId: string,
    data: EndpointRequest<"createVentureValuation">,
  ) => void;
};

export const AddValuationSheet: React.FC<AddValuationSheetProps> = ({
  open,
  onOpenChange,
  detail,
  loading,
  errors,
  createValuation,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const company = detail?.summary.company;
  const latest = detail?.summary.latest_valuation;
  const [eventDate, setEventDate] = useState(() => today());
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [paperValue, setPaperValue] = useState(latest?.paper_value_sek ?? "");
  const [haircut, setHaircut] = useState(latest?.haircut_percentage ?? "75");
  const [realizedValue, setRealizedValue] = useState(
    latest?.realized_value_sek ?? "",
  );
  const [source, setSource] = useState<
    EndpointRequest<"createVentureValuation">["valuation_source"]
  >(latest?.valuation_source ?? "founder_estimate");
  const [liquidity, setLiquidity] = useState<
    EndpointRequest<"createVentureValuation">["liquidity_level"]
  >(latest?.liquidity_level ?? "restricted");
  const [confidence, setConfidence] = useState(
    String(latest?.confidence_score ?? 3),
  );
  const [includeTotals, setIncludeTotals] = useState(
    latest?.include_in_venture_totals ?? true,
  );
  const [note, setNote] = useState("");
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>(
    latest?.linked_document_ids ?? [],
  );
  const [localError, setLocalError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaperValue(latest?.paper_value_sek ?? "");
    setHaircut(latest?.haircut_percentage ?? "75");
    setRealizedValue(latest?.realized_value_sek ?? "");
    setSource(latest?.valuation_source ?? "founder_estimate");
    setLiquidity(latest?.liquidity_level ?? "restricted");
    setConfidence(String(latest?.confidence_score ?? 3));
    setIncludeTotals(latest?.include_in_venture_totals ?? true);
    setEventDate(today());
    setYear(String(new Date().getFullYear()));
    setNote("");
    setLinkedDocumentIds(latest?.linked_document_ids ?? []);
    setLocalError(undefined);
    setSubmitted(false);
  }, [latest, open]);

  useEffect(() => {
    if (!submitted || loading.createValuation) return;
    const timer = window.setTimeout(() => {
      if (!errors.createValuation) onOpenChange(false);
      setSubmitted(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    errors.createValuation,
    loading.createValuation,
    onOpenChange,
    submitted,
  ]);

  const riskAdjusted = riskAdjustedFromHaircut(paperValue, haircut);
  const isSubmitting = loading.createValuation;
  const toggleLinkedDocument = (documentId: string) => {
    setLinkedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const submit = () => {
    if (!company) return;
    if (isDemo) {
      setLocalError("Demo mode cannot save Ventures valuation changes.");
      return;
    }
    if (!cleanDecimal(paperValue)) {
      setLocalError("Paper value is required.");
      return;
    }
    setLocalError(undefined);
    setSubmitted(true);
    createValuation(company.id, {
      event_date: eventDate,
      label: `${year} annual review`,
      event_type: "annual_review",
      paper_value_sek: cleanDecimal(paperValue),
      haircut_percentage: cleanDecimal(haircut),
      realized_value_sek: decimalOrUndefined(realizedValue),
      valuation_source: source,
      liquidity_level: liquidity,
      confidence_score: Number(confidence) || null,
      include_in_venture_totals: includeTotals,
      note: note.trim() || null,
      linked_document_ids: linkedDocumentIds,
    });
  };

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Add annual valuation"
      description={`Update paper value, conservative value, and confidence${company ? ` for ${company.name}` : ""}.`}
      footer={
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
            disabled={isSubmitting || !company || isDemo}
            title={
              isDemo
                ? "Demo mode cannot save Ventures valuation changes."
                : undefined
            }
            onClick={submit}
          >
            <Save className="h-4 w-4" />
            Save valuation
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
        <div className="space-y-4">
          <ErrorBanner
            message={errors.createValuation}
            localError={localError}
          />
          {isDemo ? <DemoMutationBanner /> : null}
          {company ? (
            <Badge
              variant="outline"
              className={cn(statusTheme(company.status).badge)}
            >
              {company.name} · {titleCase(company.status)}
            </Badge>
          ) : null}
          <Section
            title="Valuation event"
            icon={<TrendingUp className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Valuation date">
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(event) => setEventDate(event.target.value)}
                />
              </Field>
              <Field label="Annual review year">
                <Input
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </Field>
              <Field
                label="Paper value SEK"
                helper="Unadjusted company paper value."
              >
                <Input
                  value={paperValue}
                  onChange={(event) => setPaperValue(event.target.value)}
                />
              </Field>
              <Field
                label="Realized value SEK"
                helper="Cash already realized from this company, if any."
              >
                <Input
                  value={realizedValue}
                  onChange={(event) => setRealizedValue(event.target.value)}
                />
              </Field>
              <Field
                label="Haircut percentage"
                helper="Risk-adjusted value is paper value after haircut."
              >
                <Input
                  value={haircut}
                  onChange={(event) => setHaircut(event.target.value)}
                />
              </Field>
              <Field label="Valuation source">
                <select
                  className={fieldClass}
                  value={source}
                  onChange={(event) =>
                    setSource(event.target.value as typeof source)
                  }
                >
                  <option value="founder_estimate">Founder estimate</option>
                  <option value="financing_round">Financing round</option>
                  <option value="offer">Offer</option>
                  <option value="annual_accounts">Annual accounts</option>
                  <option value="model">Model</option>
                  <option value="external_valuation">External valuation</option>
                  <option value="account_balance_sync">
                    Account balance sync
                  </option>
                </select>
              </Field>
              <Field label="Liquidity level">
                <select
                  className={fieldClass}
                  value={liquidity}
                  onChange={(event) =>
                    setLiquidity(event.target.value as typeof liquidity)
                  }
                >
                  <option value="none">None</option>
                  <option value="restricted">Restricted</option>
                  <option value="possible_secondary">Possible secondary</option>
                  <option value="liquid">Liquid</option>
                </select>
              </Field>
              <Field label="Confidence score">
                <select
                  className={fieldClass}
                  value={confidence}
                  onChange={(event) => setConfidence(event.target.value)}
                >
                  <option value="1">1 - Low</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5 - High</option>
                </select>
              </Field>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Include in venture paper totals
                  </p>
                  <p className="text-xs text-slate-500">
                    Still excluded from main net worth.
                  </p>
                </div>
                <Switch
                  checked={includeTotals}
                  onCheckedChange={setIncludeTotals}
                />
              </div>
            </div>
            <Field label="Note">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </Section>
          <Section
            title="Linked evidence"
            icon={<FileImage className="h-4 w-4 text-teal-700" />}
          >
            <DocumentLinkPicker
              documents={detail?.documents ?? []}
              selectedIds={linkedDocumentIds}
              onToggle={toggleLinkedDocument}
            />
          </Section>
        </div>
        <Section title="Before and after">
          <div className="space-y-3">
            <AfterValueRow
              label="Paper value"
              before={formatVentureSek(latest?.paper_value_sek)}
              after={formatVentureSek(paperValue)}
              positive
            />
            <AfterValueRow
              label="Risk-adjusted value"
              before={formatVentureSek(latest?.risk_adjusted_value_sek)}
              after={formatVentureSek(riskAdjusted)}
              positive
            />
            <AfterValueRow
              label="Implied haircut"
              before={`${latest?.haircut_percentage ?? "0"}%`}
              after={`${haircut || "0"}%`}
            />
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Risk-adjusted value is a conservative venture view, not liquid
              cash.
            </div>
          </div>
        </Section>
      </div>
    </SheetFrame>
  );
};

type EditOwnershipSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail?: VentureCompanyDetail;
  companies: VentureOverview["companies"];
  loading: VentureLoading;
  errors: VentureErrors;
  createOwnershipEvent: (
    companyId: string,
    data: EndpointRequest<"createVentureOwnershipEvent">,
  ) => void;
};

export const EditOwnershipSheet: React.FC<EditOwnershipSheetProps> = ({
  open,
  onOpenChange,
  detail,
  companies,
  loading,
  errors,
  createOwnershipEvent,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const company = detail?.summary.company;
  const latest = detail?.summary.latest_ownership;
  const [ownerType, setOwnerType] = useState<
    EndpointRequest<"createVentureOwnershipEvent">["owner_type"]
  >(latest?.owner_type ?? "person");
  const [ownerCompanyId, setOwnerCompanyId] = useState(
    latest?.owner_company_id ?? "",
  );
  const [directPct, setDirectPct] = useState(
    latest?.direct_ownership_pct ?? "",
  );
  const [fullyDilutedPct, setFullyDilutedPct] = useState(
    latest?.fully_diluted_ownership_pct ?? "",
  );
  const [sharesOwned, setSharesOwned] = useState(latest?.shares_owned ?? "");
  const [totalShares, setTotalShares] = useState(latest?.total_shares ?? "");
  const [shareClass, setShareClass] = useState(latest?.share_class ?? "");
  const [votingRights, setVotingRights] = useState(
    latest?.voting_rights_pct ?? "",
  );
  const [optionNotes, setOptionNotes] = useState(
    latest?.option_or_warrant_notes ?? "",
  );
  const [investedCapital, setInvestedCapital] = useState(
    latest?.invested_capital_sek ?? "",
  );
  const [reason, setReason] = useState(latest?.reason ?? "Ownership update");
  const [effectiveDate, setEffectiveDate] = useState(() => today());
  const [note, setNote] = useState("");
  const [linkedDocumentIds, setLinkedDocumentIds] = useState<string[]>(
    latest?.linked_document_ids ?? [],
  );
  const [localError, setLocalError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOwnerType(latest?.owner_type ?? "person");
    setOwnerCompanyId(latest?.owner_company_id ?? "");
    setDirectPct(latest?.direct_ownership_pct ?? "");
    setFullyDilutedPct(latest?.fully_diluted_ownership_pct ?? "");
    setSharesOwned(latest?.shares_owned ?? "");
    setTotalShares(latest?.total_shares ?? "");
    setShareClass(latest?.share_class ?? "");
    setVotingRights(latest?.voting_rights_pct ?? "");
    setOptionNotes(latest?.option_or_warrant_notes ?? "");
    setInvestedCapital(latest?.invested_capital_sek ?? "");
    setReason(latest?.reason ?? "Ownership update");
    setEffectiveDate(today());
    setNote("");
    setLinkedDocumentIds(latest?.linked_document_ids ?? []);
    setLocalError(undefined);
    setSubmitted(false);
  }, [latest, open]);

  useEffect(() => {
    if (!submitted || loading.createOwnershipEvent) return;
    const timer = window.setTimeout(() => {
      if (!errors.createOwnershipEvent) onOpenChange(false);
      setSubmitted(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    errors.createOwnershipEvent,
    loading.createOwnershipEvent,
    onOpenChange,
    submitted,
  ]);

  const previousDirect = toFiniteNumber(latest?.direct_ownership_pct);
  const nextDirect = toFiniteNumber(directPct);
  const companyPaper = toFiniteNumber(detail?.summary.paper_value_sek);
  const companyRiskAdjusted = toFiniteNumber(
    detail?.summary.risk_adjusted_value_sek,
  );
  const previousPaperStake = companyPaper * (previousDirect / 100);
  const nextPaperStake = companyPaper * (nextDirect / 100);
  const previousRiskStake = companyRiskAdjusted * (previousDirect / 100);
  const nextRiskStake = companyRiskAdjusted * (nextDirect / 100);
  const isSubmitting = loading.createOwnershipEvent;
  const toggleLinkedDocument = (documentId: string) => {
    setLinkedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const submit = () => {
    if (!company) return;
    if (isDemo) {
      setLocalError("Demo mode cannot save Ventures ownership changes.");
      return;
    }
    if (!cleanDecimal(directPct)) {
      setLocalError("Direct ownership percentage is required.");
      return;
    }
    if (ownerType === "company" && !ownerCompanyId) {
      setLocalError("Choose the holding company owner.");
      return;
    }
    if (ownerType === "company" && ownerCompanyId === company.id) {
      setLocalError("A company cannot own itself.");
      return;
    }
    setLocalError(undefined);
    setSubmitted(true);
    createOwnershipEvent(company.id, {
      owner_type: ownerType,
      owner_company_id: ownerType === "company" ? ownerCompanyId : null,
      effective_date: effectiveDate,
      reason: reason.trim() || null,
      direct_ownership_pct: cleanDecimal(directPct),
      fully_diluted_ownership_pct: decimalOrUndefined(fullyDilutedPct),
      shares_owned: decimalOrUndefined(sharesOwned),
      total_shares: decimalOrUndefined(totalShares),
      share_class: shareClass.trim() || null,
      voting_rights_pct: decimalOrUndefined(votingRights),
      invested_capital_sek: decimalOrUndefined(investedCapital),
      option_or_warrant_notes: optionNotes.trim() || null,
      note: note.trim() || null,
      linked_document_ids: linkedDocumentIds,
    });
    if (isDemo) {
      window.setTimeout(() => onOpenChange(false), 0);
    }
  };

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Edit ownership"
      description={`Update stake, ownership owner, share class, and ownership evidence${company ? ` for ${company.name}` : ""}.`}
      footer={
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
            disabled={isSubmitting || !company || isDemo}
            title={
              isDemo
                ? "Demo mode cannot save Ventures ownership changes."
                : undefined
            }
            onClick={submit}
          >
            <Save className="h-4 w-4" />
            Save ownership change
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_0.55fr]">
        <div className="space-y-4">
          <ErrorBanner
            message={errors.createOwnershipEvent}
            localError={localError}
          />
          {isDemo ? <DemoMutationBanner /> : null}
          <Section
            title="New ownership"
            icon={<ShieldCheck className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Owner type">
                <select
                  className={fieldClass}
                  value={ownerType}
                  onChange={(event) =>
                    setOwnerType(event.target.value as typeof ownerType)
                  }
                >
                  <option value="person">Casper</option>
                  <option value="company">Holding company</option>
                </select>
              </Field>
              {ownerType === "company" ? (
                <Field label="Holding company">
                  <select
                    className={fieldClass}
                    value={ownerCompanyId}
                    onChange={(event) => setOwnerCompanyId(event.target.value)}
                  >
                    <option value="">Choose company</option>
                    {companies
                      .filter((summary) => summary.company.id !== company?.id)
                      .map((summary) => (
                        <option
                          key={summary.company.id}
                          value={summary.company.id}
                        >
                          {summary.company.name}
                        </option>
                      ))}
                  </select>
                </Field>
              ) : null}
              <Field label="Direct ownership %">
                <Input
                  value={directPct}
                  onChange={(event) => setDirectPct(event.target.value)}
                />
              </Field>
              <Field label="Fully diluted %">
                <Input
                  value={fullyDilutedPct}
                  onChange={(event) => setFullyDilutedPct(event.target.value)}
                />
              </Field>
              <Field label="Shares owned">
                <Input
                  value={sharesOwned}
                  onChange={(event) => setSharesOwned(event.target.value)}
                />
              </Field>
              <Field label="Total shares">
                <Input
                  value={totalShares}
                  onChange={(event) => setTotalShares(event.target.value)}
                />
              </Field>
              <Field label="Share class">
                <Input
                  value={shareClass}
                  onChange={(event) => setShareClass(event.target.value)}
                />
              </Field>
              <Field label="Voting rights %">
                <Input
                  value={votingRights}
                  onChange={(event) => setVotingRights(event.target.value)}
                />
              </Field>
              <Field label="Invested capital SEK">
                <Input
                  value={investedCapital}
                  onChange={(event) => setInvestedCapital(event.target.value)}
                />
              </Field>
              <Field label="Option/warrant notes">
                <Input
                  value={optionNotes}
                  onChange={(event) => setOptionNotes(event.target.value)}
                />
              </Field>
              <Field label="Effective date">
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(event) => setEffectiveDate(event.target.value)}
                />
              </Field>
              <Field label="Reason">
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Note">
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </Field>
          </Section>
          <Section
            title="Linked evidence"
            icon={<FileImage className="h-4 w-4 text-teal-700" />}
          >
            <DocumentLinkPicker
              documents={detail?.documents ?? []}
              selectedIds={linkedDocumentIds}
              onToggle={toggleLinkedDocument}
            />
          </Section>
        </div>
        <Section title="Before and after">
          <div className="space-y-3">
            <AfterValueRow
              label="Direct ownership"
              before={formatVenturePercent(latest?.direct_ownership_pct)}
              after={formatVenturePercent(directPct)}
              positive={nextDirect >= previousDirect}
            />
            <AfterValueRow
              label="Paper stake exposure"
              before={formatVentureSek(previousPaperStake)}
              after={formatVentureSek(nextPaperStake)}
              positive={nextPaperStake >= previousPaperStake}
            />
            <AfterValueRow
              label="Risk-adjusted stake"
              before={formatVentureSek(previousRiskStake)}
              after={formatVentureSek(nextRiskStake)}
              positive={nextRiskStake >= previousRiskStake}
            />
            <MiniCompanyPreview
              name={company?.name ?? ""}
              role={company?.role}
              companyType={company?.company_type}
              status={company?.status}
              color={company?.node_color ?? "#0f766e"}
              paperValue={detail?.summary.paper_value_sek}
              ownership={directPct}
              liquidity={detail?.summary.latest_valuation?.liquidity_level}
            />
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This updates the Ventures graph ownership edge and derived stake
              exposure only.
            </div>
          </div>
        </Section>
      </div>
    </SheetFrame>
  );
};

type NoteSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail?: VentureCompanyDetail;
  note?: VentureCompanyDetail["notes"][number];
  loading: VentureLoading;
  errors: VentureErrors;
  createNote: (
    companyId: string,
    data: EndpointRequest<"createVentureNote">,
  ) => void;
  updateNote: (
    companyId: string,
    noteId: string,
    data: EndpointRequest<"updateVentureNote">,
  ) => void;
};

export const NoteSheet: React.FC<NoteSheetProps> = ({
  open,
  onOpenChange,
  detail,
  note,
  loading,
  errors,
  createNote,
  updateNote,
}) => {
  const isDemo = useAppSelector(selectIsDemo);
  const company = detail?.summary.company;
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [noteDate, setNoteDate] = useState(() => today());
  const [timelineEventId, setTimelineEventId] = useState("");
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const isEditing = Boolean(note);
  const operationLoading = isEditing ? loading.updateNote : loading.createNote;
  const operationError = isEditing ? errors.updateNote : errors.createNote;

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(note?.title ?? "");
    setBody(note?.body_markdown ?? "");
    setTags((note?.tags ?? []).join(", "));
    setPinned(note?.pinned ?? false);
    setNoteDate(note?.note_date ?? today());
    setTimelineEventId(note?.timeline_event_id ?? "");
    setDocumentIds(note?.document_ids ?? []);
    setLocalError(undefined);
    setSubmitted(false);
  }, [note, open]);

  useEffect(() => {
    if (!submitted || operationLoading) return;
    const timer = window.setTimeout(() => {
      if (!operationError) onOpenChange(false);
      setSubmitted(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [onOpenChange, operationError, operationLoading, submitted]);

  const toggleDocument = (documentId: string) => {
    setDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  };

  const submit = () => {
    if (!company) return;
    if (isDemo) {
      setLocalError("Demo mode cannot save Ventures notes.");
      return;
    }
    if (!title.trim()) {
      setLocalError("Note title is required.");
      return;
    }
    if (!body.trim()) {
      setLocalError("Markdown body is required.");
      return;
    }
    setLocalError(undefined);
    setSubmitted(true);
    const payload = {
      title: title.trim(),
      body_markdown: body,
      tags: tagsFromInput(tags),
      pinned,
      note_date: noteDate,
      timeline_event_id: timelineEventId || null,
      document_ids: documentIds,
    };
    if (note) {
      updateNote(company.id, note.id, payload);
    } else {
      createNote(company.id, payload);
    }
  };

  return (
    <SheetFrame
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit note" : "Add note"}
      description={`Capture Markdown context, tags, and optional links${company ? ` for ${company.name}` : ""}.`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={operationLoading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={operationLoading || !company || isDemo}
            title={isDemo ? "Demo mode cannot save Ventures notes." : undefined}
            onClick={submit}
          >
            <Save className="h-4 w-4" />
            {isEditing ? "Save note" : "Add note"}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1fr_0.6fr]">
        <div className="space-y-4">
          <ErrorBanner message={operationError} localError={localError} />
          {isDemo ? <DemoMutationBanner /> : null}
          <Section
            title="Note"
            icon={<NotebookText className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Note date">
                <Input
                  type="date"
                  value={noteDate}
                  onChange={(event) => setNoteDate(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Markdown body">
              <Textarea
                className="min-h-56 font-mono"
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Tags"
                helper="Comma-separated. Use flexible tags such as reflection, risk, fundraising, board, or strategy."
              >
                <Input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                />
              </Field>
              <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-700">Pinned</p>
                  <p className="text-xs text-slate-500">
                    Show above normal recent notes.
                  </p>
                </div>
                <Switch checked={pinned} onCheckedChange={setPinned} />
              </div>
            </div>
          </Section>

          <Section
            title="Optional links"
            icon={<Link2 className="h-4 w-4 text-teal-700" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Timeline event">
                <select
                  className={fieldClass}
                  value={timelineEventId}
                  onChange={(event) => setTimelineEventId(event.target.value)}
                >
                  <option value="">No linked event</option>
                  {(detail?.timeline ?? []).map((event) => (
                    <option key={event.id} value={event.id}>
                      {formatVentureDate(event.event_date)} - {event.title}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="space-y-2">
                <Label>Documents</Label>
                <DocumentLinkPicker
                  documents={detail?.documents ?? []}
                  selectedIds={documentIds}
                  onToggle={toggleDocument}
                />
              </div>
            </div>
          </Section>
        </div>
        <Section title="Markdown preview">
          <div className="prose prose-slate max-w-none rounded-md border border-slate-200 bg-white p-4 text-sm">
            {body.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            ) : (
              <p className="text-slate-500">Preview appears as you write.</p>
            )}
          </div>
        </Section>
      </div>
    </SheetFrame>
  );
};
