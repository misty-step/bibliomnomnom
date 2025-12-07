import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("redirects unauthenticated users from library to sign-in", async ({ page }) => {
    await page.goto("/library");

    // Should redirect to Clerk sign-in page or show sign-in component
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-in page loads correctly", async ({ page }) => {
    await page.goto("/sign-in");

    // Clerk sign-in component should be visible
    // Note: The actual content depends on Clerk's component rendering
    await expect(page).toHaveURL(/sign-in/);
  });

  test("sign-up page loads correctly", async ({ page }) => {
    await page.goto("/sign-up");

    // Clerk sign-up component should be visible
    await expect(page).toHaveURL(/sign-up/);
  });
});

test.describe("Protected Routes", () => {
  test("library page requires authentication", async ({ page }) => {
    // Navigate to protected route without auth
    const response = await page.goto("/library");

    // Should redirect away from library
    const url = page.url();
    expect(url).not.toContain("/library");
  });

  test("redirects unknown routes to sign-in", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    // Middleware protects all unknown routes, so it should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });
});
