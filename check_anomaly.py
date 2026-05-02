import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from config import MONGO_URI, DB_NAME

async def check():
    col = AsyncIOMotorClient(MONGO_URI)[DB_NAME]['transactions']
    
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    counts = []
    for i in range(24):
        start = now - timedelta(hours=i+1)
        end   = now - timedelta(hours=i)
        n = await col.count_documents({
            'time': {'$gte': start, '$lt': end},
            'amount': {'$gte': 100}
        })
        counts.append(n)
        print(f"  {end.strftime('%H:00')} → {start.strftime('%H:00')} : {n} tx")

    active = [c for c in counts if c > 0]
    if active:
        avg = sum(active) / len(active)
        print(f"\nСереднє за годину:  {avg:.0f} tx")
        print(f"Максимум за годину: {max(active)} tx")
        print(f"Мінімум за годину:  {min(active)} tx")
        print(f"\nРекомендований поріг аномалії: {int(avg * 3)}-{int(max(active) * 1.5)} tx/h")
    else:
        print('Немає даних за останні 24 години')

asyncio.run(check())
