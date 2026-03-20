export const cognitoConfig = {
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  webClientId: import.meta.env.VITE_COGNITO_WEB_CLIENT_ID,
  identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
  loginDomain: import.meta.env.VITE_COGNITO_LOGIN_DOMAIN
} as const;
