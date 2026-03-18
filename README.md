# D&D Turn Planner

A tablet-optimized web application for tracking D&D character resources and planning combat turns.

## Goals

Help players manage combat resources efficiently while other players are taking their turns. The app is designed for tablet use during gameplay sessions.

### Primary Goals

1. **Instant Resource Tracking** - Quickly track spell slots, Lay on Hands, Channel Divinity, and other resources
2. **Turn Planning** - Plan upcoming actions while waiting for other players
3. **Effect Management** - Track concentration spells, buffs, and duration-based effects
4. **Rest Management** - Easy short/long rest workflow
5. **Multiple Plans** - Save reusable combat scenarios

### Target Experience

Running on a tablet during gameplay. One-handed operation. Quick taps. Clear visual state.

## Character Focus

**Initial Implementation:** Level 3 Paladin - Oath of Redemption (D&D 5e 2024 rules)

### Resources to Track

| Resource | Level 3 Details |
| --- | --- |
| Spell Slots | Level 1: 2 slots/day (2024 rules grant 1st-level at level 3) |
| Lay on Hands | 15 HP pool (5 × level) for healing |
| Channel Divinity | 1 use/short rest |
| Divine Smite | Costs spell slots for bonus damage |
| Concentration | Active spell tracking with save DC |

### Oath of Redemption Features (Level 3)

| Feature | Description |
| --- | --- |
| **Abjure Enemy** | Frighten target - must flee on failed Wisdom save |
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

| Step Type | Examples |
| --- | --- |
| **Action** | Attack, cast spell, use Channel Divinity |
| **Bonus Action** | Lay on Hands, certain spells |
| **Reaction** | Shield, opportunity attacks |
| **Rest** | Short or long rest (performs all rest operations) |

**Step Behaviour:**

- Each step tracks its **resource costs**
- When actioned, costs apply to character
- Plan tracks **total resource changes** across all steps

### Effects

| Effect Type | Examples |
| --- | --- |
| **Concentration** | Active spell requiring concentration |
| **Buff** | Bless from party member, Paladin aura |
| **Debuff** | Poison, frightened condition |

**Effect Behaviour:**

- **Per-plan preview:** Plan shows how effects would change when actioned
- **Global application:** When plan is actioned, effects apply to character
- **Multi-actionable:** Plans can be actioned multiple times (different turns)

## Technology Stack

| Layer | Technology |
| --- | --- |
| UI Framework | SvelteKit + static adapter (`.svelte` components) |
| Type Definitions | TypeScript (shared types for all code) |
| Build Tool | Vite |
| State Management | Svelte 5 stores (`$state`, `$derived`, `$effect`) |
| Rules Engine | TypeScript module (runs in browser - separate concern) |
| AWS Integration | Amplify library v6 (library only - NO CLI, NO Amplify Hosting) |
| Backend | API Gateway + DynamoDB |
| Authentication | AWS Cognito |
| Hosting | S3 + CloudFront (prod/staging), Vite dev server |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Package Manager | pnpm |
| Build/Deploy | Make |
| CI/CD | GitHub Actions |

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

| Decision | Rationale |
| --- | --- |
| **Client-side rules engine** | Instant feedback, works offline after initial load, reduces server costs |
| **Optimistic UI updates** | Responsive feel during gameplay, no waiting for network |
| **SvelteKit static adapter** | No server costs, CDN delivery, works offline |
| **Amplify library only** | Full control over architecture, no CLI opinions |
| **Multi-plan support** | Reusable combat scenarios, flexible planning workflow |

## Data Model Concepts

| Entity | Contains |
| --- | --- |
| **Character** | Profile, current resources, global active effects |
| **Plan** | Saved combat scenario, list of steps |
| **Step** | Action/bonus/reaction/rest with resource costs |
| **Effect** | Concentration, buff, debuff with duration |

## Design Principles

| Principle | Application |
| --- | --- |
| **Touch-Optimized** | Large tap targets, gestures for common actions |
| **Minimal Friction** | One-tap actions, no confirmation dialogues for common operations |
| **Visual Clarity** | At-a-glance resource state, clear progress indicators |
| **Rules as Data** | All D&D rules loaded from API, not hardcoded |
| **Progressive Enhancement** | Core works, features sync when available |

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
# or
make dev

# Run tests
pnpm test
pnpm test:e2e
# or
make test

# Build for production
pnpm build
# or
make build

# Deploy to AWS
make deploy
```

### Make Targets

| Target | Description |
| --- | --- |
| `make dev` | Start Vite dev server |
| `make build` | Build SvelteKit for production |
| `make test` | Run Vitest unit/integration tests |
| `make test:e2e` | Run Playwright E2E tests |
| `make deploy` | Deploy to S3 + CloudFront |
| `make clean` | Clean build artifacts |
| `make lint` | Run ESLint |
| `make format` | Run Prettier |

## Future Expansion

The architecture supports:

- Multiple characters per user
- Additional D&D classes and levels
- Higher level features
- Party-wide resource tracking
- Export/import character data
