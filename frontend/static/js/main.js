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

      document.getElementById("alertSound")?.play().catch(() => {});
      document.getElementById("loginSuccess")?.classList.add("show");

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
  const sound = document.getElementById("alertSound");
  if (!toast) return;
  toast.textContent = "🔔 " + message;
  toast.classList.add("show");
  sound?.play().catch(() => {});
  setTimeout(() => toast.classList.remove("show"), 4000);
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/";
});

// === Fetch Dashboard Data ===
async function fetchData() {
  if (!token) return (window.location.href = "/");

  const roleTitle = document.getElementById("roleTitle");
  if (roleTitle) roleTitle.textContent = `Logged in as: ${role.toUpperCase()}`;

  const binsRes = await fetch("/get_bins");
  const binsData = await binsRes.json();

  if (role === "corporation") {
    populateBins(binsData.bins, "binsContainer", true, true);
    const alertsRes = await fetch("/get_alerts", {
      headers: { Authorization: "Bearer " + token }
    });
    const alertData = await alertsRes.json();
    populateAlerts(alertData.alerts);
  }

  if (role === "citizen") {
    populateBins(binsData.bins, "citizenBinsContainer", false, false);
  }

  updateMap(binsData.bins);
}

// === Populate Bins ===
function populateBins(bins, id, showTime, showWeight) {
  const container = document.getElementById(id);
  container.innerHTML = "";
  bins.forEach(bin => {
    const fill = bin.fill_level;
    const div = document.createElement("div");
    div.classList.add("card");
    if (fill >= 90) div.classList.add("bin-full");
    else if (fill >= 70) div.classList.add("bin-warning");
    else div.classList.add("bin-safe");

    div.innerHTML = `
      <h4>${bin.bin_id}</h4>
      <p>Type: ${bin.waste_type}</p>
      <p>Fill: ${fill}%</p>
      ${showWeight ? `<p>Weight: ${bin.weight} kg</p>` : ""}
      ${showTime ? `<p>${new Date(bin.timestamp).toLocaleString()}</p>` : ""}
    `;
    container.appendChild(div);
  });
}

// === Alerts (Mark as Collected) ===
function populateAlerts(alerts) {
  const container = document.getElementById("alertsContainer");
  container.innerHTML = "";

  if (!alerts?.length) {
    container.innerHTML = "<p>No Alerts 🎉</p>";
    previousAlertCount = 0;
    return;
  }

  if (alerts.length > previousAlertCount) {
    showToast(`${alerts.length - previousAlertCount} new alert(s)!`);
  }

  previousAlertCount = alerts.length;

  alerts.forEach(a => {
    const status = a.collected ? "✔ Collected" : "❌ Pending";
    const btn = !a.collected ? 
      `<button class="collectBtn" data-id="${a._id}">Mark as Collected</button>` 
      : "";

    const div = document.createElement("div");
    div.classList.add("card", "alert");
    div.innerHTML = `
      <strong>${a.message}</strong><br>
      Type: ${a.waste_type} | Bin: ${a.bin_id}<br>
      Time: ${new Date(a.timestamp).toLocaleString()}<br>
      Status: ${status}<br>${btn}
    `;
    container.appendChild(div);
  });

  document.querySelectorAll(".collectBtn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const id = e.target.dataset.id;
      const res = await fetch("/mark_collected", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ alert_id: id })
      });
      if (res.ok) showToast("🧹 Bin marked as collected!");
      fetchData();
    });
  });
}

// === GOOGLE MAP INTEGRATION ===
let map;
let markers = [];

function initMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  map = new google.maps.Map(mapEl, {
    center: { lat: 13.06330, lng: 77.80150 },
    zoom: 16,
  });

  fetchBins();
  setInterval(fetchBins, 5000); // auto refresh
}

async function fetchBins() {
  try {
    const res = await fetch("https://smart-waste-project.onrender.com/get_all_bins");
    const bins = await res.json();
    updateMap(bins);
  } catch (error) {
    console.error("Error fetching bins:", error);
  }
}

function updateMap(bins) {
  if (!map) return;

  // Remove old markers
  markers.forEach(m => m.setMap(null));
  markers = [];

  bins.forEach(bin => {
    if (!bin.latitude || !bin.longitude) return;

    const lat = parseFloat(bin.latitude);
    const lng = parseFloat(bin.longitude);

    if (isNaN(lat) || isNaN(lng)) return;

    const fill = bin.fill_level;
    const color = fill < 50 ? "green" : fill < 90 ? "orange" : "red";

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: `${bin.bin_id} - ${fill}% full`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 1,
        scale: 10,
      },
    });

    markers.push(marker);
  });
}


// === Scroll to Top Button ===
const scrollBtn = document.getElementById("scrollTopBtn");
let timeout;
function handleScroll() {
  if (scrollY > 250) {
    scrollBtn.classList.add("show");
    resetTimer();
  } else scrollBtn.classList.remove("show");
}
function resetTimer() {
  clearTimeout(timeout);
  timeout = setTimeout(() => scrollBtn.classList.remove("show"), 8000);
}
scrollBtn?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
document.addEventListener("scroll", handleScroll);
document.addEventListener("mousemove", () => { if (scrollY > 250) resetTimer(); });

// === Load Map When on Dashboard ===
if (location.pathname.includes("/dashboard")) {
  const s = document.createElement("script");
  s.src = `https://maps.googleapis.com/maps/api/js?key=${window.MAPS_KEY}&callback=initMap`;
  s.async = true;
  document.body.appendChild(s);

  fetchData();
  setInterval(fetchData, 10000);
}
