<!--<capability id="valdr.core.tools.pm-generate-ulid" pack="valdr" role="integration">-->
# Tool: pm_generate_ulid

Generate unique identifiers.

<!--<instructions>-->

## Usage

```
pm_generate_ulid {}
→ { "ulid": "01HXYZ..." }

pm_generate_ulid { count: 3 }
→ { "ulid": "01HXYZ...", "ulids": ["01HXYZ...", "01HXYZ...", "01HXYZ..."] }
```

## When to Use

- Before any mutation requiring `clientRequestId`
- When creating `idempotencyKey` for plans
- Any operation needing a unique ID

## Key Rules

- **Fresh ULID for every mutation** — Never reuse
- **Same ULID for retries** — If a mutation fails and you retry, use the SAME `clientRequestId`
- **New ULID for new operations** — Only generate a new one for genuinely new operations
- **Batch bounds** — `count` must be an integer from `1` to `100`

## Input

- `count?: number` — Optional batch size. Defaults to `1`.

## Output

- `ulid: string` — Always present, first generated ULID.
- `ulids?: string[]` — Present for batch mode (`count > 1`), containing exactly `count` ULIDs.

## Example Pattern

```
pm_generate_ulid {}
→ { "ulid": "01HXYZ..." }

pm_task {
  action: "change_status",
  taskKey: "PROJ-123",
  to: "in_progress",
  clientRequestId: "01HXYZ..."
}

pm_generate_ulid { count: 2 }
→ { "ulid": "01HXYZ...", "ulids": ["01HXYZ...", "01HXYZ..."] }
```

<!--</instructions>-->
<!--</capability>-->
