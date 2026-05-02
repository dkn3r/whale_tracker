"""
ETH Whale Tracker — FastAPI backend
Run:  uvicorn api:app --port 8000
"""

import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import httpx

from config import MONGO_URI, DB_NAME

client = AsyncIOMotorClient(MONGO_URI)
tx_col = client[DB_NAME]["transactions"]


async def _create_indexes():
    try:
        await tx_col.create_index("time")
        await tx_col.create_index([("amount", -1)])
        await tx_col.create_index([("from", 1)])
        await tx_col.create_index("hash", unique=True, sparse=True)
        print("MongoDB indexes ready")
    except Exception as e:
        print(f"Index warning: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _create_indexes()
    yield


app = FastAPI(title="ETH Whale Tracker API", lifespan=lifespan)


async def agg(pipeline):
    return [doc async for doc in tx_col.aggregate(pipeline)]

def iso(dt):
    if isinstance(dt, datetime): return dt.isoformat()
    return str(dt) if dt else None

def _cutoff(hours):
    return datetime.utcnow() - timedelta(hours=hours)

def r2(v):
    return round(float(v or 0), 2)

PERIOD_HOURS = {"hour": 1, "day": 24, "month": 720, "year": 8760}


@app.get("/api/stats")
async def get_stats():
    total   = await tx_col.count_documents({"amount": {"$gt": 0}})
    all_agg = await agg([{"$match": {"amount": {"$gt": 0}}}, {"$group": {"_id": None, "vol": {"$sum": "$amount"}, "max": {"$max": "$amount"}}}])
    h1_agg  = await agg([{"$match": {"time": {"$gte": _cutoff(1)}, "amount": {"$gt": 0}}}, {"$group": {"_id": None, "count": {"$sum": 1}, "vol": {"$sum": "$amount"}, "senders": {"$addToSet": "$from"}}}])
    h24_agg = await agg([{"$match": {"time": {"$gte": _cutoff(24)}, "amount": {"$gt": 0}}}, {"$group": {"_id": None, "count": {"$sum": 1}, "vol": {"$sum": "$amount"}}}])
    a = all_agg[0] if all_agg else {}; h1 = h1_agg[0] if h1_agg else {}; h24 = h24_agg[0] if h24_agg else {}
    return {"total_txs": total, "total_volume": r2(a.get("vol",0)), "max_amount": r2(a.get("max",0)),
            "txs_1h": h1.get("count",0), "volume_1h": r2(h1.get("vol",0)), "senders_1h": len(h1.get("senders",[])),
            "txs_24h": h24.get("count",0), "volume_24h": r2(h24.get("vol",0))}


@app.get("/api/wotd")
async def get_wotd():
    cutoff = _cutoff(1)
    best = await tx_col.find_one({"time": {"$gte": cutoff}, "amount": {"$gt": 0}}, sort=[("amount", -1)])
    if not best: return {}
    totals = await agg([{"$match": {"from": best["from"], "time": {"$gte": cutoff}}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}])
    t = totals[0] if totals else {}
    return {"address": best["from"], "amount": r2(best["amount"]), "hash": best.get("hash",""),
            "time": iso(best.get("time")), "total_hour": r2(t.get("total",0)), "tx_count_hour": t.get("count",0)}


@app.get("/api/largest-ever")
async def get_largest_ever():
    best = await tx_col.find_one({"amount": {"$gt": 0}}, sort=[("amount", -1)])
    if not best: return {}
    totals = await agg([{"$match": {"from": best["from"]}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}])
    t = totals[0] if totals else {}
    return {"address": best["from"], "to": best.get("to",""), "amount": r2(best["amount"]),
            "hash": best.get("hash",""), "time": iso(best.get("time")), "block": best.get("block"),
            "total_sent": r2(t.get("total",0)), "tx_count": t.get("count",0)}


@app.get("/api/top-hourly")
async def get_top_hourly(n: int = 10):
    cursor = tx_col.find({"time": {"$gte": _cutoff(1)}, "amount": {"$gt": 0}}, {"_id": 0}).sort("amount", -1).limit(n)
    docs = []
    async for doc in cursor:
        doc["time"] = iso(doc.get("time")); doc["amount"] = r2(doc["amount"]); docs.append(doc)
    return docs


@app.get("/api/transactions")
async def get_transactions(threshold: float = 100, limit: int = 60):
    query = {"amount": {"$gt": 0}} if threshold <= 0 else {"amount": {"$gte": threshold}}
    cursor = tx_col.find(query, {"_id": 0}).sort("time", -1).limit(limit)
    docs = []
    async for doc in cursor:
        doc["time"] = iso(doc.get("time")); doc["amount"] = r2(doc["amount"]); docs.append(doc)
    return docs


@app.get("/api/minutely")
async def get_minutely(threshold: float = 100):
    now = datetime.utcnow(); cutoff = now - timedelta(hours=1)
    rows = await agg([
        {"$match": {"time": {"$gte": cutoff}, "amount": {"$gte": threshold}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%dT%H:%M", "date": {"$subtract": ["$time", {"$multiply": [{"$mod": [{"$minute": "$time"}, 5]}, 60000]}]}}}, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}},
    ])
    row_map = {r["_id"]: r for r in rows}
    base = now.replace(second=0, microsecond=0) - timedelta(minutes=now.minute % 5)
    return [{"label": (base - timedelta(minutes=i*5)).strftime("%H:%M"), "count": row_map.get((base - timedelta(minutes=i*5)).strftime("%Y-%m-%dT%H:%M"), {}).get("count", 0), "volume": r2(row_map.get((base - timedelta(minutes=i*5)).strftime("%Y-%m-%dT%H:%M"), {}).get("volume", 0))} for i in range(11, -1, -1)]


@app.get("/api/hourly")
async def get_hourly(threshold: float = 100, hours: int = 24):
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0); cutoff = now - timedelta(hours=hours)
    rows = await agg([{"$match": {"time": {"$gte": cutoff}, "amount": {"$gte": threshold}}}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%dT%H:00", "date": "$time"}}, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}}])
    row_map = {r["_id"]: r for r in rows}
    return [{"label": (now - timedelta(hours=i)).strftime("%H:00"), "count": row_map.get((now - timedelta(hours=i)).strftime("%Y-%m-%dT%H:00"), {}).get("count", 0), "volume": r2(row_map.get((now - timedelta(hours=i)).strftime("%Y-%m-%dT%H:00"), {}).get("volume", 0))} for i in range(hours-1, -1, -1)]


@app.get("/api/heatmap")
async def get_heatmap():
    rows = await agg([{"$match": {"time": {"$gte": _cutoff(24*365)}, "amount": {"$gt": 0}}}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$time"}}, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}}, {"$sort": {"_id": 1}}])
    return [{"date": r["_id"], "count": r["count"], "volume": r2(r["volume"])} for r in rows]


@app.get("/api/leaderboard")
async def get_leaderboard(period: str = "day", n: int = 5, threshold: float = 100):
    hours = PERIOD_HOURS.get(period, 24)
    rows  = await agg([{"$match": {"time": {"$gte": _cutoff(hours)}, "amount": {"$gte": threshold}}}, {"$group": {"_id": "$from", "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}}, {"$sort": {"count": -1}}, {"$limit": n}])
    return [{"address": r["_id"], "count": r["count"], "volume": r2(r["volume"])} for r in rows]


@app.get("/api/address/{addr}")
async def get_address(addr: str):
    sent = await agg([{"$match": {"from": addr}}, {"$group": {"_id": None, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}, "max": {"$max": "$amount"}, "first": {"$min": "$time"}, "last": {"$max": "$time"}}}])
    recv = await agg([{"$match": {"to": addr}}, {"$group": {"_id": None, "count": {"$sum": 1}, "volume": {"$sum": "$amount"}}}])
    cutoff_14 = datetime.utcnow() - timedelta(days=14)
    act_rows  = await agg([{"$match": {"from": addr, "time": {"$gte": cutoff_14}}}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$time"}}, "count": {"$sum": 1}}}])
    act_map   = {r["_id"]: r["count"] for r in act_rows}
    daily     = [{"date": (datetime.utcnow()-timedelta(days=i)).strftime("%Y-%m-%d"), "count": act_map.get((datetime.utcnow()-timedelta(days=i)).strftime("%Y-%m-%d"), 0)} for i in range(13, -1, -1)]
    recent_txs = []
    async for doc in tx_col.find({"from": addr}, {"_id": 0}).sort("time", -1).limit(8):
        doc["time"] = iso(doc.get("time")); doc["amount"] = r2(doc["amount"]); recent_txs.append(doc)
    s = sent[0] if sent else {}; r = recv[0] if recv else {}
    return {"address": addr, "sent_count": s.get("count",0), "sent_volume": r2(s.get("volume",0)), "max_amount": r2(s.get("max",0)),
            "recv_count": r.get("count",0), "recv_volume": r2(r.get("volume",0)), "first_seen": iso(s.get("first")), "last_seen": iso(s.get("last")),
            "daily_activity": daily, "recent_txs": recent_txs}


@app.get("/api/correlation")
async def get_correlation(days: int = 30):
    cutoff   = datetime.utcnow() - timedelta(days=days)
    vol_rows = await agg([{"$match": {"time": {"$gte": cutoff}, "amount": {"$gt": 0}}}, {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$time"}}, "volume": {"$sum": "$amount"}}}])
    vol_map  = {r["_id"]: r2(r["volume"]) for r in vol_rows}
    price_map: dict = {}
    try:
        async with httpx.AsyncClient(timeout=5) as http:
            resp = await http.get("https://api.coingecko.com/api/v3/coins/ethereum/market_chart", params={"vs_currency": "usd", "days": days, "interval": "daily"})
            if resp.status_code == 200:
                for ts_ms, price in resp.json().get("prices", []):
                    price_map[datetime.utcfromtimestamp(ts_ms/1000).strftime("%Y-%m-%d")] = round(price, 2)
    except Exception: pass
    return [{"date": (datetime.utcnow()-timedelta(days=i)).strftime("%Y-%m-%d"), "volume": vol_map.get((datetime.utcnow()-timedelta(days=i)).strftime("%Y-%m-%d"), 0), "price": price_map.get((datetime.utcnow()-timedelta(days=i)).strftime("%Y-%m-%d"))} for i in range(days-1, -1, -1)]


@app.get("/api/network")
async def get_network(limit: int = 10):
    nodes_raw = await agg([{"$match": {"amount": {"$gt": 0}}}, {"$group": {"_id": "$from", "sent": {"$sum": "$amount"}, "txCount": {"$sum": 1}}}, {"$sort": {"sent": -1}}, {"$limit": limit}])
    node_ids  = [n["_id"] for n in nodes_raw]
    recv_data = {r["_id"]: r["recv"] for r in await agg([{"$match": {"to": {"$in": node_ids}}}, {"$group": {"_id": "$to", "recv": {"$sum": "$amount"}}}])}
    edges_raw = await agg([{"$match": {"from": {"$in": node_ids}, "to": {"$in": node_ids}}}, {"$group": {"_id": {"from": "$from", "to": "$to"}, "weight": {"$sum": 1}, "volume": {"$sum": "$amount"}}}, {"$sort": {"weight": -1}}, {"$limit": 40}])
    return {
        "nodes": [{"id": n["_id"], "sent": r2(n["sent"]), "recv": r2(recv_data.get(n["_id"], 0)), "txCount": n["txCount"]} for n in nodes_raw],
        "edges": [{"source": e["_id"]["from"], "target": e["_id"]["to"], "weight": e["weight"], "volume": r2(e["volume"])} for e in edges_raw],
    }



@app.get("/api/transactions-month")
async def get_transactions_month(limit: int = 500):
    """All transactions in the last 30 days for chart3 distribution."""
    cursor = tx_col.find(
        {"time": {"$gte": _cutoff(24 * 30)}, "amount": {"$gt": 0}},
        {"_id": 0, "amount": 1}
    ).sort("time", -1).limit(limit)
    docs = []
    async for doc in cursor:
        docs.append({"amount": r2(doc["amount"])})
    return docs


# ── STATIC FILES — must be absolutely last ────────────────────
app.mount("/", StaticFiles(directory="static", html=True), name="static")
