from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

ETHERSCAN = "https://etherscan.io"

def whale_links_keyboard(tx_hash, from_addr, to_addr):

    buttons = [
        [
            InlineKeyboardButton(
                text="TX",
                url=f"{ETHERSCAN}/tx/{tx_hash}"
            )
        ],
    ]

    addr_row = []
    if from_addr:
        addr_row.append(InlineKeyboardButton(
            text="From",
            url=f"{ETHERSCAN}/address/{from_addr}"
        ))
    if to_addr:
        addr_row.append(InlineKeyboardButton(
            text="To",
            url=f"{ETHERSCAN}/address/{to_addr}"
        ))
    if addr_row:
        buttons.append(addr_row)

    return InlineKeyboardMarkup(inline_keyboard=buttons)