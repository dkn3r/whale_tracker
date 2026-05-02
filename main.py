import asyncio

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from config import BOT_TOKEN
from bot.handlers import router
from blockchain.watcher import watch_blocks
from logger import logger


# main.py — add these imports at the top
import uvicorn
from api import app as web_app

async def main():
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher(storage=MemoryStorage())
    dp.include_router(router)

    asyncio.create_task(watch_blocks(bot))

    # Start dashboard in background
    config = uvicorn.Config(web_app, host="0.0.0.0", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    asyncio.create_task(server.serve())   # ← background task, not awaited

    logger.info("Bot + Dashboard started")
    await dp.start_polling(bot)           # ← this keeps everything alive

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"FATAL ERROR: {e}")
        input("Press Enter to exit...")  # keeps the window open on Windows