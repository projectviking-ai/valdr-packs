<!--<prompt key="valdr-agents-infra-gcloud-cheatsheet" pack="valdr" role="context" tags="gcloud,cloud-run,cheatsheet,infra">-->
# GCloud Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Set Context

```bash
gcloud auth list
gcloud config list
gcloud config set project <PROJECT_ID>
gcloud config set run/region <REGION>
```

## Cloud Run Inspect

```bash
gcloud run services list --platform=managed --region <REGION>
gcloud run services describe <service-name> --platform=managed --region <REGION>
gcloud run revisions list --service <service-name> --platform=managed --region <REGION>
```

## Logs and Health

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="<service-name>"' --limit=50 --freshness=2h
gcloud logging read 'resource.type="uptime_url"' --limit=50 --freshness=24h
```

## Uptime Checks

```bash
gcloud monitoring uptime-check-configs list
```

Approval required before delete:

```bash
gcloud monitoring uptime-check-configs delete <UPTIME_CHECK_ID>
```

## Safe Scaling Updates

Approval required before changing scaling or CPU allocation:

```bash
gcloud run services update <service-name> --region <REGION> --min-instances=<N>
gcloud run services update <service-name> --region <REGION> --max-instances=<N>
gcloud run services update <service-name> --region <REGION> --cpu-throttling
gcloud run services update <service-name> --region <REGION> --no-cpu-throttling
```

## Traffic and Rollback

Inspect revisions first:

```bash
gcloud run revisions list --service <service-name> --region <REGION>
```

Approval required before traffic changes:

```bash
gcloud run services update-traffic <service-name> --region <REGION> --to-revisions <REVISION>=100
```

## IAM and Service Account

```bash
gcloud run services describe <service-name> --region <REGION> --format='value(spec.template.spec.serviceAccountName)'
gcloud projects get-iam-policy <PROJECT_ID>
```

Approval required before IAM policy changes:

```bash
gcloud projects add-iam-policy-binding <PROJECT_ID> --member=<MEMBER> --role=<ROLE>
gcloud projects remove-iam-policy-binding <PROJECT_ID> --member=<MEMBER> --role=<ROLE>
```

## Remote Endpoint Checks

Public service:

```bash
curl -sS https://<SERVICE_URL>/health
```

Private service with identity token:

```bash
ID_TOKEN="$(gcloud auth print-identity-token)"
curl -sS -H "Authorization: Bearer ${ID_TOKEN}" https://<SERVICE_URL>/health
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
