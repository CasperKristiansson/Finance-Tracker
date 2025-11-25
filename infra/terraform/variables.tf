variable "account_id" {
  description = "AWS account ID where Finance Tracker resources are provisioned."
  type        = string
}

variable "enable_bastion" {
  description = "Set to true to provision the bastion host for direct Aurora access."
  type        = bool
  default     = false
}
