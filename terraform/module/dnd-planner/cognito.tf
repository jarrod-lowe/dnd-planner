resource "aws_cognito_user_pool" "cognito" {
  name                = local.resource_prefix
  user_pool_tier      = "ESSENTIALS"
  username_attributes = ["email"]

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 20
    require_lowercase                = false
    require_uppercase                = false
    require_numbers                  = false
    require_symbols                  = false
    temporary_password_validity_days = 7
  }

  lambda_config {
    post_confirmation = module.post_confirmation.arn
  }
}

resource "aws_cognito_user_group" "may_create_characters" {
  user_pool_id = aws_cognito_user_pool.cognito.id
  name         = "MayCreateCharacters"
  description  = "Users who can create characters"
}

resource "aws_cognito_user_pool_client" "cognito" {
  name                                 = local.resource_prefix
  user_pool_id                         = aws_cognito_user_pool.cognito.id
  generate_secret                      = false
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_USER_SRP_AUTH"]
  allowed_oauth_flows_user_pool_client = true
  callback_urls                        = ["http://localhost:5173/auth/callback", "http://localhost:5174/auth/callback", "http://localhost:5173/auth/callback.html", "http://localhost:5174/auth/callback.html", "https://${local.cdn_domain_name}/auth/callback.html"]
  logout_urls                          = ["http://localhost:5173/", "http://localhost:5174/", "https://${local.cdn_domain_name}/"]
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "aws.cognito.signin.user.admin"]
  supported_identity_providers         = ["COGNITO"]
}

resource "aws_cognito_identity_pool" "cognito" {
  identity_pool_name               = local.resource_prefix
  allow_unauthenticated_identities = true
  allow_classic_flow               = false

  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.cognito.id
    provider_name           = "cognito-idp.${data.aws_region.current.id}.${data.aws_partition.current.dns_suffix}/${aws_cognito_user_pool.cognito.id}"
    server_side_token_check = true
  }
}

resource "aws_cognito_identity_pool_roles_attachment" "cognito" {
  identity_pool_id = aws_cognito_identity_pool.cognito.id
  roles = {
    "authenticated"   = aws_iam_role.cognito.arn
    "unauthenticated" = aws_iam_role.cognito_unauth.arn
  }
}

resource "aws_iam_role" "cognito" {
  name               = "${local.resource_prefix}-user"
  assume_role_policy = data.aws_iam_policy_document.cognito_assume.json
}

data "aws_iam_policy_document" "cognito_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.${data.aws_partition.current.dns_suffix}"]
    }
    condition {
      test     = "StringEquals"
      variable = "cognito-identity.${data.aws_partition.current.dns_suffix}:aud"
      values   = [aws_cognito_identity_pool.cognito.id]
    }
    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.${data.aws_partition.current.dns_suffix}:amr"
      values   = ["authenticated"]
    }
  }
}

resource "aws_iam_policy" "cognito" {
  name   = "${local.resource_prefix}-user"
  policy = data.aws_iam_policy_document.cognito.json
}

data "aws_iam_policy_document" "cognito" {
  statement {
    actions = [
      "cognito-identity:GetCredentialsForIdentity",
    ]
    resources = ["*"] # checkov:skip=CKV_AWS_107:Has to be wildcard
  }
}

resource "aws_iam_role_policy_attachment" "cognito" {
  role       = aws_iam_role.cognito.name
  policy_arn = aws_iam_policy.cognito.arn
}

# Unauthenticated role with minimal permissions
resource "aws_iam_role" "cognito_unauth" {
  name               = "${local.resource_prefix}-unauth"
  assume_role_policy = data.aws_iam_policy_document.cognito_unauth_assume.json
}

data "aws_iam_policy_document" "cognito_unauth_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.${data.aws_partition.current.dns_suffix}"]
    }
    condition {
      test     = "StringEquals"
      variable = "cognito-identity.${data.aws_partition.current.dns_suffix}:aud"
      values   = [aws_cognito_identity_pool.cognito.id]
    }
    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.${data.aws_partition.current.dns_suffix}:amr"
      values   = ["unauthenticated"]
    }
  }
}

resource "aws_iam_policy" "cognito_unauth" {
  name   = "${local.resource_prefix}-unauth"
  policy = data.aws_iam_policy_document.cognito_unauth.json
}

