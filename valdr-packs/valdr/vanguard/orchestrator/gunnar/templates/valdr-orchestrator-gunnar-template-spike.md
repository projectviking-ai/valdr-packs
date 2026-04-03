<!--<prompt key="valdr-orchestrator-gunnar-template-spike" role="guide">-->
# Task Template: Spike / Research

Use this template when creating spike or research tasks. Fill every section with specific, bounded details.

---

## Question

<The specific question or decision this spike must answer>

- State the question clearly and concisely
- A good spike question is answerable with a concrete recommendation or decision
- Bad: "Research caching" — Good: "Should we use Redis or in-memory LRU for session caching, given our 10k concurrent user target?"

## Research Areas

<Numbered list — what to investigate, compare, or prototype>

1. Area 1: `<specific thing to investigate>`
2. Area 2: ...
3. Area 3: ...

Each area should be scoped enough to investigate within the time box. Include specific technologies, patterns, or approaches to evaluate.

## Constraints

<Time box, technology constraints, compatibility requirements>

- **Time box:** `<hours or days>`
- **Technology constraints:** `<must work with X, cannot use Y>`
- **Compatibility:** `<must integrate with existing system Z>`
- **Performance:** `<must meet threshold N>`

## Expected Output

<What the spike should produce — decision doc, prototype, proof of concept, recommendation>

- Specify the deliverable format: decision document, prototype code, comparison matrix, or recommendation with rationale
- If a prototype, specify where it should live and what it should demonstrate
- If a decision, specify the options that should be evaluated

## Acceptance Criteria

- [ ] Question answered with a concrete recommendation
- [ ] `<N>` options evaluated with pros/cons
- [ ] Prototype demonstrates `<specific capability>` (if applicable)
- [ ] Decision documented in `<location>`
- [ ] Time box of `<duration>` respected

Each criterion must be independently verifiable.

---

**Quality checklist before submitting:**
- [ ] Question is specific and answerable — not open-ended exploration
- [ ] Time box is defined
- [ ] Expected output format is specified
- [ ] Acceptance criteria define "done" for the research

<!--</prompt>-->
