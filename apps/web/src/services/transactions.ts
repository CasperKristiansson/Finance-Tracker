import { apiFetch } from "@/lib/apiClient";
import type { TransactionListResponse } from "@/types/api";
import { transactionListSchema } from "@/types/schemas";

type TokenParam = { token: string | null };

export const fetchTransactions = async ({
  token,
  query,
}: TokenParam & {
  query: Record<string, string | number | string[] | undefined | null>;
}) =>
  apiFetch<TransactionListResponse>({
    path: "/transactions",
    schema: transactionListSchema,
    query,
    token,
  });
