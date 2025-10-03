variable "account_id" {
  default = "574406306846"
}

variable "enable_public_access" {
  description = "Set to true to temporarily expose the Aurora instance to the public internet."
  type        = bool
  default     = false
}
