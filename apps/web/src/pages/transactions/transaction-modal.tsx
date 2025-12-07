import { zodResolver } from "@hookform/resolvers/zod";
import { X, Plus, Trash2 } from "lucide-react";
import React, { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  useAccountsApi,
  useCategoriesApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { TransactionStatus } from "@/types/api";

const legSchema = z.object({
  account_id: z.string().min(1, "Pick an account"),
  amount: z.string().min(1, "Add an amount"),
});

const transactionFormSchema = z
  .object({
    description: z.string().min(1, "Description required").trim(),
    notes: z.string().optional(),
    category_id: z.string().optional(),
    status: z.nativeEnum(TransactionStatus),
    occurred_at: z.string().min(1, "Occurred date required"),
    posted_at: z.string().optional(),
    legs: z.array(legSchema).min(2, "Add at least two legs"),
  })
  .superRefine((val, ctx) => {
    const amounts = val.legs.map((leg) => Number(leg.amount));
    if (amounts.some((amt) => Number.isNaN(amt))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["legs"],
        message: "Amounts must be numeric",
      });
    }
    const total = amounts.reduce(
      (sum, amt) => sum + (Number.isNaN(amt) ? 0 : amt),
      0,
    );
    if (Math.abs(total) > 0.0001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["legs"],
        message: "Legs must balance to zero",
      });
    }
  });

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

const statusTone: Record<TransactionStatus, string> = {
  [TransactionStatus.RECORDED]: "bg-slate-100 text-slate-700",
  [TransactionStatus.IMPORTED]: "bg-amber-100 text-amber-800",
  [TransactionStatus.REVIEWED]: "bg-emerald-100 text-emerald-800",
  [TransactionStatus.FLAGGED]: "bg-rose-100 text-rose-800",
};

const statusBadge = (status: TransactionStatus) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
      statusTone[status],
    )}
  >
    {status}
  </span>
);

export const TransactionModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const { createTransaction } = useTransactionsApi();
  const today = new Date().toISOString().slice(0, 10);

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      notes: "",
      category_id: "",
      status: TransactionStatus.RECORDED,
      occurred_at: today,
      posted_at: today,
      legs: [
        { account_id: "", amount: "" },
        { account_id: "", amount: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "legs",
  });

  useEffect(() => {
    if (open) {
      fetchAccounts({});
      fetchCategories();
    }
  }, [fetchAccounts, fetchCategories, open]);

  const statusValue = watch("status");

  const onSubmit = handleSubmit(async (values) => {
    await createTransaction({
      description: values.description,
      notes: values.notes?.trim() || undefined,
      category_id: values.category_id || undefined,
      occurred_at: new Date(values.occurred_at).toISOString(),
      posted_at: values.posted_at
        ? new Date(values.posted_at).toISOString()
        : undefined,
      status: values.status,
      legs: values.legs.map((leg) => ({
        account_id: leg.account_id,
        amount: leg.amount,
      })),
    });
    reset({
      description: "",
      notes: "",
      category_id: "",
      status: TransactionStatus.RECORDED,
      occurred_at: today,
      posted_at: today,
      legs: [
        { account_id: "", amount: "" },
        { account_id: "", amount: "" },
      ],
    });
    onClose();
  });

  const addLeg = () =>
    append({
      account_id: "",
      amount: "",
    });

  const removeLeg = (index: number) => {
    if (fields.length <= 2) return;
    remove(index);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Add Transaction
            </h2>
            {statusBadge(statusValue)}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid gap-6 px-6 py-4 md:grid-cols-2">
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Description
              <input
                className="rounded border border-slate-200 px-3 py-2"
                placeholder="Payee or memo"
                {...register("description")}
              />
              {errors.description ? (
                <span className="text-xs text-rose-600">
                  {errors.description.message}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Notes
              <textarea
                className="min-h-[80px] rounded border border-slate-200 px-3 py-2"
                placeholder="Optional notes"
                {...register("notes")}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Occurred at
                <input
                  type="date"
                  className="rounded border border-slate-200 px-3 py-2"
                  {...register("occurred_at")}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Posted at
                <input
                  type="date"
                  className="rounded border border-slate-200 px-3 py-2"
                  {...register("posted_at")}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Category
                <select
                  className="rounded border border-slate-200 px-3 py-2"
                  {...register("category_id")}
                >
                  <option value="">Unassigned</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Status
                <select
                  className="rounded border border-slate-200 px-3 py-2"
                  {...register("status")}
                >
                  {Object.values(TransactionStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Legs</p>
              <Button size="sm" variant="outline" onClick={addLeg}>
                <Plus className="h-4 w-4" /> Add leg
              </Button>
            </div>
            <div className="space-y-2">
              {fields.map((leg, index) => (
                <div
                  key={leg.id}
                  className="grid grid-cols-[1.5fr,1fr,auto] items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <select
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    {...register(`legs.${index}.account_id` as const)}
                  >
                    <option value="">Select account</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.account_type} • {acc.id.slice(0, 6)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    placeholder="0.00"
                    {...register(`legs.${index}.amount` as const)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLeg(index)}
                    disabled={fields.length <= 2}
                  >
                    <Trash2 className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              ))}
            </div>
            {errors.legs ? (
              <div className="text-sm text-rose-600">
                {errors.legs?.message?.toString() ||
                  (Array.isArray(errors.legs) &&
                    errors.legs.find((err) => err?.message)?.message)}
              </div>
            ) : null}
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Legs must balance to zero. Debits are negative, credits are
              positive. Minimum two legs.
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
