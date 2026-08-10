# AGENTS.md

Guidance for LLM Agents working in this repository.

Q: Are you writing new rules? A: See docs/RULE_GROUP_GUIDE.md - this is the
primary guide to use, read it carefully. Do not skip this when writing new
rules.

## Purpose

A tablet-optimized web application for tracking D&D character resources and planning combat turns.

## Critical Rules

These rules are critical. Keep them through compactions, and add them into an plans you create.

### TDD

- Use the TDD superpower for all code changes

### Infrastructure Operations

- **NEVER run `terraform` commands directly.** Always use Make targets:
  - `make clean` - clean up state (useful if .terraform is in an inconsistent state)
  - `make setup-state` - Setup state infrastructure
  - `make setup-aws` - Setup AWS infrastructure (OIDC, IAM roles)
  - `make setup-github` - Setup GitHub configuration
  - `make deploy-test` - Deploy test environment
  - `make format` - Prettify
  - `make validate` - Validate all environments
  - Do not forget this when doing backend work

- **AWS commands** are permitted for read-only operations, but always set the profile:

  ```bash
  aws <read-only-command> --profile dnd-planner-ro --region ap-southeast-2
  ```

Avoid `$(...)` in commands, as they trigger security checks that slow you down.

### Git

- **NEVER** commit to git while tests fail
- **NEVER** commit to main

### Plan Execution

- **If you discover a plan won't work, STOP.** Do not change tack or improvise a different approach. Ask the user how to proceed before continuing.

### I18n

- **All user-facing text must be added to the i18n system.** Do not hardcode strings in the frontend; use the translation files and keys instead. Make sure to explicitly note this in any plans involving front-end (Svelte/Typescript) development.

### A11y

- Always design the frontend with accessibility in mind
- Use semantic HTML elements and ARIA attributes where appropriate
- Ensure good color contrast and keyboard navigability
- Do not forget this when doing frontend work

### The CSS Law

- Do NOT EVER create new colours; all colours exist in the theme files, use those variables only
- CSS styles should be semantic, and re-used
- Do not forget this when doing frontend work

### Testing

- Regularly run `make test` to check all tests pass
- Run `make test` before you declare yourself done
- To update the test environment seed data and rule groups, run `make sync-rule-groups`
- To fully update the test environment, run `make deploy-test`
- To run the dev vite server run `make dev` - but check it isn't already running first `pgrep -f vite.js`

### Forbidden commands

- **DO NOT USE** `find ... -exec grep ...` or `find ... -exec xargs grep ...`; use `rg` instead
- **DO NOT USE** `$(...)` wherever possible (consider running interior commands separately and remembering their output)
- **DO NOT USE** `terraform`, use the make targets for it
- **DO NOT USE** python or node, etc, to validate JSON or YAML - use `jq` and `yq` (WITHOUT redirections!)
- Avoid `find`
- Avoid redirections (`>`, `2>`, `<`, `|`) and chaining (`&&`, `||`) and `sed` - they trigger sandbox restrictions
- Avoid `cd DIR; command` where possible - it triggers sandbox restrictions

## Technology Stack

| Layer           | Technology             |
| --------------- | ---------------------- |
| Frontend        | SvelteKit + TypeScript |
| Build           | Vite                   |
| State           | Svelte 5 stores        |
| Backend         | API Gateway + DynamoDB |
| Auth            | AWS Cognito            |
| Hosting         | S3 + CloudFront        |
| Testing         | Vitest, Playwright     |
| Package Manager | pnpm                   |
| Infrastructure  | Terraform              |

## Repository Structure

```plain
terraform/
├── environment/       # Terraform environments
│   ├── state/        # State bucket infrastructure
│   ├── aws/          # OIDC provider + IAM roles
│   ├── github/       # GitHub ruleset, environments, secrets
│   ├── test/         # Test environment
│   └── prod/         # Production environment
└── module/           # Reusable Terraform modules
```

## Common Commands

```bash
make dev          # Start development server
make build        # Compile everything
make test         # Run all tests
make lint         # Run ESLint
make format       # Run Prettier
make deploy-test  # Deploy to the test environment
```

## Design Principles

- Touch-optimized for tablet use during gameplay
- Client-side rules engine for instant feedback
- Optimistic UI updates for responsiveness
- SvelteKit static adapter - no server costs
- The rules engine handles rules, the UI handles the interface; keep the clear interface between them
- Use TDD strictly
- When writing new rules, add to the yaml scenarios runner

## Notable Code Features

- Rules are TypeScript modules (`src/lib/rules-engine/rules/`) evaluated by a pure dataflow engine; the engine's output feeds the UI and is handed back (with the plan and committed effects) on the next evaluation
  - See RULES_ENGINE.md for the engine specification
  - See FRONTEND_DESIGN.md for the initial design of the frontend
  - See DATA_MODEL.md for a description of the DynamoDB data model
  - See docs/RULE_GROUP_GUIDE.md for how to write new rules
- The YAML under `data/rule-groups/` is metadata only (translations, requires, settings, condition, detail) — it carries no rules, and the schema rejects them
- Evaluation ordering is structural (derived from what each contribution reads), not authored — there are no phases, groups, or `after`
  - Do NOT propose adding ordering controls; express a value as a derivation of the facts it depends on
- Actions never write facts: an offer's `apply` advertises effects, and the committed-effects list is the persisted character state
