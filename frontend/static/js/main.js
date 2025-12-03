// === MULTI-ROLE LOGIN LOGIC ===
const roleSelection = document.getElementById("roleSelection");
const adminForm = document.getElementById("adminLoginForm");
const citizenForm = document.getElementById("citizenLoginForm");
const registerForm = document.getElementById("registerForm");
const otpForm = document.getElementById("otpForm");

const adminBtn = document.getElementById("adminBtn");
const citizenBtn = document.getElementById("citizenBtn");
const openRegister = document.getElementById("openRegister");
const backBtns = document.querySelectorAll(".backBtn");

let selectedRole = null;
let pendingUsername = null;

// === UI Navigation ===
adminBtn?.addEventListener("click", () => {
  roleSelection.style.display = "none";
  adminForm.style.display = "block";
  selectedRole = "corporation";
});

citizenBtn?.addEventListener("click", () => {
  roleSelection.style.display = "none";
  citizenForm.style.display = "block";
  selectedRole = "citizen";
});

openRegister?.addEventListener("click", () => {
  citizenForm.style.display = "none";
  registerForm.style.display = "block";
});

backBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    adminForm.style.display = "none";
    citizenForm.style.display = "none";
    registerForm.style.display = "none";
    otpForm.style.display = "none";
    roleSelection.style.display = "block";
  });
});

// === COMMON LOGIN FUNCTION ===
async function loginUser(username, password, role, msgBox) {
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });

    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);

      msgBox.textContent = "Login Successful!";
      msgBox.style.color = "green";

      const popup = document.getElementById("loginSuccess");
      popup?.classList.add("show");

      setTimeout(() => window.location.href = "/dashboard", 1300);
    } else {
      msgBox.textContent = data.msg;
      msgBox.style.color = "red";
    }
  } catch {
    msgBox.textContent = "Server Error!";
  }
}

// === Login ===
adminForm?.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(adminUsername.value, adminPassword.value, selectedRole, adminMessage);
});

citizenForm?.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(citizenUsername.value, citizenPassword.value, selectedRole, citizenMessage);
});

// === Registration ===
registerForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: regUsername.value,
      password: regPassword.value,
      phone: regPhone.value
    }),
  });

  const data = await res.json();
  if (res.ok) {
    pendingUsername = regUsername.value;
    alert("Demo OTP: " + data.demo_otp);
    registerForm.style.display = "none";
    otpForm.style.display = "block";
  } else {
    registerMessage.textContent = data.msg;
  }
});

// === OTP Verify ===
otpForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const res = await fetch("/verify_otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: pendingUsername, otp: otpInput.value }),
  });

  const data = await res.json();
  if (res.ok) {
    otpMessage.textContent = "OTP Verified! Login Now";
    setTimeout(() => {
      otpForm.style.display = "none";
      citizenForm.style.display = "block";
    }, 1200);
  } else otpMessage.textContent = data.msg;
});

// === ---- DASHBOARD LOGIC ---- ===
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

let previousAlertCount = 0;

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = "🔔 " + message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4000);
}

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/";
});

// Fetch Data
async function fetchData() {
  if (!token) return (window.location.href = "/");

  const roleTitle = document.getElementById("roleTitle");
  if (roleTitle && role) {
    roleTitle.textContent = `Logged in as: ${role.toUpperCase()}`;
  }

  const binsRes = await fetch("/get_bins");
  const binsData = await binsRes.json();

  if (role === "corporation") {
    populateBins(binsData.bins, "binsContainer", true);
    const alertsRes = await fetch("/get_alerts", {
      headers: { Authorization: "Bearer " + token }
    });
    const alertData = await alertsRes.json();
    populateAlerts(alertData.alerts);
  }

  if (role === "citizen") {
    populateBins(binsData.bins, "citizenBinsContainer", false);
  }

  updateMap(binsData.bins);
}

// Populate Bins
function populateBins(bins, containerId, showTime) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  bins.forEach(bin => {
    const div = document.createElement("div");
    div.classList.add("card");

    if (bin.fill_level >= 90) div.classList.add("bin-full");
    else if (bin.fill_level >= 70) div.classList.add("bin-warning");
    else div.classList.add("bin-safe");

    div.innerHTML = `
      <h4>${bin.bin_id}</h4>
      <p>${bin.waste_type}</p>
      <p>${bin.fill_level}%</p>
      ${showTime ? `<p>${new Date(bin.timestamp).toLocaleString()}</p>` : ""}
    `;
    container.appendChild(div);
  });
}

// Alerts (with Mark as Collected)
function populateAlerts(alerts) {
  const container = document.getElementById("alertsContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!alerts || !alerts.length) {
    container.innerHTML = "<p>No Alerts 🎉</p>";
    previousAlertCount = 0;
    return;
  }

  if (alerts.length > previousAlertCount) {
    showToast(`${alerts.length - previousAlertCount} new alert(s)`);
  }

  previousAlertCount = alerts.length;

  alerts.forEach(a => {
    const div = document.createElement("div");
    div.classList.add("card", "alert");

    const statusText = a.collected ? "✅ Collected" : "❌ Pending";
    const btnHTML = !a.collected
      ? `<br><button class="collectBtn" data-id="${a._id}">Mark as Collected</button>`
      : "";

    div.innerHTML = `
      <b>${a.message}</b><br>
      Type: ${a.waste_type} | Bin: ${a.bin_id}<br>
      Time: ${new Date(a.timestamp).toLocaleString()}<br>
      Status: ${statusText}
      ${btnHTML}
    `;
    container.appendChild(div);
  });

  // Enable "Mark as Collected" buttons
  const collectButtons = container.querySelectorAll(".collectBtn");
  collectButtons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!id) return;

      try {
        const res = await fetch(`/collect/${id}`, {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token
          }
        });

        if (res.ok) {
          showToast("🧹 Bin marked as collected!");
          fetchData();
        } else {
          showToast("❌ Failed to update!");
        }
      } catch {
        showToast("⚠️ Network error!");
      }
    });
  });
}

// === GOOGLE MAP INTEGRATION ===
let map;
function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    center: { lat: 13.06330, lng: 77.80150 },
    zoom: 17
  });
}

function updateMap(bins) {
  if (!map || !bins) return;

  bins.forEach(bin => {
    if (!bin.latitude || !bin.longitude) return;

    const fill = bin.fill_level;
    const color =
      fill < 70 ? "green" :
      fill < 90 ? "orange" :
      "red";

    new google.maps.Marker({
      position: { lat: bin.latitude, lng: bin.longitude },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        scale: 10,
        strokeWeight: 1,
      },
      title: `${bin.bin_id} ${fill}%`
    });
  });
}

// Load Map Script + start dashboard
if (window.location.pathname.includes("/dashboard")) {
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${window.MAPS_KEY}&callback=initMap`;
  s.async = true;
  s.defer = true;
  document.body.appendChild(s);

  fetchData();
  setInterval(fetchData, 10000);
}
