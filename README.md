# D&D Turn Planner

A tablet-optimized web application for tracking D&D character resources and planning combat turns.

## Goals

Help players plan their turn while other players are taking their turns. The app
is designed for tablet use during gameplay sessions.

The app does not prevent a player from breaking the rules - in case the DM
allows them to make any exception - but it marks things that cannot be done
without breaking the rules as illegal.

### Primary Goals

1. **Instant Resource Tracking** - Quickly track spell slots, Lay on Hands, Channel Divinity, and other resources
2. **Turn Planning** - Plan upcoming actions while waiting for other players
3. **Effect Management** - Track concentration spells, buffs, and duration-based effects
4. **Rest Management** - Easy short/long rest workflow

This is focussed on the players own turn. It does not have any knowledge of the
actions of other players, or the GM, beyond what the user tells it. It does not
require the user to keep informing it of things happening around the table all
the time.

### Target Experience

Running on a tablet during gameplay. One-handed operation. Quick taps. Clear visual state.

## D&D

This work includes material from the System Reference Document 5.2 (“SRD 5.2”)
by Wizards of the Coast LLC, available at <https://www.dndbeyond.com/srd>. The
SRD 5.2 is licensed under the Creative Commons Attribution 4.0 International
License, available at <https://creativecommons.org/licenses/by/4.0/legalcode>.

## Character Focus

**Initial Implementation:** Level 3 Paladin - Oath of Redemption (D&D 5e 2024 rules)

### Resources to Track

| Resource         | Level 3 Details                                              |
| ---------------- | ------------------------------------------------------------ |
| Spell Slots      | Level 1: 2 slots/day (2024 rules grant 1st-level at level 3) |
| Lay on Hands     | 15 HP pool (5 × level) for healing                           |
| Channel Divinity | 1 use/short rest                                             |
| Divine Smite     | Costs spell slots for bonus damage                           |
| Concentration    | Active spell tracking with save DC                           |

### Oath of Redemption Features (Level 3)

| Feature                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| **Abjure Enemy**       | Frighten target - must flee on failed Wisdom save     |
| **Rebuke the Violent** | Reflect damage to attacker (same type + CHA modifier) |

### Always-Prepared Spells (Level 3 Paladin)

Command, Heroism, Sanctuary - plus 2 additional from Paladin spell list.

## Core Concepts

### Characters

A user may have multiple characters.

### Plans

A **Plan** represents a combat scenario or encounter. Characters can have multiple saved plans, one of which is the active plan.

Each plan contains **Steps** that define actions for each turn.

**Active Plan Actions:**

- **Save** - Persist the current state to saved plans
- **Action** - Execute a step's effects on character resources
- **Delete** - Remove the plan

### Steps

Each **Step** in a plan represents what happens on a turn:

| Step Type        | Examples                                          |
| ---------------- | ------------------------------------------------- |
| **Action**       | Attack, cast spell, use Channel Divinity          |
| **Bonus Action** | Lay on Hands, certain spells                      |
| **Reaction**     | Shield, opportunity attacks                       |
| **Rest**         | Short or long rest (performs all rest operations) |

**Step Behaviour:**

- Each step tracks its **resource costs**
- When actioned, costs apply to character
- Plan tracks **total resource changes** across all steps

### Effects

| Effect Type       | Examples                              |
| ----------------- | ------------------------------------- |
| **Concentration** | Active spell requiring concentration  |
| **Buff**          | Bless from party member, Paladin aura |
| **Debuff**        | Poison, frightened condition          |

**Effect Behaviour:**

- **Per-plan preview:** Plan shows how effects would change when actioned
- **Global application:** When plan is actioned, effects apply to character
- **Multi-actionable:** Plans can be actioned multiple times (different turns)

## Technology Stack

| Layer            | Technology                                                     |
| ---------------- | -------------------------------------------------------------- |
| UI Framework     | SvelteKit + static adapter (`.svelte` components)              |
| Type Definitions | TypeScript (shared types for all code)                         |
| Build Tool       | Vite                                                           |
| State Management | Svelte 5 stores (`$state`, `$derived`, `$effect`)              |
| Rules Engine     | TypeScript module (runs in browser - separate concern)         |
| AWS Integration  | Amplify library v6 (library only - NO CLI, NO Amplify Hosting) |
| Backend          | API Gateway + DynamoDB                                         |
| Authentication   | AWS Cognito                                                    |
| Hosting          | S3 + CloudFront (prod/staging), Vite dev server                |
| Testing          | Vitest (unit/integration), Playwright (E2E)                    |
| Package Manager  | pnpm                                                           |
| Build/Deploy     | Make                                                           |
| CI/CD            | GitHub Actions                                                 |

