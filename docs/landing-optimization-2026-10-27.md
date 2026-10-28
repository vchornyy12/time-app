# Оптимізація лендингу — 2026-10-27

Реалізовано та опубліковано на https://time24.pro. Перевірений preview став production deploy `6ae084647009787d186f3356`, published at `2026-10-27T14:43:54.876Z`.

## Зміни

- `LandingPage` — Server Component. Прибрано client boundary, Framer Motion та імпорт загального UI barrel; `Logo` імпортується напряму. Основний контент і навігація видимі до JS та при його відключенні.
- FAQ використовує нативні `details/summary`, підтримує клавіатуру і працює без hydration. Браузер сам експонує expanded state; summary зв’язаний з answer region через `aria-controls`/`aria-labelledby`.
- Безкінечні shadow/gradient анімації замінені статичними декоративними ефектами. Hover lift — CSS лише для fine pointer з hover і без reduced-motion. CSS scroll progress є progressive enhancement, без JS listener і без анімації при reduced-motion.
- Monospace font збережено для сторінок, що його використовують, але глобальний preload вимкнено. На лендингу font network requests тепер відсутні.
- Header, текстові CTA й footer links мають touch target висотою щонайменше 44 px. Breakpoints і основну композицію збережено. Публічне APK-посилання 1.0.5 збережене.

## Production: до / після

Три запуски до та три після на одному домені, Chromium, viewport 390×844, CPU ×4, download 1.6 Mbps, latency 150 ms, browser cache disabled.

| Показник | До | Після |
|---|---:|---:|
| LCP | 3.28–3.51 s | 0.88–1.02 s |
| FCP | 2.43–3.14 s | 0.88–1.02 s |
| TTFB | 400–624 ms | 421–599 ms |
| CLS до взаємодії | 0 | 0 |
| Загальний transfer | ~314 KB | ~166 KB |
| Encoded JavaScript | ~261 KB | ~132 KB |
| Font body transfer | ~23 KB | 0 |
| Заголовок із JS disabled | opacity 0 | opacity 1 |

Це laboratory measurements, не field CrUX і не Lighthouse score. INP та фізичні Safari/Android-пристрої не вимірювалися. CDN/network variation не усунено рандомізованим A/B; результати не гарантують такий самий час кожному відвідувачу. TTFB до/після близький; основне покращення — раннє відображення й менше клієнтського коду.

## Перевірки

- Production build і TypeScript: pass.
- 447 existing unit/component tests у 34 файлах: pass.
- 12 нових browser regression checks: pass на локальному production build та preview. Окрема конфігурація не використовує auth setup і не змішується з authenticated E2E.
- Повторний production-аудит 320, 360, 390, 430, 768, 1024, 1440, 1920 px: без horizontal overflow і pageerror; FAQ працює на всіх ширинах. Виявлених link/button target <24 px більше немає.
- Візуально перевірено preview 320/1440 px з JS disabled; композиція збережена, CTA в header збільшено.
- ESLint: 0 errors; є попередній warning про невикористану `TestimonialsSection`, яка й раніше не рендерилася.

Повторити browser regression: `npm run build`, потім `npm run test:landing`. Для зовнішнього origin: `LANDING_TEST_ORIGIN=https://time24.pro npm run test:landing`.

Evidence: `docs/performance/2026-10-27/landing.json` (до), `landing-after.json` (після), `interactions.json` (початковий аудит). Первинний звіт: `docs/landing-review-2026-10-27.md`.
