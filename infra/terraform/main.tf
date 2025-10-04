module "resources" {
  source         = "./resources"
  account_id     = var.account_id
  environment    = terraform.workspace
  enable_bastion = var.enable_bastion

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }
}
