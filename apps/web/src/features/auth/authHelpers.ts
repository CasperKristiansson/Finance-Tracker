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

const isBrowser = () => typeof window !== "undefined";

const normalizeCognitoDomain = (
  domain: string | undefined,
  region: string,
): string => {
  if (!domain) return domain ?? "";
  const trimmed = domain.trim().replace(/^https?:\/\//i, "");
  if (trimmed.includes("amazoncognito.com")) return trimmed;
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

const ensureAmplifyConfigured = () => {
  if (amplifyConfigured || !isBrowser()) return;

  const region = import.meta.env[authEnvKeys.region] ?? "";
  const userPoolId = import.meta.env[authEnvKeys.userPoolId];
  const userPoolClientId = import.meta.env[authEnvKeys.userPoolClientId];
  const cognitoDomain = normalizeCognitoDomain(
    import.meta.env[authEnvKeys.cognitoDomain],
    region,
  );
  const redirectSignIn = normalizeRedirect(
    import.meta.env[authEnvKeys.redirectSignIn],
  );
  const redirectSignOut = normalizeRedirect(
    import.meta.env[authEnvKeys.redirectSignOut],
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
      },
      oauth: {
        domain: cognitoDomain,
        redirectSignIn,
        redirectSignOut,
        responseType: "code",
        scopes: ["email", "openid", "profile"],
        providers: ["Google"],
      },
    },
  });

  amplifyConfigured = true;
};

const isUnauthenticatedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const name = "name" in error ? (error as { name?: string }).name : undefined;
  const message = error.message ?? "";
  return (
    name === "UserNotAuthenticatedException" ||
    name === "NotAuthorizedException" ||
    message.includes("authenticated")
  );
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

      return {
        email: user.username,
        ...tokens,
      };
    } catch (error) {
      if (isUnauthenticatedError(error)) {
        return null;
      }
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    ensureAmplifyConfigured();
    await signInWithRedirect({ provider: "Google" });
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
      if (!isUnauthenticatedError(error)) {
        throw error;
      }
    }
  }
}

export default new AmplifyAuthService();
