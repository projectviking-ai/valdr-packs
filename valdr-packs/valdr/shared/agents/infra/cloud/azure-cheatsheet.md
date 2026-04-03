<!--<prompt key="valdr-agents-infra-azure-cheatsheet" pack="valdr" role="context" tags="azure,aks,cheatsheet,infra">-->
# Azure CLI Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Prerequisites

1. Azure account
2. Azure CLI authenticated:
   ```bash
   az login
   ```

## Set Context

```bash
az account show
az account list --output table
az account set --subscription <SUBSCRIPTION_ID>
```

## App Service Inspect

```bash
az webapp list --output table
az webapp show --name <APP> --resource-group <RG>
az webapp config show --name <APP> --resource-group <RG>
az webapp deployment list-publishing-profiles --name <APP> --resource-group <RG>
```

## App Service Logs and Health

```bash
az webapp log tail --name <APP> --resource-group <RG>
az webapp log download --name <APP> --resource-group <RG> --log-file logs.zip
az monitor activity-log list --resource-group <RG> --max-events 20 --output table
```

## AKS Inspect

```bash
az aks list --output table
az aks show --name <CLUSTER> --resource-group <RG>
az aks get-credentials --name <CLUSTER> --resource-group <RG>
kubectl get nodes
kubectl get pods --all-namespaces
```

Approval required before AKS scaling:

```bash
az aks scale --name <CLUSTER> --resource-group <RG> --node-count <N>
az aks nodepool scale --cluster-name <CLUSTER> --resource-group <RG> --name <POOL> --node-count <N>
```

## Container Instances Inspect

```bash
az container list --output table
az container show --name <CONTAINER> --resource-group <RG>
az container logs --name <CONTAINER> --resource-group <RG>
```

## Storage Inspect

```bash
az storage account list --output table
az storage container list --account-name <ACCOUNT> --output table
az storage blob list --account-name <ACCOUNT> --container-name <CONTAINER> --output table
```

## Networking Inspect

```bash
az network vnet list --output table
az network nsg list --output table
az network nsg rule list --nsg-name <NSG> --resource-group <RG> --output table
az network lb list --output table
az network public-ip list --output table
```

## IAM and RBAC

```bash
az role assignment list --resource-group <RG> --output table
az ad sp list --display-name <SEARCH> --output table
```

Approval required before RBAC changes:

```bash
az role assignment create --assignee <PRINCIPAL_ID> --role <ROLE> --resource-group <RG>
az role assignment delete --assignee <PRINCIPAL_ID> --role <ROLE> --resource-group <RG>
```

## Key Vault Inspect

```bash
az keyvault list --output table
az keyvault secret list --vault-name <VAULT> --output table
az keyvault secret show --vault-name <VAULT> --name <SECRET>
```

Approval required before secret changes:

```bash
az keyvault secret set --vault-name <VAULT> --name <SECRET> --value <VALUE>
az keyvault secret delete --vault-name <VAULT> --name <SECRET>
```

## App Service Scaling

Approval required before scaling changes:

```bash
az webapp update --name <APP> --resource-group <RG> --set siteConfig.numberOfWorkers=<N>
az appservice plan update --name <PLAN> --resource-group <RG> --sku <SKU>
```

## App Service Deployment and Rollback

Inspect deployment slots:

```bash
az webapp deployment slot list --name <APP> --resource-group <RG> --output table
```

Approval required before deployment changes:

```bash
az webapp deployment slot swap --name <APP> --resource-group <RG> --slot staging --target-slot production
```

## Remote Endpoint Checks

```bash
curl -sS https://<APP>.azurewebsites.net/health
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
