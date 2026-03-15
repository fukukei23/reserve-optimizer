# Architecture

```
Internet (clients & paired devices)
        |
        v
 +---------------+
 |     Caddy     |
 | TLS + BasicAuth|
 +---------------+
        |
 127.0.0.1:18789 (reverse proxy)
        |
 +--------------------+
 | OpenClaw Gateway   |
 |  - Agents runtime  |
 |  - Cron & storage  |
 +--------------------+
        |
        v
 +--------------------+
 | LLM Provider API   |
 | (primary: zai/glm-5; fallback: openai/gpt-5.2)
 +--------------------+
```

## Components

### Caddy (Edge Proxy)
- Terminates TLS for `fopenclaw.com` using automatic certificates.
- Enforces HTTP BasicAuth before forwarding traffic.
- Acts as the only externally exposed service, forwarding authenticated requests to the gateway on loopback.

### OpenClaw Gateway
- Runs inside Docker, bound to `127.0.0.1:18789` to avoid direct WAN exposure.
- Handles device pairing, session orchestration, cron jobs, and skill execution.
- Maintains gateway tokens and secret material stored outside of the repo.

### Agents
- Execute tasks triggered via the gateway, inheriting the security boundary enforced by Caddy and UFW.
- Communicate with upstream models through provider adapters configured within the gateway.

### LLM Providers (primary: zai/glm-5; fallback: openai/gpt-5.2)
- Inference requests are proxied from the gateway to the configured provider(s) using managed API keys (`<REDACTED>`).
- Network egress is restricted to provider endpoints; monitor usage to prevent key leakage and unexpected spend.

> **Security Note:** Keep the gateway container patched and restart it after configuration changes to ensure policy updates propagate end-to-end.