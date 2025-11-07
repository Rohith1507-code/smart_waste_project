# db.py
from pymongo import MongoClient

# === Connect to MongoDB Atlas ===
# Replace <db_password> with your actual MongoDB user password (inside quotes)
MONGO_URI = "mongodb+srv://rohithmurali_db_user:RO37TA67VI82SA84@cluster2005.fjgd1yg.mongodb.net/?appName=Cluster2005"

client = MongoClient(MONGO_URI)

# === Use (or create) the smart_waste database ===
db = client["smart_waste"]

# === Collections ===
bins_collection = db["bins"]
alerts_collection = db["alerts"]
notifications_collection = db["notifications"]
users_collection = db["users"]
collected_records = db["collected_records"]  # log of collected bins
