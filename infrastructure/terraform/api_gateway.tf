# API Gateway for Wogi Flow Team Backend

# HTTP API (API Gateway v2)
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-${var.environment}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = true
    allow_headers     = ["Content-Type", "Authorization", "X-Team-Id"]
    allow_methods     = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_origins     = ["http://localhost:3000", "https://app.wogi-flow.dev", "https://wogi-flow.dev"]
    max_age           = 3600
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

# API Stage
resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.api_stage_name
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId         = "$context.requestId"
      ip                = "$context.identity.sourceIp"
      requestTime       = "$context.requestTime"
      httpMethod        = "$context.httpMethod"
      routeKey          = "$context.routeKey"
      status            = "$context.status"
      responseLength    = "$context.responseLength"
      integrationError  = "$context.integrationErrorMessage"
    })
  }

  default_route_settings {
    throttling_burst_limit = 100
    throttling_rate_limit  = 50
  }

  tags = {
    Name = "${var.project_name}-api-stage"
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-api-logs"
  }
}

# JWT Authorizer (Cognito)
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.main.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
  }
}

# ============================================================
# Teams Routes
# ============================================================

resource "aws_apigatewayv2_integration" "teams" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.teams_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "teams_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_update" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "PUT /teams/{teamId}"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_delete" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "DELETE /teams/{teamId}"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_members" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/members"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "teams_invite" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/invite"
  target             = "integrations/${aws_apigatewayv2_integration.teams.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================================
# Proposals Routes
# ============================================================

resource "aws_apigatewayv2_integration" "proposals" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.proposals_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "proposals_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/proposals"
  target             = "integrations/${aws_apigatewayv2_integration.proposals.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "proposals_create" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/proposals"
  target             = "integrations/${aws_apigatewayv2_integration.proposals.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "proposals_get" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/proposals/{proposalId}"
  target             = "integrations/${aws_apigatewayv2_integration.proposals.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "proposals_vote" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/proposals/{proposalId}/vote"
  target             = "integrations/${aws_apigatewayv2_integration.proposals.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "proposals_decide" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/proposals/{proposalId}/decide"
  target             = "integrations/${aws_apigatewayv2_integration.proposals.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================================
# Memory Routes
# ============================================================

resource "aws_apigatewayv2_integration" "memory" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.memory_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "memory_sync" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/memory/sync"
  target             = "integrations/${aws_apigatewayv2_integration.memory.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "memory_pull" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/memory"
  target             = "integrations/${aws_apigatewayv2_integration.memory.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "memory_push" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/memory"
  target             = "integrations/${aws_apigatewayv2_integration.memory.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "memory_metrics" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/memory/metrics"
  target             = "integrations/${aws_apigatewayv2_integration.memory.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ============================================================
# Activity Routes
# ============================================================

resource "aws_apigatewayv2_integration" "activity" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.activity_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "activity_list" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "GET /teams/{teamId}/activity"
  target             = "integrations/${aws_apigatewayv2_integration.activity.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "activity_log" {
  api_id             = aws_apigatewayv2_api.main.id
  route_key          = "POST /teams/{teamId}/activity"
  target             = "integrations/${aws_apigatewayv2_integration.activity.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
