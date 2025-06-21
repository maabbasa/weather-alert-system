import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export class WeatherAlertSystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Buckets
    const rawBucket = new s3.Bucket(this, 'RawWeatherDataBucket');
    const starBucket = new s3.Bucket(this, 'StarSchemaWeatherBucket');

    // DynamoDB
    const subscriberTable = new dynamodb.Table(this, 'Subscribers', {
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    // IAM Role for Lambda
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });
    subscriberTable.grantReadWriteData(lambdaRole);
    rawBucket.grantReadWrite(lambdaRole);
    starBucket.grantReadWrite(lambdaRole);

    // Common Lambda props
    const lambdaProps = {
      runtime: lambda.Runtime.PYTHON_3_11,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      role: lambdaRole,
    };

    // Lambda Functions
    const weatherFetcher = new lambda.Function(this, 'WeatherFetcherFunction', {
      ...lambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/weather-fetcher')
    });

    const dailyAlert = new lambda.Function(this, 'DailyAlertFunction', {
      ...lambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/daily-alert')
    });

    const severeAlert = new lambda.Function(this, 'SevereAlertFunction', {
      ...lambdaProps,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/severe-alert')
    });

    const subscribeFn = new lambda.Function(this, 'SubscribeFunction', {
      ...lambdaProps,
      handler: 'subscribe.handler',
      code: lambda.Code.fromAsset('lambda/subscription')
    });

    const unsubscribeFn = new lambda.Function(this, 'UnsubscribeFunction', {
      ...lambdaProps,
      handler: 'unsubscribe.handler',
      code: lambda.Code.fromAsset('lambda/subscription')
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'SubscriptionApi');
    const subscribe = api.root.addResource('subscribe');
    subscribe.addMethod('POST', new apigateway.LambdaIntegration(subscribeFn));
    const unsubscribe = api.root.addResource('unsubscribe');
    unsubscribe.addMethod('POST', new apigateway.LambdaIntegration(unsubscribeFn));

    // EventBridge Schedule
    new events.Rule(this, 'WeatherFetchSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(weatherFetcher)]
    });

    new events.Rule(this, 'DailyAlertSchedule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
      targets: [new targets.LambdaFunction(dailyAlert)]
    });

    new events.Rule(this, 'SevereAlertSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(severeAlert)]
    });

    // Glue Crawler & Job setup placeholder (manual script upload assumed)
    new cdk.CfnOutput(this, 'RawDataBucketName', { value: rawBucket.bucketName });
    new cdk.CfnOutput(this, 'StarSchemaBucketName', { value: starBucket.bucketName });
    new cdk.CfnOutput(this, 'API Endpoint', { value: api.url });
  }
}
