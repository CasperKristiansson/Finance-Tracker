import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { LucideIconPicker } from "@/components/lucide-icon-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useAccountsApi } from "@/hooks/use-api";
import {
  AccountType,
  InterestCompound,
  type AccountCreateRequest,
  type AccountWithBalance,
} from "@/types/api";

type Props = {
  open: boolean;
  onClose: () => void;
  account?: AccountWithBalance;
};

const iconPresets = [
  { label: "Swedbank", value: "banks/swedbank.png" },
  { label: "Nordnet", value: "banks/nordnet.jpg" },
  { label: "SEB", value: "banks/seb.png" },
  { label: "Danske Bank", value: "banks/danskebank.png" },
  { label: "Circle K", value: "banks/circlek.png" },
];

const accountFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").trim(),
    account_type: z.enum(AccountType),
    is_active: z.boolean(),
    icon: z.string().optional(),
    loan: z.object({
      origin_principal: z.string().optional(),
      current_principal: z.string().optional(),
      interest_rate_annual: z.string().optional(),
      interest_compound: z.enum(InterestCompound),
      minimum_payment: z.string().optional(),
      expected_maturity_date: z.string().optional(),
    }),
  })
  .superRefine((val, ctx) => {
    if (val.account_type !== AccountType.DEBT) return;
    const required = [
      "origin_principal",
      "current_principal",
      "interest_rate_annual",
    ] as const;
    required.forEach((field) => {
      if (!val.loan[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["loan", field],
          message: "Required for debt accounts",
        });
      }
    });
  });

type AccountFormValues = z.infer<typeof accountFormSchema>;

const isDebt = (type: AccountType) => type === AccountType.DEBT;

