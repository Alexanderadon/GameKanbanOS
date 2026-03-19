from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import Optional, Union, List
import database

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Models
class UpdateStatus(BaseModel):
    id: int
    status: str

class UpdateDetails(BaseModel):
    id: int
    priority: Optional[str] = None
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[Union[str, List[str]]] = None
    description: Optional[str] = None
    progress: Optional[int] = None

class AddItem(BaseModel):
    title: str
    category: str = "Общее"
    status: str = "TODO"
    priority: str = "Medium"
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    tags: Optional[Union[str, List[str]]] = None
    description: Optional[str] = None
    progress: int = 0

@app.on_event("startup")
def startup_event():
    database.init_db()

@app.get("/", response_class=HTMLResponse)
async def read_items(request: Request):
    items = jsonable_encoder(database.get_all_items())
    return templates.TemplateResponse("index.html", {"request": request, "items": items})

@app.get("/map", response_class=HTMLResponse)
async def read_map(request: Request):
    items = jsonable_encoder(database.get_all_items())
    return templates.TemplateResponse("map.html", {"request": request, "items": items})

@app.get("/api/items")
async def get_items():
    return jsonable_encoder(database.get_all_items())

@app.post("/api/items/update_status")
async def update_item_status(data: UpdateStatus):
    database.execute_operations([
        {"action": "update", "id": data.id, "status": data.status}
    ])
    return {"success": True}

@app.post("/api/items/update_details")
async def update_item_details(data: UpdateDetails):
    update_op = {"action": "update", "id": data.id}
    if data.priority is not None: update_op["priority"] = data.priority
    if data.assignee is not None: update_op["assignee"] = data.assignee
    if data.due_date is not None: update_op["due_date"] = data.due_date
    if data.tags is not None: update_op["tags"] = data.tags
    if data.description is not None: update_op["description"] = data.description
    if data.progress is not None: update_op["progress"] = data.progress
    
    database.execute_operations([update_op])
    return {"success": True}

@app.post("/api/items/delete")
async def delete_item(data: UpdateStatus):
    database.execute_operations([{"action": "delete", "id": data.id}])
    return {"success": True}

@app.post("/api/items/add")
async def add_item(data: AddItem):
    created = database.add_item_and_return({
        "title": data.title,
        "category": data.category,
        "status": data.status,
        "priority": data.priority,
        "assignee": data.assignee or "",
        "due_date": data.due_date or "",
        "tags": data.tags or "",
        "description": data.description or "",
        "progress": data.progress or 0,
    })
    return {"success": True, "item": created}
