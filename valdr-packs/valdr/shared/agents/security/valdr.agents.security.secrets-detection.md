<!--<capability id="valdr.agents.security.secrets-detection" pack="valdr" role="validation">-->
# Secrets Detection & Remediation

<!--<identity>-->
Detect exposed secrets, coordinate safe response, and prevent recurrence.
<!--</identity>-->

<!--<instructions>-->
## Secret Pattern Coverage
Detect likely exposures for:
- API keys and access tokens
- passwords and connection strings
- cloud credentials and IAM keys
- private keys, certificates, and signing material
- webhook secrets and service account tokens

## File-Level Risks
- committed `.env` and override files
- plaintext credentials in config manifests
- private key blocks (`BEGIN PRIVATE KEY`)
- test fixtures containing real tokens

## Code-Level Risks
- hardcoded secret-like literals
- base64 blobs decoded at runtime into credentials
- fallback secrets in source defaults
- secret values echoed into logs or exceptions

## History Scanning
A clean HEAD is insufficient; scan commit history/tags for leaked credentials and rotate even if removed from current tree.

## Remediation Workflow
1. **Detect**: identify scope and exposure time.
2. **Rotate**: revoke and re-issue credentials immediately.
3. **Remove**: purge from code/history where feasible.
4. **Prevent**: add controls (hooks, scanners, policy checks).

## Prevention Controls
- `.gitignore` for local secret files
- pre-commit scanners (`gitleaks`, `detect-secrets`)
- CI scanning gates on PR and default branch
- secret manager integration via references/env injection, never hardcoding

## Secret Manager Patterns
- use environment variables only as indirection, not storage
- prefer short-lived credentials from vault/brokered identity
- enforce least-privilege scopes and TTL-based rotation
<!--</instructions>-->
<!--</capability>-->
