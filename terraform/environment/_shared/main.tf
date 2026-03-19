terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  backend "s3" {
    # Configured via init argument -e/--workspace
  }
}

provider "aws" {
  default_tags {
    tags = {
      Project     = "dnd-planner"
      Environment = local.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "dnd-planner"
      Environment = local.environment
      ManagedBy   = "terraform"
    }
  }
}

module "dnd-planner" {
  source = "../../module/dnd-planner"

  environment = local.environment
  domain      = var.domain
  host        = var.host

  providers = {
    aws           = aws
    aws.us-east-1 = aws.us-east-1
  }
}
