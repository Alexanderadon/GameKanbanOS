# GameKanbanOS

A Telegram bot plus a web Kanban dashboard for tracking a game-dev project. Free-form text messages sent to the bot are parsed by an LLM into add/update/delete operations against a Postgres `items` table; the dashboard renders the same table as a drag-and-drop board and as a dependency-style map.

## What / Why

Project updates in a small game studio usually arrive as chat messages ("Anton, fix the camera bug ASAP", "inventory is done, movement is half-done"). GameKanbanOS turns those messages into structured board changes without manual card editing:

1. A user writes a message to the Telegram bot and picks a priority (or lets the model choose).
2. `llm_processor.py` sends the message together with the current board state to **Google Gemini** (`gemini-1.5-flash` via `google-generativeai`) and expects back a raw JSON array of operations (`add` / `update` / `delete`).
3. `database.py` applies those operations to the `items` table in Postgres (Supabase is the intended host, but any Postgres URL works).
4. The FastAPI dashboard (`web.py`) shows the board and exposes a small JSON API used by the frontend.

Gemini is the only LLM integrated in the code; there is no provider abstraction.

## Features

- **Telegram bot** (`bot.py`, aiogram 3): `/start`, `/help`, `/status` (items grouped by category), `/clear` (with inline confirmation), and free-text updates with an inline priority picker (Critical / High / Medium / Low / Auto).
- **LLM parsing** (`llm_processor.py`): the prompt asks the model to avoid duplicates (prefer `update` over `add`), assign a category, and extract priority, assignee, due date, tags and description when mentioned.
- **Kanban dashboard** (`templates/index.html`, `static/script.js`): columns by status (`TODO`, `PARTIAL`, `DONE`, `ROADMAP`), HTML5 drag-and-drop between columns, a trash drop zone, quick status buttons, a details editor (priority, assignee, due date, tags, description, progress bar), an add-item form and an assignee filter.
- **Map view** (`templates/map.html`): items rendered as a graph with vis-network (loaded from a CDN).
- **JSON API** (`web.py`): `GET /api/items`, `POST /api/items/add`, `POST /api/items/update_status`, `POST /api/items/update_details`, `POST /api/items/delete`.
- **Schema bootstrap**: `database.init_db()` runs `CREATE TABLE IF NOT EXISTS` plus indexes on startup of both the bot and the web app; `schema.sql` contains the same DDL for pasting into the Supabase SQL editor.
- **Seed data**: `populate.py` inserts a sample game-project backlog when the table is empty; `items_import.csv` is a sample CSV in the `items` column layout.

## Stack

From `requirements.txt`:

- Python 3
- aiogram >= 3.4.1 (Telegram bot)
- google-generativeai (Gemini client)
- FastAPI + uvicorn + jinja2 (web dashboard and API)
- pg8000 >= 1.31.2 (pure-Python Postgres driver)
- python-dotenv >= 1.0.1
- Frontend: vanilla JS/CSS, vis-network via CDN in the map view

Database: Postgres (Supabase). One table, `items`, with a `tags text[]` column and check constraints on `status`, `priority` and `progress`.

## Architecture

```
bot.py            Telegram bot (aiogram). Collects text + priority, calls the LLM, applies operations.
llm_processor.py  Builds the prompt, calls Gemini, parses the JSON array of operations.
database.py       pg8000 connection, schema bootstrap, get_all_items / add / execute_operations / clear.
web.py            FastAPI app: HTML pages (/ and /map) and the /api/items/* endpoints.
templates/        index.html (Kanban board), map.html (vis-network graph)
static/           script.js (board logic, fetch calls to the API), style.css
schema.sql        DDL for the items table (same as database.SCHEMA_SQL).
populate.py       Seed script.
items_import.csv  Sample CSV matching the items columns.
```

The bot and the web server are two separate processes that share the same database; the dashboard does not push updates, so after a bot-driven change the browser page has to be reloaded.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate   |   Unix: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Environment variables (read via `python-dotenv` from `.env`; see `.env.example`):

| Variable | Used in | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | `bot.py` | Bot token; the bot refuses to start without it |
| `GEMINI_API_KEY` | `llm_processor.py`, `bot.py` | Gemini API key; free-text updates are rejected if it is missing |
| `SUPABASE_DB_URL` | `database.py` | `postgresql://...` connection string |
| `DATABASE_URL` | `database.py` | Fallback used when `SUPABASE_DB_URL` is not set |

Create the table either by running `schema.sql` in the Supabase SQL editor or simply by starting one of the apps (`init_db()` runs on startup).

Web dashboard:

```bash
uvicorn web:app --reload --port 8000
```

- Kanban board: `http://localhost:8000`
- Map view: `http://localhost:8000/map`

Telegram bot:

```bash
python bot.py
```

Optional seed data:

```bash
python populate.py
```

Note: `database._get_conn()` uses a non-verifying TLS context (`ssl._create_unverified_context()`) as a workaround for certificate-chain issues with the Supabase pooler on older Python/Windows setups. This is acceptable for local development only.

## Tests / CI

There are no automated tests and no CI workflow in this repository.

## Roadmap

Known gaps visible in the code:

- **No authentication or authorization** on the write endpoints (`/api/items/add`, `update_status`, `update_details`, `delete`) or on the bot (any Telegram user who finds the bot can modify or clear the board).
- TLS certificate verification is disabled for the database connection.
- The `!add Category: ... | Task: ... | Status: ...` non-LLM format mentioned in the bot's `/help` text is not implemented; every non-command message goes through Gemini.
- No live refresh of the dashboard after bot-driven changes (manual page reload).
- Bot messages and default category names are in Russian; the UI is English.
- Single LLM provider (Gemini) hard-coded; no retries or validation of the model output beyond `json.loads`.
- No tests, no CI, no Docker/deployment configuration.

## License

MIT. See [LICENSE](LICENSE).
