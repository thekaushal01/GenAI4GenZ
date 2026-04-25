# MediCare

MediCare is a medical knowledge assistant for educational use. It answers common health questions using a structured FAQ dataset, retrieval (RAG), and context compression to keep responses fast and cost-efficient.

## Why This Project

This project is built to demonstrate how to combine:
- safety-first health guidance
- retrieval-grounded responses
- token optimization with Scaledown

In short: better context, lower cost, and safer output behavior.

## What It Does

- Retrieves relevant disease context from a local medical JSON knowledge base
- Compresses retrieved context before model generation
- Generates responses with Gemini 2.5 Flash
- Applies safety checks for emergency, diagnosis, and prescription-related prompts
- Tracks token usage and savings
- Provides both a landing page and a chatbot interface

## How the Response Flow Works

1. User sends a question
2. Safety filter checks intent (emergency/unsafe patterns)
3. Retriever selects the most relevant disease entries
4. Scaledown compresses context to reduce token usage
5. Gemini generates an answer from compressed context
6. Final response includes safety disclaimer and token stats

## Quick Start

### Prerequisites

- Python 3.9+
- Gemini API key
- Scaledown API key

### Setup
```bash
git clone https://github.com/thekaushal01/GenAI4GenZ.git
cd healthcare-faq-bot
```

```bash
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_key
SCALEDOWN_API_KEY=your_scaledown_key
```

Run backend:

```bash
cd backend
python app.py
```

Open frontend:
- `healthcare-faq-bot/landing-page/index.html`
- or `healthcare-faq-bot/frontend/index.html`

```

## Project Structure

```text
healthcare-faq-bot/
  backend/
    app.py
    retrieval.py
    safety.py
    gemini.py
    scaledown.py
    requirements.txt
  data/
    medical_faq.json
  frontend/
    index.html
    styles.css
    script.js
  landing-page/
    index.html
    styles.css
    script.js
```

## Safety Notes

This project is educational and not a medical device.

It must not be used for:
- diagnosis
- prescription decisions
- emergency treatment guidance

If there is a medical emergency, contact local emergency services immediately.

## Tech Stack

- FastAPI
- Gemini 2.5 Flash
- Scaledown API
- Tailwind CSS + Vanilla JavaScript

## Deployment (Minimal)

Deploy backend to Railway/Render/Cloud Run and host static frontend on Vercel/Netlify/GitHub Pages.

Production checklist:
- set `GEMINI_API_KEY` and `SCALEDOWN_API_KEY`
- restrict CORS origins
- enable HTTPS
- add error and uptime monitoring

## License

Educational use.
