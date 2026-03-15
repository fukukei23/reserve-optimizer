# Security Posture

## BasicAuth (Caddy)
- Define creds in `Caddyfile` using hashed passwords (e.g., `caddy hash-password --plaintext 'S3cure!!'`).
- Sample snippet:
  ```caddyfile
  fopenclaw.com {
      basicauth {
          deployer JDJhJDEyJFhXTTU2YTZVdXlLTG5VZU1ERTg4a25hU1Q1TGNIZ3MyT1l3T2Qyck1RSXo2dUpGWTB1
      }
      reverse_proxy 127.0.0.1:18789
  }
  ```
- Store the plaintext only in a secrets manager; commit only the hashed value.

## UFW Hardening
- Enforce least privilege: `sudo ufw default deny incoming`, allow only 22/80/443 as needed, and explicitly deny 18789.
- Verify with `sudo ufw status numbered` and prune stale rules using rule IDs.

## Trusted Proxies
- Gateway should treat only `127.0.0.1` (and Docker bridge if applicable) as trusted proxies to prevent spoofed headers.
- In OpenClaw config: `trustedProxies: ["127.0.0.1", "172.18.0.0/16"]` (adjust per docker network).

## Token & Pairing Controls
- A valid gateway token already exists—store it as `<REDACTED>` and load via env var `OPENCLAW_GATEWAY_TOKEN`.
- Provider API keys (Z.AI/OpenAI) must never be committed; load via env or config with redaction in docs/logs.
- Device pairing is complete; periodically review `openclaw devices list` and revoke unused pairs with `openclaw devices revoke <id>`.

## Risks & Recommendations
- **Credential sprawl:** Rotate BasicAuth and gateway tokens quarterly, updating `.env` and secret stores simultaneously.
- **Config drift:** Pin Docker image tags (e.g., `openclaw/gateway:2026.2.18`) and document upgrade steps before pulling `latest`.
- **Log leakage:** Scrub sensitive tokens (`<REDACTED>`) before sharing logs. Use `grep -v '<REDACTED>'` when exporting.
- **Monitoring gap:** Add fail2ban or Caddy rate limiting for repeated BasicAuth failures.

> **Security Reminder:** Treat backups with the same level of encryption and access controls as production—tokens and pairing secrets cannot appear in plain text anywhere.