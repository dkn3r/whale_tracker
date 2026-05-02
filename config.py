import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")

WSS_PROVIDER = "wss://ethereum-rpc.publicnode.com"
HTTPS_PROVIDER = "https://ethereum-rpc.publicnode.com"

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "whale_tracker"
