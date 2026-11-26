# Android production signing

Налаштовано 2026-10-26. APK підписується локальним release-ключем, без Expo login. Публічний fingerprint закріплений у `mobile/release-signing.json`; APK checker перевіряє також цю identity.

## Збірка

```sh
cd mobile
npm run build:release:apk
```

Потрібні JDK 17 та Android SDK. За нестандартного розміщення задайте `JAVA_HOME` і `ANDROID_HOME`. Скрипт запускає Expo prebuild, Gradle release, підписує unsigned APK і виконує `scripts/check-android-apk.mjs` без debug override. Результат: `mobile/dist/time24-<version>-release.apk` та JSON-звіт поруч. Для наступних версій збільшуйте `expo.android.versionCode` в `app.json`; ключ залишайте той самий.

Expo plugin прибирає debug signing із release build type після кожного prebuild. Прямий Gradle assembleRelease тепер створює unsigned APK; встановлюваний production APK виготовляє release-скрипт. Debug build type залишається придатним для розробки. EAS може додати власну release signing configuration; профіль production використовує `credentialsSource: local` і наявний `credentials.json`. Cloud EAS додатково потребуватиме входу в Expo та узгодження remote versionCode.

## Резервна копія ключа

Приватні файли, виключені з Git:

- `mobile/.signing/time24-release.jks` — приватний ключ.
- `mobile/credentials.json` — alias, пароль і шлях до keystore.

**Збережіть обидва файли в захищеній резервній копії поза цим Mac**, наприклад у сховищі паролів з підтримкою файлів. Відновлюйте їх у ті самі відносні шляхи. `mobile/release-signing.json` містить лише публічні дані та може зберігатися в Git. Не створюйте новий ключ при наступній збірці: для sideload APK втрата оригінального ключа унеможливить звичайне оновлення встановленого застосунку. Для Google Play слід окремо налаштувати Play App Signing і визначити, чи цей ключ буде upload key.

Локальні permissions: `.signing` — 0700; keystore і credentials — 0600. Паролі передаються signing subprocess через environment, не через аргументи команд і не в Gradle/Metro.

## Перший перехід зі старого APK

Старі APK підписані Android Debug, новий — Time24 Android Release. Android не дозволяє встановити його поверх старого APK з іншим сертифікатом. Переконайтеся, що задачі збережені й видимі у web, видаліть старий застосунок, установіть release APK і знову увійдіть. Видалення очищує локальну сесію та локальні незбережені чернетки; збережені серверні задачі залишаються в акаунті. Наступні APK з цим release-ключем і більшим versionCode встановлюватимуться як оновлення.

Публічний APK у Supabase цим налаштуванням не замінюється автоматично.

## Публікація 1.0.5

2026-10-26 зібрано production APK 1.0.5, versionCode 6. Версійний файл `releases/time24-1.0.5-release.apk` завантажено в Supabase, production `NEXT_PUBLIC_APK_URL` оновлено, лендинг повторно опубліковано. Версійні URL уникають старого CDN-кешу `releases/time24.apk`. Під час наступних релізів публікуйте новий версійний файл і оновлюйте production-змінну з повторним деплоєм лендингу. Попередній публічний APK збережено локально в `mobile/dist/time24-landing-before-release-105.apk` для відкату.

Джерела: [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/), [Expo signing security](https://docs.expo.dev/app-signing/security/).

## Публікація 1.0.6

2026-11-26 зібрано production APK 1.0.6, versionCode 7, тим самим release-ключем (оновлюється поверх 1.0.5). Нове: вхід через Google, позначення Waiting For як виконаних, джерела й пропозиції асистента, повторна синхронізація з Google Calendar, нова іконка time24. Файл `releases/time24-1.0.6-release.apk` завантажено в Supabase (SHA-256 перевірено після завантаження), production `NEXT_PUBLIC_APK_URL` оновлено. Файл 1.0.5 залишено в Supabase для відкату.
