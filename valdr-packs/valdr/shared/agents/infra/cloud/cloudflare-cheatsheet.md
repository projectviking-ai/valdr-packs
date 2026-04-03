<!--<prompt key="valdr-agents-infra-cloudflare-cheatsheet" pack="valdr" role="context" tags="cloudflare,wrangler,workers,cheatsheet,infra">-->
# Cloudflare / Wrangler Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Prerequisites

1. Cloudflare account
2. Wrangler CLI authenticated:
   ```bash
   npx wrangler login
   ```

## Account and Zone Context

```bash
npx wrangler whoami
npx wrangler deployments list
```

## Workers Inspect

```bash
npx wrangler deployments list
npx wrangler tail <WORKER_NAME>
npx wrangler secret list --name <WORKER_NAME>
```

## Workers Deploy

Approval required before deployment:

```bash
npx wrangler deploy
npx wrangler deploy --env <ENV>
```

## Workers Rollback

Inspect versions first:

```bash
npx wrangler deployments list
npx wrangler versions list
```

Approval required before rollback:

```bash
npx wrangler rollback
npx wrangler rollback --version-id <VERSION_ID>
```

## Pages Inspect

```bash
npx wrangler pages project list
npx wrangler pages deployment list --project-name <PROJECT>
```

## Pages Deploy

Approval required before deployment:

```bash
npx wrangler pages deploy <OUTPUT_DIR> --project-name <PROJECT>
npx wrangler pages deploy <OUTPUT_DIR> --project-name <PROJECT> --branch <BRANCH>
```

## KV Inspect

```bash
npx wrangler kv namespace list
npx wrangler kv key list --namespace-id <NS_ID>
npx wrangler kv key get --namespace-id <NS_ID> <KEY>
```

Approval required before KV mutations:

```bash
npx wrangler kv key put --namespace-id <NS_ID> <KEY> <VALUE>
npx wrangler kv key delete --namespace-id <NS_ID> <KEY>
```

## R2 Inspect

```bash
npx wrangler r2 bucket list
npx wrangler r2 object get <BUCKET>/<KEY>
```

Approval required before R2 mutations:

```bash
npx wrangler r2 object put <BUCKET>/<KEY> --file <FILE>
npx wrangler r2 object delete <BUCKET>/<KEY>
```

## D1 Database Inspect

```bash
npx wrangler d1 list
npx wrangler d1 info <DB_NAME>
npx wrangler d1 execute <DB_NAME> --command "SELECT * FROM sqlite_master WHERE type='table'"
```

Approval required before D1 mutations:

```bash
npx wrangler d1 execute <DB_NAME> --command "<SQL>"
npx wrangler d1 execute <DB_NAME> --file <SQL_FILE>
```

## DNS Inspect (via API)

```bash
curl -sS -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" | jq '.result[] | {name, type, content, ttl}'
```

Approval required before DNS changes:

```bash
curl -sS -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -d '{"type":"<TYPE>","name":"<NAME>","content":"<VALUE>","ttl":1,"proxied":true}'
```

## Secrets Management

Approval required before secret changes:

```bash
npx wrangler secret put <SECRET_NAME> --name <WORKER_NAME>
npx wrangler secret delete <SECRET_NAME> --name <WORKER_NAME>
```

## Remote Endpoint Checks

```bash
curl -sS https://<WORKER_URL>/health
curl -sS -I https://<DOMAIN> | grep -E 'cf-ray|server|cf-cache-status'
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
