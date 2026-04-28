const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const s3 = require('aws-cdk-lib/aws-s3');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const iam = require('aws-cdk-lib/aws-iam');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require('path');
const { Stack } = require('aws-cdk-lib');


class ImageStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // -----------------------------------------------------------------------
    // Import shared Lambda layers
    // -----------------------------------------------------------------------
    const importedBoto3Layer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'Boto3Layer', cdk.Fn.importValue('Boto3LayerVersionArn'));

    const importedRequestsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'RequestsLayer', cdk.Fn.importValue('RequestsLayerVersionArn'));

    const importedBs4Layer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'BS4Layer', cdk.Fn.importValue('BS4LayerVersionArn'));

    // -----------------------------------------------------------------------
    // Import DynamoDB tables and stream ARN
    // -----------------------------------------------------------------------
    const importedRestaurantTable = dynamodb.Table.fromTableArn(
      this, 'RestaurantTable', cdk.Fn.importValue('RestaurantTableExport'));

    const importedMenuItemsTable = dynamodb.Table.fromTableArn(
      this, 'MenuItemsTable', cdk.Fn.importValue('MenuItemsTableExport'));

    const restaurantStreamArn = cdk.Fn.importValue('RestaurantTableStreamArnExport');

    // -----------------------------------------------------------------------
    // S3 bucket — private, images served via CloudFront only
    // -----------------------------------------------------------------------
    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // -----------------------------------------------------------------------
    // CloudFront distribution with Origin Access Identity (OAI)
    // S3Origin automatically creates an OAI and grants CloudFront bucket access.
    // -----------------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'ImagesDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(imagesBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
      },
    });

    // -----------------------------------------------------------------------
    // ImageFetch Lambda
    // -----------------------------------------------------------------------
    const imageFetchLambda = new lambda.Function(this, 'ImageFetchLambda', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'image_fetch.lambda_handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      layers: [importedBoto3Layer, importedRequestsLayer],
      environment: {
        IMAGES_BUCKET:     imagesBucket.bucketName,
        CLOUDFRONT_URL:    distribution.distributionDomainName,
        CLAUDE_HAIKU:      'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        GOOGLE_API_KEY:    'AIzaSyCT_Ep05C1nDQphu5aMrGEu2glMI7H4IL4',
        RESTAURANT_TABLE:  'DdbStack-RestaurantTableBDE2029A-1QA3XQE9B836T',
        MENU_ITEMS_TABLE:  'DdbStack-MenuItemsTableBDB50838-124BTKBL895OK',
        FIRECRAWL_API_KEY: 'fc-a6a9f8011469447ea1ad5a672a64221b',
      },
    });

    // -----------------------------------------------------------------------
    // Permissions
    // -----------------------------------------------------------------------
    imagesBucket.grantWrite(imageFetchLambda);
    importedRestaurantTable.grantReadWriteData(imageFetchLambda);
    importedMenuItemsTable.grantReadWriteData(imageFetchLambda);

    // Bedrock: Claude Haiku 4.5 via cross-region inference profile
    imageFetchLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-haiku-4-5*',
      ],
    }));

    // DDB Stream read permissions
    imageFetchLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:DescribeStream',
        'dynamodb:ListStreams',
      ],
      resources: [restaurantStreamArn],
    }));

    // aws-marketplace actions are account-level and must use resource '*'
    imageFetchLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['aws-marketplace:ViewSubscriptions', 'aws-marketplace:Subscribe'],
      resources: ['*'],
    }));

    // -----------------------------------------------------------------------
    // DDB Stream Event Source Mapping — INSERT events only, batch size 1
    // -----------------------------------------------------------------------
    new lambda.EventSourceMapping(this, 'RestaurantStreamESM', {
      target: imageFetchLambda,
      eventSourceArn: restaurantStreamArn,
      startingPosition: lambda.StartingPosition.LATEST,
      filters: [
        lambda.FilterCriteria.filter({
          eventName: lambda.FilterRule.isEqual('INSERT'),
        }),
      ],
      batchSize: 1,
      bisectBatchOnError: true,
      retryAttempts: 2,
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, 'ImagesBucketName', {
      value: imagesBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'ImagesDistributionUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
  }
}

module.exports = { ImageStack };
