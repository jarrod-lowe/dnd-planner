import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load and display the title', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/D&D Planner/);
  });

  test('should display the hello world heading', async ({ page }) => {
    await page.goto('/');

    // Wait for the heading to appear (i18n must be loaded for this)
    const heading = page.getByRole('heading', { name: /d&d planner/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display the rules engine hello world text', async ({ page }) => {
    await page.goto('/');

    const helloWorldText = page.getByText('Hello from the rules engine');
    await expect(helloWorldText).toBeVisible({ timeout: 10000 });
  });

  test('should display the description paragraph', async ({ page }) => {
    await page.goto('/');

    const paragraph = page.getByText(/tablet-optimized web application/);
    await expect(paragraph).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CSS Theming', () => {
  test('should apply light theme CSS variables', async ({ page }) => {
    await page.goto('/');

    // Wait for content to load
    await page.waitForSelector('h1', { timeout: 10000 });

    const primaryColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim()
    );
    expect(primaryColor).toBe('rgb(144 74 72)'); // Light theme primary
  });

  test('should apply dark theme when preferred', async ({ page }) => {
    // Emulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    // Wait for content to load
    await page.waitForSelector('h1', { timeout: 10000 });

    const primaryColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim()
    );
    expect(primaryColor).toBe('rgb(255 179 176)'); // Dark theme primary
  });

  test('should apply design tokens to page elements', async ({ page }) => {
    await page.goto('/');

    const heading = page.getByRole('heading', { name: /d&d planner/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
    const color = await heading.evaluate((el) => getComputedStyle(el).color);

    // Should use primary color token, not hardcoded #8b0000
    expect(color).not.toBe('rgb(139, 0, 0)');
  });
});
