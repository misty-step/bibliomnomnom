import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("displays landing page with branding", async ({ page }) => {
    await page.goto("/");

    // Check title
    await expect(page).toHaveTitle(/bibliomnomnom/i);

    // Check main heading
    await expect(page.getByRole("heading", { name: /bibliomnomnom/i })).toBeVisible();
  });

  test("has sign in link", async ({ page }) => {
    await page.goto("/");

    // Look for sign in button/link
    const signInLink = page.getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible();
  });

  test("has accessible navigation", async ({ page }) => {
    await page.goto("/");

    // Check for navigation landmark
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
  });

  test("footer displays correctly", async ({ page }) => {
    await page.goto("/");

    // Check footer exists with correct content
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/bibliomnomnom/i);
  });
});
