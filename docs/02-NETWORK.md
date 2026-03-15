# Network Topology

## Addresses & Ports
- **Public IP:** `162.43.17.111`
- **Domain:** `fopenclaw.com` → points to the VPS via A record.
- **Exposed ports:** `80/tcp` and `443/tcp` (Caddy handles HTTP→HTTPS redirects and TLS termination).
- **Internal ports:** `127.0.0.1:18789` (OpenClaw Gateway). This port must remain unreachable from the Internet; only Caddy talks to it across the Docker bridge or host loopback.

## Flow
1. Client hits `https://fopenclaw.com` (port 443).
2. Caddy validates TLS + BasicAuth, then performs `reverse_proxy http://127.0.0.1:18789`.
3. Gateway receives the request, processes it, and—if needed—contacts the configured LLM provider(s) (Z.AI for GLM-5, with OpenAI as fallback) over outbound HTTPS.

## SSH Tunnel vs Public Route
- **Public Route:** Standard access over 443 through Caddy. Use for production workloads and paired devices.
- **SSH Tunnel:** For administrative debugging without touching public TLS paths. Example:
  ```bash
  ssh -L 18789:127.0.0.1:18789 ubuntu@162.43.17.111
  curl -H "Authorization: Basic <BASE64>" https://localhost:18789/healthz
  ```
  *Reminder:* Even over SSH, apply BasicAuth headers when probing endpoints.

## UFW Policy Snapshot
- `ufw allow 80/tcp`
- `ufw allow 443/tcp`
- `ufw deny 18789`
- `ufw default deny incoming`

> **Security Note:** Re-run `sudo ufw status numbered` after every firewall change and document rule numbers for quick rollbacks.