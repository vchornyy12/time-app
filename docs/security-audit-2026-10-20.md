# Аудит безпеки time24 — 20.10.2026

## Висновок

Є три пріоритетні проблеми: production RPC аналітики обходить RLS і доступна без входу; Google Calendar OAuth приймає передбачуваний state; локальна вебзбірка використовує Next.js 16.2.1 з відомими вразливостями. Перші дві перевірено на production без отримання чужої аналітики й без підключення календаря. Версію Next.js саме у production незалежно не встановлено.

Пряме читання таблиць у перевірених сценаріях ізольоване. Це не усуває витік через SECURITY DEFINER RPC. Ознак фактичної попередньої експлуатації не встановлено; журнали інцидентів не аналізувалися.

Під час цього аудиту бізнес-дані, grants, функції та deployment production не змінювалися. Виконано входи наявного тестового акаунта, read-only запити до БД/API та OAuth callback із навмисно недійсним кодом. Зміни user_preferences з попереднього завдання вже були застосовані до початку аудиту.

## Обсяг і докази

- Код вебзастосунку, усі серверні actions і три route handlers, міграції та повна схема; базовий огляд мобільної авторизації й сховища сесії.
- Production: https://time24.pro та пов'язаний Supabase-проєкт; каталоги public/storage, політики, grants, функції, bucket-конфігурація.
- Прямі анонімні SELECT id LIMIT 1 для семи таблиць; під тестовою сесією — HEAD/count запити лише рядків із user_id, відмінним від власного. Приватний вміст не виводився.
- npm audit --omit=dev окремо для web і mobile; це кількість позначених пакетів у lockfile, не кількість незалежних атак чи вразливостей готового APK.
- 404 Vitest-тести проходять; TypeScript проходить. Перевірка патернів секретів у tracked-файлах і доданих рядках усіх 84 git commits не знайшла збігів. .env-файлів у tracked-файлах немає. Це не повноцінний secret scanner і не гарантія відсутності всіх типів секретів.
- Checkout: 20dcaa6 плюс незакомічені зміни grants/user_preferences із попереднього завдання. Відповідність усіх production-файлів checkout не підтверджена.

Артефакти: [HTTP/API](security/2026-10-20/production-http.json), [OAuth](security/2026-10-20/production-oauth.json), [залежності](security/2026-10-20/dependencies.json), [SQL для повторної перевірки](security/2026-10-20/catalog-readonly.sql).

## Знахідки

### S1 — P1: анонімна персональна аналітика через production get_analytics

**Підтверджено у production.** public.get_analytics(uuid,timestamptz) має SECURITY DEFINER, owner postgres із BYPASSRLS, доступна anon, не має налаштованого search_path. Тіло використовує переданий p_user_id, не містить auth.uid(). Анонімний POST /rest/v1/rpc/get_analytics із синтетичним UUID повернув 200 і поля completed_by_day, avg_cycle_days, tasks_captured, status_counts.

За наявності UUID іншої людини можна запитувати її агрегати активності незалежно від табличних RLS. Чужі UUID для такого виклику не використовувалися. Це не підтвердження читання назв задач або токенів: виявлений канал повертає агрегати.

**Розбіжність:** migration 007 визначає функцію як SECURITY INVOKER із результатом jsonb; production має SECURITY DEFINER і результат json. Просте повторне CREATE OR REPLACE із migration 007 може впасти через зміну return type.

**Виправлення:** [mitigate-analytics.sql](security/2026-10-20/mitigate-analytics.sql) змінює лише security mode, search_path і EXECUTE grants, зберігає тіло та return type. Скрипт підготовлено, але не застосовано. Ізольована PostgreSQL-модель для json і jsonb відтворює обхід до виправлення; після нього anon отримує permission denied, authenticated бачить лише власні агрегати. Повторне застосування перевірено.

Після production-виправлення перевірити: anon → відмова; user A / p_user_id=B → порожні агрегати; user A / p_user_id=A → правильні агрегати. Перенести виправлення у звичайну міграцію й синхронізувати визначення функції з репозиторієм.

