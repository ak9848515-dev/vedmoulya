# Monitoring Runbook — VedMoulya v1.0.0

|                  |                      |
| ---------------- | -------------------- |
| **Service**      | VedMoulya Platform   |
| **Version**      | 1.0.0                |
| **Last Updated** | 2026-07-30           |
| **Owner**        | Platform Engineering |

---

## Health Endpoints

| Endpoint                   | Method | Purpose            | Expected Response                                    | Frequency |
| -------------------------- | ------ | ------------------ | ---------------------------------------------------- | --------- |
| `/api/trpc/health.check`   | GET    | Full system health | `{status:"healthy", version:"1.0.0", modules:[...]}` | Every 30s |
| `/api/trpc/health.live`    | GET    | Quick liveness     | `{status:"alive", timestamp:"..."}`                  | Every 10s |
| `/api/trpc/health.ready`   | GET    | Readiness          | `{status:"ready", uptime:N}`                         | Every 10s |
| `/api/trpc/health.version` | GET    | Version info       | `{version:"1.0.0", modules:[...]}`                   | On deploy |

### Automated Health Check Script

```bash
#!/usr/bin/env bash
# health-check.sh — Quick health check for monitoring
BASE_URL="${1:-http://localhost:3000}"

check() {
  local url="$1"
  local expected="$2"
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$response" = "200" ]; then
    echo "✅ $url — $response"
    return 0
  else
    echo "❌ $url — $response (expected 200)"
    return 1
  fi
}

echo "🔍 Health Check Report — $(date)"
echo ""

check "$BASE_URL/api/trpc/health.check"
check "$BASE_URL/api/trpc/health.live"
check "$BASE_URL/api/trpc/health.ready"
check "$BASE_URL/api/trpc/health.version"
check "$BASE_URL"
check "$BASE_URL/career"
check "$BASE_URL/learning"
check "$BASE_URL/business"
check "$BASE_URL/marketplace"
check "$BASE_URL/settings"
```

---

## Alert Configuration

### Critical Alerts (Immediate Response)

| Alert                    | Condition                              | Action                                  | Response Time |
| ------------------------ | -------------------------------------- | --------------------------------------- | ------------- |
| **Service Down**         | Health check fails 3 consecutive times | PagerDuty/Slack → Rollback              | < 5 min       |
| **High Error Rate**      | 5xx errors > 1% of requests            | Investigate logs → Rollback if critical | < 10 min      |
| **Database Unreachable** | Connection failures                    | Check DB status → Restart if needed     | < 5 min       |
| **Cache Exhaustion**     | Redis memory > 90%                     | Flush cache or scale up                 | < 15 min      |
| **Memory Leak**          | Memory usage increases > 5% per hour   | Restart service → Investigate           | < 30 min      |

### Warning Alerts (Business Hours)

| Alert                      | Condition            | Action                     | Response Time |
| -------------------------- | -------------------- | -------------------------- | ------------- |
| **High Latency**           | p95 latency > 1000ms | Investigate bottlenecks    | < 1 hour      |
| **Low Cache Hit Rate**     | Hit rate < 50%       | Review cache configuration | < 4 hours     |
| **Slow Queries**           | Query time > 500ms   | Add indexes or optimize    | < 1 day       |
| **Disk Space**             | Storage > 80%        | Clean up or scale          | < 1 day       |
| **SSL Certificate Expiry** | < 30 days remaining  | Renew certificate          | < 1 week      |

---

## Metrics & Dashboards

### Key Metrics to Monitor

| Category         | Metric          | Source                | Target             |
| ---------------- | --------------- | --------------------- | ------------------ |
| **Performance**  | API p50 latency | Health endpoint / APM | < 200ms            |
| **Performance**  | API p95 latency | Health endpoint / APM | < 500ms            |
| **Performance**  | API p99 latency | Health endpoint / APM | < 1000ms           |
| **Cache**        | Hit rate        | LifeOS cache metrics  | > 80%              |
| **Cache**        | Memory usage    | LifeOS cache metrics  | < 256 MB           |
| **Cache**        | Total entries   | LifeOS cache metrics  | < 50,000           |
| **Errors**       | Error rate      | Application logs      | < 0.1%             |
| **Availability** | Uptime          | Health check          | > 99.9%            |
| **Build**        | Bundle size     | Build output          | < 150 kB shared JS |

### Dashboard Widgets

1. **Service Health** — Green/Red status for all health endpoints
2. **API Latency** — Time-series of p50/p95/p99 latency
3. **Error Rate** — Count of 4xx/5xx errors over time
4. **Cache Performance** — Hit rate, memory usage, entry count
5. **User Activity** — Active sessions, requests per minute
6. **Build Metrics** — Latest build size, test pass rate

