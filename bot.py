import os
import asyncio
from aiogram import Bot, Dispatcher, types, F
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, CallbackQuery
from aiogram.filters.command import Command
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv

import database
from llm_processor import process_update_with_llm

load_dotenv()

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not BOT_TOKEN:
    raise ValueError("Пожалуйста, укажите TELEGRAM_BOT_TOKEN в файле .env")

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode="Markdown"))
dp = Dispatcher()

pending_tasks = {}

# Basic markdown table formatter
def format_status(items: list) -> str:
    if not items:
        return "База пуста. Отправьте мне обновления по проекту!"

    # Group by category
    grouped = {}
    for item in items:
        cat = item['category'] or 'Other'
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(item)

    res = "📊 *Статус проекта*\n\n"
    for cat, cat_items in grouped.items():
        res += f"📂 *{cat}*\n"
        for i in cat_items:
             status_icon = "✅" if i['status'] == 'DONE' else "🚧" if i['status'] == 'PARTIAL' else "📝"
             res += f" {status_icon} \[`{i['id']}`] {i['title']}\n"
        res += "\n"
    return res

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "🎮 *Добро пожаловать в Project OS Bot!*\n\n"
        "Просто напишите мне о задачах \u2014 я разобрерусь и добавлю их на доску автоматически!\n\n"
        "💻 Сайт: http://localhost:8000\n\n"
        "*Команды:*\n"
        "/status \u2014 смотреть все задачи\n"
        "/clear \u2014 очистить всю базу задач\n"
        "/help \u2014 показать подсказки по работе с ботом"
    )

@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    await message.answer(
        "💡 *Как пользоваться ботом:*\n\n"
        "Просто напишите что-то вроде:\n"
        "• `изючить прогресс мувмента, добавить инвентарь`\n"
        "• `Антон, срочно почини баг с камерой`\n"
        "• `удалить задачу баттл система сделана`\n\n"
        "ИИ сам разберётся что добавить, что обновить, что удалить и кюда положить.\n\n"
        "Но если хотите просто добавить задачу без ИИ, напишите в формате:\n"
        "`!add Категория: Мувмент | Задача: Сделать прыжок | Статус: TODO`"
    )

@dp.message(Command("clear"))
async def cmd_clear(message: types.Message):
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="⚠️ Да, удалить всё", callback_data="confirm_clear"),
        InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_clear")
    ]])
    await message.answer("⚠️ Удалить все задачи из базы? Это действие необратимо!", reply_markup=keyboard)

@dp.callback_query(F.data.in_({'confirm_clear', 'cancel_clear'}))
async def handle_clear_callback(callback: CallbackQuery):
    if callback.data == 'confirm_clear':
        database.clear_all_items()
        await callback.message.edit_text("✅ База очищена. Обновите страницу http://localhost:8000")
    else:
        await callback.message.edit_text("Отмена \u2014 база не тронута. 👍")

@dp.message(Command("status"))
async def cmd_status(message: types.Message):
    items = database.get_all_items()
    text = format_status(items)

    # Split text if it's too long for Telegram (max 4096)
    if len(text) > 4000:
        for x in range(0, len(text), 4000):
            await message.answer(text[x:x+4000])
    else:
        await message.answer(text)

@dp.message(F.text)
async def handle_update(message: types.Message):
    if message.text.startswith('/'):
        return

    if not os.getenv("GEMINI_API_KEY"):
        await message.answer("❌ **Внимание**: Укажите GEMINI_API_KEY в файле .env")
        return

    user_id = message.from_user.id
    pending_tasks[user_id] = message.text

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="❤️‍🔥 Critical", callback_data="prio_Critical"),
            InlineKeyboardButton(text="🔼 High", callback_data="prio_High")
        ],
        [
            InlineKeyboardButton(text="➖ Medium", callback_data="prio_Medium"),
            InlineKeyboardButton(text="🔽 Low", callback_data="prio_Low")
        ],
        [
            InlineKeyboardButton(text="🤖 Авто-Приоритет", callback_data="prio_Auto")
        ]
    ])
    
    await message.answer("Выберите приоритет для этой задачи(задач):", reply_markup=keyboard)

@dp.callback_query(F.data.startswith('prio_'))
async def handle_priority_callback(callback: CallbackQuery):
    user_id = callback.from_user.id
    priority = callback.data.split('_')[1]
    
    if user_id not in pending_tasks:
        await callback.answer("Задача не найдена или уже обработана.", show_alert=True)
        return
        
    user_text = pending_tasks.pop(user_id)
    
    if priority == 'Auto':
        await callback.message.edit_text("🤖 Авто-выбор приоритета. Обрабатываю...")
    else:
        user_text += f"\\n\\n[SYSTEM INSTRUCTION: The user explicitly set the priority for these tasks to '{priority}'. You MUST apply this priority.]"
        await callback.message.edit_text(f"Приоритет: {priority}. Обрабатываю...")

    current_state = database.get_all_items()

    try:
        operations = await process_update_with_llm(user_text, current_state)
        if not operations:
            await callback.message.edit_text("❌ Не удалось разобрать ответ от нейросети. Попробуйте еще раз.")
            return

        database.execute_operations(operations)

        added = len([op for op in operations if op.get('action') == 'add'])
        updated = len([op for op in operations if op.get('action') == 'update'])
        deleted = len([op for op in operations if op.get('action') == 'delete'])

        reply = f"✅ База успешно обновлена!\n\n➕ Добавлено: {added}\n🔄 Обновлено: {updated}\n🗑 Удалено: {deleted}\n\nПосмотреть состояние: /status\nНе забудьте обновить страницу в браузере!"
        await callback.message.edit_text(reply)

    except Exception as e:
        await callback.message.edit_text(f"🛑 Произошла ошибка: {e}")

async def main():
    database.init_db()
    print("Bot is starting...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
