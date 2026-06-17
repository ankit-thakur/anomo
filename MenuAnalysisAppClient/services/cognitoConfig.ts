// Cognito configuration — set these in MenuAnalysisAppClient/.env (see .env.example)
export const COGNITO_CONFIG = {
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID ?? '',
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID ?? '',
  DomainPrefix: process.env.EXPO_PUBLIC_COGNITO_DOMAIN_PREFIX ?? '',
  Region: process.env.EXPO_PUBLIC_AWS_REGION ?? 'us-east-1',
};