data "aws_iam_policy_document" "cognito_unauth" {
  # Minimal permissions for unauthenticated users
  statement {
    actions = [
      "cognito-identity:GetCredentialsForIdentity",
    ]
    resources = ["*"] # checkov:skip=CKV_AWS_107:Has to be wildcard
  }
}

resource "aws_iam_role_policy_attachment" "cognito_unauth" {
  role       = aws_iam_role.cognito_unauth.name
  policy_arn = aws_iam_policy.cognito_unauth.arn
}

resource "aws_cognito_user_pool_domain" "cognito" {
  domain                = lower(local.resource_prefix)
  user_pool_id          = aws_cognito_user_pool.cognito.id
  managed_login_version = 2
}

resource "aws_cognito_managed_login_branding" "cognito" {
  user_pool_id = aws_cognito_user_pool.cognito.id
  client_id    = aws_cognito_user_pool_client.cognito.id

  settings = jsonencode({
    categories = {
      form = {
        displayGraphics = false
        location = {
          horizontal = "CENTER"
          vertical   = "CENTER"
        }
      }
      global = {
        colorSchemeMode = "LIGHT"
      }
    }
    componentClasses = {
      buttons = {
        borderRadius = 8
      }
      input = {
        borderRadius = 8
        lightMode = {
          defaults = {
            backgroundColor = "FFFFFFFF"
            borderColor     = "FCEAE8FF"
          }
          placeholderColor = "6C757DFF"
        }
      }
      link = {
        lightMode = {
          defaults = {
            textColor = "0066CCFF"
          }
          hover = {
            textColor = "0052A3FF"
          }
        }
      }
      focusState = {
        lightMode = {
          borderColor = "0066CCFF"
        }
      }
      inputLabel = {
        lightMode = {
          textColor = "231919FF"
        }
      }
      divider = {
        lightMode = {
          borderColor = "FCEAE8FF"
        }
      }
    }
    components = {
      primaryButton = {
        lightMode = {
          defaults = {
            backgroundColor = "904A48FF"
            textColor       = "FFFFFFFF"
          }
          hover = {
            backgroundColor = "723C3AFF"
            textColor       = "FFFFFFFF"
          }
          active = {
            backgroundColor = "723C3AFF"
            textColor       = "FFFFFFFF"
          }
        }
      }
      secondaryButton = {
        lightMode = {
          defaults = {
            backgroundColor = "FFFFFFFF"
            textColor       = "231919FF"
            borderColor     = "FCEAE8FF"
          }
          hover = {
            backgroundColor = "FFF8F7FF"
            textColor       = "231919FF"
            borderColor     = "FCEAE8FF"
          }
          active = {
            backgroundColor = "FFF8F7FF"
            textColor       = "231919FF"
            borderColor     = "FCEAE8FF"
          }
        }
      }
      idpButton = {
        standard = {
          lightMode = {
            defaults = {
              backgroundColor = "FFFFFFFF"
              textColor       = "495057FF"
              borderColor     = "FCEAE8FF"
            }
            hover = {
              backgroundColor = "FFF8F7FF"
              textColor       = "231919FF"
              borderColor     = "FCEAE8FF"
            }
            active = {
              backgroundColor = "FFF8F7FF"
              textColor       = "231919FF"
              borderColor     = "FCEAE8FF"
            }
          }
        }
      }
      pageBackground = {
        image = {
          enabled = false
        }
        lightMode = {
          color = "FFF8F7FF"
        }
      }
      pageText = {
        lightMode = {
          bodyColor        = "231919FF"
          headingColor     = "231919FF"
          descriptionColor = "231919FF"
        }
      }
      form = {
        backgroundImage = {
          enabled = false
        }
        lightMode = {
          backgroundColor = "FFFFFFFF"
          borderColor     = "FCEAE8FF"
        }
        borderRadius = 12
      }
    }
  })

  depends_on = [aws_cognito_user_pool_domain.cognito]
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.cognito.id
}

output "cognito_identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.cognito.id
}

output "cognito_web_client_id" {
  description = "Cognito Web Client ID"
  value       = aws_cognito_user_pool_client.cognito.id
}

output "cognito_login_domain" {
  description = "Cognito Login Domain"
  value       = nonsensitive(sensitive("${aws_cognito_user_pool_domain.cognito.domain}.auth.${data.aws_region.current.id}.amazoncognito.com"))
}
