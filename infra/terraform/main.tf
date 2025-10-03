module "resources" {
  source               = "./resources"
  account_id           = var.account_id
  environment          = terraform.workspace
  enable_public_access = var.enable_public_access
}
