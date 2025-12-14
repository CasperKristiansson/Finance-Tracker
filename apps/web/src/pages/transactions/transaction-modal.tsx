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
import type { TransactionRead } from "@/types/api";

const legSchema = z.object({
  account_id: z.string().min(1, "Pick an account"),
  amount: z.string().min(1, "Add an amount"),
});

const transactionFormSchema = z
  .object({
    description: z.string().min(1, "Description required").trim(),
    notes: z.string().optional(),
    category_id: z.string().optional(),
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

export const TransactionModal: React.FC<{
  open: boolean;
  onClose: () => void;
  transaction?: TransactionRead | null;
}> = ({ open, onClose, transaction }) => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const { createTransaction, updateTransaction } = useTransactionsApi();
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = Boolean(transaction);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      description: "",
      notes: "",
      category_id: "",
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
      if (!transaction) {
        reset({
          description: "",
          notes: "",
          category_id: "",
          occurred_at: today,
          posted_at: today,
          legs: [
            { account_id: "", amount: "" },
            { account_id: "", amount: "" },
          ],
        });
      }
    }
  }, [fetchAccounts, fetchCategories, open, reset, today, transaction]);

  useEffect(() => {
    if (!open) return;
    if (!transaction) return;

    reset({
      description: transaction.description ?? "",
      notes: transaction.notes ?? "",
      category_id: transaction.category_id ?? "",
      occurred_at: (transaction.occurred_at ?? today).slice(0, 10),
      posted_at: (transaction.posted_at ?? today).slice(0, 10),
      legs: transaction.legs.map((leg) => ({
        account_id: leg.account_id,
        amount: String(leg.amount),
      })),
    });
  }, [open, reset, today, transaction]);

  const onSubmit = handleSubmit(async (values) => {
    if (transaction) {
      await updateTransaction(transaction.id, {
        description: values.description,
        notes: values.notes?.trim() || null,
        category_id: values.category_id || null,
        occurred_at: new Date(values.occurred_at).toISOString(),
        posted_at: values.posted_at
          ? new Date(values.posted_at).toISOString()
          : null,
        subscription_id: transaction.subscription_id ?? null,
      });
    } else {
      await createTransaction({
        description: values.description,
        notes: values.notes?.trim() || undefined,
        category_id: values.category_id || undefined,
        occurred_at: new Date(values.occurred_at).toISOString(),
        posted_at: values.posted_at
          ? new Date(values.posted_at).toISOString()
          : undefined,
        legs: values.legs.map((leg) => ({
          account_id: leg.account_id,
          amount: leg.amount,
        })),
      });
    }
    reset({
      description: "",
      notes: "",
      category_id: "",
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
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
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
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Legs</p>
              {!isEdit ? (
                <Button size="sm" variant="outline" onClick={addLeg}>
                  <Plus className="h-4 w-4" /> Add leg
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              {fields.map((leg, index) => (
                <div
                  key={leg.id}
                  className={cn(
                    "grid grid-cols-[1.5fr,1fr,auto] items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2",
                    isEdit && "opacity-90",
                  )}
                >
                  {isEdit ? (
                    <>
                      <div className="truncate text-sm text-slate-800">
                        {accounts.find((acc) => acc.id === leg.account_id)
                          ?.name ?? leg.account_id}
                      </div>
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {Number(leg.amount).toLocaleString("sv-SE", {
                          style: "currency",
                          currency: "SEK",
                        })}
                      </div>
                      <div />
                    </>
                  ) : (
                    <>
                      <select
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        {...register(`legs.${index}.account_id` as const)}
                      >
                        <option value="">Select account</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
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
                    </>
                  )}
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
            {isEdit ? (
              <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Editing legs isn’t supported yet (metadata only).
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Legs must balance to zero. Debits are negative, credits are
                positive. Minimum two legs.
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : transaction
                ? "Save changes"
                : "Save transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
