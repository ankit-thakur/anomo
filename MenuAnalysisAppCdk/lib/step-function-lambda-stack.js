const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const tasks = require('aws-cdk-lib/aws-stepfunctions-tasks');
const stepfunctions = require('aws-cdk-lib/aws-stepfunctions');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require('path');
const Construct = require('constructs');
const { Stack, Duration } = require('aws-cdk-lib');
const secrets = require('./secrets.json');


// Bedrock model ARNs to grant InvokeModel access.
// Wildcards cover all cross-region inference profiles (us.anthropic.*).
// Cross-region inference profiles route requests to us-east-1, us-east-2, us-west-2, etc.
// Wildcard the region so the IAM policy covers all hops, not just us-east-1.
// Wildcard region: cross-region inference routes through us-east-1, us-east-2, us-west-2
const BEDROCK_MODEL_ARNS = [
  'arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0',
  'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-sonnet-4*',
  'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0',
  // Legacy models used by GetMenuLambda
  'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
  'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0',
];

// Primary model — keep in sync with lambdas/.env CLAUDE_SONNET_4
// Verify model availability in: AWS Console → Bedrock → Model catalog
const PRIMARY_MODEL = 'us.anthropic.claude-sonnet-4-20250514-v1:0';
const FAST_MODEL    = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';


class StepFunctionWithLambdasStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // -----------------------------------------------------------------------
    // Import shared Lambda layers
    // -----------------------------------------------------------------------
    const importedBoto3Layer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'Boto3Layer', cdk.Fn.importValue('Boto3LayerVersionArn'));

    const importedRequestsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'RequestsLayer', cdk.Fn.importValue('RequestsLayerVersionArn'));

    const importedDotenvLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'dotenv_layer', cdk.Fn.importValue('DotenvLayerVersionArn'));

    // const importedOpenAiLayer = lambda.LayerVersion.fromLayerVersionArn(
    //   this, 'OpenAiLayer', cdk.Fn.importValue('OpenAiLayerVersionArn'));

    const importedPdfReaderLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'PdfReaderLayer', cdk.Fn.importValue('PdfReaderLayerVersionArn'));

    const importedBs4Layer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'bs4_layer', cdk.Fn.importValue('BS4LayerVersionArn'));

    // Strands public layer — no need to build your own.
    // Find the latest version number at: https://github.com/strands-agents/strands-agents
    // or run: aws lambda get-layer-version \
    //   --layer-name arn:aws:lambda:us-east-1:856699698935:layer:strands-agents-py312-x86_64 \
    //   --version-number <N>
    // Update STRANDS_LAYER_VERSION below when Strands releases a new version.
    const STRANDS_LAYER_VERSION = 1;  // <-- update to latest version
    const importedStrandsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'StrandsLayer',
      `arn:aws:lambda:${this.region}:856699698935:layer:strands-agents-py3_12-x86_64:${STRANDS_LAYER_VERSION}`
    );

    // -----------------------------------------------------------------------
    // Import DynamoDB tables
    // -----------------------------------------------------------------------
    const importedRestaurantTable = dynamodb.Table.fromTableArn(
      this, 'RestaurantTable', cdk.Fn.importValue('RestaurantTableExport'));

    const importedMenuItemsTable = dynamodb.Table.fromTableArn(
      this, 'MenuItemsTable', cdk.Fn.importValue('MenuItemsTableExport'));

    const importedConnectionIdTable = dynamodb.Table.fromTableArn(
      this, 'ConnectionIdTable', cdk.Fn.importValue('ConnectionIdTableExport'));

    const importedEmailListTable = dynamodb.Table.fromTableArn(
      this, 'EmailListTable', cdk.Fn.importValue('EmailListTableExport'));

    const importedUsersTable = dynamodb.Table.fromTableArn(
      this, 'UsersTable', cdk.Fn.importValue('UsersTableExport'));

    const importedUserPreferencesTable = dynamodb.Table.fromTableArn(
      this, 'UserPreferencesTable', cdk.Fn.importValue('UserPreferencesTableExport'));

    // -----------------------------------------------------------------------
    // Common Bedrock policy (shared across agent Lambdas)
    // -----------------------------------------------------------------------
    const bedrockPolicy = new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: BEDROCK_MODEL_ARNS,
    });

    // -----------------------------------------------------------------------
    // Shared Lambda config for all agent Lambdas
    // -----------------------------------------------------------------------
    const agentCode = lambda.Code.fromAsset(
      path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu'));

    const agentEnv = {
      CLAUDE_SONNET_4: PRIMARY_MODEL,
      CLAUDE_HAIKU:    FAST_MODEL,
      AWS_REGION_NAME: 'us-east-1',
    };

    // Layer sets per agent — Lambda max is 5 layers per function.
    // openai layer removed: invoke_model.py now lazy-imports OpenAI only when that
    // code path is called (never by the Bedrock agent pipeline).
    const scraperLayers = [
      importedBoto3Layer,     // bedrock + boto3
      importedRequestsLayer,  // HTTP crawling + invoke_model.py
      importedBs4Layer,       // HTML parsing
      importedPdfReaderLayer, // PDF menu support
      importedStrandsLayer,
    ];  // = 5 layers ✓

    const allergenLayers = [
      importedBoto3Layer,     // bedrock (Titan embed for KB + Claude for agent)
      importedRequestsLayer,  // invoke_model.py
      importedBs4Layer,       // transitive via dish_extraction imports
      importedStrandsLayer,
    ];  // = 4 layers ✓

    const verificationLayers = [
      importedBoto3Layer,
      importedRequestsLayer,  // invoke_model.py transitive
      importedStrandsLayer,
    ];  // = 3 layers ✓

    // -----------------------------------------------------------------------
    // 1. Scraper Agent Lambda
    //    Crawls restaurant website → extracts dish list
    // -----------------------------------------------------------------------
    const scraperLambda = new lambda.Function(this, 'ScraperAgentLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agents.scraper_lambda.lambda_handler',
      code: agentCode,
      timeout: Duration.minutes(15),
      memorySize: 3008,
      layers: scraperLayers,
      environment: agentEnv,
    });
    scraperLambda.addToRolePolicy(bedrockPolicy);

    // -----------------------------------------------------------------------
    // 2. Allergen Detection Agent Lambda
    //    Infers ingredients + queries allergen KB + LLM reasoning
    // -----------------------------------------------------------------------
    const allergenLambda = new lambda.Function(this, 'AllergenAgentLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agents.allergen_lambda.lambda_handler',
      code: agentCode,
      timeout: Duration.minutes(15),
      memorySize: 10240,  // high memory: loads allergen_kb_embeddings.json into RAM
      layers: allergenLayers,
      environment: agentEnv,
    });
    allergenLambda.addToRolePolicy(bedrockPolicy);

    // -----------------------------------------------------------------------
    // 3. Verification Agent Lambda
    //    Scores confidence, flags ambiguous ingredients, generates allergen notes
    // -----------------------------------------------------------------------
    const verificationLambda = new lambda.Function(this, 'VerificationAgentLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agents.verification_lambda.lambda_handler',
      code: agentCode,
      timeout: Duration.minutes(15),  // LLM batch verification: 165 dishes ÷ 15/batch = 11 calls
      memorySize: 1024,
      layers: verificationLayers,
      environment: agentEnv,
    });
    verificationLambda.addToRolePolicy(bedrockPolicy);

    // -----------------------------------------------------------------------
    // 4. Finalize Lambda
    //    Writes results to DynamoDB, sends notification email and push
    // -----------------------------------------------------------------------
    const finalizeLambda = new lambda.Function(this, 'FinalizeMenuLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'agents.finalize_lambda.lambda_handler',
      code: agentCode,
      timeout: Duration.minutes(5),
      memorySize: 1024,
      layers: [importedBoto3Layer, importedRequestsLayer],
      environment: {
        ...agentEnv,
        RESTAURANT_TABLE:       importedRestaurantTable.tableName,
        MENU_ITEMS_TABLE:       importedMenuItemsTable.tableName,
        EMAIL_LIST_TABLE:       importedEmailListTable.tableName,
        USER_PREFERENCES_TABLE: importedUserPreferencesTable.tableName,
      },
    });

    // DynamoDB + SES permissions for finalize Lambda
    importedRestaurantTable.grantReadWriteData(finalizeLambda);
    importedMenuItemsTable.grantReadWriteData(finalizeLambda);
    importedEmailListTable.grantReadWriteData(finalizeLambda);
    importedUsersTable.grantReadWriteData(finalizeLambda);
    importedConnectionIdTable.grantReadWriteData(finalizeLambda);
    importedUserPreferencesTable.grantReadData(finalizeLambda);
    finalizeLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));
    finalizeLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:${secrets.websocket_api_id}/prod/POST/@connections/{connectionId}`],
    }));

    // -----------------------------------------------------------------------
    // Legacy GetMenu Lambda (unchanged — used for menu URL discovery flow)
    // -----------------------------------------------------------------------
    const getMenuLambda = new lambda.Function(this, 'GetMenuLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'get_menu.get_menu',
      code: agentCode,
      timeout: Duration.minutes(15),
      layers: [importedBoto3Layer, importedRequestsLayer, importedPdfReaderLayer],
      environment: agentEnv,
    });
    getMenuLambda.addToRolePolicy(bedrockPolicy);

    // -----------------------------------------------------------------------
    // Step Functions role
    // -----------------------------------------------------------------------
    const lambdaInvokeRole = new iam.Role(this, 'LambdaInvokeRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });
    lambdaInvokeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [
        scraperLambda.functionArn,
        allergenLambda.functionArn,
        verificationLambda.functionArn,
        finalizeLambda.functionArn,
        getMenuLambda.functionArn,
      ],
    }));

    // -----------------------------------------------------------------------
    // Step Functions definition: Scraper → Allergen → Verification → Finalize
    // -----------------------------------------------------------------------
    const scraperTask = new tasks.LambdaInvoke(this, 'ScraperTask', {
      lambdaFunction: scraperLambda,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const allergenTask = new tasks.LambdaInvoke(this, 'AllergenTask', {
      lambdaFunction: allergenLambda,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const verificationTask = new tasks.LambdaInvoke(this, 'VerificationTask', {
      lambdaFunction: verificationLambda,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const finalizeTask = new tasks.LambdaInvoke(this, 'FinalizeTask', {
      lambdaFunction: finalizeLambda,
      inputPath: '$',
      outputPath: '$.Payload',
    });

    const definition = scraperTask
      .next(allergenTask)
      .next(verificationTask)
      .next(finalizeTask);

    new stepfunctions.StateMachine(this, 'MenuAnalysisStepFunction', {
      definition,
      timeout: cdk.Duration.minutes(60),
      role: lambdaInvokeRole,
    });
  }
}

module.exports = { StepFunctionWithLambdasStack }
