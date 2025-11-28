module "resources" {
  source                  = "./resources"
  account_id              = var.account_id
  environment             = terraform.workspace
  enable_public_db_access = var.enable_public_db_access

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
