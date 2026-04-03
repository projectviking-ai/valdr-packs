<!--<prompt key="valdr-agents-infra-aws-cheatsheet" pack="valdr" role="context" tags="aws,ecs,cheatsheet,infra">-->
# AWS CLI Cheatsheet

Use these commands for inspection first. Before destructive or high-impact actions, ask the user for approval.

## Set Context

```bash
aws sts get-caller-identity
aws configure list
export AWS_PROFILE=<PROFILE>
export AWS_DEFAULT_REGION=<REGION>
```

## ECS Inspect

```bash
aws ecs list-clusters
aws ecs describe-clusters --clusters <CLUSTER>
aws ecs list-services --cluster <CLUSTER>
aws ecs describe-services --cluster <CLUSTER> --services <SERVICE>
aws ecs list-tasks --cluster <CLUSTER> --service-name <SERVICE>
aws ecs describe-tasks --cluster <CLUSTER> --tasks <TASK_ARN>
```

## EC2 Inspect

```bash
aws ec2 describe-instances --filters "Name=tag:Name,Values=<NAME>" --query 'Reservations[].Instances[].[InstanceId,State.Name,PrivateIpAddress]' --output table
aws ec2 describe-security-groups --group-ids <SG_ID>
aws ec2 describe-vpcs --output table
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC_ID>" --output table
```

## Logs and Health

```bash
aws logs describe-log-groups --log-group-name-prefix <PREFIX>
aws logs tail <LOG_GROUP> --since 2h --follow
aws logs filter-log-events --log-group-name <LOG_GROUP> --filter-pattern "ERROR" --start-time $(date -d '2 hours ago' +%s000)
```

## Load Balancer Inspect

```bash
aws elbv2 describe-load-balancers --names <ALB_NAME>
aws elbv2 describe-target-groups --load-balancer-arn <ALB_ARN>
aws elbv2 describe-target-health --target-group-arn <TG_ARN>
```

## S3 Inspect

```bash
aws s3 ls
aws s3 ls s3://<BUCKET>/ --recursive --summarize
aws s3api get-bucket-policy --bucket <BUCKET>
aws s3api get-bucket-encryption --bucket <BUCKET>
```

## IAM and Roles

```bash
aws iam list-roles --query 'Roles[?contains(RoleName,`<SEARCH>`)].{Name:RoleName,Arn:Arn}' --output table
aws iam get-role --role-name <ROLE>
aws iam list-attached-role-policies --role-name <ROLE>
aws iam get-policy --policy-arn <POLICY_ARN>
```

Approval required before IAM policy changes:

```bash
aws iam attach-role-policy --role-name <ROLE> --policy-arn <POLICY_ARN>
aws iam detach-role-policy --role-name <ROLE> --policy-arn <POLICY_ARN>
```

## ECS Scaling

Approval required before scaling changes:

```bash
aws ecs update-service --cluster <CLUSTER> --service <SERVICE> --desired-count <N>
aws application-autoscaling describe-scaling-policies --service-namespace ecs
```

## ECS Deployment and Rollback

Inspect task definitions first:

```bash
aws ecs list-task-definitions --family-prefix <FAMILY> --sort DESC --max-items 5
aws ecs describe-task-definition --task-definition <FAMILY>:<REVISION>
```

Approval required before deployment changes:

```bash
aws ecs update-service --cluster <CLUSTER> --service <SERVICE> --task-definition <FAMILY>:<REVISION> --force-new-deployment
```

## Remote Endpoint Checks

```bash
curl -sS https://<SERVICE_URL>/health
```

## Approval Policy

- Always ask before destructive or high-impact actions.
- If command impact is uncertain, ask the user first.
- Prefer inspect and plan commands before mutate commands.
<!--</prompt>-->
