import { Eye } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TransactionType } from "@/types/api";

export type SortKey = "date" | "description" | "amount" | "category" | "type";
export type TransactionTypeFilter = TransactionType | "tax" | "";

export type ColumnKey =
  | "date"
  | "type"
  | "description"
  | "accounts"
  | "category"
  | "amount"
  | "notes";

export type ColumnConfig = {
  key: ColumnKey;
  label: string;
  align?: "left" | "right";
};

export const columns: ColumnConfig[] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "description", label: "Payee / Description" },
  { key: "accounts", label: "Account" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount", align: "right" },
  { key: "notes", label: "Notes" },
];

export const sortableColumnKey: Partial<Record<ColumnKey, SortKey>> = {
  date: "date",
  type: "type",
  description: "description",
  category: "category",
  amount: "amount",
};

export const columnWidthClass: Partial<Record<ColumnKey, string>> = {
  date: "w-40",
  type: "w-28",
  accounts: "w-72",
  category: "w-48",
  amount: "w-36",
  notes: "w-56",
};

export const transactionTypeOptions: Array<{
  value: TransactionTypeFilter;
  label: string;
}> = [
  { value: TransactionType.INCOME, label: "Income" },
  { value: TransactionType.EXPENSE, label: "Expense" },
  { value: TransactionType.TRANSFER, label: "Transfer" },
  { value: TransactionType.INVESTMENT_EVENT, label: "Investment" },
  { value: "tax", label: "Tax" },
  { value: TransactionType.ADJUSTMENT, label: "Adjustment" },
];

export const resolveTransactionTypeFilters = (
  filter: TransactionTypeFilter,
) => {
  if (!filter) {
    return { transactionTypes: undefined, taxEvent: undefined };
  }

  if (filter === "tax") {
    return { transactionTypes: undefined, taxEvent: true };
  }

  if (filter === TransactionType.TRANSFER) {
    return { transactionTypes: [TransactionType.TRANSFER], taxEvent: false };
  }

  return { transactionTypes: [filter], taxEvent: undefined };
};

type ColumnToggleProps = {
  visibility: Record<ColumnKey, boolean>;
  onToggle: (key: ColumnKey) => void;
};

export const ColumnToggle: React.FC<ColumnToggleProps> = ({
  visibility,
  onToggle,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-slate-300 text-slate-700"
      >
        <Eye className="h-4 w-4" /> Columns
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuLabel>Show / hide</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {columns.map((col) => (
        <DropdownMenuCheckboxItem
          key={col.key}
          checked={visibility[col.key] !== false}
          onCheckedChange={() => onToggle(col.key)}
        >
          {col.label}
        </DropdownMenuCheckboxItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
