# IAM Roles and Policies for Wogi Flow Team Backend

# Lambda execution role
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-${var.environment}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-lambda-role"
  }
}

# Lambda basic execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# DynamoDB access policy for Lambda
resource "aws_iam_policy" "lambda_dynamodb" {
  name        = "${var.project_name}-${var.environment}-lambda-dynamodb"
  description = "Allow Lambda to access DynamoDB tables"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem"
        ]
        Resource = [
          aws_dynamodb_table.teams.arn,
          "${aws_dynamodb_table.teams.arn}/index/*",
          aws_dynamodb_table.team_members.arn,
          "${aws_dynamodb_table.team_members.arn}/index/*",
          aws_dynamodb_table.proposals.arn,
          "${aws_dynamodb_table.proposals.arn}/index/*",
          aws_dynamodb_table.shared_memory.arn,
          "${aws_dynamodb_table.shared_memory.arn}/index/*",
          aws_dynamodb_table.votes.arn,
          "${aws_dynamodb_table.votes.arn}/index/*",
          aws_dynamodb_table.activity_log.arn,
          "${aws_dynamodb_table.activity_log.arn}/index/*",
          aws_dynamodb_table.memory_metrics.arn,
          "${aws_dynamodb_table.memory_metrics.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

# S3 access policy for Lambda
resource "aws_iam_policy" "lambda_s3" {
  name        = "${var.project_name}-${var.environment}-lambda-s3"
  description = "Allow Lambda to access S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_execution.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}
