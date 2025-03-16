import {
  CognitoIdentityProviderClient,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  type InitiateAuthCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = "eu-north-1";
const CLIENT_ID = "v8p7acimssr4aiohm6ij7bpkp";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

const clearLocalStorage = () => {
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("email");
};

export interface AuthResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export async function cognitoLogin(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });

  const response: InitiateAuthCommandOutput = await cognitoClient.send(command);

  if (response.AuthenticationResult) {
    const { AccessToken, IdToken, RefreshToken } =
      response.AuthenticationResult;
    if (!AccessToken || !IdToken || !RefreshToken) {
      clearLocalStorage();
      throw new Error("Missing tokens in the response");
    }
    localStorage.setItem("refreshToken", RefreshToken);
    localStorage.setItem("email", username);
    return {
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
    };
  } else {
    clearLocalStorage();
    throw new Error("Authentication failed");
  }
}

export async function cognitoLogout(accessToken: string): Promise<void> {
  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  });
  await cognitoClient.send(command);
  clearLocalStorage();
}

export interface RefreshTokenResponse {
  accessToken: string;
  idToken: string;
}

export async function refreshToken(
  refreshToken: string,
): Promise<RefreshTokenResponse> {
  const command = new InitiateAuthCommand({
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  });

  const response: InitiateAuthCommandOutput = await cognitoClient.send(command);

  if (response.AuthenticationResult) {
    const { AccessToken, IdToken } = response.AuthenticationResult;
    if (!AccessToken || !IdToken) {
      clearLocalStorage();
      throw new Error("Missing tokens in the refresh response");
    }
    return {
      accessToken: AccessToken,
      idToken: IdToken,
    };
  } else {
    clearLocalStorage();
    throw new Error("Failed to refresh token");
  }
}
