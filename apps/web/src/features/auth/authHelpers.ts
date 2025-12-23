import { Amplify } from "aws-amplify";
import {
  fetchAuthSession as amplifyFetchAuthSession,
  getCurrentUser as amplifyGetCurrentUser,
  signOut as amplifySignOut,
  signInWithRedirect,
} from "aws-amplify/auth";

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser extends AuthTokens {
  email: string;
  approved: boolean;
}

export class PendingApprovalError extends Error {
  constructor(message = "USER_NOT_APPROVED") {
    super(message);
    this.name = "PendingApprovalError";
  }
}

const authEnvKeys = {
  region: "VITE_AWS_REGION",
  userPoolId: "VITE_USER_POOL_ID",
  userPoolClientId: "VITE_USER_POOL_CLIENT_ID",
  cognitoDomain: "VITE_COGNITO_DOMAIN",
  redirectSignIn: "VITE_OAUTH_REDIRECT_SIGNIN",
  redirectSignOut: "VITE_OAUTH_REDIRECT_SIGNOUT",
} as const;

let amplifyConfigured = false;
let lastConfiguredAuth: {
  region?: string;
  userPoolId?: string;
  userPoolClientId?: string;
  oauthDomain?: string;
  redirectSignIn?: string[];
  redirectSignOut?: string[];
} = {};

const isBrowser = () => typeof window !== "undefined";

const isPendingApprovalMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("user_not_approved") ||
    normalized.includes("pending approval")
  );
};

const normalizeCognitoDomain = (
  domain: string | undefined,
  region: string,
): string => {
  if (!domain) return domain ?? "";
  const trimmed = domain.trim().replace(/^https?:\/\//i, "");
  if (trimmed.includes("amazoncognito.com")) return trimmed;
  // If the env already provides a custom domain (contains a dot), keep it as-is.
  if (trimmed.includes(".")) return trimmed;
  if (region) return `${trimmed}.auth.${region}.amazoncognito.com`;
  return trimmed;
};

const normalizeRedirect = (value: string | undefined): string => {
  const fallback = `${window.location.origin}/login`;
  if (!value) return fallback;
  const trimmed = value.trim();
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  if (hasProtocol) return trimmed;
  const isLocal =
    /^localhost(?::\d+)?/.test(trimmed) || /^127\.0\.0\.1/.test(trimmed);
  const protocol = isLocal ? "http://" : "https://";
  return `${protocol}${trimmed}`;
};

const splitRedirects = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const ensureAmplifyConfigured = () => {
  if (amplifyConfigured || !isBrowser()) return;

  const region = import.meta.env[authEnvKeys.region] ?? "";
  const userPoolId = import.meta.env[authEnvKeys.userPoolId];
  const userPoolClientId = import.meta.env[authEnvKeys.userPoolClientId];
  const cognitoDomain = normalizeCognitoDomain(
    import.meta.env[authEnvKeys.cognitoDomain],
    region,
  );
  const currentOrigin = window.location.origin;
  const defaultRedirects = [
    `${currentOrigin}/login`,
    currentOrigin,
    `${currentOrigin}/`,
  ];
  const redirectSignIn = Array.from(
    new Set(
      [
        ...splitRedirects(import.meta.env[authEnvKeys.redirectSignIn]),
        ...defaultRedirects,
      ].map(normalizeRedirect),
    ),
  );
  const redirectSignOut = Array.from(
    new Set(
      [
        ...splitRedirects(import.meta.env[authEnvKeys.redirectSignOut]),
        ...defaultRedirects,
      ].map(normalizeRedirect),
    ),
  );

  if (!userPoolId || !userPoolClientId || !cognitoDomain) {
    throw new Error(
      "Amplify Auth environment variables VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID, and VITE_COGNITO_DOMAIN must be set.",
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        ...(region ? { region } : {}),
        loginWith: {
          oauth: {
            domain: cognitoDomain,
            redirectSignIn,
            redirectSignOut,
            responseType: "code",
            scopes: ["email", "openid", "profile"],
          },
        },
      },
    },
  });

  lastConfiguredAuth = {
    region,
    userPoolId,
    userPoolClientId,
    oauthDomain: cognitoDomain,
    redirectSignIn,
    redirectSignOut,
  };

  amplifyConfigured = true;
};

const isUnauthenticatedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const name = "name" in error ? (error as { name?: string }).name : undefined;
  const message = error.message ?? "";
  if (isPendingApprovalMessage(message)) return false;
  return (
    name === "UserNotAuthenticatedException" ||
    name === "NotAuthorizedException" ||
    message.includes("authenticated")
  );
};

const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return (
      JSON.stringify(value, (_, candidate) => {
        if (typeof candidate === "object" && candidate !== null) {
          if (seen.has(candidate)) return undefined;
          seen.add(candidate);
        }
        return candidate;
      }) ?? ""
    );
  } catch {
    return "";
  }
};

