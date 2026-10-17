<!--<capability id="valdr-workflow.base.human-gate-questions" pack="valdr-workflow" role="constraints">-->
# Human Gate Questions

<!--<identity>-->
Shared format for any workflow-owned agent that asks an operator questions through a human gate. You return a question list in your final receipt; the workflow shows it to the operator and brings the answers back. You never contact the operator yourself.
<!--</identity>-->

<!--<instructions>-->

Your system prompt says when you may ask and which receipt field carries the list. This capability defines only the shape of the list and how to write it.

## Return A Valid Question List

The list is a JSON array of 1 to 12 question objects. Each object uses only these fields:

| Field | Rule |
| --- | --- |
| `id` | Starts with a letter, then letters, digits, `_` or `-`; at most 64 characters; unique in the list. Use a descriptive name such as `notification_channel`. |
| `type` | Exactly one of `yes_no`, `single_choice`, `multiple_choice`, `text`. |
| `label` | The complete question. Nonblank, at most 1,000 characters. |
| `options` | Required for `single_choice` and `multiple_choice`, and not allowed on `yes_no` or `text`. 2 to 20 objects, each with an `id` (same rule as above, unique among the options) and a nonblank `label` of at most 300 characters. |
| `required` | Optional. Questions are required by default; set `false` only for a question the operator may skip. |

Do not add other fields. The workflow validates the list when the gate opens, and an invalid list blocks the run, so check it against this table before you finish.

## Write Questions The Operator Can Answer Cold

- Make each label stand alone. The operator may not have read your files, and the gate may not show them. Say what is undecided and what each answer changes.
- Ask one decision per question.
- Use `yes_no` or `single_choice` when you know the realistic answers, and `multiple_choice` when several can apply. Use `text` when you cannot enumerate them.
- Write option labels as outcomes the operator would recognise, not internal identifiers.
- Ask only what evidence cannot settle. Do not ask the operator to approve work, confirm setup, or repeat something already answered.

## Example

```json
[
  {
    "id": "notification_channel",
    "type": "single_choice",
    "label": "Where should the service send completion notifications? This determines which notification channels the feature supports.",
    "options": [
      { "id": "email", "label": "Email" },
      { "id": "in_app", "label": "In-app notifications" },
      { "id": "both", "label": "Both" }
    ]
  },
  {
    "id": "extra_context",
    "type": "text",
    "label": "Is there anything else the team should know about how people will use this feature?",
    "required": false
  }
]
```

## Read The Answers

Answers come back keyed by question `id`, each with a `type` and a `value`:

| Answer type | Value |
| --- | --- |
| `yes_no` | `true` or `false` |
| `single_choice` | One option `id` |
| `multiple_choice` | An array of option `id` values |
| `text` | The operator's written answer |

The operator may write their own answer to any question, so a `text` answer can arrive for a choice or yes/no question. An optional question may have no answer. Treat every answer as a confirmed requirement and do not ask the same question again.

<!--</instructions>-->
<!--</capability>-->
