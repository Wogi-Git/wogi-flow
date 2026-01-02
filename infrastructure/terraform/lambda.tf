# Lambda Functions for Wogi Flow Team Backend

# Lambda packages - built from infrastructure/lambda/
locals {
  lambda_dir = "${path.module}/../lambda/dist"
}

# Teams API Lambda
resource "aws_lambda_function" "teams_api" {
  function_name = "${var.project_name}-${var.environment}-teams-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = "${local.lambda_dir}/teams.zip"
  source_code_hash = filebase64sha256("${local.lambda_dir}/teams.zip")

  environment {
    variables = {
      TEAMS_TABLE         = aws_dynamodb_table.teams.name
      TEAM_MEMBERS_TABLE  = aws_dynamodb_table.team_members.name
      ENVIRONMENT         = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-teams-api"
  }
}

# Proposals API Lambda
resource "aws_lambda_function" "proposals_api" {
  function_name = "${var.project_name}-${var.environment}-proposals-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = "${local.lambda_dir}/proposals.zip"
  source_code_hash = filebase64sha256("${local.lambda_dir}/proposals.zip")

  environment {
    variables = {
      PROPOSALS_TABLE = aws_dynamodb_table.proposals.name
      VOTES_TABLE     = aws_dynamodb_table.votes.name
      TEAMS_TABLE     = aws_dynamodb_table.teams.name
      ENVIRONMENT     = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-proposals-api"
  }
}

# Memory Sync API Lambda
resource "aws_lambda_function" "memory_api" {
  function_name = "${var.project_name}-${var.environment}-memory-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = "${local.lambda_dir}/memory.zip"
  source_code_hash = filebase64sha256("${local.lambda_dir}/memory.zip")

  environment {
    variables = {
      SHARED_MEMORY_TABLE = aws_dynamodb_table.shared_memory.name
      MEMORY_METRICS_TABLE = aws_dynamodb_table.memory_metrics.name
      TEAMS_TABLE         = aws_dynamodb_table.teams.name
      S3_BUCKET           = aws_s3_bucket.artifacts.id
      ENVIRONMENT         = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-memory-api"
  }
}

# Activity API Lambda
resource "aws_lambda_function" "activity_api" {
  function_name = "${var.project_name}-${var.environment}-activity-api"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "index.handler"
  runtime       = var.lambda_runtime
  memory_size   = var.lambda_memory_size
  timeout       = var.lambda_timeout

  filename         = "${local.lambda_dir}/activity.zip"
  source_code_hash = filebase64sha256("${local.lambda_dir}/activity.zip")

  environment {
    variables = {
      ACTIVITY_LOG_TABLE = aws_dynamodb_table.activity_log.name
      TEAMS_TABLE        = aws_dynamodb_table.teams.name
      ENVIRONMENT        = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-activity-api"
  }
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "teams_api" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.teams_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "proposals_api" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.proposals_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "memory_api" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.memory_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "activity_api" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.activity_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
