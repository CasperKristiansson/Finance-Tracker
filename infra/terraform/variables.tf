variable "account_id" {
  default = ""
}

variable "enable_bastion" {
  description = "Set to true to provision the bastion host for direct Aurora access."
  type        = bool
  default     = false
}
