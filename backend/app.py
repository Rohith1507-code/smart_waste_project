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

# ---------------------------------
# Flask App Config (Frontend linked)
# ---------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(BASE_DIR), "frontend", "templates"),
    static_folder=os.path.join(os.path.dirname(BASE_DIR), "frontend", "static")
)

app.config["JWT_SECRET_KEY"] = "super-secret-change-this"  # change this for deployment
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

jwt = JWTManager(app)

# ✅ Load Google Maps API Key securely from Render environment
GOOGLE_MAPS_KEY = os.getenv("GOOGLE_MAPS_KEY")

# ---------------------------
# Utility: convert MongoDB data
# ---------------------------
def convert_mongo_obj(data):
    if isinstance(data, list):
        return [convert_mongo_obj(item) for item in data]
    if isinstance(data, dict):
        return {k: convert_mongo_obj(v) for k, v in data.items()}
    if isinstance(data, ObjectId):
        return str(data)
    if hasattr(data, "isoformat"):
        return data.isoformat()
    return data

# ---------------------------
# Role decorator
# ---------------------------
def roles_required(allowed_roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            role = claims.get("role")
            if role not in allowed_roles:
                return jsonify({"msg": "Access forbidden: insufficient role"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

# ---------------------------
# Create default users
# ---------------------------
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
        print("✅ Default users created:")
        print(" - Corporation: corp_admin / corp123")
        print(" - Citizen: citizen1 / cit123")

# ---------------------------
# Authentication endpoints
# ---------------------------
@app.route("/login", methods=["POST"])
def login():
    """
    Login with username, password, and role verification.
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    role_input = data.get("role")  # role sent from frontend

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"msg": "Invalid credentials"}), 401

    stored_pw = user["password"].encode()
    if not bcrypt.checkpw(password.encode(), stored_pw):
        return jsonify({"msg": "Invalid credentials"}), 401

    # ✅ Enforce role-based login
    if role_input and role_input.lower() != user["role"].lower():
        return jsonify({
            "msg": f"Access denied: You tried to log in as '{role_input}', "
                   f"but this account is registered as '{user['role']}'."
        }), 403

    token = create_access_token(identity=username, additional_claims={"role": user["role"]})
    return jsonify({"access_token": token, "role": user["role"]}), 200

@app.route("/register", methods=["POST"])
def register():
    """
    Register a new user (optional)
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "citizen")

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400
    if users_collection.find_one({"username": username}):
        return jsonify({"msg": "Username already exists"}), 400

    hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    users_collection.insert_one({"username": username, "password": hashed_pw, "role": role})
    return jsonify({"msg": "User created", "username": username, "role": role}), 201

# ---------------------------
# Add bin data (IoT Simulation)
# ---------------------------
@app.route("/add_data", methods=["POST"])
def add_data():
    data = request.get_json()
    data["timestamp"] = datetime.utcnow()
    bins_collection.insert_one(data)

    # If bin is full -> alert + notification
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

        # Assign receiver (based on waste type)
        if alert["waste_type"] == "biodegradable":
            receiver = "Composting Facility"
        elif alert["waste_type"] == "non-biodegradable":
            receiver = "Recycling Facility"
        else:
            receiver = "Medical Waste Treatment"

        notification = {
            "bin_id": alert["bin_id"],
            "receiver": receiver,
            "message": f"📩 Notification sent to {receiver} for {alert['waste_type']} waste bin {alert['bin_id']}.",
            "timestamp": datetime.utcnow()
        }
        notifications_collection.insert_one(notification)

        return jsonify({
            "status": "success",
            "alert": convert_mongo_obj(alert),
            "notification": convert_mongo_obj(notification)
        }), 200

    return jsonify({"status": "success", "data": convert_mongo_obj(data)}), 200

# ---------------------------
# View alerts (Role-based)
# ---------------------------
@app.route("/get_alerts", methods=["GET"])
@jwt_required(optional=True)
def get_alerts():
    try:
        claims = get_jwt()
        role = claims.get("role")
    except Exception:
        role = None

    if role == "corporation":
        alerts = list(alerts_collection.find())
    elif role == "citizen":
        return jsonify({"msg": "Citizens cannot access alerts"}), 403
    else:
        return jsonify({"msg": "Authentication required"}), 401

    return jsonify({"status": "success", "alerts": convert_mongo_obj(alerts)}), 200

# ---------------------------
# Get bins (Public)
# ---------------------------
@app.route("/get_bins", methods=["GET"])
def get_bins():
    bins = list(bins_collection.find())
    return jsonify({"status": "success", "bins": convert_mongo_obj(bins)}), 200

# ---------------------------
# Mark bin alert as collected
# ---------------------------
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

    return jsonify({"msg": "Alert marked as collected", "record": convert_mongo_obj(record)}), 200

# ---------------------------
# View notifications (Role-based)
# ---------------------------
@app.route("/get_notifications", methods=["GET"])
@jwt_required(optional=True)
def get_notifications():
    try:
        claims = get_jwt()
        role = claims.get("role")
    except Exception:
        role = None

    if role == "corporation":
        notes = list(notifications_collection.find())
    elif role == "citizen":
        return jsonify({"msg": "Citizens cannot view notifications"}), 403
    else:
        return jsonify({"msg": "Authentication required"}), 401

    return jsonify({"status": "success", "notifications": convert_mongo_obj(notes)}), 200

# ---------------------------
# FRONTEND ROUTES
# ---------------------------
@app.route("/")
def home():
    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", google_maps_key=GOOGLE_MAPS_KEY)

@app.route("/alerts")
def alerts_page():
    return render_template("alerts.html")

# ---------------------------
# App startup
# ---------------------------
if __name__ == "__main__":
    create_default_users()
    app.run(debug=True)
