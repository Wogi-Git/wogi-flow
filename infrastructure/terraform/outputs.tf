# Outputs for Wogi Flow Team Backend

# ============================================================
# API Gateway
# ============================================================

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_id" {
  description = "API Gateway ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_stage_url" {
  description = "Full API URL with stage"
  value       = "${aws_apigatewayv2_api.main.api_endpoint}/${var.api_stage_name}"
}

# ============================================================
# Cognito
# ============================================================

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "Cognito App Client ID"
  value       = aws_cognito_user_pool_client.main.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
}

output "cognito_issuer" {
  description = "Cognito JWT issuer URL"
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

# ============================================================
# DynamoDB Tables
# ============================================================

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    teams          = aws_dynamodb_table.teams.name
    team_members   = aws_dynamodb_table.team_members.name
    proposals      = aws_dynamodb_table.proposals.name
    shared_memory  = aws_dynamodb_table.shared_memory.name
    votes          = aws_dynamodb_table.votes.name
    activity_log   = aws_dynamodb_table.activity_log.name
    memory_metrics = aws_dynamodb_table.memory_metrics.name
  }
}

# ============================================================
# Lambda Functions
# ============================================================

output "lambda_functions" {
  description = "Lambda function names"
  value = {
    teams     = aws_lambda_function.teams_api.function_name
    proposals = aws_lambda_function.proposals_api.function_name
    memory    = aws_lambda_function.memory_api.function_name
    activity  = aws_lambda_function.activity_api.function_name
  }
}

# ============================================================
# S3 Bucket
# ============================================================

output "s3_bucket" {
  description = "S3 bucket name for artifacts"
  value       = aws_s3_bucket.artifacts.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.artifacts.arn
}

# ============================================================
# Configuration for CLI
# ============================================================

output "cli_config" {
  description = "Configuration snippet for wogi-flow CLI"
  value = jsonencode({
    team = {
      apiEndpoint      = "${aws_apigatewayv2_api.main.api_endpoint}/${var.api_stage_name}"
      region           = var.aws_region
      cognitoUserPool  = aws_cognito_user_pool.main.id
      cognitoClientId  = aws_cognito_user_pool_client.main.id
      cognitoDomain    = "https://${aws_cognito_user_pool_domain.main.domain}.auth.${var.aws_region}.amazoncognito.com"
    }
  })
  sensitive = false
}
