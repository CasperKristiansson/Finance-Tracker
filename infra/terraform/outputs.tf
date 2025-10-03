output "bastion_public_dns" {
  description = "Public DNS name for the bastion host when enabled."
  value       = module.resources.bastion_public_dns
}

output "bastion_instance_id" {
  description = "Instance ID of the bastion host when enabled."
  value       = module.resources.bastion_instance_id
}

