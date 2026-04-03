<!--<capability id="valdr.agents.infra.networking" pack="valdr" role="context">-->
# Networking, DNS, and Edge Security

<!--<identity>-->
Network design patterns prioritizing least privilege, segmentation, and operability.
<!--</identity>-->

<!--<instructions>-->
## VPC/VNet Design
- Plan CIDR ranges to avoid overlap across environments/regions.
- Use public subnets only for edge components; keep app/data private.
- Reserve address space for future growth and peering.

## Security Groups / Firewalls
- Deny by default; allow only required ports and sources.
- Scope rules to service identities/security groups instead of broad CIDRs.
- Define egress explicitly for high-trust environments.

## Load Balancers
- Choose L7 vs L4 based on routing and protocol needs.
- Configure health checks and graceful deregistration.
- Terminate TLS with modern policies and certificate rotation.

## DNS Practices
- Use low TTL during migration windows, higher TTL for stable records.
- Separate internal and external zones.
- Standardize naming for discoverability and operations.

## Service Mesh Guidance
- Use when mTLS, traffic shaping, and policy governance are needed at scale.
- Avoid mesh overhead for small/simple topologies.

## Private Connectivity
- Prefer private links/VPN/direct connect for sensitive service integration.
- Audit route tables and transit policies regularly.

## Common Mistakes
- Overly permissive inbound rules (`0.0.0.0/0` on admin ports)
- Missing outbound restrictions
- CIDR conflicts across peered networks
- TLS disabled between internal services handling sensitive data
<!--</instructions>-->
<!--</capability>-->
