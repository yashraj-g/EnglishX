# EnglishX — Voice AI English Speaking Coach

A voice-first AI English speaking coach built for Zenith School of AI. Learners practise speaking with an AI partner, receive structured feedback on pronunciation, vocabulary, and grammar, and track their progress across CEFR-mapped competency levels (L1–L6).

## Architecture

```
EnglishX/ (monorepo)
├── ms1-core-api/     # Express.js — Auth, Invites, Batches, Sessions, Dashboards
├── ms2-speech-agent/ # FastAPI + LangGraph — STT, Conversation, Feedback Pipeline
├── frontend/         # Next.js — Learner & Admin UI
├── infra/            # Docker, NGINX, DB schema, deploy scripts
└── .github/          # CI/CD workflows
```

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| ms1 — Core API | Express.js, JWT auth, PostgreSQL |
| ms2 — Speech Agent | FastAPI, LangGraph, Gemini API |
| Database | PostgreSQL (Supabase) |
| STT | Deepgram API |
| TTS | Browser Web Speech API |
| Email | Resend |
| Observability | OpenTelemetry → Grafana Cloud |
| Infra | Docker, NGINX, GitHub Actions CI/CD |

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

### 2. Boot everything with Docker
```bash
cd infra
docker-compose up --build
```
This starts: PostgreSQL (port 5432), ms1 (port 3001), ms2 (port 8000), NGINX (port 80).

### 3. Or run services individually
```bash
# Terminal 1 — ms1
cd ms1-core-api && npm run dev

# Terminal 2 — ms2
cd ms2-speech-agent && python -m uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend && npm run dev
```

## API Keys (Sign up when needed)

| Service | URL | What For |
|---------|-----|----------|
| **Deepgram** | https://deepgram.com | Speech-to-Text ($200 free credits) |
| **Google AI Studio** | https://aistudio.google.com | Gemini LLM (free tier) |
| **Resend** | https://resend.com | Email invites & reminders (100/day free) |
| **Supabase** | https://supabase.com | PostgreSQL hosting |
| **Grafana Cloud** | https://grafana.com | OpenTelemetry traces (free tier) |

Add keys to `.env` files in `ms1-core-api/` and `ms2-speech-agent/`.

## Features
- **Voice Conversation** — Free talk + HR interview role-play with AI
- **3-Dimension Feedback** — Pronunciation, vocabulary, grammar analysis
- **Level System** — L1–L6 (CEFR A1–C2) per dimension with rolling averages
- **Admin Dashboard** — Student management, batch analytics, invite system
- **Invite-Based Onboarding** — Tokenised email invites with batch binding
- **Daily Reminders** — Automated practice reminder emails

## License
MIT