const readResponseText = async (value: unknown): Promise<string> => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof Response !== "undefined" && value instanceof Response) {
    try {
      return await value.clone().text();
    } catch {
      return "";
    }
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.body === "string") return record.body;
    if (typeof record.data === "string") return record.data;
    if (record.body && typeof record.body === "object") {
      return safeStringify(record.body);
    }
    if (record.data && typeof record.data === "object") {
      return safeStringify(record.data);
    }
  }
  return "";
};

const isPendingApprovalError = async (error: unknown): Promise<boolean> => {
  if (error instanceof PendingApprovalError) return true;
  if (error instanceof Error && isPendingApprovalMessage(error.message)) {
    return true;
  }
  if (typeof error === "string" && isPendingApprovalMessage(error)) {
    return true;
  }
  if (!error || typeof error !== "object") return false;

  const record = error as Record<string, unknown>;
  if (
    typeof record.message === "string" &&
    isPendingApprovalMessage(record.message)
  ) {
    return true;
  }
  if (
    typeof record.error === "string" &&
    isPendingApprovalMessage(record.error)
  ) {
    return true;
  }

  const responseText = await readResponseText(
    record.response ?? record.body ?? record.data,
  );
  if (isPendingApprovalMessage(responseText)) return true;

  if ("cause" in record) {
    const causeText = await readResponseText(record.cause);
    if (isPendingApprovalMessage(causeText)) return true;
  }

  return false;
};

const toAuthTokens = (
  session: Awaited<ReturnType<typeof amplifyFetchAuthSession>>,
): AuthTokens => {
  const tokens = session.tokens;

  if (!tokens?.accessToken) {
    throw new Error("Access token missing from Cognito session.");
  }

  const idToken = tokens.idToken?.toString();
  if (!idToken) {
    throw new Error("ID token missing from Cognito session.");
  }

  return {
    accessToken: tokens.accessToken.toString(),
    idToken,
    refreshToken:
      (
        tokens as {
          refreshToken?: { toString(): string };
        }
      ).refreshToken?.toString() ?? "",
  };
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof atob === "function") {
    return atob(padded);
  }

  return Buffer.from(padded, "base64").toString("binary");
};

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid ID token format.");
  }

  const payload = decodeBase64Url(parts[1]);
  return JSON.parse(payload) as Record<string, unknown>;
};

const isApprovedFromToken = (idToken: string): boolean => {
  const payload = decodeJwtPayload(idToken);
  const approvedClaim = payload["custom:approved"];
  return (
    approvedClaim === true ||
    approvedClaim === "true" ||
    approvedClaim === 1 ||
    approvedClaim === "1"
  );
};

class AmplifyAuthService {
  constructor() {
    ensureAmplifyConfigured();
  }

  private async buildAuthenticatedUser(
    forceRefresh = false,
  ): Promise<AuthenticatedUser | null> {
    try {
      const user = await amplifyGetCurrentUser();
      const session = await amplifyFetchAuthSession({ forceRefresh });
      const tokens = toAuthTokens(session);

      const approved = isApprovedFromToken(tokens.idToken);
      if (!approved) {
        throw new PendingApprovalError();
      }

      return {
        email: user.username,
        approved,
        ...tokens,
      };
    } catch (error) {
      if (await isPendingApprovalError(error)) {
        if (error instanceof PendingApprovalError) {
          throw error;
        }
        throw new PendingApprovalError();
      }
      if (isUnauthenticatedError(error)) {
        return null;
      }
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      ensureAmplifyConfigured();
      await signInWithRedirect({ provider: "Google" });
    } catch (error) {
      // Surface configuration details to help debug OAuth issues (avoids tokens)
      console.error("Amplify signInWithRedirect failed", {
        error,
        authConfig: lastConfiguredAuth,
      });
      throw error;
    }
  }

  async signOut(): Promise<void> {
    ensureAmplifyConfigured();
    await amplifySignOut({ global: true });
  }

  async fetchAuthenticatedUser(
    forceRefresh = false,
  ): Promise<AuthenticatedUser | null> {
    ensureAmplifyConfigured();
    return this.buildAuthenticatedUser(forceRefresh);
  }

  async completeRedirectIfPresent(): Promise<void> {
    ensureAmplifyConfigured();
    try {
      await amplifyFetchAuthSession();
    } catch (error) {
      if (await isPendingApprovalError(error)) {
        if (error instanceof PendingApprovalError) {
          throw error;
        }
        throw new PendingApprovalError();
      }
      if (!isUnauthenticatedError(error)) {
        throw error;
      }
    }
  }
}

export default new AmplifyAuthService();
