import database
import os

def populate():
    # Only populate if the database is newly created or empty
    items = database.get_all_items()
    if items:
        print("Database already contains items. Skipping populate.")
        return

    print("Populating initial data...")
    initial_data = [
        {"action": "add", "title": "Процедурный 3D-мир на чанках (загрузка/выгрузка, очередь спавна)", "status": "DONE", "category": "Мир и Генерация"},
        {"action": "add", "title": "Генерация террейна (остров, вода, освещение, небо, туман)", "status": "DONE", "category": "Мир и Генерация"},
        {"action": "add", "title": "Спавн контента по чанкам (ресурсы, враги, лут, тотемы)", "status": "DONE", "category": "Мир и Генерация"},
        {"action": "add", "title": "Игрок как рабочая сущность (инвентарь, UI, бой)", "status": "DONE", "category": "Игрок и Бой"},
        {"action": "add", "title": "Базовое передвижение (Health, Damage, Movement)", "status": "DONE", "category": "Игрок и Бой"},
        
        {"action": "add", "title": "Инвентарь: 30 слотов (8 хотбара), стаки, добавление/удаление, свап", "status": "DONE", "category": "Инвентарь"},
        {"action": "add", "title": "Крафт через инвентарь (рецепты грузятся из JSON: топор, кирка)", "status": "DONE", "category": "Инвентарь"},
        
        {"action": "add", "title": "Ресурсы мира (дерево, камень, ручная добыча)", "status": "DONE", "category": "Ресурсы и Лут"},
        {"action": "add", "title": "Лут: спавн в мире, подбор игроком, уведомления", "status": "DONE", "category": "Ресурсы и Лут"},
        
        {"action": "add", "title": "Бой (raycast-атака, урон через DamageComponent)", "status": "DONE", "category": "Игрок и Бой"},
        {"action": "add", "title": "Враги: спавн, обнаружение, погоня, награды", "status": "DONE", "category": "Враги"},
        {"action": "add", "title": "Тотемы: волна из 3 волков, награда лутом/капсулой", "status": "DONE", "category": "Враги"},
        
        {"action": "add", "title": "Способности: Vitality, Haste, Spring Jump (Капсула)", "status": "DONE", "category": "Игрок и Бой"},
        {"action": "add", "title": "UI: HP-бар, Золото, Инвентарь, Хотбар, Радар", "status": "DONE", "category": "UI"},
        {"action": "add", "title": "EventBus и Оптимизация (Profiler, Object pool, LOD)", "status": "DONE", "category": "Архитектура"},

        # Частично
        {"action": "add", "title": "PlayerSystem и CombatSystem", "status": "PARTIAL", "category": "Архитектура", "description": "Пока базовые, нужна развитая система оружия"},
        {"action": "add", "title": "ProgressionSystem (только wave_index)", "status": "PARTIAL", "category": "Системы", "description": "Заглушка"},
        {"action": "add", "title": "NetworkSystem (только validate_client_action)", "status": "PARTIAL", "category": "Архитектура", "description": "Заглушка мультиплеера"},
        {"action": "add", "title": "Система экономики (только золото)", "status": "PARTIAL", "category": "Системы"},
        
        # Планы
        {"action": "add", "title": "Полноценная система волн/дней/скейлинга сложности", "status": "TODO", "category": "Планы"},
        {"action": "add", "title": "Боссы", "status": "TODO", "category": "Враги"},
        {"action": "add", "title": "Развитая RPG-прокачка", "status": "TODO", "category": "Игрок и Бой"},
        {"action": "add", "title": "Несколько типов оружия", "status": "TODO", "category": "Игрок и Бой"},
        {"action": "add", "title": "Броня и слоты экипировки", "status": "TODO", "category": "Инвентарь"},
        {"action": "add", "title": "Расходники, жажда, голод", "status": "TODO", "category": "Выживание"},
        {"action": "add", "title": "Постройки/база/крафт-станции", "status": "TODO", "category": "Строительство"},
        {"action": "add", "title": "Сохранения игры", "status": "TODO", "category": "Архитектура"},
        {"action": "add", "title": "Полноценный мультиплеер (Серверная авторитетность)", "status": "TODO", "category": "Архитектура"},
        {"action": "add", "title": "Квесты, сюжет, NPC", "status": "TODO", "category": "Мир и Генерация"},
        {"action": "add", "title": "Биомы и несколько типов врагов", "status": "TODO", "category": "Мир и Генерация"}
    ]
    
    database.execute_operations(initial_data)
    print("Database populated successfully.")

if __name__ == "__main__":
    database.init_db()
    populate()
