# OpenClaw Gateway Deployment @ fopenclaw.com

This repository documents the production deployment of an OpenClaw Gateway running on a hardened VPS at 162.43.17.111. The stack uses Docker Compose with Caddy providing TLS termination, HTTP BasicAuth, and reverse proxying into the gateway process bound to 127.0.0.1:18789. External access is limited to HTTPS, pairing is already complete, and the site currently relies on the primary model `zai/glm-5` (Z.AI) with fallback to `openai/gpt-5.2`. Health checks currently pass, but operational rigor depends on following the security and maintenance practices captured here.

## Environment at a Glance
- **Domain:** fopenclaw.com (A → 162.43.17.111)
- **Containers:** Caddy (edge) + openclaw-gateway (internal loopback bind)
- **Exposure:** Only ports 80/443 are reachable from the Internet; 18789 remains local
- **Authentication:** Caddy BasicAuth + gateway token + paired devices