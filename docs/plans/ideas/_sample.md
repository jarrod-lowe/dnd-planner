# Title

Description

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Process

1. Using /grill-me, come up with a plan
2. Incorporate test driven development (/tdd) into the plan - remember, RED tests must compile, run, not panic, fail
3. Organise the plan into a series of pull requests - each of which is the smallest meaningful and testable piece of work (TDD applies _inside_ each PR)
4. Place the plan into this file, replacing this "Process" section
5. Include a checklist of items to perform (`[ ] foo`)
6. After approval, execute the checklist in order, ticking items off as you go, and adding notes as necessary
7. Perform additional final testing per PR, including, if helpful:
   - `make sync-rule-groups` to push up rule changes
   - `make deploy-test` to push up backend code or infrastructure changes (also pushes up rule group changes)
   - using playwright to look at the development version of the site on <http://localhost:5173> (the dev server is probably already running)
8. After pushing a PR, launch a monitor for comments from codex on the PR
   - determine whether the comment is valid
   - implement fixes
   - if unsure, discuss with the user
9. Continue until there are no more reviews or failed pipelines
10. **If any step proves unworkable, STOP** - a PR slice that cannot be built as planned, a review fix with no good answer, a pipeline that will not go green. Do not change tack or improvise a different approach; ask the user how to proceed before continuing. Applies to subagents too: report the blocker up rather than routing around it
