#!/usr/bin/env bash
# EnglishX EC2 Deployment Script
# Run this directly on the EC2 instance, or via GitHub Actions SSH deploy job.
# Prerequisites: Docker, Docker Compose, Certbot, Git must be installed.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$REPO_DIR/infra"
DOMAIN="${DOMAIN:-yourdomain.com}"
EMAIL="${CERTBOT_EMAIL:-admin@yourdomain.com}"
CERTBOT_WEBROOT="/var/www/certbot"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

log "Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

log "Building and restarting Docker services..."
cd "$INFRA_DIR"
docker compose pull --quiet 2>/dev/null || true
docker compose up --build -d

log "Waiting for services to become healthy..."
sleep 10

log "Checking service health..."
if curl -sf http://localhost/health > /dev/null; then
    log "Health check passed"
else
    log "WARNING: Health check failed — check container logs"
fi

if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log "Renewing SSL certificate if needed..."
    certbot renew --quiet --webroot -w "$CERTBOT_WEBROOT" || log "Certbot renew skipped (not due yet)"
else
    log "Obtaining SSL certificate for $DOMAIN..."
    mkdir -p "$CERTBOT_WEBROOT"

    certbot certonly \
        --webroot \
        --webroot-path "$CERTBOT_WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domain "$DOMAIN" \
        --domain "www.$DOMAIN"

    log "Copying production nginx config..."
    cp "$INFRA_DIR/nginx/nginx-prod.conf" "$INFRA_DIR/nginx/nginx.conf"
    sed -i "s/yourdomain.com/$DOMAIN/g" "$INFRA_DIR/nginx/nginx.conf"

    log "Reloading nginx with SSL config..."
    docker compose exec nginx nginx -s reload
fi

log "Deployment complete."
docker compose ps
