# ─────────────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "cloud_provider" {
  value = var.cloud_provider
}

output "cluster_name" {
  value = var.cluster_name
}

# ── Azure AKS Outputs ──
output "aks_kube_config" {
  value     = var.cloud_provider == "azure" && length(azurerm_kubernetes_cluster.aks) > 0 ? azurerm_kubernetes_cluster.aks[0].kube_config_raw : null
  sensitive = true
}

output "aks_cluster_fqdn" {
  value = var.cloud_provider == "azure" && length(azurerm_kubernetes_cluster.aks) > 0 ? azurerm_kubernetes_cluster.aks[0].fqdn : null
}

# ── AWS EKS Outputs ──
output "eks_cluster_endpoint" {
  value = var.cloud_provider == "aws" && length(aws_eks_cluster.eks) > 0 ? aws_eks_cluster.eks[0].endpoint : null
}

output "eks_cluster_ca_certificate" {
  value     = var.cloud_provider == "aws" && length(aws_eks_cluster.eks) > 0 ? aws_eks_cluster.eks[0].certificate_authority[0].data : null
  sensitive = true
}

output "eks_kubeconfig_command" {
  value = var.cloud_provider == "aws" ? "aws eks update-kubeconfig --region ${var.aws_region} --name ${var.cluster_name}" : null
}

# ── App URLs ──
output "storefront_url" {
  value = "http://zylkerkart.local"
}

output "chaos_dashboard_url" {
  value = "http://chaos.zylkerkart.local"
}

output "apm_enabled" {
  value = local.enable_apm
  sensitive = true
}