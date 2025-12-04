import requests
import random
import time
from datetime import datetime

API_URL = "https://smart-waste-project.onrender.com/add_data"

BIN_LOCATIONS = {
    "BIN001": {"latitude": 13.0640, "longitude": 77.8048},
    "BIN002": {"latitude": 13.0634, "longitude": 77.8025},
    "BIN003": {"latitude": 13.0628, "longitude": 77.8062},
}

WASTE_TYPES = ["biodegradable", "non-biodegradable", "hospital"]
LOG_FILE = "logs.txt"

with open(LOG_FILE, "w", encoding="utf-8") as f:
    f.write("=== Smart Waste Log Started ===\n")
    f.write(f"Start: {datetime.now()}\n")
    f.write("=" * 60 + "\n\n")


def log_to_file(message):
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"[{datetime.now()}] {message}\n")


def send_data():
    for bin_id, loc in BIN_LOCATIONS.items():
        data = {
            "bin_id": bin_id,
            "waste_type": random.choice(WASTE_TYPES),
            "fill_level": random.randint(30, 100),
            "weight": round(random.uniform(5, 15), 2),
            "latitude": loc["latitude"],
            "longitude": loc["longitude"]
        }

        try:
            response = requests.post(API_URL, json=data)
            response_json = response.json()

            print(f"Sent: {data}")
            print(f"Response: {response_json}\n")

            log_to_file(f"Sent: {data}")
            log_to_file(f"Response: {response_json}")
            log_to_file("-" * 60)

        except Exception as e:
            print(f"❌ Error: {e}")
            log_to_file(f"❌ Error: {e}")


if __name__ == "__main__":
    while True:
        send_data()
        print("Next update in 10 secs...\n")
        log_to_file("Next update in 10 secs...\n")
        time.sleep(10)
