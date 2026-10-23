# Android APK review — 2026-10-22

Перевірено опублікований `releases/time24.apk`, мобільний код, залежності, release-конфігурацію та локально зібрано новий APK. Production APK не замінено. Бізнес-дані production не змінювалися.

## Підтверджені проблеми й виправлення

| Знахідка | Результат |
|---|---|
| Публічний APK 1.0.0 підписаний Android Debug сертифікатом | Додано перевірку готового APK: звичайний режим відхиляє debug-підпис. Локальна збірка 1.0.1 залишається **внутрішньою тестовою**, з тим самим сертифікатом для перевірки оновлення без видалення старої інсталяції. |
| Зайві storage/overlay permissions, `allowBackup=true` | Заблоковано storage, overlay, невикористані biometric/vibration permissions; backup вимкнено. В готовому APK лишилися Internet і внутрішній signature permission AndroidX. |
| Публічний APK не містить нового адаптера encrypted session storage | Новий APK включає SecureStore та міграцію старої AsyncStorage-сесії. HTTP cleartext явно вимкнено; для старого APK відсутність явного атрибута сама по собі не доводить дозволений HTTP, оскільки target SDK 36 має безпечне значення за замовчуванням. |
| Поділ SecureStore-рядка міг розірвати Unicode surrogate pair | Нові chunks обмежено 1800 UTF-8 байтами без розриву code point. Менше native storage викликів для типових ASCII-сесій. Старі manifest/chunks залишаються читабельними. |
| Пошкоджена сесія могла назавжди блокувати повторний вхід | Пошкоджений manifest або неповний набір chunks вимагає нового входу; застаріла plaintext-сесія не відновлюється. Помилки доступу до нативного сховища не трактуються як корупція. |
| Повторне натискання / повтор після timeout міг дублювати capture | Синхронний guard, UUID із `expo-crypto`, `ON CONFLICT DO NOTHING`; той самий ID зберігається для повторів поточної спроби. Назва перевіряється за лімітом БД — 1–500 Unicode code points. Черги offline-записів після перезапуску немає. |
| Completion не записував `completed_at` і міг неправильно показати успіх | Записує timestamp, перевіряє повернутий рядок та owner filter, залишає задачу при помилці. Прибрано таймер optimistic checkbox, що не відновлювався після збою. |
| Фонове оновлення токенів / гонки session restore | AppState керує refresh lifecycle; `processLock` серіалізує auth-операції. Пізня відповідь startup не перезаписує новий auth event. Додано вихід з поточного пристрою. |
| Списки завантажували все до API-ліміту й застарівали між вкладками | Спільні repository, session context і hook. Cursor pagination по timestamp + UUID, по 50 рядків, зі збереженням мікросекунд Postgres. Скасування застарілих запитів, deduplication, refresh при focus/foreground. |
| Неузгоджений `babel-preset-expo@13` при SDK 54 | Оновлено до офіційної залежності SDK 54: `~54.0.12`; сумісні npm security updates, без `--force`. |
| Release не використовував R8/resource shrinking | Увімкнено через Expo build-properties; ARMv7 + ARM64 закріплено в конфігурації, щоб clean prebuild відтворював ABI. Hermes і New Architecture збережено. |

## Deep links і dependency advisory

Вхід залишається PKCE-only: жодного прийняття bearer tokens із URL. Зовнішній URL обмежено 2048 символами, перевіряються scheme/host/path, percent encoding та єдиний `code`. Через `+native-intent` роутер отримує лише `/auth` або `/`; код обробляє окремий auth handler, він не потрапляє в navigation history.

