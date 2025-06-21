#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WeatherAlertSystemStack } from '../lib/weather-alert-system-stack';

const app = new cdk.App();
new WeatherAlertSystemStack(app, 'WeatherAlertSystemStack', {
  env: { region: 'eu-central-1' }  // or your desired region
});