const { Stack, Duration } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apig = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');
const cdk = require('aws-cdk-lib');
const secrets = require('../secrets.json');


class CdkStack extends Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const myBoto3Layer = lambda.LayerVersion.fromLayerVersionArn(this, 'boto3layer3', `arn:aws:lambda:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:layer:boto3layer3:1`);
    // Import the Lambda Layer from another stack using its exported ARN
    const importedBoto3Layer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'Boto3Layer',
      cdk.Fn.importValue('Boto3LayerVersionArn') // Import by export name
    );


    // Import the Lambda Layer from another stack using its exported ARN
    const importedRequestsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'RequestsLayer',
      cdk.Fn.importValue('RequestsLayerVersionArn') // Import by export name
    );

    // Import the Lambda Layer from another stack using its exported ARN
    const importedPdfReaderLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'PdfReaderLayer',
      cdk.Fn.importValue('PdfReaderLayerVersionArn') // Import by export name
    );
    
    // Import the Lambda Layer from another stack using its exported ARN
    const importedDotenvLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        'dotenv_layer',
        cdk.Fn.importValue('DotenvLayerVersionArn') // Import by export name
    );

    // Import the Lambda Layer from another stack using its exported ARN
    const importedBs4Layer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        'bs4_layer',
        cdk.Fn.importValue('BS4LayerVersionArn') // Import by export name
    );

    // Import the Lambda Layer from another stack using its exported ARN
    // const importedOpenAiLayer = lambda.LayerVersion.fromLayerVersionArn(
    //   this,
    //   'OpenAiLayer',
    //   cdk.Fn.importValue('OpenAiLayerVersionArn') // Import by export name
    // );
    
    // // requests module lambda layer
    // const requestsLayer = new lambda.LayerVersion(this, 'RequestsLayer', {
    //   code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/layers/requests_layer')),
    //   compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    // });



    // Import the Lambda Layer from another stack using its exported ARN
    const importedRestaurantTable = dynamodb.Table.fromTableArn(
      this,
      'RestaurantTable',
      cdk.Fn.importValue('RestaurantTableExport') // Import by export name
    );

    // Import the DDB Table from another stack using its exported ARN
    const importedMenuItemsTable = dynamodb.Table.fromTableArn(
      this,
      'MenuItemsTable',
      cdk.Fn.importValue('MenuItemsTableExport') // Import by export name
    );

    // Import the DDB table from another stack using its exported ARN
    const importedConnectionIdTable = dynamodb.Table.fromTableArn(
      this,
      'ConnectionIdTable',
      cdk.Fn.importValue('ConnectionIdTableExport') // Import by export name
    );

    // Import the DDB table from another stack using its exported ARN
    const importedUsersTable = dynamodb.Table.fromTableArn(
      this,
      'UsersTable',
      cdk.Fn.importValue('UsersTableExport') // Import by export name
    );

    // Import the DDB table from another stack using its exported ARN
    const importedUserPreferencesTable = dynamodb.Table.fromTableArn(
      this,
      'UserPreferencesTable',
      cdk.Fn.importValue('UserPreferencesTableExport')
    );

    /*********************************************************** SEARCH ***********************************************************/

    // defines lambda resource for Google Searching
    const searchPlaceIdLambda = new lambda.Function(this, 'SearchPlaceIdLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'search_places.get_place_id',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/search')),
      timeout: Duration.minutes(15),
      environment: {
        GOOGLE_API_KEY: secrets.google_api_key,
      },
      layers: [ importedRequestsLayer, importedDotenvLayer ]
    });

    // defines lambda resource for Google Searching
    const searchPlaceDetailsLambda = new lambda.Function(this, 'SearchPlaceDetailsLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'search_places.get_place_details',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/search')),
      timeout: Duration.minutes(15),
      environment: {
        GOOGLE_API_KEY: secrets.google_api_key,
      },
      layers: [ importedRequestsLayer ]
    });

    // defines API resource that will invoke lambda which gets Google's PlaceId
    const searchApi = new apig.RestApi(this, 'SearchApi', {
      restApiName: 'SearchApi',
    });

    const searchPlaceId = searchApi.root.addResource('searchPlaceId');
    searchPlaceId.addMethod('POST', new apig.LambdaIntegration(searchPlaceIdLambda));

    searchPlaceId.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'GET', 'OPTIONS'],
    });

    const searchPlaceDetails = searchApi.root.addResource('searchPlaceDetails');
    searchPlaceDetails.addMethod('GET', new apig.LambdaIntegration(searchPlaceDetailsLambda));
    searchPlaceDetails.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['GET', 'OPTIONS'],
    });

