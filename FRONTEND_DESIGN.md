# Frontend Design

Use the "frontend-design" superpower for all frontend work.

The frontend uses Svelte. The frontend relies on some typescript for the rules engine, but the rules engine is not considered part of the frontend, per se.

## Rules

- We have two theme files - `light.css` and `dark.css`. These contain colour variables. These are the _only_ colours that will be used. You may NOT add any new colours, even with tricky brightness() tricks
- Styling is done by CSS only - no inline formatting
- Be very ARIA-compliant (a11y)
- Use i18n functionality, do not hard-code strings
- Keep the entire appearance consistent - do not make things look different just for the sake of it
- The guiding principal for appearance is "D&D in the desert"
- Use HTML in preference to Javascript/Typescript for user interface
- Check your work with the a11y mcp tools
- Use the TDD superpower for writing any code into Svelte (or if absolutely necessary, Typescript)

While focussed on tablets, the UI should still work and be accessible on other formats - just not necessarily optimal.

## General Layouts

"page" is used colloquially here.

### Not logged in page

This should be a minimalist page introducing the site, with a login button. - DONE

### Logged in page

Two parts: The top-bar, and the main body (in select character mode, or play character mode).

The top bar should be the same height in both modes.

#### Top-bar (select character mode)

On the left, "Select your character" or similar. - DONE

On the right, a user dropdown menu with a Gravatar icon. When opened, it should show the user email, a logout button, and the version (v0.0.0 for now; versioning isn't done). It should behave in a properly a11y way. - DONE

#### Top-bar (play character mode)

On the left, the character name and species. - DONE

On the right, the same user dropdown men as in select character mode. - DONE

#### Main body (select character mode)

In this mode, the user has the option of selecting a character, or creating a new one (if permitted). - DONE

Characters are available along with the user data received from `/api/user`. Selecting one should take us to play character mode with that character. - DONE

If permitted, there should be an option to create a new character. A new character will need a name to be created. Behind the scenes, it will be a POST to `/api/characters`, and expect an accepted response, and wait a little before going to play character mode with that character. - DONE

To create a new character, the user must be part of the MayCreateCharacters cognito group. - DONE

#### Main body (play character mode)

The main body is split into four parts, from the left to right:

- Stats column, intended to contain a quick view of resource and statistic information. (narrow)
- Possible choices column, a vertical list of small "choice" panels, one for each availableRules entry. (wide)
- Plan column, where the choices the user has selected are shown. (wide)
- Journal column, which will just have a TODO for now. (narrow)

The stats column will eventually be dynamic, but for now just shows the movement current/max and a "TODO".

Users can add entries from the possible choices column into the plan, and remove choices from the plan. Every change results in a re-run of the rules engine, which will update the possible choices and resources and stats shown around the display. - DONE

On startup, the system will need to pull the users rule groups from the API. GET `/api/characters/{id}/rule-groups` returns the ids of the rule groups that are relevant. POST `/api/rule-groups/batch` returns all the requested rule groups (max 100, so multiple request might be necessary). - DONE
