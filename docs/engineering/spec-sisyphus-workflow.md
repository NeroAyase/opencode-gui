# Spec and Sisyphus Workflow

## Purpose

This document defines how standard engineering specs and Sisyphus execution plans should work together in this repository.

The goal is to preserve engineering intent while still allowing Sisyphus-driven agents to execute with high autonomy.

## Ownership

- `specs/*.md` owns product intent, engineering decisions, scope, goals, non-goals, and acceptance criteria.
- `.sisyphus/plans/*.md` owns execution orchestration, task dispatch, evidence capture, parallel waves, and final review.
- `.sisyphus/evidence/*` owns command output, screenshots, logs, QA traces, and review artifacts.
- `docs/engineering/*.md` owns cross-cutting analysis, handoff notes, roadmap state, and workflow rules.

## Core Rule

Sisyphus plans may expand execution detail, but they must not expand scope.

If a Sisyphus plan needs to add a new deliverable, change a non-goal, reinterpret acceptance criteria, or promote optional cleanup into required work, update the source spec first.

## Required Flow

1. Write or update the standard spec.
2. Generate or update the Sisyphus plan from that spec.
3. Execute the plan.
4. Capture evidence under `.sisyphus/evidence/`.
5. Run final review.
6. Sync the roadmap, `TODO.md`, and any affected docs.

## Scope Change Protocol

Use this rule during execution:

- If the work changes what is being built, update the spec.
- If the work changes how agents execute, update the Sisyphus plan.
- If the work changes project status, update the roadmap or `TODO.md`.
- If the work only records command output or QA proof, write evidence.

Examples:

- Adding a new feature belongs in the spec first.
- Changing agent parallelization belongs in the Sisyphus plan.
- Recording an E2E failure belongs in evidence and any linked triage doc.
- Moving an item from Tier 3 to Tier 1 belongs in the roadmap/spec first.

## Plan Generation Constraints

When generating `.sisyphus/plans/*.md` from a standard spec:

- Keep each Sisyphus task traceable to a spec phase, goal, or acceptance criterion.
- Do not introduce new source files, new docs, new tests, or new cleanup work unless the spec permits them.
- Mark optional discoveries as follow-up candidates, not as required tasks.
- Keep mechanical cleanup separate from behavior changes.
- Preserve explicit non-goals from the spec.
- Preserve upstream attribution references, especially Opencode and `anomalyco/opencode`, unless the spec explicitly says to rewrite them.

## Review Rules

Reviewers should evaluate Sisyphus plans in two layers:

- As an execution plan: check sequencing, evidence, isolation, verification, and agent handoff clarity.
- Against the source spec: check that the plan does not expand, narrow, or distort the approved scope.

Do not reject a Sisyphus plan only because it includes agent dispatch, evidence files, review waves, or other execution machinery. Reject it when that machinery changes the engineering intent or creates avoidable execution risk.

## Recommended File Pattern

For substantial work, use this structure:

```text
specs/<work-item>.md
.sisyphus/plans/<work-item>.md
.sisyphus/evidence/<work-item>/
docs/engineering/<optional-handoff-or-triage>.md
```

For roadmap-derived work, the roadmap may act as the source spec only if it includes clear scope, non-goals, and acceptance criteria. If it does not, create a standard spec before generating a Sisyphus plan.

## Tier 1 Application

For `.sisyphus/plans/tier1-release-blockers.md`, the source of truth is `docs/engineering/next-steps-roadmap.md` until a dedicated `specs/tier1-release-blockers.md` exists.

The Sisyphus plan may detail E2E triage, rename steps, evidence capture, and review waves. It should not widen the work beyond the roadmap without first updating the roadmap or creating a standard spec.