**Constraint:** All code is TypeScript - no direct JavaScript.

## Architecture

```plain
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SvelteKit │────▶│ API Gateway │────▶│  DynamoDB   │
│   (Browser) │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│Rules Engine │◀────────────────────────│ Rules Data  │
│  (TS/Local) │     API                 │  (Cache)    │
└─────────────┘                         └─────────────┘
       │
       ▼
┌─────────────┐
│   Cognito   │
└─────────────┘
```

### UI vs. Rules Engine Separation

**UI Code (SvelteKit):**

- Svelte components (`.svelte` files)
- SvelteKit pages and layouts
- Svelte stores for UI state
- Handles user interactions and display

**Rules Engine (TypeScript, browser):**

- Receives rule data from API (spells, features, costs)
- Validates actions (e.g., "can I cast this spell with my current slots?")
- Enforces game rules independent of UI
- Returns results to UI components

**Why Separate?**

- Clear separation of concerns
- Easier to test rules in isolation
- UI changes don't require rule changes
- Rules updates happen via API data, not code changes

### Key Design Decisions

| Decision                     | Rationale                                                                |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Client-side rules engine** | Instant feedback, works offline after initial load, reduces server costs |
| **Optimistic UI updates**    | Responsive feel during gameplay, no waiting for network                  |
| **SvelteKit static adapter** | No server costs, CDN delivery, works offline                             |
| **Amplify library only**     | Full control over architecture, no CLI opinions                          |
| **Multi-plan support**       | Reusable combat scenarios, flexible planning workflow                    |

## Data Model Concepts

| Entity        | Contains                                          |
| ------------- | ------------------------------------------------- |
| **Character** | Profile, current resources, global active effects |
| **Plan**      | Saved combat scenario, list of steps              |
| **Step**      | Action/bonus/reaction/rest with resource costs    |
| **Effect**    | Concentration, buff, debuff with duration         |

## Design Principles

| Principle                   | Application                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| **Touch-Optimized**         | Large tap targets, gestures for common actions                   |
| **Minimal Friction**        | One-tap actions, no confirmation dialogues for common operations |
| **Visual Clarity**          | At-a-glance resource state, clear progress indicators            |
| **Rules as Data**           | All D&D rules loaded from API, not hardcoded                     |
| **Progressive Enhancement** | Core works, features sync when available                         |

## Getting Started

```bash
# Start development server
make dev

# Run tests
make test

# Build for production
make build

# Deploy to AWS
make deploy
```

### Make Targets

| Target          | Description                       |
| --------------- | --------------------------------- |
| `make dev`      | Start Vite dev server             |
| `make build`    | Build SvelteKit for production    |
| `make test`     | Run Vitest unit/integration tests |
| `make test:e2e` | Run Playwright E2E tests          |
| `make deploy`   | Deploy to S3 + CloudFront         |
| `make clean`    | Clean build artifacts             |
| `make lint`     | Run ESLint                        |
| `make format`   | Run Prettier                      |

## Deployment

### Setup Overview

The deployment follows this dependency chain:

```plain
State Infrastructure (S3 bucket with versioning for state locking)
         │
         ▼
      AWS Infrastructure (OIDC provider + IAM roles)
         │
         ▼
     GitHub Configuration (ruleset, environments, secrets)
         │
         ▼
    CI/CD Pipelines (automate test/prod deployments)
```

**Critical:** Each step depends on the previous step completing successfully. The state bucket must exist first because ALL other environments (test, prod, aws, github) use it to store their Terraform state.

### Initial Setup (One-time)

Run these commands in order:

```bash
# 1. Set your AWS profile (or override: AWS_PROFILE=your-profile make setup-state)
# Add a dnd-planner to your ~/.aws/config with suitable permissions
export AWS_PROFILE=dnd-planner

# 2. Setup state infrastructure (creates S3 bucket with versioning)
make setup-state

# 3. Deploy AWS infrastructure (OIDC provider + IAM roles)
make setup-aws

# 4. Setup GitHub configuration (ruleset, environments, secrets)
#    Optional: Add Codacy API token to terraform/environment/github/terraform.tfvars
make setup-github

# 5. Deploy to the Test environment
make deploy-test

# Deploying to the Prod environment is done through CI/CD
make preflight # prettifies and tests
# Then commit to github and raise a PR
```

