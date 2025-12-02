// ROLE SELECTION
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

// --- UI Navigation ---
adminBtn.addEventListener("click", () => {
  roleSelection.style.display = "none";
  adminForm.style.display = "block";
  selectedRole = "corporation";
});

citizenBtn.addEventListener("click", () => {
  roleSelection.style.display = "none";
  citizenForm.style.display = "block";
  selectedRole = "citizen";
});

openRegister.addEventListener("click", () => {
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

// === ADMIN LOGIN ===
adminForm.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(
    adminUsername.value,
    adminPassword.value,
    selectedRole,
    adminMessage
  );
});

// === CITIZEN LOGIN ===
citizenForm.addEventListener("submit", e => {
  e.preventDefault();
  loginUser(
    citizenUsername.value,
    citizenPassword.value,
    selectedRole,
    citizenMessage
  );
});

// === COMMON LOGIN FUNCTION ===
async function loginUser(username, password, role, msgBox) {
  const res = await fetch("/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username, password, role}),
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);

    msgBox.textContent = "Login Successful!";
    msgBox.style.color = "green";

    setTimeout(() => window.location.href = "/dashboard", 800);
  } else {
    msgBox.textContent = data.msg;
    msgBox.style.color = "red";
  }
}

// === REGISTRATION ===
registerForm.addEventListener("submit", async e => {
  e.preventDefault();

  const res = await fetch("/register", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      username: regUsername.value,
      password: regPassword.value,
      phone: regPhone.value
    }),
  });

  const data = await res.json();

  if (res.ok) {
    pendingUsername = regUsername.value;
    registerMessage.textContent = "OTP Sent! Check screen!";
    registerMessage.style.color = "green";

    alert("Your demo OTP: " + data.demo_otp);

    registerForm.style.display = "none";
    otpForm.style.display = "block";
  } else {
    registerMessage.textContent = data.msg;
    registerMessage.style.color = "red";
  }
});

// === OTP VERIFICATION ===
otpForm.addEventListener("submit", async e => {
  e.preventDefault();

  const res = await fetch("/verify_otp", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({username: pendingUsername, otp: otpInput.value})
  });

  const data = await res.json();

  if (res.ok) {
    otpMessage.textContent = "OTP Verified! Please Login!";
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

// === LOGOUT ===
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/";
  });
}
