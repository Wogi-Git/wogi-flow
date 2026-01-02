# Wogi Flow Team Backend Infrastructure

AWS infrastructure for the Wogi Flow team collaboration features.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Wogi Flow CLI                             │
│                    (Local Development)                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (HTTP)                          │
│                     /{stage}/teams/*                             │
│                     /{stage}/proposals/*                         │
│                     /{stage}/memory/*                            │
│                     /{stage}/activity/*                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│  Cognito JWT     │ │    Lambda       │ │    CloudWatch    │
│  Authorizer      │ │    Functions    │ │    Logs          │
└──────────────────┘ └────────┬────────┘ └──────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
┌──────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│    DynamoDB      │ │       S3        │ │    Cognito       │
│    Tables        │ │    Artifacts    │ │    User Pool     │
└──────────────────┘ └─────────────────┘ └──────────────────┘
```

## Components

### DynamoDB Tables

| Table | Purpose |
|-------|---------|
| `teams` | Team information and settings |
| `team-members` | Team membership and roles |
| `proposals` | Team rule/pattern proposals |
| `votes` | Proposal votes |
| `shared-memory` | Promoted facts and patterns |
| `activity-log` | Team activity history |
| `memory-metrics` | Memory health metrics |

### Lambda Functions

| Function | Purpose |
|----------|---------|
| `teams-api` | Team CRUD and member management |
| `proposals-api` | Proposal lifecycle and voting |
| `memory-api` | Shared memory sync |
| `activity-api` | Activity logging |

### API Endpoints

```
Teams:
  GET    /teams                     - List user's teams
  POST   /teams                     - Create team
  GET    /teams/{id}                - Get team details
  PUT    /teams/{id}                - Update team
  DELETE /teams/{id}                - Delete team
  GET    /teams/{id}/members        - List members
  POST   /teams/{id}/invite         - Invite member

Proposals:
  GET    /teams/{id}/proposals      - List proposals
  POST   /teams/{id}/proposals      - Create proposal
  GET    /teams/{id}/proposals/{id} - Get proposal
  POST   /teams/{id}/proposals/{id}/vote   - Vote
  POST   /teams/{id}/proposals/{id}/decide - Admin decision

Memory:
  GET    /teams/{id}/memory         - Pull shared facts
  POST   /teams/{id}/memory         - Push facts
  POST   /teams/{id}/memory/sync    - Full sync
  GET    /teams/{id}/memory/metrics - Get metrics

Activity:
  GET    /teams/{id}/activity       - List activity
  POST   /teams/{id}/activity       - Log activity
```

## Prerequisites

1. **AWS CLI** installed and configured
2. **Terraform** >= 1.0
3. **Node.js** >= 18.x (for Lambda development)

## Deployment

### 1. Configure AWS Credentials

```bash
aws configure
# Enter: Access Key ID, Secret Key, Region (eu-west-1)
```

### 2. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 3. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings
```

### 4. Plan and Apply

```bash
# Preview changes
terraform plan

# Apply (creates all resources)
terraform apply
```

### 5. Get Outputs

```bash
terraform output

# Get CLI config snippet
terraform output -json cli_config | jq -r .
```

### 6. Update wogi-flow Config

Add the outputs to your `.workflow/config.json`:

```json
{
  "team": {
    "apiEndpoint": "https://xxx.execute-api.eu-west-1.amazonaws.com/v1",
    "cognitoUserPool": "eu-west-1_xxxxx",
    "cognitoClientId": "xxxxxxxxxx",
    "cognitoDomain": "https://wogi-flow-dev-xxx.auth.eu-west-1.amazoncognito.com"
  }
}
```

## Updating Lambda Code

### Package Lambda Functions

```bash
cd infrastructure/lambda

# Install dependencies (first time)
npm install

# Create deployment packages
mkdir -p dist

# Copy shared utils to each function
for fn in teams proposals memory activity; do
  cp -r shared $fn/
  cd $fn && zip -r ../dist/$fn.zip . && cd ..
done
```

### Deploy Updates

```bash
cd infrastructure/terraform

# Update Lambda code
terraform apply -target=aws_lambda_function.teams_api
terraform apply -target=aws_lambda_function.proposals_api
terraform apply -target=aws_lambda_function.memory_api
terraform apply -target=aws_lambda_function.activity_api
```

## Environments

Use Terraform workspaces for multiple environments:

```bash
# Create staging environment
terraform workspace new staging
terraform apply -var="environment=staging"

# Switch to production
terraform workspace new prod
terraform apply -var="environment=prod"

# List workspaces
terraform workspace list
```

## Costs

Estimated monthly costs (PAY_PER_REQUEST pricing):

| Resource | Estimated Cost |
|----------|---------------|
| DynamoDB | $0-5 (low traffic) |
| Lambda | $0-2 (pay per invocation) |
| API Gateway | $0-3 (1M requests = $1) |
| S3 | $0-1 (storage) |
| Cognito | $0 (up to 50k users free) |
| **Total** | **$0-15/month** (typical dev usage) |

## Security

- All endpoints require JWT authentication via Cognito
- S3 bucket blocks public access
- DynamoDB encrypted at rest
- All traffic over HTTPS
- Point-in-time recovery enabled on DynamoDB

## Cleanup

```bash
# Destroy all resources (IRREVERSIBLE!)
terraform destroy
```

## Troubleshooting

### Lambda Errors

```bash
# View recent logs
aws logs tail /aws/lambda/wogi-flow-dev-teams-api --follow
```

### API Gateway Issues

```bash
# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://xxx.execute-api.eu-west-1.amazonaws.com/v1/teams
```

### DynamoDB Issues

```bash
# Scan table
aws dynamodb scan --table-name wogi-flow-dev-teams
```
