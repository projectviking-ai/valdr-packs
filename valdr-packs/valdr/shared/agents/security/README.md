# Security Audit Agent

The **Security Audit Agent** is a domain specialist for application, dependency, and configuration security reviews across any language stack.

## When to Use
- Pre-merge or pre-release security reviews
- Incident-driven retrospective audits
- Dependency and supply-chain risk triage
- Compliance-aligned control checks

## Design Goals
- Reviewer-first posture with evidence-based findings
- Clear severity and confidence scoring
- Actionable remediation and verification steps
- Language-agnostic coverage (TS, Python, Go, Rust, Java, etc.)

## Files
- `security-audit-agent.agent.yaml` — manifest and capability bindings
- `security.security-audit-agent.system.md` — core behavior and report format
- `security.vulnerability-patterns.md` — vulnerability classes and detection heuristics
- `security.dependency-audit.md` — package and supply chain checks
- `security.secrets-detection.md` — secret leak detection and response
- `security.compliance.md` — OWASP/CWE/SOC2/GDPR mapping patterns
- `CAPABILITY_MATRIX.md` — capability role/category reference
