#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { CdkStack } = require('../lib/cdk-stack');
const { LambdaLayersStack } = require('../lib/lambda-layers-stack');
const { StepFunctionWithLambdasStack } = require('../lib/step-function-lambda-stack');
const { DdbStack } = require('../lib/dynamodb-stack');
// const { WebSocketApiStack } = require('../lib/websocket-stack');
const { SesEmailStack } = require('../lib/ses-email-stack');
const { RagStack } = require('../lib/rag-stack');
const { CognitoStack } = require('../lib/cognito-stack');
const { UserPreferencesStack } = require('../lib/user-preferences-stack');
const { ImageStack } = require('../lib/image-stack');

const app = new cdk.App();

// Deploy main stack with Cognito resources
new CdkStack(app, 'CdkStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new LambdaLayersStack(app, 'LambdaLayersStack', {

});

new StepFunctionWithLambdasStack(app, 'StepFunctionWithLambdasStack', {

});

const ddbStack = new DdbStack(app, 'DdbStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

const cognitoStack = new CognitoStack(app, 'CognitoStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});

new UserPreferencesStack(app, 'UserPreferencesStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  userPreferencesTableArn: ddbStack.userPreferencesTableArn,
  userPool: cognitoStack.userPool,
});

/* Temporarily commented out
new WebSocketApiStack(app, 'WebSocketApiStack', {
});
*/

new SesEmailStack(app, 'SesEmailStack', {
  
});

new RagStack(app, 'RagStack', {

});

new ImageStack(app, 'ImageStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});