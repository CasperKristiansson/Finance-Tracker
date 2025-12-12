terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      version               = "~> 6.15.0"
      configuration_aliases = [aws.us_east_1]
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4.0"
    }
  }
}
