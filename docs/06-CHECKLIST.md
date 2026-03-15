# Deployment Checklist

| Item | Status (Pass/Fail) | Verification Steps |
| --- | --- | --- |
| DNS points to 162.43.17.111 | Pass ☐ / Fail ☐ | `dig +short fopenclaw.com` → returns `162.43.17.111` |
| TLS + BasicAuth working | Pass ☐ / Fail ☐ | `curl -I https://fopenclaw.com -u deployer:<password>` → `HTTP/1.1 200 OK` |
| Gateway hidden on loopback | Pass ☐ / Fail ☐ | `sudo nmap -p 18789 127.0.0.1` → open; `sudo nmap -p 18789 162.43.17.111` → filtered |
| UFW enforcing rules | Pass ☐ / Fail ☐ | `sudo ufw status numbered` matches documented allows/denies |
| Device pairing reviewed | Pass ☐ / Fail ☐ | `docker compose exec gateway openclaw devices list` → no unknown entries |
| Gateway health OK | Pass ☐ / Fail ☐ | `curl -u deployer:<password> https://fopenclaw.com/status` returns `"health": "ok"` |
| Logs retained & sanitized | Pass ☐ / Fail ☐ | `sudo ls /var/log/caddy` and `docker compose logs gateway` show recent entries without secrets |
| Rollback plan ready | Pass ☐ / Fail ☐ | Documented image tag + stored tarball verified within last 30 days |

> **Reminder:** Mark each row after executing the verification steps; never assume "Pass" without evidence.