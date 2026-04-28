// Cognito configuration from AWS Console
export const COGNITO_CONFIG = {
  UserPoolId: 'us-east-1_kF3CB4HLL', // Verify this matches your User Pool ID
  ClientId: '422p6c4vqsuun3dneftkumrjdl', // Add your new App Client ID here
  // DomainPrefix should be the prefix you created in the Cognito console
  // e.g. if your hosted UI domain is https://menu-analysis-app.auth.us-east-1.amazoncognito.com
  // then DomainPrefix should be 'menu-analysis-app'
  DomainPrefix: 'anomo',
  Region: 'us-east-1',
};
