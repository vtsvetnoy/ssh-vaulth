# Personal SSH Desktop Client Design

**Дата:** 29 июня 2026 года  
**Scope:** desktop-приложение macOS/Windows, синхронизация через Oracle-сервер, SSH-терминал, encrypted vault

## Цель

Создать собственный бесплатный аналог базовой части Termius: desktop-приложение для macOS и Windows, где пользователь может хранить SSH-хосты, ключи и пароли, синхронизировать их через свой Oracle-сервер и подключаться к серверам во встроенном терминале.

Первый релиз рассчитан на одного владельца, но архитектура должна поддерживать будущую multi-user модель: отдельные аккаунты, отдельные vault, отдельные устройства и независимые сессии.

## Не входит в MVP

- SFTP file manager.
- SSH tunnels и port forwarding.
- Команды, snippets и automation.
- Teams, sharing, roles и organization accounts.
- Mobile clients.
- Сложный merge конфликтов по отдельным полям.
- Восстановление encrypted vault без мастер-пароля.

## Рекомендованный подход

Используется вариант `Tauri + React + xterm.js + Docker Compose sync server`.

Причины:

- весь стек можно использовать бесплатно;
- Tauri дает легкое desktop-приложение для macOS и Windows;
- xterm.js подходит для встроенного терминала;
- SSH-сессия запускается локально на машине пользователя, а не на сервере;
- Oracle-сервер хранит только аккаунты, сессии и зашифрованный vault;
- архитектура остается пригодной для будущего multi-user продукта.

## Архитектура

Монорепозиторий:

- `apps/desktop` - Tauri + React desktop client.
- `apps/server` - sync/auth API.
- `infra/oracle-compose` - Docker Compose для развертывания на Oracle-сервере.
- `packages/crypto` - shared vault schema, Rust encryption helpers и validation.
- `docs/superpowers/specs` - дизайн-документы.

Основные компоненты:

1. **Desktop UI**
   - login/register;
   - unlock vault;
   - список SSH-хостов;
   - форма добавления и редактирования хоста;
   - встроенный терминал;
   - базовые состояния загрузки, ошибки и reconnect.

2. **Local SSH runtime**
   - открывает SSH-сессии с локального компьютера пользователя;
   - поддерживает password auth;
   - поддерживает private key auth;
   - передает поток терминала в xterm.js;
   - не отправляет SSH-секреты на sync server в открытом виде.

3. **Sync server**
   - работает на Oracle-сервере через Docker Compose;
   - предоставляет API авторизации и синхронизации;
   - хранит encrypted vault blob и номер версии;
   - не умеет расшифровывать vault.

4. **Database**
   - PostgreSQL в Docker Compose;
   - хранит users, sessions/devices, vault metadata и encrypted vault blob.

## Security Design

У пользователя есть два секрета:

- пароль аккаунта для входа на sync server;
- мастер-пароль vault для расшифровки SSH-хостов, ключей и паролей.

Мастер-пароль никогда не отправляется на сервер. На клиенте из мастер-пароля создается ключ шифрования через Argon2id. Vault шифруется через XChaCha20-Poly1305.

Сервер хранит:

- email или login;
- password hash для входа в аккаунт;
- encrypted vault blob;
- vault version;
- salt и KDF параметры;
- device/session records.

Сервер не хранит мастер-пароль и не может прочитать:

- SSH passwords;
- private keys;
- key passphrases;
- host notes;
- usernames и host metadata внутри vault.

Если мастер-пароль потерян, восстановить vault нельзя. Пользователь может только сбросить vault и начать заново. Это сохраняет zero-knowledge модель.

Расшифрованный vault хранится только в памяти desktop-приложения. Для MVP допускается режим "запомнить до закрытия приложения", но не постоянная запись расшифрованного vault на диск.

## Vault Model

Encrypted vault после расшифровки содержит JSON-структуру:

- `schemaVersion`;
- `hosts`;
- `folders` или простая группировка, если потребуется;
- `updatedAt`;
- client-side metadata.

Минимальная запись host:

- `id`;
- `label`;
- `hostname`;
- `port`;
- `username`;
- `authType`: `password` или `privateKey`;
- `password`, если используется password auth;
- `privateKey`, если используется key auth;
- `privateKeyPassphrase`, если нужна;
- `notes`;
- `createdAt`;
- `updatedAt`.

В MVP folders/tags можно не показывать в UI, но схема не должна мешать добавить их позже.

## Sync Design

Клиент хранит локальную копию encrypted vault и ее `version`.

Поток:

1. Пользователь входит в аккаунт.
2. Клиент скачивает encrypted vault и metadata.
3. Пользователь вводит мастер-пароль.
4. Клиент расшифровывает vault локально.
5. Пользователь добавляет или меняет host.
6. Клиент шифрует весь vault целиком.
7. Клиент отправляет encrypted vault на сервер вместе с ожидаемой `version`.
8. Сервер принимает update только если версия совпадает с текущей.

Если версия устарела, сервер возвращает conflict. В MVP клиент скачивает свежий vault и просит пользователя повторить изменение. Сложный merge по отдельным host-записям откладывается.

## API MVP

Минимальные endpoints:

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /vault`
- `PUT /vault`

`PUT /vault` принимает expected version и возвращает новую version. При mismatch возвращается conflict response.

## Desktop MVP

Экранный поток:

1. Login/register.
2. Unlock vault мастер-паролем.
3. Host list.
4. Add/edit host.
5. Connect.
6. Terminal tab/session.

Подключение:

- пользователь выбирает host;
- приложение достает credential из расшифрованного vault в памяти;
- local SSH runtime открывает SSH-сессию;
- xterm.js отображает терминал и передает input обратно в runtime.

## Deployment

Oracle-сервер запускает sync stack через Docker Compose.

Compose-состав:

- API container;
- PostgreSQL container;
- Caddy reverse proxy для HTTPS;
- persistent volumes для базы.

Для MVP используется один домен или поддомен, направленный на Oracle-сервер. Caddy выпускает и обновляет TLS-сертификат автоматически. Backup policy для PostgreSQL добавляется отдельным этапом после MVP.

## Error Handling

Обязательные состояния:

- неправильный пароль аккаунта;
- неправильный мастер-пароль;
- недоступен sync server;
- vault version conflict;
- corrupted vault или несовместимая schema version;
- SSH connection timeout;
- SSH authentication failed;
- SSH host unreachable;
- terminal session closed.

Сообщения должны быть понятными и не раскрывать секреты.

## Testing

Минимальные проверки:

- crypto unit tests: правильный мастер-пароль расшифровывает vault;
- crypto unit tests: неправильный мастер-пароль не расшифровывает vault;
- crypto unit tests: tampered ciphertext не расшифровывается;
- API tests: register/login;
- API tests: upload/download vault;
- API tests: version conflict;
- desktop smoke test: приложение запускается;
- manual end-to-end: поднять Docker Compose, создать vault, добавить host, подключиться через встроенный терминал.

## Критерии готовности MVP

- Desktop-приложение запускается на macOS и Windows.
- Пользователь может зарегистрироваться и войти.
- Пользователь может создать или открыть encrypted vault мастер-паролем.
- Сервер хранит только encrypted vault и не получает мастер-пароль.
- Пользователь может добавить SSH-host с password auth.
- Пользователь может добавить SSH-host с private key auth.
- Пользователь может подключиться к host во встроенном терминале.
- Vault синхронизируется между двумя desktop-клиентами через Oracle-сервер.
- Конфликт версий не перезаписывает чужое изменение молча.
- Docker Compose stack поднимается на Oracle-сервере одной командой.
