import { expect, test } from "@playwright/test";

test("mobile core pages render and navigation is stable", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("link", { name: "Add recipe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask" })).toHaveCount(0);

  await page.getByRole("link", { name: "Plan" }).click();
  await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();

  await page.getByRole("link", { name: "Shop" }).click();
  await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("link", { name: "Export JSON" })).toBeVisible();
});

test("plan day clicks open meals and dragging selects a continuous range", async ({ page }) => {
  await page.goto("/plan", { waitUntil: "networkidle" });

  const selectionPanel = page.getByRole("region", { name: "Selected planning days" });
  await expect(selectionPanel).toContainText("Select planning days");
  await expect(selectionPanel).toContainText("Click a day to view meals.");
  await expect(selectionPanel.getByRole("button")).toHaveCount(0);

  const currentMonthDays = page.locator(".meal-calendar-day:not(.meal-calendar-day-muted)");
  await currentMonthDays.first().click();
  await expect(page.getByRole("heading", { name: "Meals" })).toBeVisible();
  await expect(selectionPanel.getByRole("button")).toHaveCount(0);
  await page.getByRole("button", { name: "Close day plan" }).click();

  const dragStart = currentMonthDays.nth(1);
  const dragEnd = currentMonthDays.nth(4);
  const startBox = await dragStart.boundingBox();
  const endBox = await dragEnd.boundingBox();
  expect(startBox).not.toBeNull();
  expect(endBox).not.toBeNull();

  await page.mouse.move(startBox!.x + startBox!.width / 2, startBox!.y + startBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox!.x + endBox!.width / 2, endBox!.y + endBox!.height / 2, {
    steps: 8
  });
  await page.mouse.up();

  await expect(selectionPanel).toContainText("4 days selected");
  await expect(page.locator(".meal-calendar-day-batch-selected")).toHaveCount(4);
  await expect(selectionPanel.getByRole("button", { name: "Meals" })).toHaveCount(0);

  await dragStart.click();
  await expect(selectionPanel).toContainText("3 days selected");
  await expect(page.locator(".meal-calendar-day-batch-selected")).toHaveCount(3);
});

test("add recipe wizard unifies AI URL and manual creation", async ({ page }) => {
  await page.goto("/library/add", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Add recipe" })).toBeVisible();
  await expect(page.getByRole("button", { name: /AI/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Generate draft" })).toBeVisible();

  await page.getByRole("button", { name: /URL/ }).click();
  await expect(page.getByRole("button", { name: "Review import" })).toBeVisible();
  await expect(page.getByPlaceholder("https://example.com/favorite-dinner")).toBeVisible();

  await page.getByRole("button", { name: /Search Web/ }).click();
  await expect(page.getByPlaceholder("Search recipes")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search Web" })).toBeVisible();
  await expect(page.getByText("Try a recipe name, or pick a filter and search.")).toBeVisible();

  await page.getByRole("button", { name: /Manual/ }).click();
  await expect(page.getByRole("button", { name: "Save recipe" })).toBeVisible();

  await page.goto("/library/import?url=https%3A%2F%2Fexample.com%2Ffamily-dinner");
  await expect(page).toHaveURL(/\/library\/add\?mode=url/);
  await expect(page.locator('input[value="https://example.com/family-dinner"]')).toBeVisible();

  await page.getByRole("link", { name: "Back to library" }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("saved recipe cooking controls work on mobile", async ({ page }) => {
  await page.goto("/cook?recipeId=creamy-tomato-gnocchi", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await expect(page.getByText("Cooking mode")).toBeVisible();

  await page.getByRole("button", { name: "Increase servings" }).click();
  const firstIngredient = page.locator("[data-testid^='cook-ingredient-']").first();
  await firstIngredient.scrollIntoViewIfNeeded();
  await firstIngredient.tap({ force: true });
  await page.getByTestId("cooking-notes").fill("E2E cooking note");
  await page.getByRole("button", { name: "Start" }).tap({ force: true });
  await expect(page.getByTestId("floating-cook-timer")).toBeVisible();
  await expect(page.getByTestId("floating-cook-timer")).toContainText("Step 1");
  await page.getByTestId("floating-cook-timer").tap({ force: true });
  await expect(page.getByRole("button", { name: "Back to step 1" })).toBeVisible();

  await expect(page.locator(".cook-ingredient-checked")).toHaveCount(1);
  await expect(page.getByTestId("cooking-notes")).toHaveValue("E2E cooking note");
});

test("settings can create a local SQLite backup", async ({ page }) => {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Backup SQLite" })).toBeVisible();

  const response = await page.request.post("/api/settings/backup");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).backupPath).toContain("recipai-");
});
