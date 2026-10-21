# Виправлення безпеки time24

## Стан production

Вебреліз опубліковано 20.10.2026 о 12:45 UTC. Netlify deployment: `6ad760c6d5dc180992200086`, [логи](https://app.netlify.com/projects/time2go/deploys/6ad760c6d5dc180992200086). Той самий незмінний артефакт спочатку перевірено на draft URL, потім опубліковано на https://time24.pro. Завершальні read-only перевірки після Vault lockdown пройшли. Код збережено в GitHub main. Старе Netlify ignore rule могло пропускати перший Git build після ручного деплою за відсутності CACHED_COMMIT_REF; правило замінено на перевірку двох валідних commit refs із безпечним fallback до build.

Міграції `20261020000000`–`20261020000006` застосовано й записано у Supabase migration history. Аналітичний SQL спочатку застосував власник; анонімний виклик після цього повертає 401/42501. Решту security migrations виконано через SQL Editor.

Перехід Vault виконано у два етапи: спочатку сумісні RPC і копія секретів, після перевірки нового вебрелізу — видалення legacy plaintext і клієнтських grants. У репозиторії підготовчий етап також обмежує клієнтські права на новий Vault reference для майбутніх повторних розгортань. Фінальні production permissions відповідають lockdown migration.

## Що виправлено

- **Аналітика:** збережено наявний return type, застосовано SECURITY INVOKER та явні EXECUTE grants. Анонімний доступ закрито.
- **Google OAuth:** 256-бітний випадковий state і PKCE verifier, захищена `__Host-` HttpOnly/Secure/SameSite=Lax cookie з TTL 10 хвилин, прив'язка до перевіреного user.id. Cookie очищується на callback, включно з помилками. next допускає лише безпечний внутрішній шлях. Веб auth callback повторно зберігає тільки Supabase access/refresh tokens, не provider credentials, перед перенесенням Google refresh token у Vault. Middleware також очищує provider credentials зі старих перевірених сесій при наступному запиті; refresh/logout cookies зберігаються й на редиректах.
- **Google credentials:** Supabase Vault шифрує токени. Читання/запис/очищення — лише через service-role RPC із pinned search_path. Серверний helper позначено server-only; усі його callers беруть user.id із перевіреної сесії. Клієнт бачить тільки власний статус інтеграції. Disconnect відкликає Google token; auth deletion очищує Vault secret через trigger.
- **Grants:** прибрано anon/PUBLIC доступ до приватних таблиць і authenticated TRUNCATE/REFERENCES/TRIGGER. Для user_integrations після lockdown клієнту дозволено лише SELECT безпечних колонок.
- **Data API:** валідовані DB constraints обмежують title, contexts, attachments, delegated_to, project plan, custom contexts, diary content і clarity text. Перевіряється owner prefix вкладень. Це працює й при прямих запитах до Supabase, не лише через Zod. Існуючі записи не переписувалися й не обрізалися.
- **Вебзалежності:** Next.js 16.4.2, React/React DOM 19.3.1, Supabase JS 2.118.0, SSR 0.12.7; сумісні транзитивні оновлення. Production dependency audit: 0 findings. Build configuration Netlify переведено на Node.js 22. Збірка використовує Webpack: локальний Turbopack упирався в системне обмеження відкриття порту.
- **Браузер:** CSP із випадковим nonce на кожний запит, strict-dynamic, frame/object restrictions, приватне кешування HTML; nonce передається також next-themes. Permissions-Policy закриває непотрібні camera/microphone/geolocation/payment. Прибрано глобальні GTM і Clarity scripts. Remote image optimizer allowlist порожній.
- **Серверні дії:** перед створенням Google event перевіряється реальна власна задача, використовується її збережений title. File delete перевіряє існування вкладення до зовнішнього видалення. Шляхи в metadata перевіряють власника.
- **Видалення акаунта:** потрібен login за останні 15 хвилин; перевірка admin configuration відбувається до змін. Google revoke та очищення тільки owner storage prefix мають видимі помилки й повторювані кроки. Замість попереднього часткового видалення public rows використано одну cascading Auth deletion. Зовнішні Google/Storage кроки не є атомарними з БД; якщо фінальний крок не вдасться, користувач отримає помилку і зможе повторити.
- **Мобільний код:** PKCE-only callback із точним scheme/host/path, відмова від переданих access/refresh tokens і unbound token_hash. Сесії та verifier зберігаються у SecureStore, великий payload розбивається на encrypted chunks; попередня plaintext session переноситься й видаляється. Прибрано загальний URL fetch logger. React залишається на сумісній гілці 19.1 із security backport 19.1.10.

## Перевірки

- 424 web unit/component tests у 32 файлах; 9 mobile security tests.
- Web і mobile TypeScript; цільовий ESLint; production Webpack build.
- Ізольовані PostgreSQL перевірки analytics mitigation, named grants, owner RLS, Data API bounds та Vault permissions/lifecycle. Vault stub перевіряє контроль доступу, не криптографію; production migration використала native Supabase Vault.
- Draft і production HTTP: HTML 200, CSP nonce відповідає всім script tags, сторонні analytics scripts відсутні, cache-control private/no-store. Inbox, Settings, Calendar повертають 200 під тестовою сесією.
- Production OAuth: два різних state, PKCE S256, захищена cookie; підроблений state повертає invalid_state. Прив'язаний cancellation callback працює та очищує cookie. Валідну Google consent/reconnect операцію з реальним календарем не виконували.
- Production Data API: прямий anon SELECT усіх семи private tables → 401. Під тестовою сесією foreign-row count для всіх семи → 0. SELECT google_refresh_token і секретний RPC → 42501; status columns залишаються доступними. Context validator відхиляє 21 тег.
- SQL Editor final metadata: **0** plaintext Google tokens, **0** missing Vault secret references, **0** authenticated TRUNCATE tables, **11** validated bounds; client token SELECT/RPC і anon analytics EXECUTE — false.

Санітизовані докази: [production HTTP/OAuth](security/2026-10-20/production-after.json), [права Data API](security/2026-10-20/production-access-after.json), [metadata БД](security/2026-10-20/database-after.json), [dependency counts](security/2026-10-20/dependencies-after.json).

## Що ще залишається

1. **Нова native APK/AAB.** Мобільні зміни підготовлено й перевірено кодом, але новий бінарник не створено/не опубліковано. SecureStore потребує native rebuild; не доставляти цей JS як OTA на старий APK без модуля. Запитати новий magic link на тому самому пристрої: старі implicit/token-hash посилання навмисно більше не приймаються. APK runtime, verified App Links і підпис не проходили повторного аудиту.
2. **Планове оновлення Expo SDK/React Native.** Сумісні оновлення прибрали critical findings. Залишилося 39 позначених mobile dependency packages (23 high, 16 moderate), переважно в дереві Expo/Metro/CLI/Jest. Це не 39 підтверджених runtime exploits APK. Повний web audit також ще має 5 high у dev-only ESLint/glob tree; production web audit — 0. Не застосовувати запропоновані npm downgrade/--force без окремої міграції й native перевірки.
3. **Квоти й anti-abuse.** Обмежено розмір одного запису/metadata та лишається bucket limit 10 MiB. Загальні ліміти кількості задач/файлів на акаунт, write rate, signup CAPTCHA та billing alerts потребують окремого продуктового/інфраструктурного налаштування. Наявні constraints не замінюють ці механізми.
4. **Контроль інтеграції й ретроспектива.** Варто один раз перевірити реальне Google reconnect після випуску. Middleware очищує поточні cookie при наступному запиті; історичні зовнішні копії раніше доступних provider tokens неможливо відкликати одним перенесенням у Vault; за підозри на компрометацію потрібне окреме відкликання/перепідключення. Ознак попереднього використання витоку не шукали в журналах.

## Обережність із відкатом

До Vault lockdown можна було повернути старий вебартефакт. Після lockdown старий код із прямим читанням google_refresh_token несумісний: для відкату потрібна Vault-aware версія або окремий узгоджений compatibility rollout. Не повертати клієнтам доступ до секретів для швидкого обходу помилки.
