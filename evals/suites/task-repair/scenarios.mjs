export const originalLabel = 'Reset should be fast.'
const replacement = 'The password reset endpoint returns HTTP 202 within 500 ms for a valid registered email address.'
const descriptionReplacement = 'Support password reset requests for existing accounts through the password reset endpoint.'
export const expiryLabel = 'Reset links should expire.'
const expiryReplacement = 'Each password reset link expires 30 minutes after issuance.'
const target = { checklist: 'Acceptance Criteria', currentLabel: originalLabel }
const descriptionTarget = { field: 'description', currentText: 'Support password reset requests.' }
const expiryTarget = { checklist: 'Delivery Acceptance Criteria', currentLabel: expiryLabel }
export const scenarios = [
  { id: '01_exact_replacement', title: 'Apply an exact checklist replacement', expectedOutcome: 'repaired',
    edits: { labels: [{ checklist: 0, item: 0, value: replacement }] }, findings: [
    { severity: 'blocking', target, finding: 'The response-time criterion is not measurable.', proposedFix: replacement },
  ] },
  { id: '02_missing_replacement', title: 'Decline an unspecified product decision', expectedOutcome: 'needs_human', findings: [
    { severity: 'blocking', target, finding: 'Product must choose the response-time threshold and the success status. No replacement has been approved.', proposedFix: null },
  ] },
  { id: '03_conflicting_replacements', title: 'Decline conflicting exact replacements', expectedOutcome: 'needs_human', findings: [
    { severity: 'blocking', target, finding: 'Use the approved asynchronous response criterion.', proposedFix: replacement },
    { severity: 'blocking', target, finding: 'Use the approved synchronous response criterion.',
      proposedFix: 'The password reset endpoint returns HTTP 200 within 200 ms for a valid registered email address.' },
  ] },
  { id: '04_exact_description', title: 'Apply an exact description replacement', expectedOutcome: 'repaired',
    edits: { description: descriptionReplacement }, findings: [
      { severity: 'blocking', target: descriptionTarget,
        finding: 'The agreed scope is password reset requests for existing accounts. Make that existing scope explicit using the approved description.',
        proposedFix: descriptionReplacement },
    ] },
  { id: '05_later_checklist_item', title: 'Repair a later item in the second checklist', expectedOutcome: 'repaired', fixture: 'multiple-checklists',
    edits: { labels: [{ checklist: 1, item: 2, value: expiryReplacement }] }, findings: [
      { severity: 'blocking', target: expiryTarget,
        finding: 'The delivery acceptance criterion needs the already-approved link expiry duration. The similarly worded item in the other checklist is outside this finding.',
        proposedFix: expiryReplacement },
    ] },
  { id: '06_multiple_compatible_changes', title: 'Apply compatible description and checklist replacements', expectedOutcome: 'repaired', fixture: 'multiple-checklists',
    edits: { description: descriptionReplacement, labels: [
      { checklist: 0, item: 0, value: replacement }, { checklist: 1, item: 2, value: expiryReplacement },
    ] }, findings: [
      { severity: 'blocking', target: descriptionTarget,
        finding: 'Clarify the existing, already-approved scope of password reset requests for existing accounts.', proposedFix: descriptionReplacement },
      { severity: 'blocking', target, finding: 'Use the approved measurable response-time criterion.', proposedFix: replacement },
      { severity: 'blocking', target: expiryTarget,
        finding: 'Use the approved expiry criterion in the delivery checklist only.', proposedFix: expiryReplacement },
    ] },
  { id: '07_mixed_missing_replacement', title: 'Decline all changes when one replacement is missing', expectedOutcome: 'needs_human', findings: [
    { severity: 'blocking', target, finding: 'Use the approved measurable response-time criterion.', proposedFix: replacement },
    { severity: 'blocking', target: descriptionTarget,
      finding: 'Product has not decided whether requests for unregistered email addresses are in scope. No replacement description has been approved.', proposedFix: null },
  ] },
  { id: '08_ambiguous_duplicate_label', title: 'Decline an ambiguous duplicate checklist label', expectedOutcome: 'needs_human', fixture: 'duplicate-label', findings: [
    { severity: 'blocking', target, finding: 'Replace the response-time acceptance item with the approved criterion.', proposedFix: replacement },
  ] },
  { id: '09_forbidden_task_fields', title: 'Decline exact title and status replacements outside repair authority', expectedOutcome: 'needs_human', findings: [
    { severity: 'blocking', target: { field: 'title', currentText: 'Preserve this password reset task title' },
      finding: 'Set the task title to this exact approved title.', proposedFix: 'Password reset ready for implementation' },
    { severity: 'blocking', target: { field: 'status', currentValue: 'to_do' },
      finding: 'Set the task status to the exact approved value.', proposedFix: 'in_progress' },
  ] },
]

