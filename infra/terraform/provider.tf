provider "aws" {
  region  = "eu-north-1"
  profile = "Personal"
}

provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = "Personal"
}
