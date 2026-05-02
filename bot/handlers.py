from datetime import datetime

from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup

from bot.keyboards import limit_keyboard, main_menu_keyboard
from db.mongo import user_profiles
from logger import logger

router = Router()


class LimitState(StatesGroup):
    waiting_custom_limit = State()


def utcnow():
    return datetime.utcnow()


async def touch_user(user_id, username=None):
    # created_at тільки при першому заході
    await user_profiles.update_one(
        {"user_id": user_id},
        {
            "$setOnInsert": {
                "user_id": user_id,
                "created_at": utcnow(),
                "limit": 100.0
            },
            "$set": {
                "last_seen": utcnow(),
                "username": username,
                "is_blocked": False,  # reset if user returns after blocking
            }
        },
        upsert=True
    )


async def set_limit(user_id, limit):
    await user_profiles.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "limit": float(limit),
                "last_seen": utcnow()
            },
            "$setOnInsert": {
                "user_id": user_id,
                "created_at": utcnow()
            }
        },
        upsert=True
    )


@router.message(F.text == "/start")
async def start_handler(message: Message, state: FSMContext):
    await state.clear()
    await touch_user(message.from_user.id, message.from_user.username)

    name = message.from_user.username or message.from_user.first_name or "друже"

    welcome_text = (
        f"🐋 ETH Whale Tracker\n\n"
        f"Привіт, {name}.\n"
        f"Я шукатиму великі транзакції в Ethereum і штиму тобі алерти.\n\n"
        f"Налаштуй поріг (ліміт) і отримуй повідомлення, коли хтось ганяє великі суми.\n"
        f"У кожному алерті будуть кнопки на Etherscan."
    )

    await message.answer(welcome_text, reply_markup=main_menu_keyboard())
    await message.answer("Обери ліміт або введи свій:", reply_markup=limit_keyboard())


@router.message(F.text == "🔧 Змінити ліміт")
async def change_limit_menu(message: Message, state: FSMContext):
    await state.clear()
    await touch_user(message.from_user.id, message.from_user.username)

    await message.answer("Обери ліміт або введи свій:", reply_markup=limit_keyboard())


@router.message(F.text == "📊 Мій ліміт")
async def my_limit(message: Message):
    await touch_user(message.from_user.id, message.from_user.username)

    user = await user_profiles.find_one({"user_id": message.from_user.id})
    limit = user.get("limit", 100.0) if user else 100.0

    await message.answer(f"Твій поточний ліміт: {limit} ETH")


@router.callback_query(F.data.startswith("limit_"))
async def limit_handler(callback: CallbackQuery, state: FSMContext):
    await touch_user(callback.from_user.id, callback.from_user.username)

    if callback.data == "limit_custom":
        await state.set_state(LimitState.waiting_custom_limit)
        await callback.message.answer("Введи свій ліміт у ETH (наприклад 123.45):")
        await callback.answer()
        return

    limit = float(callback.data.split("_")[1])
    await set_limit(callback.from_user.id, limit)

    await state.clear()
    await callback.message.answer(f"Ліміт встановлено: {limit} ETH ✅")
    await callback.answer()

    logger.info(f"User {callback.from_user.id} set limit {limit}")


@router.message(LimitState.waiting_custom_limit)
async def custom_limit_input(message: Message, state: FSMContext):
    await touch_user(message.from_user.id, message.from_user.username)

    raw = (message.text or "").replace(",", ".").strip()

    try:
        limit = float(raw)
        if limit <= 0 or limit > 1_000_000:
            raise ValueError()
    except Exception:
        await message.answer("Некоректно. Приклад: 100 або 123.45")
        return

    await set_limit(message.from_user.id, limit)
    await state.clear()

    await message.answer(f"Ліміт встановлено: {limit} ETH ✅")
    logger.info(f"User {message.from_user.id} set custom limit {limit}")