/*********************************************************** QUERY RESTAURANT TABLES ***********************************************************/

    // defines lambda resource for querying Restaurants table
    const queryRestaurantsLambda = new lambda.Function(this, 'QueryRestaurantsLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'query_restaurants.query_restaurants',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: Duration.minutes(15),
      layers: [ importedRequestsLayer ],
      environment: {
        RESTAURANT_TABLE: importedRestaurantTable.tableName,
        MENU_ITEMS_TABLE: importedMenuItemsTable.tableName,
      },
    });

    // defines API resource that will invoke lambda which gets Google's PlaceId
    const queryRestaurantsApi = new apig.RestApi(this, 'QueryRestaurantsApi', {
      restApiName: 'QueryRestaurantsApi',
    });

    const queryRestaurants = queryRestaurantsApi.root.addResource('queryRestaurants');
    queryRestaurants.addMethod('POST', new apig.LambdaIntegration(queryRestaurantsLambda));

    queryRestaurants.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'GET', 'OPTIONS'],
    });

    queryRestaurantsLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:${secrets.websocket_api_id}/prod/POST/@connections/{connectionId}`],
    }));

    importedRestaurantTable.grantReadWriteData(queryRestaurantsLambda);
    importedMenuItemsTable.grantReadWriteData(queryRestaurantsLambda);
    importedConnectionIdTable.grantReadWriteData(queryRestaurantsLambda);


/*********************************************************** RESTAURANT DATA ***********************************************************/

    // defines lambda resource for querying Restaurants table
    const restaurantDataLambda = new lambda.Function(this, 'restaurantDataLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'get_restaurant_data.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: Duration.minutes(15),
      layers: [ importedRequestsLayer ],
      environment: {
        RESTAURANT_TABLE:       importedRestaurantTable.tableName,
        MENU_ITEMS_TABLE:       importedMenuItemsTable.tableName,
        USER_PREFERENCES_TABLE: importedUserPreferencesTable.tableName,
      },
    });

    // defines API resource that will invoke lambda which gets Google's PlaceId
    const restaurantApi = new apig.RestApi(this, 'RestaurantApi', {
      restApiName: 'RestaurantApi',
    });

    // Route for getting restaurant details
    const getRestaurant = restaurantApi.root.addResource('getRestaurant');
    getRestaurant.addMethod('POST', new apig.LambdaIntegration(restaurantDataLambda));
    getRestaurant.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'OPTIONS'],
    });

    // Route for getting menu items
    const getMenuItems = restaurantApi.root.addResource('getMenuItems');
    getMenuItems.addMethod('POST', new apig.LambdaIntegration(restaurantDataLambda));
    getMenuItems.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'OPTIONS'],
    });

    restaurantDataLambda.addToRolePolicy(new iam.PolicyStatement({
      effect: ['Allow'],
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:${secrets.websocket_api_id}/prod/POST/@connections/{connectionId}`],
    }));

    importedRestaurantTable.grantReadWriteData(restaurantDataLambda);
    importedMenuItemsTable.grantReadWriteData(restaurantDataLambda);
    importedConnectionIdTable.grantReadWriteData(restaurantDataLambda);
    importedUserPreferencesTable.grantReadData(restaurantDataLambda);

    // Recommendations route — shares restaurantApi, separate Lambda
    const getRecommendationsLambda = new lambda.Function(this, 'GetRecommendationsLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'get_recommendations.get_recommendations',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: Duration.minutes(2),
      environment: {
        RESTAURANT_TABLE:       importedRestaurantTable.tableName,
        USER_PREFERENCES_TABLE: importedUserPreferencesTable.tableName,
      },
      layers: [ importedRequestsLayer ],
    });

    importedRestaurantTable.grantReadData(getRecommendationsLambda);
    importedUserPreferencesTable.grantReadData(getRecommendationsLambda);

    const getRecommendations = restaurantApi.root.addResource('getRecommendations');
    getRecommendations.addMethod('POST', new apig.LambdaIntegration(getRecommendationsLambda));
    getRecommendations.addCorsPreflight({
      allowOrigins: ['*'],
      allowMethods: ['POST', 'OPTIONS'],
    });

