/// <reference types="@sveltejs/kit" />

interface ImportMetaEnv {
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_WEB_CLIENT_ID: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string;
  readonly VITE_COGNITO_LOGIN_DOMAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
