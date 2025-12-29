import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Trash2, X } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAccountsApi,
  useCategoriesApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { renderCategoryIcon } from "@/lib/category-icons";
import { formatDateTime } from "@/lib/format";
import { taxAdjustedAmountHint } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { formatAccountType, renderAccountIcon } from "@/pages/accounts/utils";
import {
  AccountType,
  CategoryType,
  TransactionType,
  type TransactionRead,
} from "@/types/api";

const transactionTypeOptions = [
  "transaction",
  TransactionType.ADJUSTMENT,
  TransactionType.TRANSFER,
] as const;

type TransactionFormType = (typeof transactionTypeOptions)[number];

const transactionFormSchema = z
  .object({
    transaction_type: z.enum(transactionTypeOptions),
    account_id: z.string().min(1, "Pick an account"),
    transfer_account_id: z.string().optional(),
    amount: z.string().min(1, "Add an amount"),
    description: z.string().min(1, "Description required").trim(),
    notes: z.string().optional(),
    category_id: z.string().optional(),
    occurred_at: z.string().min(1, "Occurred date required"),
    posted_at: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const amount = Number(val.amount);
    if (Number.isNaN(amount)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Amount must be numeric",
      });
    }
    if (!Number.isNaN(amount) && Math.abs(amount) < 0.0001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Amount must be non-zero",
      });
    }
    if (val.transaction_type === TransactionType.TRANSFER) {
      if (!val.transfer_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transfer_account_id"],
          message: "Pick a transfer account",
        });
      }
      if (
        val.transfer_account_id &&
        val.transfer_account_id === val.account_id
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["transfer_account_id"],
          message: "Transfer accounts must be different",
        });
      }
    }
  });

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

const toFormTransactionType = (
  transactionType: TransactionType,
): TransactionFormType => {
  if (transactionType === TransactionType.ADJUSTMENT)
    return TransactionType.ADJUSTMENT;
  if (transactionType === TransactionType.TRANSFER)
    return TransactionType.TRANSFER;
  return "transaction";
};

const accountTypeTone: Record<AccountType, string> = {
  [AccountType.NORMAL]: "bg-slate-100 text-slate-700",
  [AccountType.DEBT]: "bg-rose-100 text-rose-700",
  [AccountType.INVESTMENT]: "bg-indigo-100 text-indigo-700",
};

