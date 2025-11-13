# app.py
from flask import Flask, request, jsonify, render_template
from datetime import datetime, timedelta
from bson import ObjectId
from functools import wraps
import bcrypt
import os

from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required,
    get_jwt_identity, get_jwt
)

from backend.db import (
    bins_collection,
    alerts_collection,
    notifications_collection,
    users_collection,
    collected_records
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(BASE_DIR), "frontend", "templates"),
    static_folder=os.path.join(os.path.dirname(BASE_DIR), "frontend", "static")
)

app.config["JWT_SECRET_KEY"] = "super-secret-change-this"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

jwt = JWTManager(app)

# Secure — key loaded from Render env
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY")


def convert_mongo_obj(data):
    if isinstance(data, list):
        return [convert_mongo_obj(i) for i in data]
    if isinstance(data, dict):
        return {k: convert_mongo_obj(v) for k, v in data.items()}
    if isinstance(data, ObjectId):
        return str(data)
    if hasattr(data, "isoformat"):
        return data.isoformat()
    return data


def roles_required(allowed):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            if get_jwt().get("role") not in allowed:
                return jsonify({"msg": "Access forbidden"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def create_default_users():
    if users_collection.count_documents({}) == 0:
        users = [
            {
                "username": "corp_admin",
                "password": bcrypt.hashpw("corp123".encode(), bcrypt.gensalt()).decode(),
                "role": "corporation"
            },
            {
                "username": "citizen1",
                "password": bcrypt.hashpw("cit123".encode(), bcrypt.gensalt()).decode(),
                "role": "citizen"
            }
        ]
        users_collection.insert_many(users)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    role_input = data.get("role")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"msg": "Invalid credentials"}), 401

    if not bcrypt.checkpw(password.encode(), user["password"].encode()):
        return jsonify({"msg": "Invalid credentials"}), 401

    if role_input.lower() != user["role"].lower():
        return jsonify({"msg": f"Role mismatch. This user is '{user['role']}'"}), 403

    token = create_access_token(identity=username, additional_claims={"role": user["role"]})
    return jsonify({"access_token": token, "role": user["role"]})


@app.route("/add_data", methods=["POST"])
def add_data():
    data = request.get_json()
    data["timestamp"] = datetime.utcnow()
    bins_collection.insert_one(data)

    if data.get("fill_level", 0) >= 80:
        alert = {
            "bin_id": data["bin_id"],
            "waste_type": data["waste_type"],
            "message": f"Bin {data['bin_id']} is full! Bin contains {data['waste_type']} waste.",
            "timestamp": datetime.utcnow(),
            "collected": False
        }
        res = alerts_collection.insert_one(alert)
        alert["_id"] = res.inserted_id

        if alert["waste_type"] == "biodegradable":
            receiver = "Composting Facility"
        elif alert["waste_type"] == "non-biodegradable":
            receiver = "Recycling Facility"
        else:
            receiver = "Medical Waste Treatment"

        notification = {
            "bin_id": alert["bin_id"],
            "receiver": receiver,
            "message": f"📩 Sent to {receiver} for {alert['waste_type']} bin {alert['bin_id']}.",
            "timestamp": datetime.utcnow()
        }
        notifications_collection.insert_one(notification)

        return jsonify({
            "status": "success",
            "alert": convert_mongo_obj(alert),
            "notification": convert_mongo_obj(notification)
        })

    return jsonify({"status": "success", "data": convert_mongo_obj(data)})


@app.route("/get_alerts")
@jwt_required(optional=True)
def get_alerts():
    role = (get_jwt() or {}).get("role")
    if role != "corporation":
        return jsonify({"msg": "Forbidden"}), 403
    alerts = list(alerts_collection.find())
    return jsonify({"status": "success", "alerts": convert_mongo_obj(alerts)})


@app.route("/get_bins")
def get_bins():
    bins = list(bins_collection.find())
    return jsonify({"status": "success", "bins": convert_mongo_obj(bins)})


@app.route("/collect/<alert_id>", methods=["POST"])
@roles_required(["corporation"])
def collect_alert(alert_id):
    alert = alerts_collection.find_one({"_id": ObjectId(alert_id)})
    if not alert:
        return jsonify({"msg": "Alert not found"}), 404

    username = get_jwt_identity()
    update = {
        "collected": True,
        "collected_by": username,
        "collected_at": datetime.utcnow()
    }
    alerts_collection.update_one({"_id": alert["_id"]}, {"$set": update})

    record = {
        "alert_id": str(alert["_id"]),
        "bin_id": alert["bin_id"],
        "waste_type": alert["waste_type"],
        "collected_by": username,
        "role": "corporation",
        "collected_at": update["collected_at"]
    }
    collected_records.insert_one(record)

    return jsonify({"msg": "Collected", "record": convert_mongo_obj(record)})


@app.route("/get_notifications")
@jwt_required(optional=True)
def get_notifications():
    if (get_jwt() or {}).get("role") != "corporation":
        return jsonify({"msg": "Forbidden"}), 403
    notes = list(notifications_collection.find())
    return jsonify({"status": "success", "notifications": convert_mongo_obj(notes)})


@app.route("/")
def home():
    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", google_maps_key=GOOGLE_MAPS_KEY)


if __name__ == "__main__":
    create_default_users()
    app.run(debug=True)
