# Project OS Bot (Supabase)

## 1) Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set:
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `SUPABASE_DB_URL`

## 2) Create DB schema in Supabase

Open Supabase dashboard:
1. `SQL Editor`
2. Create `New query`
3. Paste content of `schema.sql`
4. Run query

## 3) Run app

Web dashboard:

```bash
uvicorn web:app --reload --port 8000
```

Telegram bot:

```bash
python bot.py
```

## URLs

- Kanban board: `http://localhost:8000`
- Diagram map: `http://localhost:8000/map`
# GameKanbanOS
