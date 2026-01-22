import { test, expect } from '@playwright/test';

test('can-request-a-new-card.e2e', async ({ page }) => {
  const STEP_PAUSE_MS = 2000;

  // Start from login and sign in as User (dev-mode auth)
  await page.goto('http://localhost:3001/login');
  await expect(page.getByRole('heading', { name: 'ACME Financial' })).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);
  const signInAsUserCard = page.locator('[data-slot="card"]').filter({ hasText: 'Sign in as User' });
  await expect(signInAsUserCard).toHaveCount(1);
  await signInAsUserCard.click();
  await page.waitForTimeout(STEP_PAUSE_MS);

  // 1) Navigate to the dashboard
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/Welcome back/i)).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);

  // 2) Find our way to the cards section
  const cardsLink = page
    .getByRole('link', { name: 'Cards' })
    .or(page.getByRole('link', { name: 'My Cards' }));

  await expect(cardsLink.first()).toBeVisible();
  await cardsLink.first().click();
  await page.waitForTimeout(STEP_PAUSE_MS);
  await expect(page).toHaveURL(/\/cards$/);
  await expect(page.getByRole('heading', { name: 'My Cards' })).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);

  // 3) Request a new basic card
  await page.getByRole('button', { name: 'Request' }).click();
  await expect(page.getByText('Request New Card')).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);

  // Select “Basic Card” explicitly (it is the default, but clicking makes the intent clear)
  await page.getByText('Basic Card', { exact: true }).click();
  await page.waitForTimeout(STEP_PAUSE_MS);

  const submitResponse = page.waitForResponse((response) => {
    return (
      response.request().method() === 'POST' &&
      response.url().includes('/v1/cards/requests') &&
      response.status() >= 200 &&
      response.status() < 300
    );
  });

  await page.getByRole('button', { name: 'Submit' }).click();
  await submitResponse;
  await page.waitForTimeout(STEP_PAUSE_MS);

  // 4) Assert that everything works nicely
  await expect(page.getByText('Card request submitted successfully!')).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);

  // The page should no longer be in the empty state.
  await expect(page.getByText('No cards yet')).toBeHidden();

  // At least one card should be rendered (the masked number appears only when a card exists).
  await expect(page.getByText(/••••\s*••••\s*••••/).first()).toBeVisible();
  await page.waitForTimeout(STEP_PAUSE_MS);
});
