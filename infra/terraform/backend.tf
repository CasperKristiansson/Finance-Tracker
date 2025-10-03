terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.15.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }

  backend "s3" {
    bucket         = "finance-tracker-terraform-state-bucket-dev"
    key            = "terraform/state.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "finance-tracker-terraform-state-lock-dev"
    encrypt        = true
    profile        = "Personal"
  }

  required_version = ">= 1.13.3"
}
