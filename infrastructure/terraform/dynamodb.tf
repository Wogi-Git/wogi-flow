# DynamoDB Tables for Wogi Flow Team Backend

# Teams table - stores team information
resource "aws_dynamodb_table" "teams" {
  name         = "${var.project_name}-${var.environment}-teams"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "ownerEmail"
    type = "S"
  }

  global_secondary_index {
    name            = "owner-index"
    hash_key        = "ownerEmail"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-teams"
  }
}

# Team members table - stores team membership
resource "aws_dynamodb_table" "team_members" {
  name         = "${var.project_name}-${var.environment}-team-members"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"
  range_key    = "userId"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "user-teams-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-team-members"
  }
}

# Proposals table - stores team proposals (rules, patterns)
resource "aws_dynamodb_table" "proposals" {
  name         = "${var.project_name}-${var.environment}-proposals"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"
  range_key    = "proposalId"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "proposalId"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "status-index"
    hash_key        = "teamId"
    range_key       = "status"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "created-index"
    hash_key        = "teamId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-proposals"
  }
}

# Shared memory table - stores promoted facts/patterns
resource "aws_dynamodb_table" "shared_memory" {
  name         = "${var.project_name}-${var.environment}-shared-memory"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"
  range_key    = "factId"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "factId"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "relevanceScore"
    type = "N"
  }

  global_secondary_index {
    name            = "category-index"
    hash_key        = "teamId"
    range_key       = "category"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "relevance-index"
    hash_key        = "teamId"
    range_key       = "relevanceScore"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-shared-memory"
  }
}

# Votes table - stores proposal votes
resource "aws_dynamodb_table" "votes" {
  name         = "${var.project_name}-${var.environment}-votes"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "proposalId"
  range_key    = "userId"

  attribute {
    name = "proposalId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-votes"
  }
}

# Activity log table - stores team activity
resource "aws_dynamodb_table" "activity_log" {
  name         = "${var.project_name}-${var.environment}-activity-log"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"
  range_key    = "timestamp"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "user-activity-index"
    hash_key        = "userId"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-activity-log"
  }
}

# Memory metrics table - stores aggregated memory health metrics
resource "aws_dynamodb_table" "memory_metrics" {
  name         = "${var.project_name}-${var.environment}-memory-metrics"
  billing_mode = var.dynamodb_billing_mode
  hash_key     = "teamId"
  range_key    = "timestamp"

  attribute {
    name = "teamId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.project_name}-memory-metrics"
  }
}
