# app.py
from flask import Flask, request, jsonify, render_template
from datetime import datetime, timedelta
from bson import ObjectId
from functools import wraps
import bcrypt
import os
import random  # ➕ for OTP generation

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


# -----------------------------
# Helpers
# -----------------------------
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
    """
    Create one default corporation admin and one demo citizen
    (already marked as verified).
    """
    if users_collection.count_documents({}) == 0:
        users = [
            {
                "username": "corp_admin",
                "password": bcrypt.hashpw("corp123".encode(), bcrypt.gensalt()).decode(),
                "role": "corporation",
                "phone": None,
                "is_verified": True
            },
            {
                "username": "citizen1",
                "password": bcrypt.hashpw("cit123".encode(), bcrypt.gensalt()).decode(),
                "role": "citizen",
                "phone": None,
                "is_verified": True
            }
        ]
        users_collection.insert_many(users)


# -------- Ensure Default Admin Exists / Is Reset --------
def ensure_admin_exists():
    """
    Always ensure there is a corp_admin user with password 'corp123'.
    This uses the same bcrypt library as login(), so credentials will match.
    """
    admin_password_hash = bcrypt.hashpw("corp123".encode(), bcrypt.gensalt()).decode()

    users_collection.update_one(
        {"username": "corp_admin"},
        {
            "$set": {
                "username": "corp_admin",
                "password": admin_password_hash,
                "role": "corporation",
                "phone": None,
                "is_verified": True
            }
        },
        upsert=True
    )
    print("✔ corp_admin ensured/updated in database")


def generate_otp():
    """Generate a 6-digit OTP as a string."""
    return f"{random.randint(100000, 999999)}"


# -----------------------------
# Authentication & OTP
# -----------------------------
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

    # Role check
    if role_input is None or role_input.lower() != user["role"].lower():
        return jsonify({"msg": f"Role mismatch. This user is '{user['role']}'"}), 403

    # Citizen must be OTP-verified before login
    if user["role"] == "citizen" and not user.get("is_verified", False):
        return jsonify({
            "msg": "Phone/OTP not verified. Please complete OTP verification before logging in."
        }), 403

    token = create_access_token(identity=username, additional_claims={"role": user["role"]})
    return jsonify({"access_token": token, "role": user["role"]}), 200


@app.route("/register", methods=["POST"])
def register():
    """
    Citizen self-registration with mock OTP generation.
    Frontend will show OTP on screen (no real SMS).
    """
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    phone = data.get("phone")

    if not username or not password or not phone:
        return jsonify({"msg": "Username, password and phone are required"}), 400

    # Check uniqueness
    if users_collection.find_one({"username": username}):
        return jsonify({"msg": "Username already exists"}), 400
    if users_collection.find_one({"phone": phone}):
        return jsonify({"msg": "Phone number already registered"}), 400

    hashed_pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    otp = generate_otp()
    otp_expiry = datetime.utcnow() + timedelta(minutes=10)

    user_doc = {
        "username": username,
        "password": hashed_pw,
        "role": "citizen",
        "phone": phone,
        "is_verified": False,
        "otp_code": otp,
        "otp_expires_at": otp_expiry
    }
    users_collection.insert_one(user_doc)

    # For demo: return OTP in response instead of SMS
    return jsonify({
        "msg": "Citizen registered. Please verify the OTP to activate your account.",
        "demo_otp": otp  # ⚠️ DEMO ONLY – don't do this in production
    }), 201


@app.route("/verify_otp", methods=["POST"])
def verify_otp():
    """
    Verify OTP for a citizen.
    Expect: { "username": "...", "otp": "123456" }
    """
    data = request.get_json() or {}
    username = data.get("username")
    otp_input = data.get("otp")

    if not username or not otp_input:
        return jsonify({"msg": "Username and OTP are required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if user.get("role") != "citizen":
        return jsonify({"msg": "OTP verification only applies to citizen accounts"}), 400

    stored_otp = user.get("otp_code")
    expires_at = user.get("otp_expires_at")

    if not stored_otp or not expires_at:
        return jsonify({"msg": "No active OTP. Please register again."}), 400

    if datetime.utcnow() > expires_at:
        return jsonify({"msg": "OTP has expired. Please register again."}), 400

    if otp_input != stored_otp:
        return jsonify({"msg": "Invalid OTP"}), 400

    # Mark as verified
    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True},
            "$unset": {"otp_code": "", "otp_expires_at": ""}
        }
    )

    return jsonify({"msg": "OTP verified successfully. You can now log in."}), 200


# -----------------------------
# IoT Data & Alerts
# -----------------------------
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


# -----------------------------
# Frontend routes
# -----------------------------
@app.route("/")
def home():
    return render_template("login.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", google_maps_key=GOOGLE_MAPS_KEY)


if __name__ == "__main__":
    ensure_admin_exists()
    create_default_users()
    app.run(debug=True)
