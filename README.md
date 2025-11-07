# 🚮 Smart Waste Management System

[![Live Demo – Render](https://img.shields.io/badge/▶️%20Live%20Demo-Render-%2300C7B7?logo=render)](https://your-render-app-url.onrender.com)
![Built with Flask](https://img.shields.io/badge/Built%20with-Flask-blue?logo=flask)
![Database MongoDB Atlas](https://img.shields.io/badge/Database-MongoDB%20Atlas-green?logo=mongodb)
![License MIT](https://img.shields.io/badge/License-MIT-yellow.svg)


An intelligent waste management system that uses IoT and AI to monitor waste bins, trigger automatic alerts, and help municipal authorities manage waste efficiently.

---

## ⚙️ Tech Stack
**Backend:** Flask (Python)  
**Database:** MongoDB Atlas (Cloud)  
**Frontend:** HTML, CSS, JavaScript  
**Auth:** JWT (Role-based Login for Admin & Citizen)

---

## 🌟 Features
✅ Real-time bin monitoring  
✅ Automatic alert generation when bins are full  
✅ Role-based login (Admin / Citizen)  
✅ MongoDB Atlas cloud integration  
✅ Dashboard for admins to view bins and alerts  
✅ Secure JWT-based authentication  
✅ Deployable on Render (cloud platform)

---

## 🧩 Project Structure

smart_waste_project/
│
├── backend/
│ ├── app.py
│ ├── db.py
│ ├── logs.txt
│ └── ...
│
├── frontend/
│ ├── login.html
│ ├── login.css
│ ├── main.js
│ └── ...
│
├── requirements.txt
├── Procfile
├── .gitignore
└── README.md


---

## 🚀 How to Run Locally

1️⃣ **Clone the repository**
```bash
git clone https://github.com/<your-username>/smart_waste_project.git
cd smart_waste_project

2️⃣ Create a virtual environment
python -m venv venv
venv\Scripts\activate   # (on Windows)

3️⃣ Install dependencies
pip install -r requirements.txt

4️⃣ Run the Flask server
python backend/app.py

Then open http://127.0.0.1:5000/
 in your browser.

 ☁️ Deployment (Render)

You can deploy this project easily to Render.com:

1️⃣ Push this repo to GitHub
2️⃣ Create a new Render “Web Service”
3️⃣ Connect your GitHub repo
4️⃣ Set:

Build Command: pip install -r requirements.txt
Start Command: gunicorn backend.app:app

5️⃣ Add your environment variables (if any)
6️⃣ Click Deploy 🚀

👨‍💻 Default Login Credentials
Role	Username	Password
Admin	corp_admin	corp123
Citizen	citizen1	cit123

📬 Contact

If you’d like to collaborate or improve this project, feel free to fork and contribute!

🟢 Project by: Rohith Murali
💡 5th Semester CSE Mini Project — Smart Waste Management System


---

Would you like me to add the **fancy badges section** at the top like:  
`Built with Flask 🐍 | Deployed on Render ☁️ | Database: MongoDB Atlas 🍃`  
It looks great on GitHub pages.

