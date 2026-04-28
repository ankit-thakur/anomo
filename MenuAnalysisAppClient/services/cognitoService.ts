import { CognitoUserPool, CognitoUserAttribute, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
import { COGNITO_CONFIG } from './cognitoConfig';

const poolData = { UserPoolId: COGNITO_CONFIG.UserPoolId, ClientId: COGNITO_CONFIG.ClientId };
const userPool = new CognitoUserPool(poolData);

export const signUp = (email: string, password: string, attributes: Record<string, string> = {}) => {
  return new Promise((resolve, reject) => {
    const attributeList = Object.keys(attributes).map(key => new CognitoUserAttribute({ Name: key, Value: attributes[key] }));

    userPool.signUp(email, password, attributeList, [], (err: any, result: any) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

export const confirmSignUp = (email: string, code: string) => {
  return new Promise((resolve, reject) => {
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);
    cognitoUser.confirmRegistration(code, true, (err: any, result: any) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

export const signIn = (email: string, password: string) => {
  return new Promise((resolve, reject) => {
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: (result: any) => resolve(result),
      onFailure: (err: any) => reject(err),
    });
  });
};

export const signOut = (email: string) => {
  const userData = { Username: email, Pool: userPool };
  const cognitoUser = new CognitoUser(userData);
  cognitoUser.signOut();
};
