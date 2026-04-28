import { COGNITO_CONFIG } from '../services/cognitoConfig';
import { getRedirectUri } from '../utils/environment';

// List of allowed URIs for different environments. These should all be
// configured in the Cognito App Client's callback URLs (AWS Console).
const SIGNIN_URIS = [
  // Local development URIs (Expo Go)
  'exp://192.168.68.65:8081/home',  // Mobile Expo Go
  'http://localhost:8081/home',      // Web browser
  // Production URIs
  'exp://exp.host/@ankit-thakur/anomo/home',
  'anomo://home',
];

const SIGNOUT_URIS = [
  // Local development URIs (Expo Go)
  'exp://192.168.68.65:8081/signin', // Mobile Expo Go
  'http://localhost:8081/signin',     // Web browser
  // Production URIs
  'exp://exp.host/@ankit-thakur/anomo/signin',
  'anomo://signin',
];

const awsConfig = {
  ...COGNITO_CONFIG,
  aws_project_region: COGNITO_CONFIG.Region,
  aws_user_pools_id: COGNITO_CONFIG.UserPoolId,
  aws_user_pools_web_client_id: COGNITO_CONFIG.ClientId,
  oauth: {
    // Use the domain prefix configured in Cognito (DomainPrefix). Do NOT
    // build the domain from the UserPoolId — that produces an invalid domain
    // like 'us-east-1.auth.us-east-1.amazoncognito.com'. Set COGNITO_CONFIG.DomainPrefix
    // to the prefix you created in the console (e.g. 'menu-analysis-app').
    domain: COGNITO_CONFIG.DomainPrefix
      ? `${COGNITO_CONFIG.DomainPrefix}.auth.${COGNITO_CONFIG.Region}.amazoncognito.com`
      : `${COGNITO_CONFIG.UserPoolId.split('_')[0]}.auth.${COGNITO_CONFIG.Region}.amazoncognito.com`,
    scope: ['email', 'openid', 'profile'],
    // Amplify expects a single redirect string at runtime. Use the
    // environment helper to pick the correct one from the list.
    redirectSignIn: "http://localhost:8081/home",
    redirectSignOut: "http://localhost:8081/signin",
    // redirectSignIn: getRedirectUri(SIGNIN_URIS, 'signIn'),
    // redirectSignOut: getRedirectUri(SIGNOUT_URIS, 'signOut'),
    responseType: 'code',
  },
};

export default awsConfig;