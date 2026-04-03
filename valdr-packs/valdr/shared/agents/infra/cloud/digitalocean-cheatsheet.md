<!--<prompt key="valdr-agents-infra-digitalocean-cheatsheet" pack="valdr" role="context" tags="digitalocean,doctl,cheatsheet,infra">-->
# DigitalOcean CLI Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Prerequisites

1. DigitalOcean account
2. doctl authenticated:
   ```bash
   doctl auth init
   ```

## Set Context

```bash
doctl account get
doctl auth list
doctl projects list
```

## Droplets Inspect

```bash
doctl compute droplet list --output json | jq '.[] | {id, name, status, region: .region.slug, size: .size_slug, ip: .networks.v4[0].ip_address}'
doctl compute droplet get <DROPLET_ID>
doctl compute droplet actions <DROPLET_ID>
```

Approval required before droplet changes:

```bash
doctl compute droplet-action resize <DROPLET_ID> --size <SIZE>
doctl compute droplet-action power-cycle <DROPLET_ID>
doctl compute droplet delete <DROPLET_ID>
```

## App Platform Inspect

```bash
doctl apps list
doctl apps get <APP_ID>
doctl apps list-deployments <APP_ID>
doctl apps logs <APP_ID> --type run
```

Approval required before app deployments:

```bash
doctl apps create-deployment <APP_ID>
doctl apps update <APP_ID> --spec <SPEC_FILE>
```

## Kubernetes Inspect

```bash
doctl kubernetes cluster list
doctl kubernetes cluster get <CLUSTER_ID>
doctl kubernetes cluster kubeconfig save <CLUSTER_ID>
kubectl get nodes
kubectl get pods --all-namespaces
```

Approval required before cluster scaling:

```bash
doctl kubernetes cluster node-pool update <CLUSTER_ID> <POOL_ID> --count <N>
```

## Load Balancers Inspect

```bash
doctl compute load-balancer list
doctl compute load-balancer get <LB_ID>
```

## Networking Inspect

```bash
doctl compute vpc list
doctl compute firewall list
doctl compute firewall get <FW_ID>
doctl compute domain list
doctl compute domain records list <DOMAIN>
```

Approval required before firewall/DNS changes:

```bash
doctl compute firewall add-rules <FW_ID> --inbound-rules "<RULES>"
doctl compute domain records create <DOMAIN> --record-type <TYPE> --record-name <NAME> --record-data <VALUE>
```

## Volumes Inspect

```bash
doctl compute volume list
doctl compute volume get <VOLUME_ID>
doctl compute volume-action list <VOLUME_ID>
```

## Databases Inspect

```bash
doctl databases list
doctl databases get <DB_ID>
doctl databases connection <DB_ID>
doctl databases pool list <DB_ID>
```

## Container Registry Inspect

```bash
doctl registry get
doctl registry repository list-v2
doctl registry repository list-tags <REPO>
```

## Spaces (S3-compatible) Inspect

```bash
doctl compute cdn list
s3cmd ls s3://<SPACE_NAME>/
```

## Remote Endpoint Checks

```bash
curl -sS https://<APP_URL>/health
curl -sS -I https://<DOMAIN> | grep server
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
