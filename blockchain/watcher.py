import asyncio
import json
from datetime import datetime

import websockets
from web3 import AsyncWeb3
from web3.providers.async_rpc import AsyncHTTPProvider

from config import WSS_PROVIDER, HTTPS_PROVIDER
from db.mongo import user_profiles, tx_collection
from logger import logger
from bot.etherscan import whale_links_keyboard


w3 = AsyncWeb3(AsyncHTTPProvider(HTTPS_PROVIDER))


async def ensure_indexes():
    """Create indexes for fast dashboard queries."""
    try:
        await tx_collection.create_index("hash", unique=True, sparse=True)
    except Exception:
        pass  # Index already exists
    try:
        await tx_collection.create_index("time")
        await tx_collection.create_index("from")
        await tx_collection.create_index("amount")
    except Exception:
        pass
    logger.info("MongoDB indexes ensured")


MIN_WHALE_ETH = 10  # Save only transactions >= 10 ETH

def extract_hash(tx):
    """Return 0x-prefixed lowercase hex hash, or None if unavailable."""
    raw = tx.get("hash")
    if raw is None:
        return None
    if isinstance(raw, (bytes, bytearray)):
        return "0x" + raw.hex()
    h = str(raw).strip().lower()
    # Strip ALL existing 0x prefixes then add exactly one clean one
    while h.startswith("0x"):
        h = h[2:]
    return "0x" + h


async def save_transaction(tx_hash, value_eth, from_addr, to_addr, block_number):
    """
    Upsert the transaction.
    Records ALL transactions where funds are sent (value > 0, to is not None).
    """
    await tx_collection.update_one(
        {"hash": tx_hash},
        {"$setOnInsert": {
            "hash":   tx_hash,
            "amount": round(float(value_eth), 2),
            "time":   datetime.utcnow(),
            "block":  block_number,
            "from":   from_addr,
            "to":     to_addr,
        }},
        upsert=True,
    )


async def notify_users(bot, tx_hash, value_eth, from_addr, to_addr, block_number):
    """Send whale alerts to all eligible non-blocked users."""
    async for user in user_profiles.find({"is_blocked": {"$ne": True}}):
        user_id = user.get("user_id")
        if not user_id:
            continue

        try:
            limit = float(user.get("limit") or 0)
        except (TypeError, ValueError):
            limit = 0.0

        if float(value_eth) < limit:
            continue

        amount_str = f"{float(value_eth):.2f}"
        message_text = (
            "🚨 <b>Whale detected!</b>\n\n"
            f"💰 Amount: <b>{amount_str} ETH</b>\n"
            f"🕐 Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n"
            f"📦 Block: {block_number}\n"
            f"📤 From: <code>{from_addr}</code>\n"
            f"📥 To: <code>{to_addr or 'Contract creation'}</code>\n"
            f"🔗 Hash: <code>{tx_hash}</code>"
        )

        keyboard = whale_links_keyboard(tx_hash, from_addr, to_addr)

        try:
            await bot.send_message(
                user_id,
                message_text,
                reply_markup=keyboard,
                parse_mode="HTML",
                disable_web_page_preview=True,
            )
        except Exception as send_error:
            err = str(send_error)
            if "bot was blocked by the user" in err or "Forbidden" in err:
                logger.warning(f"User blocked bot: {user_id}")
                await user_profiles.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "is_blocked":     True,
                        "blocked_at":     datetime.utcnow(),
                        "blocked_reason": "blocked_by_user",
                    }},
                )
            else:
                logger.error(f"Telegram send error (user {user_id}): {send_error}")


async def process_block(bot, block_number: int):
    block = await w3.eth.get_block(block_number, full_transactions=True)
    saved = 0

    for tx in block.transactions:
        tx_hash   = extract_hash(tx)
        if not tx_hash:
            continue

        from_addr = tx.get("from")
        to_addr   = tx.get("to")        # None = contract creation
        value_eth = w3.from_wei(tx.get("value", 0), "ether")

        # ── Save only whale transactions ──────────────────────
        # Condition: value >= MIN_WHALE_ETH AND both addresses exist
        if float(value_eth) < MIN_WHALE_ETH or to_addr is None or from_addr is None:
            continue

        try:
            await save_transaction(tx_hash, value_eth, from_addr, to_addr, block_number)
            saved += 1
        except Exception as db_error:
            logger.error(f"Mongo save error ({tx_hash}): {db_error}")
            continue

        # ── Notify users whose limit is met ──────────────────
        try:
            await notify_users(bot, tx_hash, value_eth, from_addr, to_addr, block_number)
        except Exception as notify_error:
            logger.error(f"Notify error ({tx_hash}): {notify_error}")

    logger.info(f"Block {block_number}: {saved}/{len(block.transactions)} txs saved")


async def watch_blocks(bot):
    logger.info("Blockchain watcher started")
    await ensure_indexes()

    while True:
        try:
            async with websockets.connect(
                WSS_PROVIDER,
                ping_interval=20,
                ping_timeout=20,
                close_timeout=10,
            ) as ws:
                await ws.send(json.dumps({
                    "id":     1,
                    "method": "eth_subscribe",
                    "params": ["newHeads"],
                }))
                logger.info("Subscribed to newHeads")

                while True:
                    raw_msg = await ws.recv()
                    data    = json.loads(raw_msg)

                    params    = data.get("params")
                    if not params:
                        continue

                    block_hex = (params.get("result") or {}).get("number")
                    if not block_hex:
                        continue

                    block_number = int(block_hex, 16)
                    logger.info(f"New block: {block_number}")

                    try:
                        await process_block(bot, block_number)
                    except Exception as e:
                        logger.error(f"Error processing block {block_number}: {e}")

        except Exception as e:
            logger.error(f"Watcher connection error: {e} — reconnecting in 5s")
            await asyncio.sleep(5)
