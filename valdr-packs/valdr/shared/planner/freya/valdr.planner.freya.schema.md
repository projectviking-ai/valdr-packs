<!--<capability id="valdr.planner.freya.schema" pack="valdr" role="constraints">-->
# VMP Plan Schema

This capability defines the exact markdown format for VMP plans.

## Frontmatter Rules

**MUST include exactly ONE of:**
- `projectKey: <key>` OR
- `projectId: <id>`

**NEVER include both. NEVER include neither.**

**NEVER include in frontmatter:**
- `planId`
- `planKey`
- `createdBy`
- `tags`

## Plan Structure (Fixed Sections)

```markdown
---
schemaVersion: 1.0
projectKey: <key>
---

# Plan: <title>

## Idea
<1-3 sentences describing what this plan accomplishes>

## Constraints
- <constraint 1>
- <constraint 2>

## Success
- <success criterion 1>
- <success criterion 2>

## Design

### Problem
<What problem does this solve?>

### Approach
<How will we solve it?>

### Risks
- [R1] <risk description> | Mitigation: <how to mitigate>
- [R2] <risk description> | Mitigation: <how to mitigate>

## Requirements
- [REQ-1] <requirement title>
  Description: <detailed description>
  Scenario: <Gherkin format Given/When/Then>

- [REQ-2] <requirement title>
  Description: <detailed description>
  Scenario: <Gherkin format>

## Tasks
- [TASK-1] <action verb> <what>
  Summary: <2-4 sentences with specific file paths and actions>
  Requirements: REQ-1, REQ-2
  Acceptance:
    - <verifiable criterion with file/location>
    - <verifiable criterion with file/location>

- [TASK-2] <action verb> <what>
  Summary: <specific details>
  Requirements: REQ-1
  Acceptance:
    - <criterion>
```

## Section Rules

| Section | Required | Content |
|---------|----------|---------|
| Idea | Yes | 1-3 sentences |
| Constraints | Yes | Bullet list |
| Success | Yes | Bullet list of verifiable criteria |
| Design | Yes | Problem, Approach, Risks subsections |
| Design > Risks | Yes | Each risk needs mitigation (see Risk Format below) |
| Requirements | Yes | REQ-1, REQ-2... format with Description and Scenario |
| Tasks | Yes | TASK-1, TASK-2... format with Summary, Requirements, Acceptance |

## ID Formats

- Requirements: `REQ-1`, `REQ-2`, `REQ-3`...
- Tasks: `TASK-1`, `TASK-2`, `TASK-3`...
- Risks: `R1`, `R2`, `R3`...

**Keep IDs stable between retries.** Do not renumber after initial draft.

## Risk Format (CRITICAL)

Each risk line MUST include both the risk AND its mitigation, separated by ` | Mitigation: `.

**Correct format:**
```
### Risks
- [R1] Queue saturation may increase latency | Mitigation: Monitor queue depth and tune capacity
- [R2] Shutdown may block on in-flight work | Mitigation: Add configurable timeout with warning logs
```

**WRONG format (will fail parsing):**
```
### Risks
- [R1] Queue saturation may increase latency
- [R2] Shutdown may block on in-flight work
```

**No risks:**
```
### Risks
- (none)
```

## Gherkin Scenarios

Requirements should include Gherkin-format scenarios:

```
Scenario: <name>
  Given <precondition>
  When <action>
  Then <expected result>
```

<!--</capability>-->
