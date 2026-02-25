import { test, expect } from "@playwright/test";

test("acesso à página de login", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(
    page.getByRole("heading", { name: /login/i })
  ).toBeVisible();
});

test("login inválido exibe erro", async ({ page }) => {
  await page.goto("/auth/login");

  await page.getByPlaceholder(/email/i).fill("teste@invalido.com");
  await page.getByPlaceholder(/senha/i).fill("senhaerrada");

  await page.getByRole("button", { name: /entrar/i }).click();

  await expect(
    page.getByText(/credenciais inválidas/i)
  ).toBeVisible();
});