### CI/CD Pipeline

| Workflow                       | Trigger                           | Action                                                          |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------- |
| `environment-test-plan.yaml`   | Pull request to main              | Runs terraform plan for test environment, comments plan on PR   |
| `environment-test-deploy.yaml` | Push to main                      | Runs terraform apply for test environment, triggers prod deploy |
| `environment-prod-deploy.yaml` | Workflow dispatch (manual)        | Runs terraform apply for prod environment                       |
| `dependabot-automerge.yml`     | Dependabot PR opened/synchronized | Enables auto-merge after status checks pass                     |

### Environment Configuration

| Environment | Region         | State File                           | State Bucket                       |
| ----------- | -------------- | ------------------------------------ | ---------------------------------- |
| test        | ap-southeast-2 | `dnd-planner/test/terraform.tfstate` | dnd-planner-iac-state-{account_id} |
| prod        | ap-southeast-2 | `dnd-planner/prod/terraform.tfstate` | dnd-planner-iac-state-{account_id} |

**Note:** State bucket name uses your AWS account ID for deterministic naming. S3 versioning provides state locking.

### Resource Naming Convention

All AWS resources follow: `dnd-planner-{env}-{resource_name}`

Example: `dnd-planner-test-bucket`, `dnd-planner-prod-table`

### Branch Protection

Main branch enforces:

- Linear history required
- Pull request required with review
- `Environment Test - Plan` status check must pass
- No force pushes or deletions
- Branches automatically deleted after merge

## Future Expansion

The architecture supports:

- Multiple characters per user
- Additional D&D classes and levels
- Higher level features
- Party-wide resource tracking
- Export/import character data

## TODO

- Disable merge bypass option
- Missing lots of checks in pipeline
- Restructure deploy pipeline to build in a separate one earlier?
- Better favicon
- A11y - periodically recheck
- Federate Cognito to Google
- Can we get rid of the .html/no .html stuff for /auth/callback between dev (SvelteKit) and test/prod (s3)?
- Sans Serif Font?
- Effect on End Turn, to make it being actioned is obvious
- Allow stacking effects
- Fix main page length
- Fix quotas
- Weapon: Thrown (item count) [Javelin=6]
- Limit Cleave to once per turn
- Finish Help
- Tools (proficiency)
- Periapt of Wound Closure
- Configuration done (to make all configuration illegal)
- Two weapon fighting
- Use and restoration of hit die
- Paladin Oath of Redemption Level 3
  - Better tests for Divinity Points behaviour including double use of Divinity-using actions (bug?)
- Test for rulegroup requires that don't exist
  - Check rulegroup requires for cycles
  - Also check they are correct
- Thunderous Smite & Divine Smite: Should depend specifically on MELEE or UNARMED attacks
  - Javelin should only mention them when in 5ft mode
- Increase {skill} needs illegal marker in Planned column
- Ready (with spell concentration rules)
- Rename "Spellcasting" to "Magic"
- Paladin Long Rest: May swap one prepared spell
- Log UI errors to AWS?
- Improve Divine Favour to be inline with attacks
- Radiant and Bludgeoning symbols look very similar
- Alert feat is not the only option for Human origin feat
- De-duplicate icon sources in code
- Handle multiple steeds properly
- Find Steed steed's actual actions & abilities
  - fix 3x otherworldly steed entries in active; and the need to remove 2 to remove it
  - Hit Dice
  - Player mount/dismount move
  - Otherworldly Slam should not be available while mounted
  - Help, Ready, Search, Hide, Utilise, ...; while not mounted
- Shorten resources names
- Check for hard-coded english everywhere
- make search keywords be explicitly defined in yaml (currently they are implicitly the same as the ui.name, but sub .name for .keywords)

### Low Priority

- Other Mastery effects (including Nick, which exists but doesn't do anything)
- Conditions
- Defences
- Weapon/Tool/Armour Proficiencies
- Reduce duplication - e.g. We have no_action text and action consumption per action; this should be one text, and a \*target
- Reduce code duplication - check e.g. when and legalWhen use the same code
- Sort effects into more meaningful sections
- Deduplicate/rationalise translations
