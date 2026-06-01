/// <reference types="vite/client" />
/// <reference types="node" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_WS_API_BASE_URL?: string;
  readonly VITE_AWS_REGION?: string;
  readonly VITE_USER_POOL_ID?: string;
  readonly VITE_USER_POOL_CLIENT_ID?: string;
  readonly VITE_COGNITO_DOMAIN?: string;
  readonly VITE_OAUTH_REDIRECT_SIGNIN?: string;
  readonly VITE_OAUTH_REDIRECT_SIGNOUT?: string;
}
