import requests
import random
import time
from datetime import datetime

API_URL = "http://127.0.0.1:5000/add_data"
BIN_IDS = ["BIN001", "BIN002", "BIN003"]
WASTE_TYPES = ["biodegradable", "non-biodegradable", "hospital"]

LOG_FILE = "logs.txt"

with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("=== Smart Waste Management System Log Started ===\n")
    f.write(f"Session Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    f.write("=" * 60 + "\n\n")

def log_to_file(message):
    """Write logs to file with timestamp."""
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")

def send_data():
    for bin_id in BIN_IDS:
        data = {
            "bin_id": bin_id,
            "waste_type": random.choice(WASTE_TYPES),
            "fill_level": random.randint(50, 100),
            "weight": round(random.uniform(5, 15), 2)
        }
        try:
            response = requests.post(API_URL, json=data)
            response_json = response.json()

            print(f"Sent data: {data}")
            print(f"Response: {response_json}\n")

            log_to_file(f"Sent data: {data}")
            log_to_file(f"Response: {response_json}")
            log_to_file("-" * 60)

        except Exception as e:
            print(f"❌ Error sending data: {e}")
            log_to_file(f"❌ Error sending data: {e}")

if __name__ == "__main__":
    while True:
        send_data()
        print("Cycle completed — waiting 10 seconds before next batch...\n")
        log_to_file("Cycle completed — waiting 10 seconds before next batch...\n")
        time.sleep(10)
