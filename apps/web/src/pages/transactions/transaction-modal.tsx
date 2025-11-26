import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccountsApi, useCategoriesApi, useTransactionsApi } from "@/hooks/use-api";
import { TransactionStatus } from "@/types/api";
import { cn } from "@/lib/utils";

type LegInput = {
  id: string;
  account_id: string;
  amount: string;
};

const statusTone: Record<TransactionStatus, string> = {
  [TransactionStatus.RECORDED]: "bg-slate-100 text-slate-700",
  [TransactionStatus.IMPORTED]: "bg-amber-100 text-amber-800",
  [TransactionStatus.REVIEWED]: "bg-emerald-100 text-emerald-800",
  [TransactionStatus.FLAGGED]: "bg-rose-100 text-rose-800",
};

const statusBadge = (status: TransactionStatus) => (
  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", statusTone[status])}>
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

  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState<TransactionStatus>(TransactionStatus.RECORDED);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [occurredAt, setOccurredAt] = useState(today);
  const [postedAt, setPostedAt] = useState(today);
  const [legs, setLegs] = useState<LegInput[]>([
    { id: crypto.randomUUID(), account_id: "", amount: "" },
    { id: crypto.randomUUID(), account_id: "", amount: "" },
  ]);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAccounts({});
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setDescription("");
    setNotes("");
    setCategoryId("");
    setStatus(TransactionStatus.RECORDED);
    setOccurredAt(today);
    setPostedAt(today);
    setLegs([
      { id: crypto.randomUUID(), account_id: "", amount: "" },
      { id: crypto.randomUUID(), account_id: "", amount: "" },
    ]);
    setError("");
  };

  const validate = () => {
    if (legs.length < 2) return "Add at least two legs";
    if (legs.some((leg) => !leg.account_id || !leg.amount)) return "Each leg needs an account and amount";
    const total = legs.reduce((sum, leg) => sum + Number(leg.amount || 0), 0);
    if (Number.isNaN(total)) return "Amounts must be numeric";
    if (Math.abs(total) > 0.0001) return "Legs must balance to zero";
    return "";
  };

  const handleSubmit = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await createTransaction({
        description,
        notes: notes || undefined,
        category_id: categoryId || undefined,
        occurred_at: new Date(occurredAt).toISOString(),
        posted_at: postedAt ? new Date(postedAt).toISOString() : undefined,
        status,
        legs: legs.map((leg) => ({ account_id: leg.account_id, amount: leg.amount })),
      });
      resetForm();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const updateLeg = (id: string, field: keyof LegInput, value: string) => {
    setLegs((prev) => prev.map((leg) => (leg.id === id ? { ...leg, [field]: value } : leg)));
  };

  const removeLeg = (id: string) => {
    setLegs((prev) => prev.filter((leg) => leg.id !== id));
  };

  const addLeg = () => {
    setLegs((prev) => [...prev, { id: crypto.randomUUID(), account_id: "", amount: "" }]);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Add Transaction</h2>
            {statusBadge(status)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Payee or memo"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Notes
              <textarea
                className="min-h-[80px] rounded border border-slate-200 px-3 py-2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Occurred at
                <input
                  type="date"
                  className="rounded border border-slate-200 px-3 py-2"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Posted at
                <input
                  type="date"
                  className="rounded border border-slate-200 px-3 py-2"
                  value={postedAt}
                  onChange={(e) => setPostedAt(e.target.value)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Category
                <select
                  className="rounded border border-slate-200 px-3 py-2"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
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
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
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
              {legs.map((leg) => (
                <div
                  key={leg.id}
                  className="grid grid-cols-[1.5fr,1fr,auto] items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <select
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                    value={leg.account_id}
                    onChange={(e) => updateLeg(leg.id, "account_id", e.target.value)}
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
                    value={leg.amount}
                    onChange={(e) => updateLeg(leg.id, "amount", e.target.value)}
                    placeholder="0.00"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLeg(leg.id)}
                    disabled={legs.length <= 2}
                  >
                    <Trash2 className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Legs must balance to zero. Debits are negative, credits are positive. Minimum two legs.
            </div>
          </div>
        </div>
        {error ? (
          <div className="px-6 pb-2 text-sm text-rose-600">{error}</div>
        ) : null}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving..." : "Save transaction"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
