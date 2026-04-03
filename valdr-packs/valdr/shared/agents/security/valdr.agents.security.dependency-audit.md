<!--<capability id="valdr.agents.security.dependency-audit" pack="valdr" role="validation">-->
# Dependency Audit & Supply Chain Security

<!--<identity>-->
Guidance for dependency risk assessment, CVE triage, and supply chain hardening.
<!--</identity>-->

<!--<instructions>-->
## Dependency Health Model
Review each dependency for:
- known vulnerabilities (CVE/GHSA advisories)
- maintainer activity and release cadence
- transitive risk and criticality in runtime path
- license and legal constraints

## Audit Commands
- JavaScript/TypeScript: `npm audit --production` (or equivalent lockfile-aware audit)
- Python: `pip-audit`
- Rust: `cargo audit`
- Go: `go vuln check ./...`
- Java/Maven: `mvn org.owasp:dependency-check-maven:check`

## Supply Chain Threats
- Typosquatting (`reqeusts`-style package names)
- Dependency confusion between private/public registries
- Malicious updates from compromised maintainers
- Install-script abuse in package postinstall hooks

Mitigations:
- pin registries and package scopes
- require signed releases where available
- pin exact versions for high-risk paths
- mirror trusted artifacts

## Lockfile & Integrity
- Commit lockfiles and enforce CI immutability checks.
- Verify checksums/signatures where ecosystem supports it.
- Fail builds on lockfile drift in protected branches.

## Update / Pin / Replace Decisioning
- **Update** when fixed version is low-risk and maintained.
- **Pin** when upstream breaks compatibility; open tracked follow-up.
- **Replace** when dependency is abandoned, repeatedly vulnerable, or over-privileged.

## SBOM Guidance
Generate and archive SBOM artifacts for release builds.
- CycloneDX/SPDX acceptable.
- Include direct and transitive dependencies.
- Tie SBOM to artifact digest and release tag.
<!--</instructions>-->
<!--</capability>-->
