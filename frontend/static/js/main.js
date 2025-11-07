// === MULTI-ROLE LOGIN LOGIC ===
const roleSelection = document.getElementById("roleSelection");
const adminForm = document.getElementById("adminLoginForm");
const citizenForm = document.getElementById("citizenLoginForm");

const adminBtn = document.getElementById("adminBtn");
const citizenBtn = document.getElementById("citizenBtn");
const backBtns = document.querySelectorAll(".backBtn");

let selectedRole = null;

// === Role Selection Buttons ===
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

backBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    adminForm.style.display = "none";
    citizenForm.style.display = "none";
    roleSelection.style.display = "block";
  });
});

// === Admin Login ===
if (adminForm) {
  adminForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("adminUsername").value;
    const password = document.getElementById("adminPassword").value;
    const msg = document.getElementById("adminMessage");

    await handleLogin(username, password, selectedRole, msg);
  });
}

// === Citizen Login ===
if (citizenForm) {
  citizenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("citizenUsername").value;
    const password = document.getElementById("citizenPassword").value;
    const msg = document.getElementById("citizenMessage");

    await handleLogin(username, password, selectedRole, msg);
  });
}

// === Shared Login Handler ===
async function handleLogin(username, password, role, msg) {
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();

    if (res.ok) {
      // ✅ Store token and role
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("role", data.role);

      msg.textContent = "✅ Login successful!";
      msg.style.color = "green";

      // ✅ Show success popup animation
      const successPopup = document.getElementById("loginSuccess");
      if (successPopup) {
        successPopup.classList.add("show");
      }

      setTimeout(() => (window.location.href = "/dashboard"), 1500);
    } else {
      msg.textContent = data.msg || "❌ Login failed!";
      msg.style.color = "red";
    }
  } catch (err) {
    msg.textContent = "⚠️ Server error!";
    msg.style.color = "red";
  }
}

// === DASHBOARD LOGIC ===
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

// === NOTIFICATION HELPER ===
let previousAlertCount = 0;
function showToast(message) {
  const toast = document.getElementById("toast");
  const sound = document.getElementById("alertSound");
  if (!toast || !sound) return;

  toast.textContent = "🔔 " + message;
  toast.classList.add("show");
  sound.play().catch(() => {});
  setTimeout(() => toast.classList.remove("show"), 4000);
}

// === LOGOUT ===
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/";
  });
}

// === FETCH DASHBOARD DATA ===
async function fetchData() {
  console.log("🔄 Dashboard refreshed:", new Date().toLocaleTimeString());

  if (!token) {
    window.location.href = "/";
    return;
  }

  const roleTitle = document.getElementById("roleTitle");
  if (roleTitle) roleTitle.textContent = `Logged in as: ${role.toUpperCase()}`;

  const binSection = document.getElementById("binSection");
  const alertSection = document.getElementById("alertSection");
  const citizenSection = document.getElementById("citizenSection");

  // === Fetch Bin Data ===
  const binsRes = await fetch("/get_bins");
  const binsData = await binsRes.json();

  if (role === "corporation") {
    binSection.style.display = "block";
    alertSection.style.display = "block";
    citizenSection.style.display = "none";

    const binsContainer = document.getElementById("binsContainer");
    binsContainer.innerHTML = "";
    binsData.bins.forEach((bin) => {
      const card = document.createElement("div");
      card.classList.add("card");
      if (bin.fill_level >= 90) card.classList.add("bin-full");
      else if (bin.fill_level >= 70) card.classList.add("bin-warning");
      else card.classList.add("bin-safe");

      card.innerHTML = `
        <h4>${bin.bin_id}</h4>
        <p>Waste Type: ${bin.waste_type}</p>
        <p>Fill Level: ${bin.fill_level}%</p>
        <p>Weight: ${bin.weight} kg</p>
        <p>Last Updated: ${new Date(bin.timestamp).toLocaleString()}</p>
      `;
      binsContainer.appendChild(card);
    });

    // === Fetch Alerts ===
    const alertRes = await fetch("/get_alerts", {
      headers: { Authorization: "Bearer " + token },
    });
    const alertData = await alertRes.json();
    const alertsContainer = document.getElementById("alertsContainer");
    alertsContainer.innerHTML = "";

    if (alertData.alerts && alertData.alerts.length > 0) {
      if (alertData.alerts.length > previousAlertCount) {
        const newAlerts = alertData.alerts.length - previousAlertCount;
        showToast(`${newAlerts} new alert${newAlerts > 1 ? "s" : ""} received!`);
      }
      previousAlertCount = alertData.alerts.length;

      alertData.alerts.forEach((alert) => {
        const div = document.createElement("div");
        div.classList.add("card", "alert");
        const statusText = alert.collected ? "✅ Collected" : "❌ Pending";
        div.innerHTML = `
          <strong>${alert.message}</strong><br>
          Type: ${alert.waste_type} | Bin: ${alert.bin_id}<br>
          Time: ${new Date(alert.timestamp).toLocaleString()}<br>
          Status: ${statusText}
          ${
            !alert.collected
              ? `<br><button class="collectBtn" data-id="${alert._id}">Mark as Collected</button>`
              : ""
          }
        `;
        alertsContainer.appendChild(div);
      });

      document.querySelectorAll(".collectBtn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const alertId = e.target.getAttribute("data-id");
          await fetch("/mark_collected", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ alert_id: alertId }),
          });
          fetchData();
        });
      });
    } else {
      alertsContainer.innerHTML = "<p>No active alerts 🎉</p>";
      previousAlertCount = 0;
    }
  } else if (role === "citizen") {
    // === CITIZEN DASHBOARD ===
    binSection.style.display = "none";
    alertSection.style.display = "none";
    citizenSection.style.display = "block";

    const citizenContainer = document.getElementById("citizenBinsContainer");
    citizenContainer.innerHTML = "";
    binsData.bins.forEach((bin) => {
      const card = document.createElement("div");
      card.classList.add("card");
      if (bin.fill_level >= 90) card.classList.add("bin-full");
      else if (bin.fill_level >= 70) card.classList.add("bin-warning");
      else card.classList.add("bin-safe");

      card.innerHTML = `
        <h4>${bin.bin_id}</h4>
        <p>Waste Type: ${bin.waste_type}</p>
        <p>Fill Level: ${bin.fill_level}%</p>
      `;
      citizenContainer.appendChild(card);
    });
  }
}

// === Auto Refresh Dashboard Every 10 Seconds ===
if (window.location.pathname.includes("/dashboard")) {
  fetchData();
  setInterval(fetchData, 10000);
}

// === SCROLL TO TOP BUTTON ===
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
  hideTimeout = setTimeout(() => scrollBtn.classList.remove("show"), 10000);
}

document.addEventListener("mousemove", () => {
  if (window.scrollY > 250) {
    scrollBtn.classList.add("show");
    resetHideTimer();
  }
});

if (scrollBtn) {
  scrollBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}
