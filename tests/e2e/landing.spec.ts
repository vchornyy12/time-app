import { expect, test } from '@playwright/test'

test('content, navigation and FAQ work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(test.info().project.use.baseURL!)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('opacity', '1')
  await expect(page.locator('header')).toHaveCSS('opacity', '1')
  await expect(page.locator('header a[href="/register"]')).toBeVisible()
  const question = page.locator('summary').filter({ hasText: 'What is GTD?' })
  const answer = page.getByRole('region', { name: 'What is GTD?' })
  await question.click()
  await expect(answer).toBeVisible()
  await question.click()
  await expect(answer).toBeHidden()
  await context.close()
})

for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    expect(await page.locator('header a[href="/login"]').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    expect(await page.locator('header a[href="/register"]').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
  })
}

test('FAQ supports keyboard and exposes native expanded state', async ({ page }) => {
  await page.goto('/')
  const question = page.locator('summary').filter({ hasText: 'What is GTD?' })
  const details = question.locator('..')
  await question.focus()
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
  const controls = await question.getAttribute('aria-controls')
  await expect(page.locator(`#${controls}`)).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(details).not.toHaveAttribute('open')
})

test('reduced-motion has no continuously animated decorations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.landing-scroll-progress')).toHaveCSS('display', 'none')
  const button = page.getByRole('link', { name: 'Get started for free', exact: true }).first()
  const shadow = await button.locator('..').evaluate(element => getComputedStyle(element).boxShadow)
  await page.waitForTimeout(600)
  expect(await button.locator('..').evaluate(element => getComputedStyle(element).boxShadow)).toBe(shadow)
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.effect?.getTiming().iterations === Infinity).length)).toBe(0)
})

test('public landing does not download app-only client libraries or preload monospace', async ({ page }) => {
  const scripts: string[] = []
  page.on('response', response => {
    if (response.request().resourceType() === 'script') scripts.push(response.url())
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(0)
  // The server-rendered landing needs the framework and links, not its own hydrated page module.
  expect(scripts.filter(url => /\/chunks\/app\/page-/.test(url))).toEqual([])
  await expect(page.getByRole('link', { name: 'Download APK' })).toHaveAttribute('href', /\.apk(?:\?|$)/)
})
