# Oracle Sync Server Runbook

## When To Use Remote Storage

Use this deployment when you want SSH Vault to sync one encrypted account vault between multiple devices, such as a Mac and a Windows PC.

For local-only testing, use `infra/local-compose` instead and enter `http://127.0.0.1:18080` in the desktop app. For remote sync, deploy this Oracle stack and enter the HTTPS domain, for example `https://ssh-sync.example.com`.

The sync server never receives plaintext host passwords or private keys. The desktop app encrypts the vault before upload, and the server stores the encrypted blob plus account/session metadata.

## Prepare

1. Point a DNS A record such as `ssh-sync.example.com` to the Oracle server public IP.
2. Open inbound ports `80/tcp` and `443/tcp` in Oracle Cloud security rules.
3. Install Docker and Docker Compose plugin on the server.

## Deploy

```bash
cd infra/oracle-compose
cp .env.example .env
```

Edit `.env` and set `SYNC_DOMAIN` plus a long random `POSTGRES_PASSWORD`.
The `.env` file is intentionally ignored by Git and must not be committed.

```bash
docker compose up -d --build
docker compose ps
curl -fsS https://$SYNC_DOMAIN/health
```

Expected health response:

```json
{"status":"ok"}
```

## Update

```bash
git pull
cd infra/oracle-compose
docker compose up -d --build
```
