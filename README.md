# 🌦️ Weather Alert System on AWS

This project is a fully serverless, scalable, and secure weather alert system built on AWS using the AWS CDK (TypeScript). It ingests real-time weather data, stores it in S3, transforms it into a star schema using Glue, and alerts subscribers via email for daily updates and severe weather conditions.

---

## 🚀 Features
- ✅ Real-time weather data ingestion via Lambda
- 📬 Email alerts using Amazon SES
- 🗺️ Auto-detects user's country via IP (ip-api.com)
- 📊 Dashboard-ready data stored in Athena-compatible format
- 🧠 Star-schema transformations via AWS Glue
- 📤 API Gateway for subscribe/unsubscribe
- 📁 S3 partitioned data lake
- ☁️ Fully defined infrastructure via AWS CDK (TypeScript)

---

## 📦 Architecture Overview
- **Lambda Functions**
  - `weather-fetcher`: Pulls weather data every 5 minutes
  - `daily-alert`: Sends daily summary emails
  - `severe-alert`: Sends high-priority alerts
  - `subscribe/unsubscribe`: Manages users via API Gateway

- **Data Storage**
  - Raw data → S3
  - Transformed data → partitioned star schema in S3
  - Subscriber info → DynamoDB

- **Transformation**
  - AWS Glue job with bookmarks to avoid duplicates
  - Output to `fact_weather`, `dim_time`, etc.

- **Analytics**
  - Queryable via Amazon Athena
  - Visualized via Amazon QuickSight

---

## 🛠 Setup Instructions

### 📁 Clone & Install
```bash
git clone https://github.com/maabbasa/weather-alert-system.git
cd weather-alert-system
npm install
```

### ⚙️ Configure AWS
```bash
aws configure
```
Make sure you have:
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- Region: us-east-1

### 🚀 Deploy to AWS
```bash
cdk bootstrap
cdk deploy
```

### 🌐 API Endpoints
After deployment, use Postman to test:
```http
POST /subscribe
POST /unsubscribe
```

---

## 🤖 CI/CD with GitHub Actions
This project includes `.github/workflows/deploy.yml`:
- Automatically deploys CDK stack on `git push`
- Uses GitHub secrets for AWS credentials

To activate:
1. Go to GitHub → Settings → Secrets → Actions
2. Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

---

## 🧪 Local Dev Tips
- Use **Postman** for API testing
- Use **Athena** to query weather data
- Use **QuickSight** for dashboard creation

---

## 📧 Email Templates
Found in `templates/`:
- `email_template.html`
- `email_template.txt`

---

## 🔐 Security Notes
- IAM roles limited to necessary access
- API tokens used for secure unsubscribe
- No hardcoded secrets

---

## 📍 Future Enhancements
- Add region-based filters in dashboards
- Add WAF to secure API Gateway
- Add retry logic and alert logging

---

## 👤 Author
Mohamed Abbas — [buildwithabbas.com](https://buildwithabbas.com)
