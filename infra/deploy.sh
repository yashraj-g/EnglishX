#!/usr/bin/env bash
# EnglishX EC2 Deployment Script
# Run this directly on the EC2 instance, or via GitHub Actions SSH deploy job.
# Prerequisites: Docker, Docker Compose, Certbot, Git must be installed.
#
# Domain  : englishx-app.duckdns.org  (DuckDNS — points to EC2)
# Frontend: Vercel (not served from this EC2)
# EC2     : ms1-core-api (port 3001) + ms2-speech-agent (port 8000) behind NGINX

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$REPO_DIR/infra"
DOMAIN="englishx-app.duckdns.org"
EMAIL="valuedrocks@gmail.com"
CERTBOT_WEBROOT="/var/www/certbot"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "=== EnglishX EC2 Deploy — domain: $DOMAIN ==="

log "Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# ─── Docker services (ms1, ms2, nginx only — no frontend container) ───────────
log "Building and starting Docker services..."
cd "$INFRA_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up --build -d

log "Waiting for services to become healthy (15s)..."
sleep 15

log "Checking ms1 health..."
if curl -sf http://localhost/health > /dev/null 2>&1; then
    log "✅ Health check passed"
else
    log "⚠️  Health check failed — check: docker compose logs ms1-core-api"
fi

# ─── SSL Certificate via Let's Encrypt (Certbot webroot) ─────────────────────
mkdir -p "$CERTBOT_WEBROOT"

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "Certificate already exists — attempting renewal if due..."
    certbot renew \
        --quiet \
        --webroot \
        -w "$CERTBOT_WEBROOT" \
        --post-hook "docker compose -f $INFRA_DIR/docker-compose.yml exec -T nginx nginx -s reload" \
        || log "ℹ️  Certbot renew: certificate not due yet or already renewed"
else
    log "Obtaining new SSL certificate for $DOMAIN..."

    # Issue the certificate (port 80 must be open and serving the webroot)
    certbot certonly \
        --webroot \
        --webroot-path "$CERTBOT_WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domain "$DOMAIN"

    log "Switching to production NGINX config with HTTPS..."
    cp "$INFRA_DIR/nginx/nginx-prod.conf" "$INFRA_DIR/nginx/nginx.conf"

    log "Reloading NGINX with SSL config..."
    docker compose exec nginx nginx -t          # validate config first
    docker compose exec nginx nginx -s reload

    log "✅ SSL certificate issued and NGINX reloaded"
fi

log "=== Deployment complete ==="
docker compose ps
