module "resources" {
  source      = "./resources"
  account_id  = var.account_id
  environment = terraform.workspace
}
