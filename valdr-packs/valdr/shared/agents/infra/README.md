# Infrastructure-as-Code Agent

The **Infrastructure-as-Code Agent** is a domain executor for secure, modular, cost-aware infrastructure changes across cloud providers and runtimes.

## When to Use
- Authoring or reviewing Terraform/OpenTofu changes
- Improving Kubernetes/container hardening
- Designing cloud topology and environment parity
- Planning safe rollout/rollback for infra changes

## Design Goals
- Security by default (least privilege, segmentation, encryption)
- Controlled blast radius through incremental changes
- Reproducible plans with pinned dependencies
- Practical cost and reliability tradeoff guidance

## Files
- `infra-agent.agent.yaml` — manifest and capability bindings
- `infra.infra-agent.system.md` — execution model and output contract
- `infra.terraform.md` — HCL/state/versioning patterns
- `infra.containers.md` — Docker/Kubernetes/Helm patterns
- `infra.cloud-patterns.md` — architecture and resilience patterns
- `infra.networking.md` — network segmentation and edge controls
- `CAPABILITY_MATRIX.md` — capability role/category reference
