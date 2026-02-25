import { test, expect } from "@playwright/test";

test("carrega página de ordens de serviço", async ({ page }) => {
  await page.goto("/dashboard/service-orders");

  await expect(
    page.getByTestId("service-orders-title")
  ).toBeVisible();

  await expect(
    page.getByTestId("service-orders-list")
  ).toBeVisible();
});
