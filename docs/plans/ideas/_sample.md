# Title

Description

## Behaviour

Use subagents to perform tasks; the main agent should only be used for co-ordination and communicating with the human. Make sure that is in the plan.
Be extremely concise. Sacrifice grammar for the sake of concision.

## Process

1. Using /grill-me, come up with a plan
2. Incorporate test driven development (/tdd) into the plan - remember, RED tests must compile, run, not panic, fail
3. Place the plan into this file, replacing this "Process" section
4. Include a checklist of items to perform (`[ ] foo`)
5. After approval, execute the checklist in order, ticking items off as you go, and adding notes as necessary
6. Perform additional final testing, including, if helpful:
   - `make sync-rule-groups` to push up rule changes
   - `make deploy-test` to push up backend code or infrastructure changes (also pushes up rule group changes)
   - using playwright to look at the development version of the site on <http://localhost:5173> (the dev server is probably already running)
