import { expect, test } from '@playwright/test';

test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a room code typed on the homepage is carried to the join page', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Room code').fill('KXQM');
    await page.getByRole('button', { name: 'Join the room' }).click();
    await expect(page).toHaveURL(/\/join\?room=KXQM$/);
    await expect(page.getByLabel('Room code')).toHaveValue('KXQM');
});

test('health endpoint reaches the database', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
});