Це обмежує доступний зовнішній вектор DoS у старому `decode-uri-component`. Пакет усе ще присутній у dependency audit; це mitigation, не оновлення самого пакета. Його 0.5.0 перейшов на ESM, тоді як старий `query-string` використовує CommonJS, тому сліпий override не застосовувався. Джерела: [advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [Expo native intent](https://docs.expo.dev/router/advanced/native-intent/).

Audit `npm audit --prefix mobile --omit=dev`: **34 → 31 packages**, після виправлень 23 high, 8 moderate, 0 critical. Це кількість пакетів із findings, включно з транзитивними, а не 31 підтверджений exploit APK. `braces`, `node-forge`, PostCSS, image-size та sprintf-js переважно належать Expo/Metro/CLI/Jest build tooling. Для [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) та [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) advisory не вказує patched version. Потрібна окрема native міграція Expo/React Native та повторна перевірка; SDK не оновлювався на кілька major без пристрою.

Expo compatibility check попереджає про React/React DOM 19.1.10 проти рекомендованого 19.1.0. Залишено новіший patch, що задовольняє peer `^19.1.0` React Native; TypeScript, тести та native build пройшли. Runtime-сумісність на телефоні ще не підтверджена.

## Архітектура й вимірювання

- UI → `useTaskList` → `tasks.ts` → Supabase Data API з JWT користувача та RLS. Service-role ключ у мобільному коді не використовується. Public publishable key очікувано доступний у binary.
- Auth/session lifecycle централізований у root provider; екрани не перечитують SecureStore для кожного списку.
- Початкове завантаження обмежено 50 рядками на список; FlatList/SectionList віртуалізовані. Cursor не зміщується через видалення попередніх записів, на відміну від OFFSET.
- Готовий APK: приблизно **39.05 → 34.84 MB**, зменшення близько **10.8%**, обидва ARMv7/ARM64. Це вимір розміру, не FPS чи часу запуску. Hash та точні bytes — у JSON evidence.
- За потреби подальшого масштабування варто виміряти EXPLAIN для composite index `(user_id, status, created_at, id)` і calendar-аналога. Індекси production не змінювалися без вимірювання.
- Completion також очищує `projects.first_step_task_id`, як у web server action. Ці два записи, як і у web workflow, поки не атомарні; спільний транзакційний RPC/API спростить майбутню підтримку узгодженості. Offline persistence, realtime cache та синхронізація Google Calendar не додавалися.

## Перевірки

- **41 тест** у 5 файлах: PKCE, untrusted links, SecureStore Unicode/migration/corruption/failed write/serialization, task validation/idempotency, cursor order/precision, pagination/abort/retry/foreground lifecycle.
- Mobile TypeScript і ESLint зміненого mobile-коду та APK checker: pass.
- Gradle `:app:assembleRelease`: pass; R8, resource shrink, native module autolinking і release lint виконано.
- Read-only production probe через спеціальний тестовий акаунт: authenticated cursor-запити inbox/next_actions/calendar виконалися без помилок; усі повернули 0 рядків. Це перевірка API-синтаксису й grants, не реалістичний benchmark великого списку.
- APK checker у режимі `--allow-debug-signature`: pass; звичайний release gate правильно fail через debug-сертифікат. Regex-перевірка recognized secrets не є повним доказом відсутності всіх можливих секретів.
- ADB не бачить підключеного пристрою; AVD/system image локально відсутні. Не виміряно cold start, FPS, пам’ять, батарею й Android lifecycle на справжньому пристрої. Вхід через реальний magic link не пройдений end-to-end.

Evidence: `docs/security/2026-10-22/{apk-before,apk-after,dependencies}.json`.

## APK та перевірка на телефоні

Артефакт: `mobile/dist/time24-1.0.1-internal.apk` (локальний, ignored). Release bytecode з debug-підписом; не публікувати як production release. Для production додано EAS profile `release-apk`, що успадковує production і autoIncrement. Потрібно використати власний release keystore та пропустити готовий binary через checker без override. Новий сертифікат несумісний з in-place оновленням встановленого debug APK; потрібен окремий план переходу.

1. Оновити старий APK новим без uninstall; перевірити відновлення сесії, потім sign out/sign in новим magic link на цьому самому пристрої.
2. Перевірити cold/warm callback, повторне відкриття того самого листа, прострочений і malformed link.
3. Увімкнути airplane mode: login/capture/refresh/completion мають показати помилку й дозволити повтор. Повтор capture після відновлення мережі не має дублювати ту саму спробу.
4. Прокрутити список понад 50 задач, завершити задачу біля межі сторінок, повернутися між вкладками та з background. Перевірити recurring tasks і project first-step workflow окремо для перевірки повного workflow.
5. Перевірити довгий український текст/emoji, перезапуск і вихід із сесії; зняти cold start/FPS/memory на слабшому та основному пристроях перед публікацією.

Не доставляти цей JS через OTA на старий binary: SecureStore та Crypto потребують нових нативних модулів.