/*********************************************************** GET MENU LAMBDA ***********************************************************/

    const getMenuLambda = new lambda.Function(this, 'GetMenuLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'get_menu.get_menu_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      memory: 3008,
      timeout: Duration.minutes(15),
      layers: [ importedBoto3Layer, importedRequestsLayer, importedPdfReaderLayer, importedBs4Layer, importedDotenvLayer ],
      environment: {
        "openai_api_key": secrets.openai_api_key,
        "FIRECRAWL_API_KEY": secrets.firecrawl_api_key,
      }
    });

    getMenuLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-v2',
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0',
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0',
        'arn:aws:bedrock:us-east-1::foundation-model/us.anthropic.claude-3-5-haiku-20241022-v1:0',
        `arn:aws:bedrock:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0`,
        'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-haiku-20240620-v1:0',
        'arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0'
      ],
    }));

    const getMenuApi = new apig.RestApi(this, 'GetMenuApi', {
      restApiName: 'GetMenuApi',
    });

    const getMenuApiId = getMenuApi.root.addResource('getMenu');
    getMenuApiId.addMethod('POST', new apig.LambdaIntegration(getMenuLambda));
    getMenuApiId.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    });


/*********************************************************** MENU ANALYZER HANDLER ***********************************************************/

    const menuAnalyzerLambdaHandler = new lambda.Function(this, 'MenuAnalyzerLambdaHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'analyze_menu_handler.menu_analyzer_lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: Duration.minutes(15),
      memory: 3008,
      layers: [ myBoto3Layer, importedRequestsLayer, importedBs4Layer ],
      environment: {
        STEP_FUNCTION_ARN: cdk.Fn.importValue('MenuAnalysisStateMachineArnExport'),
        RESTAURANT_TABLE: importedRestaurantTable.tableName,
      },
    });

    menuAnalyzerLambdaHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [cdk.Fn.importValue('MenuAnalysisStateMachineArnExport')],
    }));

    menuAnalyzerLambdaHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:${secrets.websocket_api_id}/prod/POST/@connections/{connectionId}`],
    }));

    // Import the DDB table from another stack using its exported ARN
    const importedEmailListTable = dynamodb.Table.fromTableArn(
      this,
      'EmailListTable',
      cdk.Fn.importValue('EmailListTableExport') // Import by export name
    );

    importedConnectionIdTable.grantReadWriteData(menuAnalyzerLambdaHandler);
    importedUsersTable.grantReadWriteData(menuAnalyzerLambdaHandler);

    const analyzeMenuApi = new apig.LambdaRestApi(this, 'AnalyzeMenuApi', {
      handler: menuAnalyzerLambdaHandler,
      proxy: false,
    });

    const analyzeMenuApiId = analyzeMenuApi.root.addResource('invokeAnalyzeMenu');
    analyzeMenuApiId.addMethod('POST');
    analyzeMenuApiId.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'GET', 'OPTIONS'],
    });

    // Grant the Lambda function permissions to the DynamoDB table
    importedRestaurantTable.grantReadWriteData(menuAnalyzerLambdaHandler);


    /*********************************************************** USERS TABLE LAMBDA ***********************************************************/

    const usersLambda = new lambda.Function(this, 'UsersLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'update_users_handler.update_users_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: Duration.minutes(15),
      memory: 3008,
      layers: [ myBoto3Layer, importedRequestsLayer ],
      environment: {
        USERS_TABLE: importedUsersTable.tableName,
      },
    });

    importedUsersTable.grantReadWriteData(usersLambda);

    // defines API resource that will invoke lambda which gets Google's PlaceId
    const updateUsersApi = new apig.RestApi(this, 'UpdateUsersApi', {
      restApiName: 'UpdateUsersApi',
    });

    const updateUsers = updateUsersApi.root.addResource('updateUsers');
    updateUsers.addMethod('POST', new apig.LambdaIntegration(usersLambda));

    updateUsers.addCorsPreflight({
      allowOrigins: ['*'],  // Allow all origins, adjust for production
      allowMethods: ['POST', 'GET', 'OPTIONS'],
    });

    usersLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:us-east-1:${process.env.CDK_DEFAULT_ACCOUNT}:${secrets.websocket_api_id}/prod/POST/@connections/{connectionId}`],
    }));

  }
}

module.exports = { CdkStack }