export const AccountModal: React.FC<Props> = ({ open, onClose, account }) => {
  const {
    createAccount,
    updateAccount,
    attachLoan,
    updateLoan,
    accountMutationError,
    createLoading,
    updateLoading,
  } = useAccountsApi();

  const getDefaults = useCallback((): AccountFormValues => {
    return {
      name: account?.name ?? "",
      account_type: account?.account_type ?? AccountType.NORMAL,
      is_active: account?.is_active ?? true,
      icon: account?.icon ?? "",
      loan: {
        origin_principal: account?.loan?.origin_principal ?? "",
        current_principal: account?.loan?.current_principal ?? "",
        interest_rate_annual: account?.loan?.interest_rate_annual ?? "",
        interest_compound:
          account?.loan?.interest_compound ?? InterestCompound.MONTHLY,
        minimum_payment: account?.loan?.minimum_payment ?? "",
        expected_maturity_date: account?.loan?.expected_maturity_date ?? "",
      },
    };
  }, [account]);

  const {
    register,
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors: formErrors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: getDefaults(),
  });

  useEffect(() => {
    reset(getDefaults());
  }, [account, getDefaults, open, reset]);

  const accountType = watch("account_type");
  const isActive = watch("is_active");
  const accountTypeField = register("account_type");
  const isActiveField = register("is_active");

  const onSubmit = async (values: AccountFormValues) => {
    const payload: AccountCreateRequest = {
      name: values.name.trim(),
      account_type: values.account_type,
      is_active: values.is_active,
      icon: values.icon?.trim() ? values.icon.trim() : null,
      loan: null,
    };

    if (isDebt(values.account_type)) {
      payload.loan = {
        origin_principal: values.loan.origin_principal ?? "",
        current_principal: values.loan.current_principal ?? "",
        interest_rate_annual: values.loan.interest_rate_annual ?? "",
        interest_compound: values.loan.interest_compound,
        minimum_payment: values.loan.minimum_payment?.trim() || null,
        expected_maturity_date:
          values.loan.expected_maturity_date?.trim() || null,
      };
    } else {
      payload.loan = null;
    }

    try {
      if (account) {
        updateAccount(account.id, {
          name: payload.name,
          is_active: payload.is_active,
          icon: payload.icon ?? undefined,
        });
        if (isDebt(values.account_type)) {
          if (account.loan) {
            updateLoan(account.id, {
              origin_principal: payload.loan?.origin_principal,
              current_principal: payload.loan?.current_principal,
              interest_rate_annual: payload.loan?.interest_rate_annual,
              interest_compound: payload.loan?.interest_compound,
              minimum_payment: payload.loan?.minimum_payment ?? undefined,
              expected_maturity_date:
                payload.loan?.expected_maturity_date ?? undefined,
            });
          } else {
            attachLoan({
              account_id: account.id,
              origin_principal: payload.loan?.origin_principal ?? "",
              current_principal: payload.loan?.current_principal ?? "",
              interest_rate_annual: payload.loan?.interest_rate_annual ?? "",
              interest_compound:
                payload.loan?.interest_compound ?? InterestCompound.MONTHLY,
              minimum_payment: payload.loan?.minimum_payment ?? undefined,
              expected_maturity_date:
                payload.loan?.expected_maturity_date ?? undefined,
            });
          }
        }
        toast.success("Account updated");
      } else {
        createAccount(payload);
        toast.success("Account created");
      }
      onClose();
    } catch {
      // errors handled via mutationError
    }
  };

  const mutationBusy = isSubmitting || createLoading || updateLoading;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <Card className="w-full max-w-xl border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            {account ? "Edit account" : "Add account"}
          </CardTitle>
          <p className="text-sm text-slate-500">
            Set account type and loan details for debt accounts.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-slate-700" htmlFor="name">
              Account name
            </label>
            <Input
              id="name"
              {...register("name")}
              placeholder="e.g., Swedbank"
              autoFocus
            />
            {formErrors.name ? (
              <p className="text-xs text-red-600">{formErrors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-slate-700" htmlFor="icon">
              Account icon (relative path or pick a bank)
            </label>
            <Input
              id="icon"
              {...register("icon")}
              placeholder="e.g., banks/swedbank.png"
              list="bank-icons"
            />
            <datalist id="bank-icons">
              <option value="banks/swedbank.png" />
              <option value="banks/nordnet.jpg" />
              <option value="banks/seb.png" />
              <option value="banks/danskebank.png" />
              <option value="banks/circlek.png" />
            </datalist>
            <div className="flex flex-wrap gap-2">
              {iconPresets.map((preset) => (
                <Button
                  key={preset.value}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="border border-slate-200 text-xs"
                  onClick={() => setValue("icon", preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500" htmlFor="lucide-icon">
                Or browse Lucide icons
              </label>
              <LucideIconPicker
                inputId="lucide-icon"
                value={watch("icon")}
                onChange={(icon) =>
                  setValue("icon", icon, { shouldDirty: true })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="account_type">
                Account type
              </label>
              <select
                id="account_type"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={accountType}
                onChange={(e) => {
                  accountTypeField.onChange(e);
                  setValue("account_type", e.target.value as AccountType);
                }}
                onBlur={accountTypeField.onBlur}
                name={accountTypeField.name}
              >
                <option value={AccountType.NORMAL}>Cash</option>
                <option value={AccountType.DEBT}>Debt</option>
                <option value={AccountType.INVESTMENT}>Investment</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                isActiveField.onChange(e);
                setValue("is_active", e.target.checked);
              }}
              onBlur={isActiveField.onBlur}
              name={isActiveField.name}
            />
            Active
          </label>

          {isDebt(accountType) ? (
            <>
              <Separator />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="origin_principal"
                  >
                    Original principal
                  </label>
                  <Input
                    id="origin_principal"
                    {...register("loan.origin_principal")}
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 100000"
                  />
                  {formErrors.loan?.origin_principal ? (
                    <p className="text-xs text-red-600">
                      {formErrors.loan.origin_principal.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="current_principal"
                  >
                    Current principal
                  </label>
                  <Input
                    id="current_principal"
                    {...register("loan.current_principal")}
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 92000"
                  />
                  {formErrors.loan?.current_principal ? (
                    <p className="text-xs text-red-600">
                      {formErrors.loan.current_principal.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="interest_rate_annual"
                  >
                    Interest rate (APR)
                  </label>
                  <Input
                    id="interest_rate_annual"
                    {...register("loan.interest_rate_annual")}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g., 4.25"
                  />
                  {formErrors.loan?.interest_rate_annual ? (
                    <p className="text-xs text-red-600">
                      {formErrors.loan.interest_rate_annual.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="interest_compound"
                  >
                    Compounding
                  </label>
                  <select
                    id="interest_compound"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    {...register("loan.interest_compound")}
                  >
                    <option value={InterestCompound.MONTHLY}>Monthly</option>
                    <option value={InterestCompound.DAILY}>Daily</option>
                    <option value={InterestCompound.YEARLY}>Yearly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="minimum_payment"
                  >
                    Minimum payment
                  </label>
                  <Input
                    id="minimum_payment"
                    {...register("loan.minimum_payment")}
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 1500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="text-sm text-slate-700"
                    htmlFor="expected_maturity_date"
                  >
                    Expected maturity
                  </label>
                  <Input
                    id="expected_maturity_date"
                    type="date"
                    {...register("loan.expected_maturity_date")}
                  />
                </div>
              </div>
            </>
          ) : null}

          {accountMutationError ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {accountMutationError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={mutationBusy}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit)}
              disabled={mutationBusy}
              className="gap-2"
            >
              {mutationBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>{account ? "Save changes" : "Create account"}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
