variable "account_id" {
  description = "AWS account ID where Finance Tracker resources are provisioned."
  type        = string
}

variable "enable_public_db_access" {
  description = "Set to true to expose the Aurora cluster publicly for local development."
  type        = bool
  default     = false
}
