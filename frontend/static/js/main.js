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

// UI Navigation
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
      if (popup) popup.classList.add("show");

      setTimeout(() => window.location.href = "/dashboard", 1300);
    } else {
      msgBox.textContent = data.msg;
      msgBox.style.color = "red";
    }
  } catch {
    msgBox.textContent = "Server Error!";
  }
}

// Admin Login
adminForm?.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(adminUsername.value, adminPassword.value, selectedRole, adminMessage);
});

// Citizen Login
citizenForm?.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(citizenUsername.value, citizenPassword.value, selectedRole, citizenMessage);
});

// === REGISTRATION ===
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
    registerMessage.textContent = "OTP Sent! Check popup!";
    registerMessage.style.color = "green";

    alert("Demo OTP: " + data.demo_otp);

    registerForm.style.display = "none";
    otpForm.style.display = "block";
  } else {
    registerMessage.textContent = data.msg;
    registerMessage.style.color = "red";
  }
});

// === OTP VERIFICATION ===
otpForm?.addEventListener("submit", async e => {
  e.preventDefault();

  const res = await fetch("/verify_otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: pendingUsername, otp: otpInput.value }),
  });

  const data = await res.json();

  if (res.ok) {
    otpMessage.textContent = "OTP Verified! Login now!";
    otpMessage.style.color = "green";
    setTimeout(() => {
      otpForm.style.display = "none";
      citizenForm.style.display = "block";
    }, 1200);
  } else {
    otpMessage.textContent = data.msg;
    otpMessage.style.color = "red";
  }
});

// === DASHBOARD LOGIC ===
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

let previousAlertCount = 0;

function showToast(message) {
  const toast = document.getElementById("toast");
  const sound = document.getElementById("alertSound");
  if (!toast) return;

  toast.textContent = "🔔 " + message;
  toast.classList.add("show");
  sound?.play();
  setTimeout(() => toast.classList.remove("show"), 4000);
}

// === Logout ===
const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/";
});

// === Fetch Dashboard Data ===
async function fetchData() {
  if (!token) return (window.location.href = "/");

  document.getElementById("roleTitle").textContent = `Logged in as: ${role.toUpperCase()}`;

  const binsData = await (await fetch("/get_bins")).json();

  const binSection = document.getElementById("binSection");
  const alertSection = document.getElementById("alertSection");
  const citizenSection = document.getElementById("citizenSection");

  if (role === "corporation") {
    binSection.style.display = "block";
    alertSection.style.display = "block";
    citizenSection.style.display = "none";

    populateBins(binsData.bins, "binsContainer", true);

    const alertData = await (await fetch("/get_alerts", {
      headers: { Authorization: "Bearer " + token }
    })).json();

    populateAlerts(alertData.alerts);
  }

  if (role === "citizen") {
    binSection.style.display = "none";
    alertSection.style.display = "none";
    citizenSection.style.display = "block";

    populateBins(binsData.bins, "citizenBinsContainer", false);
  }
}

function populateBins(bins, containerId, isAdmin) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  bins.forEach(bin => {
    const div = document.createElement("div");
    div.classList.add("card");

    if (bin.fill_level >= 90) div.classList.add("bin-full");
    else if (bin.fill_level >= 70) div.classList.add("bin-warning");
    else div.classList.add("bin-safe");

    div.innerHTML = `
      <h4>${bin.bin_id}</h4>
      <p>Waste: ${bin.waste_type}</p>
      <p>Fill Level: ${bin.fill_level}%</p>
      ${isAdmin ? `<p>Updated: ${new Date(bin.timestamp).toLocaleString()}</p>` : ""}
    `;
    container.appendChild(div);
  });
}

function populateAlerts(alerts) {
  const container = document.getElementById("alertsContainer");
  container.innerHTML = "";

  if (!alerts?.length) {
    container.innerHTML = "<p>No active alerts 🎉</p>";
    previousAlertCount = 0;
    return;
  }

  if (alerts.length > previousAlertCount) {
    showToast(`${alerts.length - previousAlertCount} new alert(s)!`);
  }
  previousAlertCount = alerts.length;

  alerts.forEach(alert => {
    const div = document.createElement("div");
    div.classList.add("card", "alert");

    div.innerHTML = `
      <strong>${alert.message}</strong><br>
      ${alert.waste_type} | Bin ${alert.bin_id}<br>
      ${new Date(alert.timestamp).toLocaleString()}<br>
      Status: ${alert.collected ? "✔ Collected" : "❌ Pending"}
    `;

    container.appendChild(div);
  });
}

// Auto Refresh Dashboard
if (window.location.pathname.includes("/dashboard")) {
  fetchData();
  setInterval(fetchData, 10000);
}

// Scroll Top Button
const scrollBtn = document.getElementById("scrollTopBtn");
let hideTimeout;

window.addEventListener("scroll", () => {
  if (window.scrollY > 250) {
    scrollBtn.classList.add("show");
    resetHideTimer();
  } else scrollBtn.classList.remove("show");
});

function resetHideTimer() {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => scrollBtn.classList.remove("show"), 8500);
}

scrollBtn?.addEventListener("click", () =>
  window.scrollTo({ top: 0, behavior: "smooth" })
);
