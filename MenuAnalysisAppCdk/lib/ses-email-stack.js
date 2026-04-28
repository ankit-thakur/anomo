const cdk = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const ses = require('aws-cdk-lib/aws-ses');
const iam = require('aws-cdk-lib/aws-iam');
const apig = require('aws-cdk-lib/aws-apigateway');
const { Stack, Duration } = require('aws-cdk-lib');
const path = require('path');


class SesEmailStack extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);

        const senderEmail = 'ankitthakur78701@gmail.com';

        new ses.EmailIdentity(this, 'EmailIdentity', {
            identity: ses.Identity.email(senderEmail),
        });
    
        // ✅ 2. Lambda function to send email
        const sendEmailFunction = new lambda.Function(this, 'SendEmailFunction', {
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: 'send_email.send_email_handler',
            timeout: Duration.minutes(15),
            code: lambda.Code.fromAsset(path.join(__dirname, '../../MenuAnalysisAppServer/lambdas/menu')),
            environment: {
                SENDER_EMAIL: senderEmail,
            },
        });
    
        // ✅ 3. Grant permissions to SES
        sendEmailFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['ses:SendEmail', 'ses:SendRawEmail'],
                resources: ['*'], // You can restrict this if desired
            })
        );

        const sendEmailApi = new apig.LambdaRestApi(this, 'SendEmailApi', {
            handler: sendEmailFunction,
            proxy: false,
        });
        
        const sendEmailApiId = sendEmailApi.root.addResource('sendEmail');
        sendEmailApiId.addMethod('POST');
        sendEmailApiId.addCorsPreflight({
            allowOrigins: ['*'],  // Allow all origins, adjust for production
            allowMethods: ['POST', 'GET', 'OPTIONS'],
        });
    }
}

module.exports = { SesEmailStack }