"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherAlertSystemStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const path = __importStar(require("path"));
class WeatherAlertSystemStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, {
            ...props,
            env: { region: 'us-east-1' }
        });
        // Buckets
        const rawBucket = new s3.Bucket(this, 'RawWeatherData');
        const starBucket = new s3.Bucket(this, 'StarSchemaData');
        // DynamoDB
        const table = new dynamodb.Table(this, 'Subscribers', {
            partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
        });
        // Common Lambda props
        const commonLambdaProps = {
            runtime: lambda.Runtime.PYTHON_3_11,
            timeout: cdk.Duration.seconds(30),
            environment: {
                RAW_BUCKET_NAME: rawBucket.bucketName,
                TABLE_NAME: table.tableName,
                SENDER_EMAIL: 'mohamed.abbas@buildwithabbas.com',
            },
        };
        // Lambda: weather-fetcher
        const weatherFetcher = new lambda.Function(this, 'WeatherFetcher', {
            ...commonLambdaProps,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/weather-fetcher')),
        });
        rawBucket.grantPut(weatherFetcher);
        // Lambda: daily-alert
        const dailyAlert = new lambda.Function(this, 'DailyAlert', {
            ...commonLambdaProps,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/daily-alert')),
        });
        // Lambda: severe-alert
        const severeAlert = new lambda.Function(this, 'SevereAlert', {
            ...commonLambdaProps,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/severe-alert')),
        });
        // Lambda: subscribe
        const subscribe = new lambda.Function(this, 'SubscribeUser', {
            ...commonLambdaProps,
            handler: 'subscribe.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/subscription')),
        });
        // Lambda: unsubscribe
        const unsubscribe = new lambda.Function(this, 'UnsubscribeUser', {
            ...commonLambdaProps,
            handler: 'unsubscribe.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/subscription')),
        });
        // Permissions
        rawBucket.grantReadWrite(weatherFetcher);
        table.grantReadWriteData(subscribe);
        table.grantReadWriteData(unsubscribe);
        table.grantReadData(dailyAlert);
        table.grantReadData(severeAlert);
        [dailyAlert, severeAlert].forEach(fn => {
            fn.addToRolePolicy(new iam.PolicyStatement({
                actions: ['ses:SendEmail', 'ses:SendRawEmail'],
                resources: ['*'],
            }));
        });
        // API Gateway
        const api = new apigateway.RestApi(this, 'WeatherApi');
        const subscribeResource = api.root.addResource('subscribe');
        const unsubscribeResource = api.root.addResource('unsubscribe');
        subscribeResource.addMethod('POST', new apigateway.LambdaIntegration(subscribe));
        unsubscribeResource.addMethod('POST', new apigateway.LambdaIntegration(unsubscribe));
        // Schedules
        new events.Rule(this, 'DailyAlertSchedule', {
            schedule: events.Schedule.cron({ minute: '0', hour: '6' }),
            targets: [new targets.LambdaFunction(dailyAlert)]
        });
        new events.Rule(this, 'SevereAlertSchedule', {
            schedule: events.Schedule.rate(cdk.Duration.hours(1)),
            targets: [new targets.LambdaFunction(severeAlert)]
        });
        new events.Rule(this, 'WeatherFetcherSchedule', {
            schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
            targets: [new targets.LambdaFunction(weatherFetcher)]
        });
        // Outputs
        new cdk.CfnOutput(this, 'RawDataBucketName', { value: rawBucket.bucketName });
        new cdk.CfnOutput(this, 'StarSchemaBucketName', { value: starBucket.bucketName });
        new cdk.CfnOutput(this, 'APIEndpoint', { value: api.url });
    }
}
exports.WeatherAlertSystemStack = WeatherAlertSystemStack;
