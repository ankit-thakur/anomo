const { Stack } = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');

class CognitoStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    /** @type {cognito.UserPool} */
    this.userPool;

    // Create User Pool
    this.userPool = new cognito.UserPool(this, 'MenuAnalysisUserPool', {
      userPoolName: 'menu-analysis-user-pool',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    // Create Lambda functions for Cognito triggers
    const preSignUpLambda = new lambda.Function(this, 'PreSignUpTrigger', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'pre_signup.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/auth')),
    });

    const postConfirmationLambda = new lambda.Function(this, 'PostConfirmationTrigger', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'post_confirmation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/auth')),
    });

    // Add Lambda triggers to User Pool
    this.userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignUpLambda
    );

    this.userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationLambda
    );

    // Create App Client
    const userPoolClient = new cognito.UserPoolClient(this, 'MenuAnalysisAppClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          implicitCodeGrant: true,
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: ['http://localhost:3000/callback'], // Update with your actual callback URLs
        logoutUrls: ['http://localhost:3000/logout'],    // Update with your actual logout URLs
      },
    });

    // Export values that will be needed by other stacks or the frontend
    this.userPoolId = this.userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;
  }
}

module.exports = { CognitoStack }