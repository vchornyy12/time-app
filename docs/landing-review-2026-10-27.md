# Перевірка time24.pro — 2026-10-27

Висновок: адаптивність уже працює; повний редизайн не потрібен. Варто точково покращити початкове відображення, JS payload та доступність. Код застосунку й production під час аудиту не змінювалися.

## Що перевірено

Анонімний production-сеанс у headless Chromium: ширини 320, 360, 390, 430, 768, 1024, 1440, 1920 px, висота 900 px. Зроблено screenshots першого екрана та всієї сторінки після прокручування. Окремо: 390×844, три cold-browser-cache виміри з CPU ×4, download 1.6 Mbps та latency 150 ms; JavaScript disabled; reduced-motion; відкриття й закриття FAQ.

На всіх 8 ширинах: HTTP 200, document/body width відповідає viewport, видимих елементів поза горизонтальними межами не знайдено, pageerror не зареєстровано. Візуально перевірено screenshots 320 та 1440 px. Мобільна таблиця замінюється картками; desktop mockup прихований на малих екранах. FAQ відкривається й закривається.

## Мобільне завантаження — лабораторні виміри

| Показник | Запуск 1 | Запуск 2 | Запуск 3 |
|---|---:|---:|---:|
| TTFB | 400 ms | 624 ms | 592 ms |
| FCP | 2.43 s | 2.66 s | 3.14 s |
| LCP | 3.28 s | 3.51 s | 3.49 s |
| CLS до взаємодії | 0 | 0 | 0 |
| Загальний network transfer | 314 KB | 314 KB | 314 KB |
| Encoded JS resources | 262 KB | 261 KB | 261 KB |

Це не CrUX/field Core Web Vitals, не Lighthouse score та не вимірювання на фізичному телефоні. CPU/network throttling — емуляція; CDN і мережевий маршрут можуть змінювати результат. INP цим тестом не вимірювався. Без throttling LCP між окремими viewport-сеансами варіювався приблизно 1.6–4.6 s, тому не слід оцінювати швидкість за одним запуском.

## Зміни, які варто зробити

### 1. Перший екран має бути видимим без очікування JavaScript

`LandingPage.tsx` задає `initial={{ opacity: 0 }}` для header, hero heading, опису й CTA; `FadeUp` і `StaggerChildren` приховують контент до hydration та IntersectionObserver. З вимкненим JS перший екран фактично порожній: opacity заголовка 0, 76 main-елементів мають власне opacity 0. При повільному завантаженні JS користувач бачить ту саму порожню стадію.

Рекомендація: SSR-visible hero/header/основні CTA; декоративну анімацію додавати поверх уже видимого контенту. Для нижніх секцій — progressive enhancement із видимим fallback. Статичний маркетинговий контент поступово винести із client component, інтерактивними лишити FAQ та справді необхідні ефекти. Не вимикати SSR через `ssr:false` як спосіб оптимізації тексту першого екрана.

Це найсильніший кандидат для покращення; точний виграш потребує A/B вимірювання після змін. [Google про LCP render delay](https://web.dev/articles/optimize-lcp).

### 2. Зменшити зайвий JS та завантаження шрифтів

На лендингу запитується chunk `5686-0d82c2ec6b20db09.js` близько 52.6 KB encoded, який містить Supabase browser client. `Logo` імпортується через `@/components/ui`, а цей barrel реекспортує `SearchPalette` та інші app-компоненти з Supabase-залежностями. Ймовірний шлях зайвих залежностей — barrel; підтвердити причинність треба build-порівнянням після прямого імпорту `@/components/ui/Logo`. Samе наявність Supabase-коду в завантаженому chunk підтверджена, але це не означає, що він виконує запит або витікають дані.

`Geist Mono` глобально preload-иться через `app/layout.tsx`: 23.1 KB font body, хоча hero використовує system sans-serif; FontFaceSet для Geist лишається `unloaded`, попри network preload. Варто перенести monospace font у маршрути, де він потрібний, або вимкнути його preload. Потенційні ~52.6+23.1 KB — кандидати на економію, не обіцяний результат без build-перевірки. [Next.js font/preload](https://nextjs.org/docs/app/api-reference/components/font).

### 3. Підтримати reduced-motion й прибрати постійні декоративні цикли

CSS `prefers-reduced-motion` є, але не керує JS-анімаціями Framer Motion. При `reducedMotion: reduce` box-shadow основного CTA продовжує змінюватися. Рекомендація: `MotionConfig reducedMotion="user"` для transform/layout, а безкінечні shadow/color цикли вимикати явно через `useReducedMotion`. Залишити основні transition короткими та обмеженими в часі. [MotionConfig](https://www.motion.dev/docs/react-motion-config) уточнює, що opacity/color анімації автоматично не вимикаються.

### 4. Дрібні покращення доступності на touch

У `Sign in`, текстових CTA та footer links висота видимої/клікабельної області 16–20 px. Варто додати padding, особливо для header `Sign in`; збільшення heading або нові breakpoints не потрібні. Це спостереження про зручність touch, а не повний WCAG-аудит: допустимі spacing exceptions окремо не перевірялися.

FAQ функціонально працює, але кнопки не мають `aria-expanded` і `aria-controls`; додати прив’язку до answer region та keyboard/focus-перевірку після змін.

## Що не потребує термінової переробки

- Grid/breakpoints, padding та max-width: на перевірених ширинах працюють.
- Зображення не є основною причиною ваги: великих hero raster images немає.
- Landing stats уже кешуються на годину.
- TTFB у трьох throttled samples нижче 0.7 s; головний напрям — initial render та JS. Не слід просто прибирати `force-dynamic`/`private,no-store`: зараз вони пов’язані з per-request CSP nonce та auth redirect, тому зміна кешування потребує окремого дизайну.

Evidence: `docs/performance/2026-10-27/landing.json`, `interactions.json`. Screenshots залишені локально в `/private/tmp/time24-landing-audit/`. Початковий FAQ selector основного скрипта не збігся з текстом production; FAQ окремо перевірено правильним selector `What is GTD?`, результат у `interactions.json`.
