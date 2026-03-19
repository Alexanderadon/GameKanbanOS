import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# We use Gemini for parsing text into structured JSON.
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-1.5-flash')

SYSTEM_PROMPT = """You are an expert Project Management AI for a Game Dev Studio.
The user will provide you with a natural language string describing project updates, new tasks, assignments, or bug reports.
You will also receive the CURRENT STATE of the project (a JSON list of all existing items).

Your goal is to parse the user's input and return a precise list of JSON operations to update the database. 
You must completely AVOID duplicates. If an item exists, output an "update" action rather than "add".

Possible statuses: "DONE", "PARTIAL", "TODO", "ROADMAP".
Categories: group them logically (e.g., "Combat", "Inventory", "UI", "World", "Enemies", "Architecture").
Priorities: "Low", "Medium", "High", "Critical".

For each task, try to extract the following rich metadata if mentioned by the user:
- priority (String)
- assignee (String, e.g., "Alex", "Anna")
- due_date (String)
- tags (Array of strings, e.g., ["bug", "3D"])
- description (String, extended context or acceptance criteria)

You MUST return ONLY a raw JSON array of objects representing the operations to perform.
Format:
[
  {
    "action": "add", 
    "title": "Fix movement bug", 
    "status": "TODO", 
    "category": "Combat",
    "priority": "Critical",
    "assignee": "Alex",
    "description": "The player gets stuck on slopes.",
    "tags": ["bug", "input"]
  },
  {
    "action": "update", 
    "id": 5, 
    "status": "PARTIAL",
    "priority": "High"
  }
]
Do not include any Markdown formatting like ```json or anything else. Just the raw valid JSON array.
"""

async def process_update_with_llm(user_message: str, current_state: list) -> list:
    state_json = json.dumps(current_state, ensure_ascii=False)

    user_prompt = f"{SYSTEM_PROMPT}\n\nCURRENT STATE:\n{state_json}\n\nUSER UPDATE:\n{user_message}"

    try:
        response = await model.generate_content_async(user_prompt)
        raw_response = response.text.strip()

        # Clean up standard markdown markers if the LLM output them despite instructions
        if raw_response.startswith('```json'):
            raw_response = raw_response[7:]
        if raw_response.endswith('```'):
            raw_response = raw_response[:-3]
        raw_response = raw_response.strip()

        operations = json.loads(raw_response)
        return operations
    except Exception as e:
        print(f"Error parsing JSON from LLM: {e}")
        return []
