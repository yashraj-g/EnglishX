# EnglishX — Voice AI English Speaking Coach

A voice-first AI English speaking coach built for Zenith School of AI. Learners practise speaking with an AI partner, receive structured feedback on pronunciation, vocabulary, and grammar, and track their progress across CEFR-mapped competency levels (L1–L6).

## Architecture

```
EnglishX/ (monorepo)
├── ms1-core-api/     # Express.js — Auth, Invites, Batches, Sessions, Dashboards
├── ms2-speech-agent/ # FastAPI + LangGraph — STT, Conversation, Feedback Pipeline
├── frontend/         # Next.js — Learner & Admin UI
├── infra/            # Docker Compose, NGINX, DB schema, deploy scripts
└── .github/          # CI/CD workflows (GitHub Actions)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| ms1 — Core API | Express.js, JWT + Google OAuth, PostgreSQL |
| ms2 — Speech Agent | FastAPI, LangGraph, LangChain, Gemini API |
| Database | PostgreSQL (Supabase / AWS RDS) |
| STT | Deepgram API |
| TTS | Deepgram Aura TTS |
| Email | AWS SES |
| Auth | Custom JWT + Google OAuth2 |
| Observability | OpenTelemetry → Grafana Cloud OTLP |
| Infra | Docker, NGINX (reverse proxy), GitHub Actions CI/CD |
| Cloud | AWS EC2, HTTPS via Certbot / Let's Encrypt |
| Rate Limiting | express-rate-limit (auth: 10/15min, api: 100/15min) |
| API Docs | Swagger UI at `/api/docs` |

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.12+
- Docker & Docker Compose

### 1. Clone and install

```bash
git clone https://github.com/yashraj-g/EnglishX.git
cd EnglishX

# ms1
cd ms1-core-api && npm install && cd ..

# ms2
cd ms2-speech-agent && pip install -r requirements.txt && cd ..

# frontend
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

```bash
cp ms1-core-api/.env.example ms1-core-api/.env
cp ms2-speech-agent/.env.example ms2-speech-agent/.env
# Edit both files with your API keys
```

### 3. Boot everything with Docker

```bash
cd infra
docker compose up --build
```

Services: ms1 (port 3001), ms2 (port 8000), frontend (port 3000), NGINX (port 80).

### 4. Or run services individually

```bash
# Terminal 1 — ms1
cd ms1-core-api && npm run dev

# Terminal 2 — ms2
cd ms2-speech-agent && python -m uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend && npm run dev
```

## API Documentation

Swagger UI is available at `http://localhost/api/docs` when the stack is running.

## API Keys Required

| Service | URL | Purpose |
|---------|-----|---------|
| **Deepgram** | https://deepgram.com | Speech-to-Text + TTS ($200 free credits) |
| **Google AI Studio** | https://aistudio.google.com | Gemini LLM (free tier) |
| **AWS SES** | https://aws.amazon.com/ses | Transactional email |
| **Google Cloud** | https://console.cloud.google.com | OAuth2 (optional, for Google sign-in) |
| **Supabase / AWS RDS** | https://supabase.com | PostgreSQL hosting |
| **Grafana Cloud** | https://grafana.com | OpenTelemetry traces (free tier) |

## AWS SES Setup

1. In the AWS Console → SES → **Verified Identities**, verify your sending domain (`yourdomain.com`)
2. Add the DKIM/SPF/DMARC DNS records shown by SES
3. Create an IAM user with `ses:SendEmail` permission
4. Add credentials to `ms1-core-api/.env`:
   ```
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   AWS_SES_FROM_EMAIL=noreply@yourdomain.com
   ```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorised redirect URI: `https://yourdomain.com/api/auth/google/callback`
4. Add to `ms1-core-api/.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
   ```

## EC2 + HTTPS Deployment

### Prerequisites on EC2

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin certbot git
sudo usermod -aG docker ubuntu
```

### Initial Deployment

```bash
git clone https://github.com/yashraj-g/EnglishX.git ~/EnglishX
cd ~/EnglishX

# Set your domain
export DOMAIN=yourdomain.com
export CERTBOT_EMAIL=admin@yourdomain.com

bash infra/deploy.sh
```

The deploy script will:
1. Pull the latest code
2. Build and start all Docker services
3. Issue a Let's Encrypt SSL certificate via Certbot
4. Swap in the production NGINX config with HTTPS

### CI/CD GitHub Secrets Required

Set these in GitHub → Settings → Secrets & Variables → Actions:

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `EC2_HOST` | EC2 public IP or domain |
| `EC2_USERNAME` | SSH user (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | EC2 private key (PEM, entire content) |

Every push to `main` automatically: runs tests → builds & pushes Docker images → deploys to EC2.

## Features

- **Voice Conversation** — Free talk + HR interview role-play with AI (LangGraph)
- **3-Dimension Feedback** — Pronunciation, vocabulary, grammar analysis pipeline
- **Level System** — L1–L6 (CEFR A1–C2) per dimension with rolling averages
- **Admin Dashboard** — Student management, batch analytics, invite system
- **Invite-Based Onboarding** — Tokenised email invites with batch binding
- **Daily Reminders** — Automated practice reminder emails via AWS SES
- **Google Sign-In** — OAuth2 alongside custom email/password auth
- **Rate Limiting** — Protects auth and API endpoints from abuse
- **OpenTelemetry** — Distributed tracing → Grafana Cloud

## License

MIT
