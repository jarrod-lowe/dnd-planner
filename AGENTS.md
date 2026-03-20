# AGENTS.md

Guidance for LLM Agents working in this repository.

## Purpose

A tablet-optimized web application for tracking D&D character resources and planning combat turns.

## Critical Rules

These rules are critical. Keep them through compactions, and add them into an plans you create.

### Infrastructure Operations

- **NEVER run `terraform` commands directly.** Always use Make targets:
  - `make setup-state` - Setup state infrastructure
  - `make setup-aws` - Setup AWS infrastructure (OIDC, IAM roles)
  - `make setup-github` - Setup GitHub configuration
  - `make deploy-test` - Deploy test environment
  - `make fmt` - Format terraform files
  - `make validate` - Validate all environments
  - Do not forget this when doing backend work

- **AWS commands** are permitted for read-only operations, but always set the profile:

  ```bash
  AWS_PROFILE=dnd-planner aws <read-only-command>
  ```

### Plan Execution

- **If you discover a plan won't work, STOP.** Do not change tack or improvise a different approach. Ask the user how to proceed before continuing.

### I18n

- **All user-facing text must be added to the i18n system.** Do not hardcode strings in the frontend; use the translation files and keys instead. Make sure to explicitly note this in any plans involving front-end (Svelte/Typescript) development.

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

## The CSS Law

- Do NOT EVER create new colours; all colours exist in the theme files, use those variables only
- CSS styles should be semantic, and re-used
- Do not forget this when doing frontend work
