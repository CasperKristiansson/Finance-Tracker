import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
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

type FormState = {
  display_order: string;
  account_type: AccountType;
  is_active: boolean;
  loan: {
    origin_principal: string;
    current_principal: string;
    interest_rate_annual: string;
    interest_compound: InterestCompound;
    minimum_payment: string;
    expected_maturity_date: string;
  };
};

const defaultFormState: FormState = {
  display_order: "",
  account_type: AccountType.NORMAL,
  is_active: true,
  loan: {
    origin_principal: "",
    current_principal: "",
    interest_rate_annual: "",
    interest_compound: InterestCompound.MONTHLY,
    minimum_payment: "",
    expected_maturity_date: "",
  },
};

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

  const [form, setForm] = useState<FormState>(defaultFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (account) {
      setForm({
        display_order:
          account.display_order !== null && account.display_order !== undefined
            ? String(account.display_order)
            : "",
        account_type: account.account_type,
        is_active: account.is_active,
        loan: {
          origin_principal: account.loan?.origin_principal ?? "",
          current_principal: account.loan?.current_principal ?? "",
          interest_rate_annual: account.loan?.interest_rate_annual ?? "",
          interest_compound:
            account.loan?.interest_compound ?? InterestCompound.MONTHLY,
          minimum_payment: account.loan?.minimum_payment ?? "",
          expected_maturity_date: account.loan?.expected_maturity_date ?? "",
        },
      });
    } else {
      setForm(defaultFormState);
    }
    setErrors({});
  }, [account, open]);

  const isSubmitting = createLoading || updateLoading;

  const handleChange = (
    field: keyof FormState,
    value: string | boolean | AccountType,
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value as never,
    }));
  };

  const handleLoanChange = (field: keyof FormState["loan"], value: string) => {
    setForm((prev) => ({
      ...prev,
      loan: {
        ...prev.loan,
        [field]: value,
      },
    }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (isDebt(form.account_type)) {
      const requiredLoanFields: Array<keyof FormState["loan"]> = [
        "origin_principal",
        "current_principal",
        "interest_rate_annual",
      ];
      requiredLoanFields.forEach((key) => {
        if (!form.loan[key]) {
          nextErrors[key] = "Required for debt accounts";
        }
      });
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: AccountCreateRequest = {
      display_order: form.display_order ? Number(form.display_order) : null,
      account_type: form.account_type,
      is_active: form.is_active,
      loan: null,
    };

    if (isDebt(form.account_type)) {
      payload.loan = {
        origin_principal: form.loan.origin_principal,
        current_principal: form.loan.current_principal,
        interest_rate_annual: form.loan.interest_rate_annual,
        interest_compound: form.loan.interest_compound,
        minimum_payment: form.loan.minimum_payment || null,
        expected_maturity_date: form.loan.expected_maturity_date || null,
      };
    } else {
      payload.loan = null;
    }

    try {
      if (account) {
        updateAccount(account.id, {
          display_order: payload.display_order ?? undefined,
          is_active: payload.is_active,
        });
        if (isDebt(form.account_type)) {
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="display_order">
                Display order
              </label>
              <Input
                id="display_order"
                type="number"
                value={form.display_order}
                onChange={(e) => handleChange("display_order", e.target.value)}
                placeholder="e.g., 1"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-slate-700" htmlFor="account_type">
                Account type
              </label>
              <select
                id="account_type"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.account_type}
                onChange={(e) =>
                  handleChange("account_type", e.target.value as AccountType)
                }
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
              checked={form.is_active}
              onChange={(e) => handleChange("is_active", e.target.checked)}
            />
            Active
          </label>

          {isDebt(form.account_type) ? (
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
                    value={form.loan.origin_principal}
                    onChange={(e) =>
                      handleLoanChange("origin_principal", e.target.value)
                    }
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 100000"
                  />
                  {errors.origin_principal ? (
                    <p className="text-xs text-red-600">
                      {errors.origin_principal}
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
                    value={form.loan.current_principal}
                    onChange={(e) =>
                      handleLoanChange("current_principal", e.target.value)
                    }
                    type="number"
                    inputMode="decimal"
                    placeholder="e.g., 92000"
                  />
                  {errors.current_principal ? (
                    <p className="text-xs text-red-600">
                      {errors.current_principal}
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
                    value={form.loan.interest_rate_annual}
                    onChange={(e) =>
                      handleLoanChange("interest_rate_annual", e.target.value)
                    }
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="e.g., 4.25"
                  />
                  {errors.interest_rate_annual ? (
                    <p className="text-xs text-red-600">
                      {errors.interest_rate_annual}
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
                    value={form.loan.interest_compound}
                    onChange={(e) =>
                      handleLoanChange(
                        "interest_compound",
                        e.target.value as InterestCompound,
                      )
                    }
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
                    value={form.loan.minimum_payment}
                    onChange={(e) =>
                      handleLoanChange("minimum_payment", e.target.value)
                    }
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
                    value={form.loan.expected_maturity_date}
                    onChange={(e) =>
                      handleLoanChange("expected_maturity_date", e.target.value)
                    }
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
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
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
