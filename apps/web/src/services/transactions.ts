import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type { EndpointResponse } from "@/types/contracts";
import { transactionListSchema } from "@/types/schemas";

type TokenParam = { token: string | null };

export const fetchTransactions = async ({
  token,
  query,
}: TokenParam & {
  query: Record<string, string | number | string[] | undefined | null>;
}) =>
  apiFetch<EndpointResponse<"listTransactions">>(
    buildEndpointRequest("listTransactions", {
      schema: transactionListSchema,
      query,
      token,
    }),
  );
