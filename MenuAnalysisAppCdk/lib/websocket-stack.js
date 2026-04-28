const cdk = require('aws-cdk-lib');
const { Stack, StackProps } = require('aws-cdk-lib');
const { WebSocketApi, WebSocketStage } = require('@aws-cdk/aws-apigatewayv2-alpha');
const { WebSocketLambdaIntegration } = require('@aws-cdk/aws-apigatewayv2-integrations-alpha');
const lambda = require('aws-cdk-lib/aws-lambda');
const iam = require('aws-cdk-lib/aws-iam');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const path = require('path');


class WebSocketApiStack extends Stack {
    /**
     *
     * @param {Construct} scope
     * @param {string} id
     * @param {StackProps=} props
     */
    constructor(scope, id, props) {
        super(scope, id, props);

        // Import the Lambda Layer from another stack using its exported ARN
        const importedConnectionIdTable = dynamodb.Table.fromTableArn(
            this,
            'ConnectionIdTable',
            cdk.Fn.importValue('ConnectionIdTableExport') // Import by export name
        );

        // Lambda function for WebSocket message handling
        const messageHandler = new lambda.Function(this, 'MessageHandler', {
        runtime: lambda.Runtime.PYTHON_3_12,
        code: lambda.Code.fromAsset(path.resolve(__dirname, '../../MenuAnalysisAppServer/lambdas/websocket')),
        handler: 'message_handler.message_handler',
        });

        messageHandler.addToRolePolicy(new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: ['arn:aws:execute-api:us-east-1:022941184721:djh0fnzlrc/prod/POST/@connections/*']
        }));

        // Lambda function for handling WebSocket connection lifecycle
        const connectionHandler = new lambda.Function(this, 'ConnectionHandler', {
            runtime: lambda.Runtime.PYTHON_3_12,
            code: lambda.Code.fromAsset(path.resolve(__dirname, '../../MenuAnalysisAppServer/lambdas/websocket')),
            handler: 'connectionHandler.connectionHandler',
        });

        importedConnectionIdTable.grantReadWriteData(messageHandler);

        // Create WebSocket API
        const webSocketApi = new WebSocketApi(this, 'WebSocketApi', {
            connectRouteOptions: { integration: new WebSocketLambdaIntegration('ConnectIntegration', connectionHandler) },
            disconnectRouteOptions: { integration: new WebSocketLambdaIntegration('DisconnectIntegration', connectionHandler) },
            defaultRouteOptions: { integration: new WebSocketLambdaIntegration('MessageIntegration', messageHandler) },
        });

        // WebSocket API stage
        new WebSocketStage(this, 'ProdStage', {
            webSocketApi,
            stageName: 'prod',
            autoDeploy: true,
        });
    }
}

module.exports = { WebSocketApiStack }
