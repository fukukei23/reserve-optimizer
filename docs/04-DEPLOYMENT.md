# Deployment Guide

## 1. VPS Initialization
1. Provision Ubuntu 24.04 LTS on `162.43.17.111`.
2. Update base packages:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ufw fail2ban git curl
   ```
3. Create a non-root sudo user and add SSH keys:
   ```bash
   sudo adduser deployer
   sudo usermod -aG sudo deployer
   mkdir -p /home/deployer/.ssh && chmod 700 /home/deployer/.ssh
   ```
4. Lock down SSH (optional but recommended): disable password auth and root login via `/etc/ssh/sshd_config`.

## 2. Docker & Compose
1. Install Docker Engine and Compose plugin:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker deployer
   sudo apt install -y docker-compose-plugin
   ```
2. Create `/opt/openclaw/docker-compose.yml`:
   ```yaml
   services:
     caddy:
       image: caddy:2
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./Caddyfile:/etc/caddy/Caddyfile
         - caddy_data:/data
         - caddy_config:/config
       depends_on:
         - gateway
     gateway:
       image: openclaw/gateway:2026.2.18
       environment:
         - OPENCLAW_GATEWAY_TOKEN=<REDACTED>
       networks:
         default:
           aliases: [gateway]
       expose:
         - "18789"
       command: ["openclaw", "gateway", "start", "--bind", "127.0.0.1:18789"]
   volumes:
     caddy_data:
     caddy_config:
   ```

## 3. Caddy Configuration
1. Create `/opt/openclaw/Caddyfile`:
   ```caddyfile
   fopenclaw.com {
       encode gzip
       log {
           output file /var/log/caddy/access.log
       }
       basicauth {
           deployer JDJhJDEyJFhXTTU2YT...
       }
       reverse_proxy 127.0.0.1:18789
   }
   ```
2. Reload after edits: `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile`.

## 4. OpenClaw Initial Setup
1. Bring the stack online:
   ```bash
   cd /opt/openclaw
   docker compose pull
   docker compose up -d
   docker compose logs -f gateway
   ```
2. Pair devices: `docker compose exec gateway openclaw devices approve` (token already generated).
3. Verify health: `curl -u deployer:<password> https://fopenclaw.com/status` (returns JSON health OK).

> **Security Callout:** Never commit `.env` or token files—store them in `/opt/openclaw/secrets/` with `chmod 600` and document their rotation schedule separately.