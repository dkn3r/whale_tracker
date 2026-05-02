"""
fix_db.py — Clean up whale tracker database:
  1. Delete transactions with amount < 10 ETH (junk)
  2. Fix double 0x0x hash prefixes
  3. Print before/after stats

Run: python fix_db.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGO_URI, DB_NAME

col = AsyncIOMotorClient(MONGO_URI)[DB_NAME]["transactions"]


async def main():
    total_before = await col.count_documents({})
    print(f"Before: {total_before:,} documents")

    # Step 1: Delete junk (amount < 10 ETH)
    print("\nDeleting junk transactions (amount < 10 ETH)...")
    result = await col.delete_many({"amount": {"$lt": 10}})
    print(f"  Deleted: {result.deleted_count:,}")

    # Also delete amount = 0.0 stored as exact float
    result2 = await col.delete_many({"amount": 0.0})
    print(f"  Deleted zeros: {result2.deleted_count:,}")

    # Step 2: Fix double 0x hashes
    print("\nFixing double 0x0x hashes...")
    fixed = 0
    async for doc in col.find({"hash": {"$regex": "^0x0x"}}):
        clean_hash = "0x" + doc["hash"][4:]
        await col.update_one(
            {"_id": doc["_id"]},
            {"$set": {"hash": clean_hash}}
        )
        fixed += 1
    print(f"  Fixed hashes: {fixed:,}")

    # Step 3: Stats
    total_after = await col.count_documents({})
    whales      = await col.count_documents({"amount": {"$gte": 100}})
    mid         = await col.count_documents({"amount": {"$gte": 10, "$lt": 100}})
    print(f"\nAfter: {total_after:,} documents")
    print(f"  >= 100 ETH: {whales:,}")
    print(f"  10-100 ETH: {mid:,}")
    print(f"\nRemoved {total_before - total_after:,} junk records")


asyncio.run(main())
