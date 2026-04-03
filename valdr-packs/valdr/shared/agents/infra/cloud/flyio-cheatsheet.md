<!--<prompt key="valdr-agents-infra-flyio-cheatsheet" pack="valdr" role="context" tags="flyio,fly,containers,cheatsheet,infra">-->
# Fly.io CLI Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Prerequisites

1. Fly.io account
2. flyctl authenticated:
   ```bash
   fly auth login
   ```

## Set Context

```bash
fly auth whoami
fly apps list
fly status --app <APP>
```

## App Inspect

```bash
fly status --app <APP>
fly info --app <APP>
fly config show --app <APP>
fly regions list --app <APP>
fly ips list --app <APP>
```

## Machine Inspect

```bash
fly machine list --app <APP>
fly machine status <MACHINE_ID> --app <APP>
```

## Logs and Health

```bash
fly logs --app <APP>
fly logs --app <APP> --region <REGION>
fly checks list --app <APP>
```

## Deploy

Approval required before deployment:

```bash
fly deploy --app <APP>
fly deploy --app <APP> --strategy rolling
fly deploy --app <APP> --strategy canary
fly deploy --app <APP> --strategy bluegreen
```

## Rollback

Inspect releases first:

```bash
fly releases --app <APP>
fly releases --app <APP> --image
```

Approval required before rollback:

```bash
fly deploy --app <APP> --image <PREVIOUS_IMAGE_REF>
```

## Scaling

Approval required before scaling changes:

```bash
fly scale count <N> --app <APP>
fly scale vm <VM_SIZE> --app <APP>
fly scale memory <MB> --app <APP>
fly autoscale set min=<MIN> max=<MAX> --app <APP>
```

## Secrets

```bash
fly secrets list --app <APP>
```

Approval required before secret changes:

```bash
fly secrets set KEY=VALUE --app <APP>
fly secrets unset KEY --app <APP>
```

## Volumes Inspect

```bash
fly volumes list --app <APP>
fly volumes show <VOLUME_ID> --app <APP>
```

## Postgres Inspect

```bash
fly postgres list
fly postgres connect --app <PG_APP>
fly postgres db list --app <PG_APP>
```

## Networking

```bash
fly ips list --app <APP>
fly certs list --app <APP>
fly certs show <HOSTNAME> --app <APP>
```

Approval required before network changes:

```bash
fly ips allocate-v4 --app <APP>
fly certs add <HOSTNAME> --app <APP>
```

## SSH Access

```bash
fly ssh console --app <APP>
fly ssh console --app <APP> --command "ls -la /app"
```

## Remote Endpoint Checks

```bash
curl -sS https://<APP>.fly.dev/health
fly checks list --app <APP>
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
