<!--<capability id="valdr.core.tools.pm-automation" pack="valdr" role="integration">-->
# Tool: pm_automation

Discover, validate, preview, apply, and manage local and pack-managed automations through the connected Valdr authority.

<!--<instructions>-->

## Discover before authoring

Use the connected server's tool list and input schema. This tool uses a strict `action` plus nested `params` shape:

```text
pm_automation { action: "event_catalog", params: {} }
```

`event_catalog` is read-only. It returns built-in event descriptors and authority-computed availability. Use the returned field types, nullability, lifecycle meaning, and filter/map flags. A client, actor string, pack name, or workflow name does not grant availability. Session event descriptors may appear as unavailable until their support gate passes.

**Source ready; not released in this guide's current Valdr release.** The running authority's catalog decides what can be used. Do not infer release status or producer support from these instructions.

## Event contract

- Omitted event `version` means `1`; it does not rewrite the authored declaration.
- Match flat JSON scalar fields by exact equality. All supplied filters must match. Do not use expressions, coercion, nested paths, or OR groups.
- Map only compatible catalog fields to action inputs. Omitted or null values for optional destinations are left out so target defaults apply. Preserve `false`, `0`, and `""`.
- Do not map an optional or nullable source into a required, non-nullable destination. The authority validates the resolved target again at dispatch.
- Event payloads are limited to 16 KiB. Do not include transcripts, prompts, or tool output. Human diagnostics are limited to 2 KiB after existing redaction.
- Event subscriptions are live windows. They do not subscribe retroactively to events committed before activation or while paused. After a consumer restart, eligible events that committed and remain in the outbox can still be delivered.

Workflow lifecycle names cover `workflow.started`, `workflow.completed`, `workflow.failed`, `workflow.blocked`, and `workflow.cancelled`. `workflow.started` means the initial run start committed; a resume is not another start. Task names are `task.created`, `task.status_changed`, and `task.assignee_changed`; sprint names are `sprint.created` and `sprint.status_changed`; plan names are `plan.created` and `plan.status_changed`. A transition is emitted only at the catalog's documented committed boundary.

## Validate and preview

Call `validate` before applying a declaration. A completed validation can return `ok: true` with `data.valid: false`; read diagnostics and correct the declaration. Call `preview` with a representative `sampleEvent` before enabling an event rule. Read `matches`, `resolvedInputs`, and `diagnostics`: `true` is a matching valid sample, `false` is a valid non-match, and `null` means unavailable or invalid input. Preview does not start work.

Keep examples inert. Do not call `apply`, `resume`, or another mutation unless the user asks for that state change. Applying a new rule enables it immediately. For a new mutation, generate a fresh ULID and retain it with the same arguments for retries. Use the input schema for exact action fields and `event_catalog` for event fields and availability.

## Failure and recovery

Publication capacity pressure fails the source transaction, so the source change does not commit.

When a workflow step calls an internal tool and that tool rolls back its target mutation because event publication failed, the failed receipt keeps the original error code and retryability. The driver first retries saving the parent failure state and event. After correcting the cause, the operator can use the existing `retry_step` path for a fresh target attempt. The driver does not automatically rerun the target.

If an external operation already took effect, its result remains successful. Valdr retries saving the workflow state and event from the saved result without repeating the operation.

A `deliveryGap` is separate: it reports committed records removed by outbox expiry or retention before delivery. Its count is removed outbox rows in the reported sequence range, not an exact count of missed matches for one rule. Inspect the source, affected occurrence, and external result before resuming. Retrying may repeat external effects; Valdr does not promise exactly-once behavior outside its transaction boundary.

Unavailable events remain unavailable until the authority reports support. Do not work around availability by changing the pack, actor, workflow, or event name.

## Cross-pack composition

An automation can target an installed workflow or user tool from another pack. Keep stable references in the source declaration; do not copy valid external provider files into the consuming pack. The destination workspace resolves the provider from its installed packs. Import still blocks when a required destination entity is missing. Agents can separately retain external capability and backing-prompt references; those are pack-composition references, not automation targets.

`pm_automation` provides execution and validation contracts. Users choose their triggers, participants, approval rules, and completion criteria in their own workflows and packs.

<!--</instructions>-->
<!--</capability>-->
