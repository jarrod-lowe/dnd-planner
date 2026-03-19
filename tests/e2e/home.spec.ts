import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should load and display the title', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/D&D Planner/);
  });

  test('should display the hello world heading', async ({ page }) => {
    await page.goto('/');

    const heading = page.getByRole('heading', { name: /hello, d&d planner/i });
    await expect(heading).toBeVisible();
  });

  test('should display the description paragraph', async ({ page }) => {
    await page.goto('/');

    const paragraph = page.getByText(/tablet-optimized web application/);
    await expect(paragraph).toBeVisible();
  });
});
