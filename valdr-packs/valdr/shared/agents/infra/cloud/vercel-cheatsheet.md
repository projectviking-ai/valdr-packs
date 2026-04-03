<!--<prompt key="valdr-agents-infra-vercel-cheatsheet" pack="valdr" role="context" tags="vercel,nextjs,cheatsheet,infra">-->
# Vercel CLI Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Prerequisites

1. Vercel account
2. Vercel CLI authenticated:
   ```bash
   npx vercel login
   ```

## Set Context

```bash
npx vercel whoami
npx vercel link
npx vercel project ls
```

## Project Inspect

```bash
npx vercel ls
npx vercel inspect <DEPLOYMENT_URL>
```

## Deployments

Preview deployment (safe):

```bash
npx vercel
npx vercel --env preview
```

Approval required before production deployment:

```bash
npx vercel --prod
```

## Rollback

Inspect deployments first:

```bash
npx vercel ls
```

Approval required before rollback:

```bash
npx vercel rollback <DEPLOYMENT_URL>
```

## Environment Variables Inspect

```bash
npx vercel env ls
npx vercel env pull .env.local
```

Approval required before env changes:

```bash
npx vercel env add <NAME> <ENVIRONMENT>
npx vercel env rm <NAME> <ENVIRONMENT>
```

## Domains Inspect

```bash
npx vercel domains ls
npx vercel domains inspect <DOMAIN>
```

Approval required before domain changes:

```bash
npx vercel domains add <DOMAIN>
npx vercel domains rm <DOMAIN>
```

## Logs

```bash
npx vercel logs <DEPLOYMENT_URL>
npx vercel logs <DEPLOYMENT_URL> --follow
```

## Edge Config Inspect

```bash
npx vercel edge-config ls
```

## Build Output

```bash
npx vercel build
npx vercel dev
```

## Remote Endpoint Checks

```bash
curl -sS https://<PROJECT>.vercel.app/api/health
curl -sS -I https://<DOMAIN> | grep -E 'x-vercel|server'
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- Preview deployments are safe; production deployments require approval.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
