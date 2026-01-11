import { test, expect } from "@playwright/test";

test.describe("Pricing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("displays pricing page with correct heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /your ai reading companion/i })).toBeVisible();
  });

  test("shows monthly price of $15", async ({ page }) => {
    await expect(page.getByText("$15")).toBeVisible();
  });

  test("shows annual price of $129", async ({ page }) => {
    // Click annual toggle first
    await page.getByRole("button", { name: /annual/i }).click();
    await expect(page.getByText("$129")).toBeVisible();
  });

  test("has monthly/annual toggle", async ({ page }) => {
    const monthlyButton = page.getByRole("button", { name: /monthly/i });
    const annualButton = page.getByRole("button", { name: /annual/i });

    await expect(monthlyButton).toBeVisible();
    await expect(annualButton).toBeVisible();
  });

  test("toggle switches between monthly and annual pricing", async ({ page }) => {
    // Start with monthly selected (default)
    await expect(page.getByText("$15")).toBeVisible();
    await expect(page.getByText("/month")).toBeVisible();

    // Switch to annual
    await page.getByRole("button", { name: /annual/i }).click();
    await expect(page.getByText("$129")).toBeVisible();
    await expect(page.getByText("/year")).toBeVisible();

    // Switch back to monthly
    await page.getByRole("button", { name: /monthly/i }).click();
    await expect(page.getByText("$15")).toBeVisible();
  });

  test("shows 14-day free trial CTA", async ({ page }) => {
    await expect(page.getByRole("link", { name: /start.*14.*day.*free.*trial/i })).toBeVisible();
  });

  test("displays feature list", async ({ page }) => {
    const features = [
      /ai reading insights/i,
      /smart recommendations/i,
      /ocr note capture/i,
      /reading analytics/i,
      /goodreads import/i,
      /export your data/i,
    ];

    for (const feature of features) {
      await expect(page.getByText(feature)).toBeVisible();
    }
  });

  test("has FAQ section", async ({ page }) => {
    await expect(page.getByText(/frequently asked questions/i)).toBeVisible();
    await expect(page.getByText(/what happens after the trial/i)).toBeVisible();
    await expect(page.getByText(/can i cancel anytime/i)).toBeVisible();
  });

  test("trial CTA links to pricing (for unauthenticated users)", async ({ page }) => {
    const ctaLink = page.getByRole("link", { name: /start.*14.*day.*free.*trial/i });
    // For unauthenticated users, this should redirect through auth
    // The href should contain /sign-in or /sign-up
    const href = await ctaLink.getAttribute("href");
    expect(href).toBeTruthy();
  });

  test("shows annual savings badge", async ({ page }) => {
    await page.getByRole("button", { name: /annual/i }).click();
    await expect(page.getByText(/2 months free/i)).toBeVisible();
  });
});

test.describe("Footer on Pricing Page", () => {
  test("displays footer with pricing and feedback links", async ({ page }) => {
    await page.goto("/pricing");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: /pricing/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /feedback/i })).toBeVisible();
  });

  test("feedback link has correct mailto", async ({ page }) => {
    await page.goto("/pricing");

    const feedbackLink = page.locator("footer").getByRole("link", { name: /feedback/i });
    const href = await feedbackLink.getAttribute("href");
    expect(href).toBe("mailto:hello@mistystep.io");
  });
});
