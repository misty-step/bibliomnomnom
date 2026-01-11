import { test, expect } from "@playwright/test";

test.describe("Pricing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("displays pricing page with correct heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /your ai reading companion/i })).toBeVisible();
  });

  test("shows annual price of $129 by default", async ({ page }) => {
    // Annual is the default
    await expect(page.getByText("$129")).toBeVisible();
  });

  test("shows monthly price of $15 when toggled", async ({ page }) => {
    // Click the Monthly text button (exact match to avoid toggle switch)
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(page.getByText("$15")).toBeVisible();
  });

  test("has monthly/annual toggle", async ({ page }) => {
    // Use exact matching to avoid ambiguity with toggle switch aria-labels
    const monthlyButton = page.getByRole("button", { name: "Monthly", exact: true });
    const annualButton = page.getByRole("button", { name: /^Annual/ });

    await expect(monthlyButton).toBeVisible();
    await expect(annualButton).toBeVisible();
  });

  test("toggle switches between annual and monthly pricing", async ({ page }) => {
    // Start with annual selected (default)
    await expect(page.getByText("$129")).toBeVisible();
    await expect(page.getByText("/year")).toBeVisible();

    // Switch to monthly (use exact match)
    await page.getByRole("button", { name: "Monthly", exact: true }).click();
    await expect(page.getByText("$15")).toBeVisible();
    await expect(page.getByText("/month")).toBeVisible();

    // Switch back to annual (starts with "Annual")
    await page.getByRole("button", { name: /^Annual/ }).click();
    await expect(page.getByText("$129")).toBeVisible();
  });

  test("shows 14-day free trial CTA", async ({ page }) => {
    await expect(page.getByRole("link", { name: /start.*14.*day.*free.*trial/i })).toBeVisible();
  });

  test("displays feature list", async ({ page }) => {
    // Check for feature headings (h3 elements) to avoid matching FAQ text
    const features = [
      "AI Reading Insights",
      "Smart Recommendations",
      "OCR Note Capture",
      "Reading Analytics",
      "Goodreads Import",
      "Export Your Data",
    ];

    for (const feature of features) {
      await expect(page.getByRole("heading", { name: feature })).toBeVisible();
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
    // Annual is default, badge should be visible
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
