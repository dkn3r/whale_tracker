from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton,
    ReplyKeyboardMarkup, KeyboardButton
)

def main_menu_keyboard():
    # Постійні кнопки ВНИЗУ чату (не inline)
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🔧 Змінити ліміт"), KeyboardButton(text="📊 Мій ліміт")]
        ],
        resize_keyboard=True,
        selective=True
    )

def limit_keyboard():
    # Inline кнопки (з’являються в конкретному повідомленні)
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="100 ETH", callback_data="limit_100"),
            InlineKeyboardButton(text="500 ETH", callback_data="limit_500")
        ],
        [
            InlineKeyboardButton(text="1000 ETH", callback_data="limit_1000")
        ],
        [
            InlineKeyboardButton(text="Ввести свій ліміт", callback_data="limit_custom")
        ]
    ])