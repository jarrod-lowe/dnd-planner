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

#### Top-bar

On the left through the middle: nothing yet.

On the right, a user dropdown menu with a Gravatar icon. When opened, it should show the user email, a logout button, and the version (v0.0.0 for now; versioning isn't done). It should behave in a properly a11y way. - DONE

#### Main body (select character mode)

In this mode, the user has the option of selecting a character, or creating a new one (if permitted).

Characters are available along with the user data received from `/api/user`. Selecting one should take us to play character mode with that character.

If permitted, there should be an option to create a new character. A new character will need a name to be created. Behind the scenes, it will be a POST to `/api/characters`, and expect an accepted response, and wait a little before going to play character mode with that character.

To create a new character, the user must be part of the MayCreateCharacters cognito group.

#### Main body (play character mode)

Not yet designed - it should just say the character name, and TODO
