module "resources" {
  source         = "./resources"
  account_id     = var.account_id
  environment    = terraform.workspace
  enable_bastion = var.enable_bastion
}
