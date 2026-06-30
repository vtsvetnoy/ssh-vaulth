# Oracle Sync Server Runbook

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
