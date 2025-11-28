import { Amplify } from "aws-amplify";
import {
  fetchAuthSession as amplifyFetchAuthSession,
  getCurrentUser as amplifyGetCurrentUser,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  type SignInOutput,
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
} as const;

let amplifyConfigured = false;

const isBrowser = () => typeof window !== "undefined";

const ensureAmplifyConfigured = () => {
  if (amplifyConfigured || !isBrowser()) return;

  const region = import.meta.env[authEnvKeys.region] ?? "";
  const userPoolId = import.meta.env[authEnvKeys.userPoolId];
  const userPoolClientId = import.meta.env[authEnvKeys.userPoolClientId];

  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      "Amplify Auth environment variables VITE_USER_POOL_ID and VITE_USER_POOL_CLIENT_ID must be set.",
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        ...(region ? { region } : {}),
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

  async signIn(email: string, password: string): Promise<AuthenticatedUser> {
    ensureAmplifyConfigured();

    const output: SignInOutput = await amplifySignIn({
      username: email,
      password,
    });

    if (!output.isSignedIn) {
      throw new Error(
        output.nextStep.signInStep
          ? `Unsupported sign-in step: ${output.nextStep.signInStep}`
          : "Sign-in was not completed.",
      );
    }

    const session = await this.buildAuthenticatedUser(true);
    if (!session) {
      throw new Error("Unable to load Cognito session after sign-in.");
    }
    return session;
  }

  async signOut(): Promise<void> {
    ensureAmplifyConfigured();
    await amplifySignOut();
  }

  async fetchAuthenticatedUser(
    forceRefresh = false,
  ): Promise<AuthenticatedUser | null> {
    ensureAmplifyConfigured();
    return this.buildAuthenticatedUser(forceRefresh);
  }
}

export default new AmplifyAuthService();
