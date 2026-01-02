# Cognito User Pool for Wogi Flow Team Backend

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}-users"

  # Username attributes
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # User attributes
  schema {
    name                     = "name"
    attribute_data_type      = "String"
    mutable                  = true
    required                 = true
    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # Verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Wogi Flow - Verify your email"
    email_message        = "Your verification code is: {####}"
  }

  # MFA configuration
  mfa_configuration = "OFF"

  # Admin create user config
  admin_create_user_config {
    allow_admin_create_user_only = false

    invite_message_template {
      email_subject = "Welcome to Wogi Flow"
      email_message = "Hello {username}, your temporary password is {####}"
      sms_message   = "Hello {username}, your temporary password is {####}"
    }
  }

  # User pool add-ons
  user_pool_add_ons {
    advanced_security_mode = "OFF"
  }

  tags = {
    Name = "${var.project_name}-users"
  }
}

# User Pool Client
resource "aws_cognito_user_pool_client" "main" {
  name         = "${var.project_name}-${var.environment}-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # OAuth configuration
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  callback_urls                        = var.cognito_callback_urls
  logout_urls                          = var.cognito_logout_urls
  supported_identity_providers         = ["COGNITO"]

  # Token configuration
  access_token_validity  = 1    # hours
  id_token_validity      = 1    # hours
  refresh_token_validity = 30   # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Auth flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"

  # Read/write attributes
  read_attributes = [
    "email",
    "name",
    "email_verified"
  ]

  write_attributes = [
    "email",
    "name"
  ]
}

# User Pool Domain
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}-${data.aws_caller_identity.current.account_id}"
  user_pool_id = aws_cognito_user_pool.main.id
}

# Resource Server (for custom scopes if needed later)
resource "aws_cognito_resource_server" "main" {
  identifier   = "wogi-flow-api"
  name         = "Wogi Flow API"
  user_pool_id = aws_cognito_user_pool.main.id

  scope {
    scope_name        = "teams.read"
    scope_description = "Read team data"
  }

  scope {
    scope_name        = "teams.write"
    scope_description = "Modify team data"
  }

  scope {
    scope_name        = "memory.read"
    scope_description = "Read shared memory"
  }

  scope {
    scope_name        = "memory.write"
    scope_description = "Write shared memory"
  }
}
