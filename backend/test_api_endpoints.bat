@echo off
echo ===============================
echo SMART WASTE MANAGEMENT - API TEST
echo ===============================
echo.

:: 1️⃣ Login as Corporation
echo 🔐 Logging in as Corporation...
for /f "tokens=2 delims=:," %%A in ('curl -s -X POST http://127.0.0.1:5000/login -H "Content-Type: application/json" -d "{\"username\":\"corp_admin\",\"password\":\"corp123\"}" ^| findstr access_token') do set TOKEN=%%~A
set TOKEN=%TOKEN:"=%
echo ✅ Token fetched: %TOKEN%
echo.

:: 2️⃣ Get all alerts
echo 📢 Fetching Alerts (Corporation)...
curl -s -X GET http://127.0.0.1:5000/get_alerts -H "Authorization: Bearer %TOKEN%"
echo.
echo --------------------------------------

:: 3️⃣ Get bins (Corporation)
echo 🗑️ Fetching Bins (Corporation view)...
curl -s -X GET http://127.0.0.1:5000/get_bins -H "Authorization: Bearer %TOKEN%"
echo.
echo --------------------------------------

:: 4️⃣ Login as Citizen
echo 👤 Logging in as Citizen...
for /f "tokens=2 delims=:," %%A in ('curl -s -X POST http://127.0.0.1:5000/login -H "Content-Type: application/json" -d "{\"username\":\"citizen1\",\"password\":\"cit123\"}" ^| findstr access_token') do set CIT_TOKEN=%%~A
set CIT_TOKEN=%CIT_TOKEN:"=%
echo ✅ Citizen Token fetched: %CIT_TOKEN%
echo.

:: 5️⃣ Get bins (Citizen)
echo 🗺️ Fetching Bins (Citizen view)...
curl -s -X GET http://127.0.0.1:5000/get_bins -H "Authorization: Bearer %CIT_TOKEN%"
echo.
echo --------------------------------------

:: 6️⃣ Try to access Alerts (Citizen)
echo 🚫 Trying to fetch Alerts as Citizen (should be blocked)...
curl -s -X GET http://127.0.0.1:5000/get_alerts -H "Authorization: Bearer %CIT_TOKEN%"
echo.
echo --------------------------------------

echo ✅ TEST SEQUENCE COMPLETED
pause
