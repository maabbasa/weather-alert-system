import json
import boto3
import urllib.request
import datetime
import os

s3 = boto3.client('s3')


def handler(event, context):
    now = datetime.datetime.utcnow()
    timestamp = now.strftime('%Y-%m-%dT%H:%M:%SZ')

    url = f"https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true"
    response = urllib.request.urlopen(url)
    data = json.loads(response.read())

    bucket = os.environ.get("RAW_BUCKET_NAME", "replace-me")
    key = f"weather/{now.strftime('%Y/%m/%d/%H%M%S')}.json"

    s3.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps({
            "timestamp": timestamp,
            "data": data
        }),
        ContentType='application/json'
    )

    return {
        "statusCode": 200,
        "body": json.dumps({"message": "Weather data saved", "key": key})
    }
