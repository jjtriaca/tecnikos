import { test, expect } from "@playwright/test";

test("abrir oferta pública por token", async ({ page }) => {
  await page.goto("/p/TEST_TOKEN");

  await expect(
    page.getByText(/ordem de serviço/i)
  ).toBeVisible();
});

test("fluxo de aceite exibe telefone", async ({ page }) => {
  await page.goto("/p/TEST_TOKEN");

  await page.getByRole("button", { name: /aceitar/i }).click();

  await expect(
    page.getByPlaceholder(/telefone/i)
  ).toBeVisible();
});