export const TransactionModal: React.FC<{
  open: boolean;
  onClose: () => void;
  transaction?: TransactionRead | null;
}> = ({ open, onClose, transaction }) => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const { createTransaction, updateTransaction, deleteTransaction } =
    useTransactionsApi();
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = Boolean(transaction);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      transaction_type: "transaction",
      account_id: "",
      transfer_account_id: "",
      amount: "",
      description: "",
      notes: "",
      category_id: "",
      occurred_at: today,
      posted_at: today,
    },
  });

  const selectedCategoryId = useWatch({ control, name: "category_id" });
  const selectedTransactionType = useWatch({
    control,
    name: "transaction_type",
  });
  const enteredAmount = useWatch({ control, name: "amount" });
  const selectedAccountId = useWatch({ control, name: "account_id" });
  const selectedTransferAccountId = useWatch({
    control,
    name: "transfer_account_id",
  });
  const selectedCategory = useMemo(
    () => categories.find((cat) => cat.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );
  const selectedTransferAccount = useMemo(
    () =>
      accounts.find((account) => account.id === selectedTransferAccountId) ??
      null,
    [accounts, selectedTransferAccountId],
  );
  const categoryAmountHint = useMemo(() => {
    if (transaction) return taxAdjustedAmountHint(transaction);
    const numeric = Number(enteredAmount);
    if (Number.isNaN(numeric)) return null;
    return numeric;
  }, [enteredAmount, transaction]);
  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active !== false && account.name !== "Offset",
      ),
    [accounts],
  );
  const offsetAccount = useMemo(
    () => accounts.find((account) => account.name === "Offset") ?? null,
    [accounts],
  );
  const categoryTypeFilter = useMemo(() => {
    if (transaction) {
      if (transaction.transaction_type === TransactionType.ADJUSTMENT) {
        return CategoryType.ADJUSTMENT;
      }
      if (transaction.transaction_type === TransactionType.TRANSFER) {
        return null;
      }
      if (categoryAmountHint === null) return null;
      return categoryAmountHint < 0
        ? CategoryType.EXPENSE
        : CategoryType.INCOME;
    }
    if (selectedTransactionType === TransactionType.TRANSFER) return null;
    if (selectedTransactionType === TransactionType.ADJUSTMENT)
      return CategoryType.ADJUSTMENT;
    if (categoryAmountHint === null) return null;
    return categoryAmountHint < 0 ? CategoryType.EXPENSE : CategoryType.INCOME;
  }, [categoryAmountHint, selectedTransactionType, transaction]);
  const visibleCategories = useMemo(() => {
    if (!categoryTypeFilter) return categories;
    return categories.filter((cat) => cat.category_type === categoryTypeFilter);
  }, [categories, categoryTypeFilter]);
  const categoryGroups = useMemo(() => {
    const categoryList = visibleCategories ?? [];
    const income = categoryList.filter(
      (cat) => cat.category_type === CategoryType.INCOME,
    );
    const expense = categoryList.filter(
      (cat) => cat.category_type === CategoryType.EXPENSE,
    );
    const other = categoryList.filter(
      (cat) =>
        cat.category_type !== CategoryType.INCOME &&
        cat.category_type !== CategoryType.EXPENSE,
    );

    return [
      { key: "income", label: "Income", items: income },
      { key: "expense", label: "Expense", items: expense },
      { key: "other", label: "Other", items: other },
    ];
  }, [visibleCategories]);

  useEffect(() => {
    if (open) {
      fetchAccounts({ includeInactive: true });
      fetchCategories();
      if (!transaction) {
        reset({
          transaction_type: "transaction",
          account_id: "",
          transfer_account_id: "",
          amount: "",
          description: "",
          notes: "",
          category_id: "",
          occurred_at: today,
          posted_at: today,
        });
      }
    }
  }, [fetchAccounts, fetchCategories, open, reset, today, transaction]);

  useEffect(() => {
    if (!open) return;
    if (!transaction) return;

    const fallbackLeg = transaction.legs[0];
    const transferFrom =
      transaction.legs.find((leg) => Number(leg.amount) < 0) ?? fallbackLeg;
    const transferTo =
      transaction.legs.find((leg) => Number(leg.amount) > 0) ??
      transaction.legs[1];

    reset({
      transaction_type: toFormTransactionType(transaction.transaction_type),
      account_id: transferFrom?.account_id ?? "",
      transfer_account_id:
        transaction.transaction_type === TransactionType.TRANSFER
          ? (transferTo?.account_id ?? "")
          : "",
      amount: categoryAmountHint ? String(categoryAmountHint) : "",
      description: transaction.description ?? "",
      notes: transaction.notes ?? "",
      category_id: transaction.category_id ?? "",
      occurred_at: (transaction.occurred_at ?? today).slice(0, 10),
      posted_at: (transaction.posted_at ?? today).slice(0, 10),
    });
  }, [categoryAmountHint, open, reset, today, transaction]);

  const submitTransaction = async (
    values: TransactionFormValues,
    options: { keepOpen: boolean },
  ) => {
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
      onClose();
      return;
    }

    const rawAmount = Number(values.amount);
    const safeAmount = Number.isNaN(rawAmount) ? 0 : rawAmount;
    const resolvedTransactionType =
      values.transaction_type === TransactionType.ADJUSTMENT
        ? TransactionType.ADJUSTMENT
        : values.transaction_type === TransactionType.TRANSFER
          ? TransactionType.TRANSFER
          : safeAmount < 0
            ? TransactionType.EXPENSE
            : TransactionType.INCOME;
    if (
      resolvedTransactionType !== TransactionType.TRANSFER &&
      !offsetAccount
    ) {
      setError("account_id", {
        message: "Offset account missing. Reconcile an account to create it.",
      });
      return;
    }

    const signedAmount = (() => {
      if (resolvedTransactionType === TransactionType.INCOME)
        return Math.abs(safeAmount);
      if (resolvedTransactionType === TransactionType.EXPENSE)
        return -Math.abs(safeAmount);
      return safeAmount;
    })();

    const legs =
      resolvedTransactionType === TransactionType.TRANSFER
        ? [
            {
              account_id: values.account_id,
              amount: String(-Math.abs(safeAmount)),
            },
            {
              account_id: values.transfer_account_id ?? "",
              amount: String(Math.abs(safeAmount)),
            },
          ]
        : [
            {
              account_id: values.account_id,
              amount: String(signedAmount),
            },
            {
              account_id: offsetAccount?.id ?? "",
              amount: String(-signedAmount),
            },
          ];

    await createTransaction({
      description: values.description,
      notes: values.notes?.trim() || undefined,
      category_id:
        resolvedTransactionType === TransactionType.TRANSFER
          ? undefined
          : values.category_id || undefined,
      occurred_at: new Date(values.occurred_at).toISOString(),
      posted_at: values.posted_at
        ? new Date(values.posted_at).toISOString()
        : undefined,
      transaction_type: resolvedTransactionType,
      legs,
    });

    if (options.keepOpen) {
      reset({
        transaction_type: values.transaction_type,
        account_id: values.account_id,
        transfer_account_id: "",
        amount: "",
        description: "",
        notes: "",
        category_id: "",
        occurred_at: today,
        posted_at: today,
      });
      return;
    }

    reset({
      transaction_type: "transaction",
      account_id: "",
      transfer_account_id: "",
      amount: "",
      description: "",
      notes: "",
      category_id: "",
      occurred_at: today,
      posted_at: today,
    });
    onClose();
  };

  const onDelete = () => {
    if (!transaction) return;
    const shouldDelete = window.confirm(
      "Delete this transaction? This cannot be undone.",
    );
    if (!shouldDelete) return;
    deleteTransaction(transaction.id);
    reset({
      transaction_type: "transaction",
      account_id: "",
      transfer_account_id: "",
      amount: "",
      description: "",
      notes: "",
      category_id: "",
      occurred_at: today,
      posted_at: today,
    });
    onClose();
  };

  const onSubmit = handleSubmit((values) =>
    submitTransaction(values, { keepOpen: false }),
  );
  const onSubmitAndAdd = handleSubmit((values) =>
    submitTransaction(values, { keepOpen: true }),
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
            {transaction?.updated_at ? (
              <span className="text-xs text-slate-500">
                Updated {formatDateTime(transaction.updated_at)}
              </span>
            ) : null}
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
          </div>
          <div className="space-y-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Transaction type
              <select
                className="rounded border border-slate-200 px-2 py-2 text-sm"
                disabled={isEdit}
                {...register("transaction_type")}
              >
                <option value="transaction">Transaction</option>
                <option value={TransactionType.ADJUSTMENT}>Adjustment</option>
                <option value={TransactionType.TRANSFER}>Transfer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {selectedTransactionType === TransactionType.TRANSFER
                ? "From account"
                : "Account"}
              <input type="hidden" {...register("account_id")} />
              {isEdit ? (
                <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Accounts can’t be changed when editing.
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {selectedAccount ? (
                          <>
                            {renderAccountIcon(
                              selectedAccount.icon,
                              selectedAccount.name,
                              "h-6 w-6 rounded-full border border-slate-100 bg-white p-1 text-slate-700",
                            )}
                            <span className="truncate">
                              {selectedAccount.name}
                            </span>
                            <span
                              className={cn(
                                "ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                                accountTypeTone[selectedAccount.account_type],
                              )}
                            >
                              {formatAccountType(selectedAccount.account_type)}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">Select account</span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    {activeAccounts.map((acc) => (
                      <DropdownMenuItem
                        key={acc.id}
                        onSelect={() =>
                          setValue("account_id", acc.id, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {renderAccountIcon(
                            acc.icon,
                            acc.name,
                            "h-6 w-6 rounded-full border border-slate-100 bg-white p-1 text-slate-700",
                          )}
                          <span className="truncate">{acc.name}</span>
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                            accountTypeTone[acc.account_type],
                          )}
                        >
                          {formatAccountType(acc.account_type)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {errors.account_id ? (
                <span className="text-xs text-rose-600">
                  {errors.account_id.message}
                </span>
              ) : null}
            </label>
            {selectedTransactionType === TransactionType.TRANSFER ? (
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                To account
                <input type="hidden" {...register("transfer_account_id")} />
                {isEdit ? (
                  <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                    Transfer accounts can’t be changed when editing.
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {selectedTransferAccount ? (
                            <>
                              {renderAccountIcon(
                                selectedTransferAccount.icon,
                                selectedTransferAccount.name,
                                "h-6 w-6 rounded-full border border-slate-100 bg-white p-1 text-slate-700",
                              )}
                              <span className="truncate">
                                {selectedTransferAccount.name}
                              </span>
                              <span
                                className={cn(
                                  "ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                                  accountTypeTone[
                                    selectedTransferAccount.account_type
                                  ],
                                )}
                              >
                                {formatAccountType(
                                  selectedTransferAccount.account_type,
                                )}
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500">
                              Select account
                            </span>
                          )}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-72">
                      {activeAccounts
                        .filter((acc) => acc.id !== selectedAccountId)
                        .map((acc) => (
                          <DropdownMenuItem
                            key={acc.id}
                            onSelect={() =>
                              setValue("transfer_account_id", acc.id, {
                                shouldDirty: true,
                                shouldValidate: true,
                              })
                            }
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              {renderAccountIcon(
                                acc.icon,
                                acc.name,
                                "h-6 w-6 rounded-full border border-slate-100 bg-white p-1 text-slate-700",
                              )}
                              <span className="truncate">{acc.name}</span>
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                                accountTypeTone[acc.account_type],
                              )}
                            >
                              {formatAccountType(acc.account_type)}
                            </span>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {errors.transfer_account_id ? (
                  <span className="text-xs text-rose-600">
                    {errors.transfer_account_id.message}
                  </span>
                ) : null}
              </label>
            ) : null}
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Balance
              <input
                type="number"
                step="0.01"
                className="rounded border border-slate-200 px-3 py-2"
                placeholder="0.00"
                disabled={isEdit}
                {...register("amount")}
              />
              {errors.amount ? (
                <span className="text-xs text-rose-600">
                  {errors.amount.message}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Category
              <input type="hidden" {...register("category_id")} />
              {selectedTransactionType === TransactionType.TRANSFER ? (
                <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                  Transfers don’t use categories.
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-slate-300"
                    >
                      <span className="flex items-center gap-2">
                        {selectedCategory ? (
                          <>
                            <span
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border",
                                selectedCategory.color_hex
                                  ? "border-transparent text-white"
                                  : "border-slate-200 bg-slate-100 text-slate-700",
                              )}
                              style={
                                selectedCategory.color_hex
                                  ? {
                                      backgroundColor:
                                        selectedCategory.color_hex,
                                    }
                                  : undefined
                              }
                            >
                              {renderCategoryIcon(
                                selectedCategory.icon,
                                selectedCategory.name,
                                selectedCategory.color_hex
                                  ? "h-4 w-4 text-white"
                                  : "h-4 w-4 text-slate-700",
                              )}
                            </span>
                            <span>{selectedCategory.name}</span>
                          </>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </span>
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuItem
                      onSelect={() =>
                        setValue("category_id", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <span className="text-slate-500">Unassigned</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {categoryGroups
                      .filter((group) => group.items.length)
                      .map((group, index, filtered) => (
                        <React.Fragment key={group.key}>
                          <DropdownMenuLabel className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                            {group.label}
                          </DropdownMenuLabel>
                          {group.items.map((cat) => (
                            <DropdownMenuItem
                              key={cat.id}
                              onSelect={() =>
                                setValue("category_id", cat.id, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                              className="flex items-center gap-2"
                            >
                              <span
                                className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-full border",
                                  cat.color_hex
                                    ? "border-transparent text-white"
                                    : "border-slate-200 bg-slate-100 text-slate-700",
                                )}
                                style={
                                  cat.color_hex
                                    ? { backgroundColor: cat.color_hex }
                                    : undefined
                                }
                              >
                                {renderCategoryIcon(
                                  cat.icon,
                                  cat.name,
                                  cat.color_hex
                                    ? "h-4 w-4 text-white"
                                    : "h-4 w-4 text-slate-700",
                                )}
                              </span>
                              <span>{cat.name}</span>
                            </DropdownMenuItem>
                          ))}
                          {index < filtered.length - 1 ? (
                            <DropdownMenuSeparator />
                          ) : null}
                        </React.Fragment>
                      ))}
                    {!categoryGroups.some((group) => group.items.length) ? (
                      <DropdownMenuItem disabled>
                        No matching categories
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </label>
            {isEdit ? (
              <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Editing amounts and accounts isn’t supported yet (metadata
                only).
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
          {isEdit ? (
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!transaction ? (
              <Button variant="outline" onClick={onSubmitAndAdd}>
                Save & add another
              </Button>
            ) : null}
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
    </div>
  );
};

export default TransactionModal;