---

## Logging

### Log Levels in Production

| Level   | Usage                                | Example                                                    |
| ------- | ------------------------------------ | ---------------------------------------------------------- |
| `ERROR` | Runtime failures, API errors         | `{"level":"error","message":"Database connection failed"}` |
| `WARN`  | Degraded states, deprecations        | `{"level":"warn","message":"Cache miss rate > 50%"}`       |
| `INFO`  | Business events, state changes       | `{"level":"info","message":"User logged in"}`              |
| `DEBUG` | Development only — NOT in production | —                                                          |

### Log Format (JSON)

All logs should be structured JSON for machine parsing:

```json
{
  "timestamp": "2026-07-30T12:00:00.000Z",
  "level": "info",
  "service": "api-gateway",
  "version": "1.0.0",
  "requestId": "uuid-here",
  "message": "...",
  "metadata": {}
}
```

---

## Incident Response Procedures

### Severity Levels

| Level     | Definition              | Response    | SLA       |
| --------- | ----------------------- | ----------- | --------- |
| **SEV-1** | Complete service outage | Immediate   | < 15 min  |
| **SEV-2** | Major feature broken    | Urgent      | < 1 hour  |
| **SEV-3** | Minor issue / degraded  | Normal      | < 4 hours |
| **SEV-4** | Cosmetic / enhancement  | Best effort | < 1 week  |

### Incident Flow

```
1. DETECT ──▶ Alert triggered or user report
     │
     ▼
2. TRIAGE ──▶ Assess severity, notify team
     │
     ├── SEV-1/2: Open incident channel
     │
     ▼
3. RESPOND ──▶ Investigate root cause
     │
     ├── Fix identified → Deploy fix or rollback
     │
     ▼
4. RESOLVE ──▶ Verify fix, close incident
     │
     ▼
5. POST-MORTEM ──▶ Document within 48 hours
```

### Communication Channels

| Channel                        | Purpose                      |
| ------------------------------ | ---------------------------- |
| **Slack: #vedmoulya-alerts**   | Automated alerts             |
| **Slack: #vedmoulya-incident** | Active incident coordination |
| **PagerDuty**                  | On-call escalation           |
| **Email: ops@vedmoulya.com**   | Non-urgent reports           |

---

## Maintenance Procedures

### Scheduled Maintenance

1. Announce maintenance window at least 48 hours in advance
2. Schedule during low-usage period (e.g., 02:00-04:00 UTC)
3. Take services down gracefully
4. Perform maintenance
5. Verify health checks
6. Bring services back online
7. Monitor for 30 minutes post-maintenance

### Build Cache Clearing

```bash
# Clear stale Next.js build cache
npm run clean:build
```

### Database Maintenance

```bash
# Analyze tables for query optimizer
psql $DATABASE_URL -c "ANALYZE;"

# Reindex if needed
psql $DATABASE_URL -c "REINDEX DATABASE vedmoulya;"

# Vacuum (if not using auto-vacuum)
psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

---

## On-Call Schedule

| Day                   | Primary | Secondary | Escalation |
| --------------------- | ------- | --------- | ---------- |
| Mon-Fri (business)    | —       | —         | —          |
| Mon-Fri (after hours) | —       | —         | —          |
| Weekends              | —       | —         | —          |

_Configure on-call schedule on the monitoring platform._

---

## Escalation Path

```
Level 1: On-call Engineer
   │
   ▼ (if unresolved after 15 min)
Level 2: Platform Engineering Lead
   │
   ▼ (if unresolved after 30 min)
Level 3: CTO / Engineering Director
```

---

## Appendix: Health Check API Responses

### Successful Health Check

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600000,
    "modules": [{ "name": "lifeOS", "status": "healthy" }],
    "cache": {
      "totalEntries": 150,
      "hitRate": 0.85,
      "memoryUsage": 45000
    }
  }
}
```

### Degraded Health Check

```json
{
  "success": true,
  "data": {
    "status": "degraded",
    "version": "1.0.0",
    "uptime": 3600000,
    "modules": [{ "name": "lifeOS", "status": "degraded" }],
    "cache": {
      "totalEntries": 5,
      "hitRate": 0.2,
      "memoryUsage": 1000
    }
  }
}
```

---

## Revision History

| Date       | Author               | Change          |
| ---------- | -------------------- | --------------- |
| 2026-07-30 | Platform Engineering | Initial version |
