const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const tasks = require('aws-cdk-lib/aws-stepfunctions-tasks');
const stepfunctions = require('aws-cdk-lib/aws-stepfunctions');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require('path');
const Construct = require('constructs');
const { Stack, Duration } = require('aws-cdk-lib');
const secrets = require('../secrets.json');


class RagStack extends cdk.Stack {
  /**
   *
   * @param {Construct} scope
   * @param {string} id
   * @param {StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

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
        const importedOpenSearchLayer = lambda.LayerVersion.fromLayerVersionArn(
          this,
          'OpenSearchLayer',
          cdk.Fn.importValue('OpenSearchLayerVersionArn') // Import by export name
        );

        // Import the Lambda Layer from another stack using its exported ARN
        const importedDotenvLayer = lambda.LayerVersion.fromLayerVersionArn(
            this,
            'dotenv_layer',
            cdk.Fn.importValue('DotenvLayerVersionArn') // Import by export name
        );

        // Import the Lambda Layer from another stack using its exported ARN
        const importedPdfReaderLayer = lambda.LayerVersion.fromLayerVersionArn(
            this,
            'PdfReaderLayer',
            cdk.Fn.importValue('PdfReaderLayerVersionArn') // Import by export name
        );

        const chunkDataLambda = new lambda.Function(this, 'ChunkDataLambda', {
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'chunk_data.chunk_data',
          code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu/rag')),
          timeout: Duration.minutes(15),
          memory: 10240,
          layers: [ importedBoto3Layer, importedRequestsLayer ],
        });

        const embedVectorizeLambda = new lambda.Function(this, 'EmbedVectorizeLambda', {
          runtime: lambda.Runtime.PYTHON_3_12,
          handler: 'embed_vectorize.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu/rag')),
          timeout: Duration.minutes(15),
          memory: 10240,
          environment: {
            'OPENSEARCH_ENDPOINT': secrets.opensearch_endpoint,
          },
          layers: [ importedBoto3Layer, importedRequestsLayer, importedDotenvLayer, importedOpenSearchLayer, importedPdfReaderLayer ],
        });

        embedVectorizeLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0'],
        }));

        embedVectorizeLambda.addToRolePolicy(new iam.PolicyStatement({
            actions: ["aoss:APIAccessAll",
                "aoss:CreateIndex",
                "aoss:UpdateIndex",
                "aoss:DeleteIndex",
                "aoss:GetIndex"],
            resources: "*",
        }));

        // Create Lambda invoke permissions for Step Functions
        const lambdaInvokeRole = new iam.Role(this, 'LambdaInvokeRole', {
          assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
        });
    
        lambdaInvokeRole.addToPolicy(new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction', ],
          resources: [chunkDataLambda.functionArn, embedVectorizeLambda.functionArn],
        }));
    
        const chunkDataLambdaTask = new tasks.LambdaInvoke(this, 'Invoke data chunking lambda', {
          lambdaFunction: chunkDataLambda,
          inputPath: '$',           // Pass the input from the previous Lambda
          outputPath: '$.Payload',
        });
        
        const embedVectorizeLambdaTask = new tasks.LambdaInvoke(this, 'Invoke embedding and vectorization lambda', {
          lambdaFunction: embedVectorizeLambda,
          inputPath: '$',           // Pass the input from the previous Lambda
          outputPath: '$.Payload',
        });
    
        // const definition = chunkDataLambdaTask
        //     .next(embedVectorizeLambdaTask);

        const definition = embedVectorizeLambdaTask;
    
        // Create the Step Function state machine
        new stepfunctions.StateMachine(this, 'RagStepFunction', {
          definition,
          timeout: cdk.Duration.minutes(16),  // Optional: Specify a timeout
          role: lambdaInvokeRole,            // Attach the role with permissions to invoke Lambdas
        });
    }
}

module.exports = { RagStack }