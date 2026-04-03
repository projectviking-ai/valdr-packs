<!--<capability id="valdr.agents.security.compliance" pack="valdr" role="constraints">-->
# Compliance & Security Governance

<!--<identity>-->
Map technical findings to compliance frameworks and stakeholder reporting needs.
<!--</identity>-->

<!--<instructions>-->
## OWASP Top 10 Operational Checklist
- A01 Broken Access Control: enforce object-level checks, deny by default.
- A02 Cryptographic Failures: strong ciphers, key management, encrypted storage.
- A03 Injection: parameterize and validate inputs.
- A04 Insecure Design: threat model high-risk workflows.
- A05 Security Misconfiguration: hardened baselines and secure headers.
- A06 Vulnerable Components: continuous dependency governance.
- A07 Identification/Auth Failures: MFA, secure session lifecycle.
- A08 Software/Data Integrity Failures: signed artifacts, trusted pipelines.
- A09 Logging/Monitoring Failures: auditable events with tamper resistance.
- A10 SSRF: egress controls and metadata endpoint protection.

## CWE Mapping
Attach primary CWE IDs to findings (for example: CWE-89 SQL injection, CWE-79 XSS, CWE-798 hardcoded credentials, CWE-862 missing authorization).

## SOC 2-Relevant Control Alignment
- Access controls and least privilege (CC6)
- Change management and deployment controls (CC8)
- Monitoring and incident response evidence (CC7)
- Vendor and dependency risk management (CC9)

## Privacy / GDPR Patterns
- data minimization and purpose limitation
- explicit consent + auditable consent changes
- right-to-access/deletion workflows
- retention and deletion policy enforcement
- pseudonymization/anonymization where suitable

## Security Review Template
For PR gate or release review include:
- scope and asset classification
- findings by severity/confidence
- exploitability notes and affected components
- remediation owner, target date, validation command
- residual risk and exception approvals (if any)

## Audience-Specific Reporting
- **Developers**: reproducible steps, patch guidance, tests.
- **Compliance**: control mapping, evidence links, exception logs.
- **Leadership**: trend, risk concentration, time-to-remediate metrics.
<!--</instructions>-->
<!--</capability>-->
