import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  type InitiateAuthCommandOutput,
} from "@aws-sdk/client-cognito-identity-provider";

const REGION = "eu-north-1";
const CLIENT_ID = "v8p7acimssr4aiohm6ij7bpkp";

const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

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

  console.log("command", command);

  const response: InitiateAuthCommandOutput = await cognitoClient.send(command);

  if (response.AuthenticationResult) {
    const { AccessToken, IdToken, RefreshToken } =
      response.AuthenticationResult;
    if (!AccessToken || !IdToken || !RefreshToken) {
      throw new Error("Missing tokens in the response");
    }
    return {
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
    };
  } else {
    throw new Error("Authentication failed");
  }
}
