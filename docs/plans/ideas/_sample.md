# Title

Description

## Process

1. Using brainstorming, come up with a plan
2. Incorporate test driven development (superpower) into the plan - remember, RED tests must compile, run, not panic, fail
3. Place the plan into this file
4. Include a checklist of items to perform (`[ ] foo`)
5. After approval, execute the checklist in order, ticking items off as you go, and adding notes as necessary
6. Perform additional final testing, including, if helpful:
   - `make sync-rule-groups` to push up rule changes
   - `make deploy-test` to push up backend code or infrastructure changes (also pushes up rule group changes)
   - using playwright to look at the development version of the site on <http://localhost:5173> (the dev server is probably already running)
