# Operations Manual

## Gateway Token Management
- Tokens live outside the repo; load via `/opt/openclaw/.env` with `OPENCLAW_GATEWAY_TOKEN=<REDACTED>`.
- Rotate quarterly:
  ```bash
  docker compose exec gateway openclaw gateway token rotate
  sudo systemctl reload docker # if using service units
  ```
- Update secrets store immediately after rotation and notify paired device owners.

## Device Approvals & Revocations
- List waiting devices:
  ```bash
  docker compose exec gateway openclaw devices pending
  ```
- Approve a device by ID:
  ```bash
  docker compose exec gateway openclaw devices approve 7f3b4c
  ```
- Revoke unused devices:
  ```bash
  docker compose exec gateway openclaw devices revoke 7f3b4c
  ```

## Log Access
- Caddy access/error logs: `/var/log/caddy/*.log` (mounted via volume). Tail with:
  ```bash
  sudo tail -f /var/log/caddy/access.log
  ```
- Gateway logs:
  ```bash
  cd /opt/openclaw
  docker compose logs -f gateway
  ```
- Export logs safely:
  ```bash
  docker compose logs gateway | sed -E 's/(OPENAI_API_KEY|GLM_API_KEY)=[^ ]+/\1=<REDACTED>/g' > gateway.log
  ```

## Docker Compose Rollback
1. Identify last working image tag (e.g., `openclaw/gateway:2026.2.18`).
2. Edit `docker-compose.yml` to pin the known-good tag.
3. Redeploy:
   ```bash
   docker compose pull gateway
   docker compose up -d gateway
   ```
4. If the rollback fails, use stored tarball:
   ```bash
   docker load < gateway-2026-02-18.tar
   docker tag gateway:backup openclaw/gateway:2026.2.18
   docker compose up -d gateway
   ```

> **Operational Warning:** Always pause cron jobs or announce maintenance windows before restarts to avoid dropping in-flight agent tasks.