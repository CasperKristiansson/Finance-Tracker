type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiRequest {
  path: string;
  method?: HttpMethod;
  query?: Record<
    string,
    | string
    | number
    | boolean
    | Array<string | number | boolean>
    | null
    | undefined
  >;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string | null;
  retryCount?: number;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  url: string;

  constructor(status: number, message: string, url: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.url = url;
  }
}

const RETRY_STATUS = new Set([502, 503, 504]);
const DEFAULT_RETRY_ATTEMPTS = 2;

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePath = (path: string) => {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
};

const buildQueryString = (query?: ApiRequest["query"]) => {
  if (!query) return "";

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
    } else {
      params.append(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `?${qs}` : "";
};

const parseResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  }
  const text = await response.text();
  return text || null;
};

export const apiFetch = async <T>(
  request: ApiRequest,
): Promise<{ data: T; status: number; response: Response }> => {
  if (!API_BASE_URL) {
    throw new ApiError(
      0,
      "API base URL is not configured (set VITE_API_BASE_URL).",
      request.path,
    );
  }

  const attempts = Math.max(request.retryCount ?? DEFAULT_RETRY_ATTEMPTS, 1);
  const url = `${API_BASE_URL}${normalizePath(request.path)}${buildQueryString(request.query)}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(request.headers ?? {}),
  };

  if (request.token) {
    headers.Authorization = `Bearer ${request.token}`;
  }

  const method = request.method ?? "GET";
  const body =
    request.body !== undefined && method !== "GET" && method !== "HEAD"
      ? JSON.stringify(request.body)
      : undefined;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      const payload = await parseResponse(response);

      if (response.ok) {
        return { data: payload as T, status: response.status, response };
      }

      const errorMessage =
        (payload as { error?: string; message?: string })?.error ??
        (payload as { message?: string })?.message ??
        response.statusText;

      const apiError = new ApiError(
        response.status,
        errorMessage || "Request failed",
        url,
        payload,
      );

      if (RETRY_STATUS.has(response.status) && attempt < attempts) {
        await delay(200 * attempt);
        continue;
      }

      throw apiError;
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError) {
        if (RETRY_STATUS.has(error.status) && attempt < attempts) {
          await delay(200 * attempt);
          continue;
        }
        throw error;
      }

      if (attempt < attempts) {
        await delay(200 * attempt);
        continue;
      }

      throw new ApiError(
        0,
        error instanceof Error ? error.message : "Network request failed",
        url,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError(0, "Unknown error during API request", url);
};