### S2 — P1: Google Calendar OAuth state не прив'язаний до браузера

**Підтверджено кодом і production.** app/api/google/auth/route.ts:20–21 формує user.id|encodedNext. У callback:25–33 перевіряється лише збіг user.id. Немає випадкового одноразового nonce, перевірки його cookie/серверного запису або строку дії.

Два GET /api/google/auth під тестовою сесією повернули однаковий state без Set-Cookie. Callback із самостійно сформованим state та завідомо недійсним code повернув token_exchange_failed замість invalid_state: підроблений state дійшов до обміну коду. Google не видав токенів, integration не змінено.

Можлива OAuth account-linking CSRF атака: знаючи UUID цілі та отримавши валідний код для того самого OAuth client, атакувальник може спробувати прив'язати свій Google Calendar до активної сесії жертви. Тоді майбутні назви запланованих задач можуть потрапити в чужий календар. Повний сценарій із валідним чужим кодом не запускався.

**Виправлення:** криптографічно випадковий nonce; HttpOnly/Secure/SameSite=Lax cookie або серверний запис із user_id, next і TTL; одноразове використання й перевірка до token exchange; PKCE як додатковий захист. next приймати лише як перевірений внутрішній шлях. Обробляти malformed percent-encoding без 500. [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

### S3 — P1: застарілі вебзалежності, включно з Next.js

**Підтверджено для локального lockfile/installed packages; точна production-версія невідома.** next 16.2.1, react/react-dom 19.2.3, Supabase JS 2.97.0, ws 8.19.0. npm audit позначає 7 пакетів: 1 critical, 5 high, 1 moderate. Окремі advisory одного пакета не слід рахувати як незалежні підтверджені шляхи експлуатації.

Особливо релевантний App Router із Server Actions: офіційний advisory GHSA-p3m5-59mp-jv5r описує DoS і вимагає щонайменше Next.js 16.4.1 для цієї гілки. Цей advisory новіший за частину даних npm audit, тому одного audit недостатньо. [Офіційний advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r).

Critical advisory AVIF image optimization також охоплює цю версію. У next.config.ts:24–29 дозволено будь-який *.supabase.co без обмеження шляху. Це дає надто широкий allowlist для обробки віддалених зображень, включно з іншими Supabase-проєктами. Реальний production image backend Netlify та можливість конкретного RCE не перевірялися, шкідливі зображення не надсилалися. Advisory для Windows-hosted RCE або next/og не є доказом застосовності: Windows deployment не встановлено, використання next/og у коді не знайдено. [AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).

**Виправлення:** узгоджено оновити Next.js/React та транзитивні залежності, виконати audit, тести/build і deploy; перевірити фактичний deployed lockfile. Прибрати remotePatterns, якщо непотрібні, або обмежити конкретним project hostname і потрібними шляхами. Не запускати npm audit fix --force без аналізу змін.

### S4 — P2: довготривалий Google refresh token доступний браузерній ролі

**Підтверджено правами production.** authenticated має SELECT на google_refresh_token у власному user_integrations; перевірено запитом LIMIT 0 без отримання значень. Серверні actions використовують ту саму роль для читання й запису токенів. Токен зберігається як text; application-level encryption у коді немає. Це не твердження про відсутність шифрування диска Supabase.

RLS захищає від іншого користувача, але JavaScript із доступом до сесії може читати довготривалі OAuth credentials через Data API. У коді також є сторонні скрипти в root layout.

**Виправлення:** винести секрети інтеграції в приватну схему/таблицю із серверним доступом, мінімальний public status для UI, шифрування токенів на рівні застосунку/Vault. Під час перенесення серверний код має явно перевіряти user.id; не давати service_role клієнту. [Google token best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).

### S5 — P2: API-ролям залишені зайві табличні привілеї

**Підтверджено каталогами production.** authenticated має TRUNCATE на tasks, projects, user_integrations, user_contexts, daily_reflections, clarity_sessions. Для user_preferences після попереднього виправлення це право відсутнє. anon зберігає SELECT на п'ятьох приватних таблицях, хоча RLS зараз повертає нуль рядків.

TRUNCATE не проходить рядкові RLS-перевірки. Водночас звичайний PostgREST CRUD не надає команди TRUNCATE: прямий HTTP-шлях масового видалення не виявлено й не тестувався. Це зайві привілеї та небезпечна передумова для майбутнього RPC/SQL-шляху, не підтверджена анонімна можливість стерти БД.

**Виправлення:** точково відкликати непотрібні anon-права і TRUNCATE/REFERENCES/TRIGGER у клієнтських ролей, зберегти потрібні CRUD. Перевірити інші RPC та default privileges. Саме додавання CRUD grants не забирає старі ALL grants.

### S6 — P2: недостатній контроль ресурсів на рівні БД/Storage

**Підтверджено схемою й bucket-конфігурацією.** attachments приватний, ліміт 10 MiB на об'єкт, allowed_mime_types=NULL. Політики правильно обмежують шляхи префіксом auth.uid(). releases публічний — це очікувано для дистрибуції, запис у нього клієнтськими політиками не дозволений.

Ліміти title/content/attachments реалізовані в Zod server actions; прямий Supabase Data API їх оминає. У production public-таблицях знайдено лише один CHECK constraint — допустимі recurrence_rule. Ліміт файлів на користувача/загальний storage quota для нього у перевіреній схемі не знайдений. Можливе навантаження/витрати від акаунта, який пише напряму через API. Заповнення сховища та великі payload не тестувалися.

**Виправлення:** важливі ліміти розмірів продублювати у CHECK constraints/валідації БД, додати квоти та контроль write rate/обсягу на користувача. Для файлів визначити дозволені типи й спосіб безпечного завантаження; довільний MIME сам собою не доводить XSS, оскільки Storage має інший origin і його response headers тут не досліджувалися.

### S7 — P2: мобільні сесії та deep links потребують посилення

**За кодом; APK/runtime не досліджувався.** mobile/lib/supabase.ts зберігає session у нешифрованому AsyncStorage. mobile/lib/auth.ts:25–44 приймає access_token/refresh_token з URL і викликає setSession; немає браузерного nonce/PKCE binding у цьому шляху. mobile/app/_layout.tsx:29 перевіряє URL через startsWith('timeapp://auth'), а не точний protocol/host/path. Custom scheme може перехоплювати інший застосунок; прийняття переданих bearer tokens створює передумови session injection. Фактичний OS/deep-link exploit не запускався.

**Виправлення:** Keychain/Keystore-backed storage; PKCE та точна перевірка callback URL; за можливості verified App Links/Universal Links. Прибрати загальний URL fetch logging із release build. [React Native security](https://reactnative.dev/docs/next/security).

Мобільний npm audit позначає 50 пакетів: 2 critical, 32 high, 15 moderate, 1 low. Critical — shell-quote і tar, здебільшого пов'язані з інструментами збірки. Навіть --omit=dev включає Expo/Metro/CLI через production dependency tree. Це не доказ 50 експлуатованих вразливостей у встановленому APK. Потрібен окремий узгоджений upgrade Expo SDK, React Native та транзитивних залежностей; автоматична порада npm downgrade до Expo 44 не повинна застосовуватися.

### S8 — P2: немає CSP; сторонні скрипти завантажуються також на приватних сторінках

**Production:** Content-Security-Policy і Permissions-Policy відсутні на перевірених HTML-відповідях. HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy присутні; X-Powered-By не видається.

**Код:** app/layout.tsx підключає GTM глобально, ClarityAnalytics також розміщений у root layout і активується production env. Обмеження завантаження на landing/маркетингові сторінки або явного masking приватних областей у коді не знайдено. Фактичні GTM tags, Clarity dashboard masking і запис сесій не перевірялися; витік текстів задач у telemetry не стверджується.

**Виправлення:** почати з CSP Report-Only, прибрати/обмежити сторонні скрипти на auth і приватних сторінках, перевірити masking у Clarity та перелік GTM tags, потім увімкнути CSP з мінімальними дозволами. CSP не замінює виправлення XSS/OAuth.

## Додаткові проблеми життєвого циклу акаунта

lib/actions/account.ts:34–44 видаляє рядки до перевірки працездатності admin client; Supabase error objects не кидаються як винятки й ігноруються. За відсутності service-role key або помилки admin delete можливий частковий результат. Видалення Storage-об'єктів і відкликання Google OAuth token у цьому потоці відсутні; disconnectGoogleCalendar лише очищує локальний токен. Значення confirmedEmail не є повторною автентифікацією. Не перевірялося реальним видаленням акаунта.

Перед заявою про повне стирання даних потрібен узгоджений, відновлюваний процес: перевірка серверної конфігурації до змін, обробка кожної помилки, очищення файлів, відкликання інтеграцій і перевірка завершення. Не виконувати destructive сценарій на реальному акаунті для аудиту.

## Що перевірено позитивно

- RLS увімкнено на всіх семи public-таблицях. Переглянуті політики прив'язують user_id до auth.uid(); INSERT/UPDATE мають відповідні обмеження.
- Анонімні SELECT повернули 0 рядків для tasks/projects/user_contexts/daily_reflections/clarity_sessions; user_integrations/user_preferences — 401/42501. Пряма анонімна видача цих рядків у перевірених запитах не підтвердилася.
- Під тестовою сесією запити чужих рядків усіх семи таблиць повернули count=0.
- Шість project RPC працюють SECURITY INVOKER із pinned search_path; anon EXECUTE для них відсутній. get_public_stats — навмисний SECURITY DEFINER агрегат лише загальних лічильників. rls_auto_enable — event-trigger helper, не звичайний RPC для читання задач.
- Ролі anon/authenticated не мають CREATE у public.
- Приватні вебсторінки й Google auth без сесії редиректять на login. Для /.env і /.git/config отримано login redirect, а не вміст; для двох перевірених debug PNG — 404.
- HTTP перенаправляється на HTTPS; HSTS активний. Attachments bucket приватний, політики перевіряють owner prefix. Публічний Supabase publishable key у мобільному коді сам собою не є секретом.
- Серверні actions здебільшого повторно перевіряють auth, використовують user_id і Zod; user-generated HTML rendering/eval у перевірених шляхах не виявлено. Статичні analytics snippets із dangerouslySetInnerHTML самі по собі не доводять XSS.

## Порядок виправлення

1. S1: застосувати перевірену analytics mitigation, перевірити deny/own/foreign, зафіксувати міграцію й історію. Це невелика незалежна зміна БД.
2. S2: nonce/cookie/TTL/one-time state, тести підміни й повтору callback, deployment і production-перевірка.
3. S3: оновлення залежностей і конкретний image allowlist, перевірка deployment version та повторний audit.
4. S4–S6: приватне зберігання integration secrets, мінімальні grants, constraints/квоти.
5. S7–S8 і lifecycle: мобільна авторизація/SDK, telemetry/CSP, повне видалення даних.

## Межі висновку

Не проводилися DoS/load tests, RCE експлуатація, масове сканування, запис/видалення бізнес-даних, читання чужої аналітики, ротація ключів або production deploy. Не перевірено повністю authenticated write isolation двох реальних акаунтів через API, Storage signed URL leakage/revocation, Auth redirect allowlist/password policy/CAPTCHA/rate limits, власниківські MFA, Netlify WAF/CI/deployment secrets, backup restore, журнал попередніх атак, APK/підпис/декомпіляцію та мережевий трафік мобільного клієнта. Перевірки доступу на читання не гарантують коректності всіх INSERT/UPDATE/DELETE сценаріїв.

Повторити оцінку після виправлень, особливо оскільки фактична production get_analytics вже відрізняється від репозиторію.

## Подальші виправлення

Аудит вище описує стан до виправлень. Вебреліз і міграції застосовано; поточний статус та залишкові роботи — у [журналі виправлень](security-fixes-2026-10-20.md).
