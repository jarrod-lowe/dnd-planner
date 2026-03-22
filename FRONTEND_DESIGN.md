# Frontend Design

Use the "frontend-design" superpower for all frontend work.

The frontend uses Svelte. The frontend relies on some typescript for the rules engine, but the rules engine is not considered part of the frontend, per se.

## Rules

- We have two theme files - `light.css` and `dark.css`. These contain colour variables. These are the _only_ colours that will be used
- Styling is done by CSS only - no inline formatting
- Be very ARIA-compliant (a11y)
- Use i18n functionality, do not hard-code strings
- Keep the entire appearance consistent - do not make things look different just for the sake of it
- The guiding principal for appearance is "D&D in the desert"
- Use HTML in preference to Javascript/Typescript for user interface
- Check your work with the a11y mcp tools

## General Layouts

"page" is used colloquially here.

### Not logged in page

This should be a minimalist page introducing the site, with a login button.

### Logged in page

Two parts: The top-bar, and the main body.

#### Top-bar

On the left through the middle: nothing yet.

On the right, a user dropdown menu with a Gravatar icon. When opened, it should show the user email, a logout button, and the version (v0.0.0 for now; versioning isn't done). It should behave in a properly a11y way.

#### Main body

Not yet designed - it should just say TODO
