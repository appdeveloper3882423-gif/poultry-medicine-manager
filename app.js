import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCkyj91dIxfyFq3ErGucMykxB6h0trplM",
  authDomain: "poultry-medicine-manager-93b79.firebaseapp.com",
  projectId: "poultry-medicine-manager-93b79",
  storageBucket: "poultry-medicine-manager-93b79.firebasestorage.app",
  messagingSenderId: "623127969077",
  appId: "1:623127969077:web:e7e4b8a2e25fc4e249607c"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});


/* =========================================================
   PERSISTENT LOGIN
========================================================= */

setPersistence(auth, browserLocalPersistence)
  .catch(error => {
    console.error("Persistence error:", error);
  });


/* =========================================================
   STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let inventory = [];
let sales = [];

let inventoryUnsubscribe = null;
let salesUnsubscribe = null;
let profileUnsubscribe = null;

let currentSaleForPrint = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = id => document.getElementById(id);

function money(value) {
  const n = Number(value || 0);
  return "Rs. " + n.toLocaleString("en-PK", {
    maximumFractionDigits: 2
  });
}

function todayString() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromTimestamp(timestamp) {
  if (!timestamp) return "-";

  const d = new Date(Number(timestamp));

  return d.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function dateTimeFromTimestamp(timestamp) {
  if (!timestamp) return "-";

  const d = new Date(Number(timestamp));

  return d.toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function escapeHTML(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitial(name) {

  const text = String(name || "U").trim();

  return text
    ? text.charAt(0).toUpperCase()
    : "U";
}

function showToast(message, type = "success") {

  const container = $("toastContainer");

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function setButtonLoading(button, loading, text) {

  if (!button) return;

  if (loading) {

    button.classList.add("loading");
    button.disabled = true;

  } else {

    button.classList.remove("loading");
    button.disabled = false;
  }

  if (text) {

    const textElement = button.querySelector(".btn-text");

    if (textElement) {
      textElement.textContent = text;
    }
  }
}

function authErrorMessage(error) {

  const code = error?.code || "";

  const messages = {

    "auth/invalid-email":
      "Email address is not valid.",

    "auth/user-not-found":
      "No account exists with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password should contain at least 6 characters.",

    "auth/popup-closed-by-user":
      "Google login was cancelled.",

    "auth/popup-blocked":
      "Google popup was blocked by the browser.",

    "auth/unauthorized-domain":
      "This website domain is not authorized in Firebase.",

    "auth/account-exists-with-different-credential":
      "This email already uses another login method."

  };

  return messages[code] || error?.message || "Something went wrong.";
}


/* =========================================================
   AUTH UI
========================================================= */

function showAuthMessage(message, type = "error") {

  const box = $("authMessage");

  box.textContent = message;

  box.style.color =
    type === "success"
      ? "var(--success)"
      : "var(--danger)";
}

function clearAuthMessage() {
  $("authMessage").textContent = "";
}

$("showRegisterBtn").addEventListener("click", () => {

  $("loginBox").classList.add("hidden");
  $("registerBox").classList.remove("hidden");

  clearAuthMessage();
});

$("showLoginBtn").addEventListener("click", () => {

  $("registerBox").classList.add("hidden");
  $("loginBox").classList.remove("hidden");

  clearAuthMessage();
});


/* =========================================================
   PASSWORD SHOW/HIDE
========================================================= */

document.querySelectorAll(".password-toggle").forEach(button => {

  button.addEventListener("click", () => {

    const input = $(button.dataset.target);

    if (input.type === "password") {

      input.type = "text";
      button.textContent = "Hide";

    } else {

      input.type = "password";
      button.textContent = "Show";
    }
  });

});


/* =========================================================
   EMAIL LOGIN
========================================================= */

$("loginForm").addEventListener("submit", async event => {

  event.preventDefault();

  const button = $("loginBtn");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  if (!email || !password) {
    showAuthMessage("Please enter email and password.");
    return;
  }

  setButtonLoading(button, true);

  const text = button.querySelector(".btn-text");

  if (text) {
    text.textContent = "Logging in...";
  }

  clearAuthMessage();

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showAuthMessage(
      "Login successful. Opening your dashboard...",
      "success"
    );

  } catch (error) {

    console.error(error);

    showAuthMessage(
      authErrorMessage(error),
      "error"
    );

    setButtonLoading(button, false);
  }

});


/* =========================================================
   CREATE ACCOUNT
========================================================= */

$("registerForm").addEventListener("submit", async event => {

  event.preventDefault();

  const button = $("registerBtn");

  const name = $("registerName").value.trim();
  const business = $("registerBusiness").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  if (password.length < 6) {

    showAuthMessage(
      "Password must contain at least 6 characters."
    );

    return;
  }

  setButtonLoading(button, true);

  const text = button.querySelector(".btn-text");

  if (text) {
    text.textContent = "Creating account...";
  }

  clearAuthMessage();

  try {

    const result =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = result.user;

    await updateProfile(user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", user.uid),
      {
        name,
        businessName: business,
        email,
        photoURL: user.photoURL || "",
        provider: "email",
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        merge: true
      }
    );

    showAuthMessage(
      "Account created successfully. Opening dashboard...",
      "success"
    );

  } catch (error) {

    console.error(error);

    showAuthMessage(
      authErrorMessage(error),
      "error"
    );

    setButtonLoading(button, false);
  }

});


/* =========================================================
   GOOGLE LOGIN
========================================================= */

async function loginWithGoogle(button) {

  setButtonLoading(button, true);

  const text = button.querySelector(".google-btn-text");

  if (text) {
    text.textContent = "Connecting to Google...";
  }

  clearAuthMessage();

  try {

    const result =
      await signInWithPopup(
        auth,
        googleProvider
      );

    const user = result.user;

    const userRef =
      doc(db, "users", user.uid);

    const profileSnapshot =
      await getDoc(userRef);

    if (!profileSnapshot.exists()) {

      await setDoc(
        userRef,
        {
          name: user.displayName || "Google User",
          businessName: "Poultry Medicine Business",
          email: user.email || "",
          photoURL: user.photoURL || "",
          provider: "google",
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      );

    } else {

      await updateDoc(
        userRef,
        {
          name:
            user.displayName ||
            profileSnapshot.data().name ||
            "User",

          email: user.email || "",

          photoURL: user.photoURL || "",

          provider: "google",

          updatedAt: Date.now()
        }
      );
    }

    showAuthMessage(
      "Google login successful. Opening dashboard...",
      "success"
    );

  } catch (error) {

    console.error(error);

    showAuthMessage(
      authErrorMessage(error),
      "error"
    );

    setButtonLoading(button, false);

    const text = button.querySelector(".google-btn-text");

    if (text) {
      text.textContent = "Continue with Google";
    }
  }
}

$("googleLoginBtn").addEventListener(
  "click",
  () => loginWithGoogle($("googleLoginBtn"))
);

$("googleRegisterBtn").addEventListener(
  "click",
  () => loginWithGoogle($("googleRegisterBtn"))
);


/* =========================================================
   AUTH STATE
========================================================= */

onAuthStateChanged(auth, async user => {

  if (user) {

    currentUser = user;

    await startApplication(user);

  } else {

    stopListeners();

    currentUser = null;
    currentProfile = null;
    inventory = [];
    sales = [];

    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
  }

});


/* =========================================================
   START APP
========================================================= */

async function startApplication(user) {

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  try {

    await ensureProfile(user);

    updateUserUI();

    subscribeToProfile();
    subscribeToInventory();
    subscribeToSales();

  } catch (error) {

    console.error(error);

    showToast(
      "Unable to load your account data.",
      "error"
    );
  }
}


/* =========================================================
   PROFILE
========================================================= */

async function ensureProfile(user) {

  const userRef =
    doc(db, "users", user.uid);

  const snapshot =
    await getDoc(userRef);

  if (!snapshot.exists()) {

    await setDoc(
      userRef,
      {
        name:
          user.displayName ||
          "User",

        businessName:
          "Poultry Medicine Business",

        email:
          user.email || "",

        photoURL:
          user.photoURL || "",

        provider:
          user.providerData?.[0]?.providerId ===
          "google.com"
            ? "google"
            : "email",

        createdAt:
          Date.now(),

        updatedAt:
          Date.now()
      }
    );
  }
}

function subscribeToProfile() {

  if (!currentUser) return;

  if (profileUnsubscribe) {
    profileUnsubscribe();
  }

  profileUnsubscribe = onSnapshot(
    doc(db, "users", currentUser.uid),
    snapshot => {

      if (snapshot.exists()) {

        currentProfile =
          snapshot.data();

        updateUserUI();
      }
    }
  );
}

function updateUserUI() {

  if (!currentUser) return;

  const name =
    currentProfile?.name ||
    currentUser.displayName ||
    "User";

  const email =
    currentUser.email ||
    currentProfile?.email ||
    "";

  const initial =
    getInitial(name);

  $("topUserName").textContent = name;
  $("sidebarUserName").textContent = name;

  $("sidebarUserEmail").textContent = email;

  $("menuUserName").textContent = name;
  $("menuUserEmail").textContent = email;

  $("topAvatar").textContent = initial;
  $("sidebarAvatar").textContent = initial;
  $("menuAvatar").textContent = initial;

  $("profileName").value = name;

  $("profileBusiness").value =
    currentProfile?.businessName ||
    "";

  $("profileEmail").value =
    email;

  $("accountUid").textContent =
    currentUser.uid;

  $("accountProvider").textContent =
    currentProfile?.provider === "google"
      ? "Google"
      : "Email / Password";
}


/* =========================================================
   PROFILE SAVE
========================================================= */

$("profileForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) return;

    const button = $("saveProfileBtn");

    setButtonLoading(button, true);

    const text = button.querySelector(".btn-text");

    if (text) {
      text.textContent = "Saving...";
    }

    try {

      const name =
        $("profileName").value.trim();

      const businessName =
        $("profileBusiness").value.trim();

      await setDoc(
        doc(db, "users", currentUser.uid),
        {
          name,
          businessName,
          email: currentUser.email || "",
          updatedAt: Date.now()
        },
        {
          merge: true
        }
      );

      await updateProfile(
        currentUser,
        {
          displayName: name
        }
      );

      showToast(
        "Profile saved successfully."
      );

    } catch (error) {

      console.error(error);

      showToast(
        "Unable to save profile.",
        "error"
      );

    } finally {

      setButtonLoading(
        button,
        false,
        "Save Profile"
      );
    }
  }
);


/* =========================================================
   FIRESTORE LISTENERS
========================================================= */

function subscribeToInventory() {

  if (!currentUser) return;

  if (inventoryUnsubscribe) {
    inventoryUnsubscribe();
  }

  const ref =
    collection(
      db,
      "users",
      currentUser.uid,
      "inventory"
    );

  inventoryUnsubscribe =
    onSnapshot(
      ref,
      snapshot => {

        inventory =
          snapshot.docs.map(
            item => ({
              id: item.id,
              ...item.data()
            })
          );

        inventory.sort(
          (a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
        );

        renderEverything();
      },
      error => {

        console.error(error);

        showToast(
          "Inventory sync error.",
          "error"
        );
      }
    );
}

function subscribeToSales() {

  if (!currentUser) return;

  if (salesUnsubscribe) {
    salesUnsubscribe();
  }

  const ref =
    collection(
      db,
      "users",
      currentUser.uid,
      "sales"
    );

  salesUnsubscribe =
    onSnapshot(
      ref,
      snapshot => {

        sales =
          snapshot.docs.map(
            item => ({
              id: item.id,
              ...item.data()
            })
          );

        sales.sort(
          (a, b) =>
            Number(b.soldAt || 0) -
            Number(a.soldAt || 0)
        );

        renderEverything();
      },
      error => {

        console.error(error);

        showToast(
          "Sales sync error.",
          "error"
        );
      }
    );
}


/* =========================================================
   STOP LISTENERS
========================================================= */

function stopListeners() {

  if (inventoryUnsubscribe) {
    inventoryUnsubscribe();
    inventoryUnsubscribe = null;
  }

  if (salesUnsubscribe) {
    salesUnsubscribe();
    salesUnsubscribe = null;
  }

  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }
}


/* =========================================================
   NAVIGATION
========================================================= */

const pageTitles = {

  dashboard: [
    "Dashboard",
    "Business overview"
  ],

  inventory: [
    "Inventory",
    "Manage medicine stock"
  ],

  sale: [
    "New Sale",
    "Record sale and delivery"
  ],

  history: [
    "Sales History",
    "Complete transaction history"
  ],

  customers: [
    "Customers",
    "Customer purchase records"
  ],

  deliveries: [
    "Deliveries",
    "Salesman delivery tracking"
  ],

  reports: [
    "Reports",
    "Business performance"
  ],

  settings: [
    "Settings",
    "Account settings"
  ]
};

function navigate(page) {

  document
    .querySelectorAll(".page")
    .forEach(section => {

      section.classList.remove(
        "active-page"
      );
    });

  const target =
    $(`page-${page}`);

  if (target) {
    target.classList.add(
      "active-page"
    );
  }

  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

  $("pageTitle").textContent =
    pageTitles[page]?.[0] ||
    "Dashboard";

  $("pageSubtitle").textContent =
    pageTitles[page]?.[1] ||
    "";

  $("profileMenu").classList.add(
    "hidden"
  );

  $("sidebar").classList.remove(
    "open"
  );

  if (page === "sale") {
    prepareSaleForm();
  }

  if (page === "reports") {
    renderReports();
  }
}

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        navigate(
          button.dataset.page
        );
      }
    );
  });


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

$("mobileMenuBtn").addEventListener(
  "click",
  () => {

    $("sidebar").classList.toggle(
      "open"
    );
  }
);


/* =========================================================
   PROFILE MENU
========================================================= */

$("profileBtn").addEventListener(
  "click",
  event => {

    event.stopPropagation();

    $("profileMenu").classList.toggle(
      "hidden"
    );
  }
);

document.addEventListener(
  "click",
  event => {

    if (
      !event.target.closest(
        ".profile-wrap"
      )
    ) {

      $("profileMenu").classList.add(
        "hidden"
      );
    }
  }
);


/* =========================================================
   LOGOUT
========================================================= */

async function logoutUser() {

  const confirmed =
    confirm(
      "Are you sure you want to logout?"
    );

  if (!confirmed) return;

  try {

    await signOut(auth);

    showToast(
      "Logged out successfully."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Logout failed.",
      "error"
    );
  }
}

$("sidebarLogoutBtn").addEventListener(
  "click",
  logoutUser
);

$("menuLogoutBtn").addEventListener(
  "click",
  logoutUser
);

$("settingsLogoutBtn").addEventListener(
  "click",
  logoutUser
);


/* =========================================================
   THEME
========================================================= */

const savedTheme =
  localStorage.getItem(
    "poultryTheme"
  );

if (savedTheme === "dark") {

  document.body.classList.add(
    "dark"
  );

  $("themeBtn").textContent = "☀️";
}

$("themeBtn").addEventListener(
  "click",
  () => {

    document.body.classList.toggle(
      "dark"
    );

    const dark =
      document.body.classList.contains(
        "dark"
      );

    localStorage.setItem(
      "poultryTheme",
      dark ? "dark" : "light"
    );

    $("themeBtn").textContent =
      dark ? "☀️" : "🌙";
  }
);


/* =========================================================
   INVENTORY STATUS
========================================================= */

function expiryInfo(expiryDate) {

  if (!expiryDate) {

    return {
      type: "none",
      label: "No expiry"
    };
  }

  const today =
    new Date(
      todayString() + "T00:00:00"
    );

  const expiry =
    new Date(
      expiryDate + "T00:00:00"
    );

  const difference =
    Math.ceil(
      (
        expiry - today
      ) /
      (1000 * 60 * 60 * 24)
    );

  if (difference < 0) {

    return {
      type: "expired",
      label: `Expired ${Math.abs(difference)} days ago`
    };
  }

  if (difference <= 7) {

    return {
      type: "expiring",
      label: `Expires in ${difference} days`
    };
  }

  if (difference <= 30) {

    return {
      type: "soon",
      label: `Expires in ${difference} days`
    };
  }

  return {
    type: "good",
    label: `Expires ${expiryDate}`
  };
}

function stockStatus(item) {

  const qty =
    Number(item.quantity || 0);

  const threshold =
    Number(
      item.lowStockThreshold || 0
    );

  if (qty <= 0) {

    return {
      type: "expired",
      label: "Out of Stock"
    };
  }

  if (threshold > 0 && qty <= threshold) {

    return {
      type: "expiring",
      label: "Low Stock"
    };
  }

  return {
    type: "good",
    label: "Available"
  };
}


/* =========================================================
   DASHBOARD
========================================================= */

function calculateProfitTotals() {

  let totalSales = 0;
  let totalProfit = 0;

  let todayProfit = 0;
  let monthProfit = 0;
  let yearProfit = 0;

  const now = new Date();

  const today =
    now.toISOString().slice(0, 10);

  const month =
    `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

  const year =
    String(now.getFullYear());

  sales.forEach(sale => {

    const saleValue =
      Number(sale.totalSale || 0);

    const profit =
      Number(sale.profit || 0);

    totalSales += saleValue;
    totalProfit += profit;

    const date =
      new Date(
        Number(sale.soldAt || 0)
      );

    const dateString =
      date.toISOString().slice(0, 10);

    const saleMonth =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

    const saleYear =
      String(date.getFullYear());

    if (dateString === today) {
      todayProfit += profit;
    }

    if (saleMonth === month) {
      monthProfit += profit;
    }

    if (saleYear === year) {
      yearProfit += profit;
    }
  });

  return {
    totalSales,
    totalProfit,
    todayProfit,
    monthProfit,
    yearProfit
  };
}

function renderDashboard() {

  const totalItems =
    inventory.length;

  const lowStock =
    inventory.filter(
      item =>
        Number(item.quantity || 0) <=
        Number(item.lowStockThreshold || 0) &&
        Number(item.quantity || 0) > 0
    ).length;

  const expired =
    inventory.filter(
      item =>
        expiryInfo(item.expiryDate).type ===
        "expired"
    ).length;

  const expiring =
    inventory.filter(
      item =>
        ["expiring", "soon"].includes(
          expiryInfo(item.expiryDate).type
        )
    ).length;

  const inventoryValue =
    inventory.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
        Number(item.purchasePrice || 0),
      0
    );

  const totals =
    calculateProfitTotals();

  $("statItems").textContent =
    totalItems;

  $("statLow").textContent =
    lowStock;

  $("statExpired").textContent =
    expired;

  $("statExpiring").textContent =
    expiring;

  $("statInventoryValue").textContent =
    money(inventoryValue);

  $("statSales").textContent =
    money(totals.totalSales);

  $("statProfit").textContent =
    money(totals.totalProfit);

  $("statTodayProfit").textContent =
    money(totals.todayProfit);

  $("statMonthProfit").textContent =
    money(totals.monthProfit);

  $("statYearProfit").textContent =
    money(totals.yearProfit);

  renderRecentSales();
  renderExpiryAlerts();
}

function renderRecentSales() {

  const target =
    $("recentSalesTable");

  const recent =
    sales.slice(0, 7);

  if (!recent.length) {

    target.innerHTML =
      `<div class="empty-state">
        No sales recorded yet.
      </div>`;

    return;
  }

  target.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Medicine</th>
          <th>Customer</th>
          <th>Qty</th>
          <th>Profit</th>
        </tr>
      </thead>

      <tbody>

        ${recent.map(sale => `

          <tr>

            <td>
              ${dateFromTimestamp(sale.soldAt)}
            </td>

            <td>
              <strong>
                ${escapeHTML(sale.medicineName)}
              </strong>
            </td>

            <td>
              ${escapeHTML(sale.customerName)}
            </td>

            <td>
              ${sale.quantity}
            </td>

            <td>
              <strong>
                ${money(sale.profit)}
              </strong>
            </td>

          </tr>

        `).join("")}

      </tbody>
    </table>
  `;
}

function renderExpiryAlerts() {

  const target =
    $("expiryAlerts");

  const alerts =
    inventory
      .filter(item => {

        const expiry =
          expiryInfo(item.expiryDate);

        return [
          "expired",
          "expiring",
          "soon"
        ].includes(expiry.type);
      })
      .slice(0, 8);

  if (!alerts.length) {

    target.innerHTML =
      `<div class="empty-state">
        No expiry alerts.
      </div>`;

    return;
  }

  target.innerHTML =
    alerts.map(item => {

      const expiry =
        expiryInfo(item.expiryDate);

      const badge =
        expiry.type === "expired"
          ? "badge-red"
          : "badge-orange";

      return `

        <div class="alert-item">

          <div>

            <strong>
              ${escapeHTML(item.name)}
            </strong>

            <small>
              Batch: ${escapeHTML(item.batchNo || "-")}
            </small>

          </div>

          <span class="badge ${badge}">
            ${escapeHTML(expiry.label)}
          </span>

        </div>
      `;

    }).join("");
}


/* =========================================================
   INVENTORY
========================================================= */

function renderInventory() {

  const search =
    $("inventorySearch").value
      .trim()
      .toLowerCase();

  const category =
    $("inventoryCategoryFilter").value;

  const status =
    $("inventoryStatusFilter").value;

  let filtered =
    inventory.filter(item => {

      const text =
        [
          item.name,
          item.batchNo,
          item.supplier,
          item.category
        ]
          .join(" ")
          .toLowerCase();

      if (
        search &&
        !text.includes(search)
      ) {
        return false;
      }

      if (
        category &&
        item.category !== category
      ) {
        return false;
      }

      if (status) {

        const expiry =
          expiryInfo(item.expiryDate);

        const stock =
          stockStatus(item);

        if (
          status === "low" &&
          stock.type !== "expiring"
        ) {
          return false;
        }

        if (
          status === "expired" &&
          expiry.type !== "expired"
        ) {
          return false;
        }

        if (
          status === "expiring" &&
          !["expiring", "soon"].includes(
            expiry.type
          )
        ) {
          return false;
        }

        if (
          status === "available" &&
          stock.type !== "good"
        ) {
          return false;
        }
      }

      return true;
    });

  const target =
    $("inventoryTable");

  if (!filtered.length) {

    target.innerHTML =
      `<div class="empty-state">
        No inventory found.
      </div>`;

    return;
  }

  target.innerHTML = `
    <table class="data-table">

      <thead>

        <tr>
          <th>Medicine</th>
          <th>Category</th>
          <th>Batch</th>
          <th>Qty</th>
          <th>Purchase</th>
          <th>Sale</th>
          <th>Expiry</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${filtered.map(item => {

          const expiry =
            expiryInfo(item.expiryDate);

          const stock =
            stockStatus(item);

          let badgeClass =
            "badge-green";

          let label =
            stock.label;

          if (
            expiry.type === "expired"
          ) {
            badgeClass = "badge-red";
            label = "Expired";
          }

          else if (
            stock.type === "expiring"
          ) {
            badgeClass = "badge-orange";
          }

          return `

            <tr>

              <td>
                <strong>
                  ${escapeHTML(item.name)}
                </strong>
                <small style="display:block;color:var(--muted)">
                  ${escapeHTML(item.supplier || "")}
                </small>
              </td>

              <td>
                ${escapeHTML(item.category || "-")}
              </td>

              <td>
                ${escapeHTML(item.batchNo || "-")}
              </td>

              <td>
                <strong>
                  ${Number(item.quantity || 0)}
                </strong>
                ${escapeHTML(item.unit || "")}
              </td>

              <td>
                ${money(item.purchasePrice)}
              </td>

              <td>
                ${money(item.salePrice)}
              </td>

              <td>
                ${item.expiryDate || "-"}
              </td>

              <td>
                <span class="badge ${badgeClass}">
                  ${escapeHTML(label)}
                </span>
              </td>

              <td>

                <button
                  class="table-action"
                  data-edit-stock="${item.id}">
                  Edit
                </button>

                <button
                  class="table-action delete"
                  data-delete-stock="${item.id}">
                  Delete
                </button>

              </td>

            </tr>

          `;

        }).join("")}

      </tbody>

    </table>
  `;

  target
    .querySelectorAll(
      "[data-edit-stock]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          editStock(
            button.dataset.editStock
          );
        }
      );
    });

  target
    .querySelectorAll(
      "[data-delete-stock]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteStock(
            button.dataset.deleteStock
          );
        }
      );
    });
}


/* =========================================================
   ADD STOCK
========================================================= */

function openStockModal(item = null) {

  $("stockForm").reset();

  $("stockId").value =
    item?.id || "";

  $("stockModalTitle").textContent =
    item
      ? "Edit Stock"
      : "Add Stock";

  $("stockName").value =
    item?.name || "";

  $("stockCategory").value =
    item?.category || "";

  $("stockBatch").value =
    item?.batchNo || "";

  $("stockQuantity").value =
    item?.quantity ?? "";

  $("stockUnit").value =
    item?.unit || "Pieces";

  $("purchasePrice").value =
    item?.purchasePrice ?? "";

  $("defaultSalePrice").value =
    item?.salePrice ?? "";

  $("lowStockThreshold").value =
    item?.lowStockThreshold ?? 10;

  $("supplier").value =
    item?.supplier || "";

  $("purchaseDate").value =
    item?.purchaseDate || "";

  $("expiryDate").value =
    item?.expiryDate || "";

  $("stockNotes").value =
    item?.notes || "";

  $("stockModal").classList.remove(
    "hidden"
  );
}

$("addStockBtn").addEventListener(
  "click",
  () => openStockModal()
);

$("dashboardAddStockBtn").addEventListener(
  "click",
  () => openStockModal()
);

async function editStock(id) {

  const item =
    inventory.find(
      stock => stock.id === id
    );

  if (!item) return;

  openStockModal(item);
}

async function deleteStock(id) {

  const item =
    inventory.find(
      stock => stock.id === id
    );

  if (!item) return;

  const confirmed =
    confirm(
      `Delete "${item.name}" from inventory?`
    );

  if (!confirmed) return;

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        currentUser.uid,
        "inventory",
        id
      )
    );

    showToast(
      "Stock deleted successfully."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Unable to delete stock.",
      "error"
    );
  }
}


/* =========================================================
   SAVE STOCK
========================================================= */

$("stockForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) return;

    const button =
      $("saveStockBtn");

    setButtonLoading(
      button,
      true
    );

    const id =
      $("stockId").value;

    const data = {

      name:
        $("stockName").value.trim(),

      category:
        $("stockCategory").value,

      batchNo:
        $("stockBatch").value.trim(),

      quantity:
        Number(
          $("stockQuantity").value
        ),

      unit:
        $("stockUnit").value,

      purchasePrice:
        Number(
          $("purchasePrice").value
        ),

      salePrice:
        Number(
          $("defaultSalePrice").value
        ),

      lowStockThreshold:
        Number(
          $("lowStockThreshold").value || 0
        ),

      supplier:
        $("supplier").value.trim(),

      purchaseDate:
        $("purchaseDate").value,

      expiryDate:
        $("expiryDate").value,

      notes:
        $("stockNotes").value.trim(),

      updatedAt:
        Date.now()
    };

    try {

      if (id) {

        await updateDoc(
          doc(
            db,
            "users",
            currentUser.uid,
            "inventory",
            id
          ),
          data
        );

        showToast(
          "Stock updated successfully."
        );

      } else {

        await addDoc(
          collection(
            db,
            "users",
            currentUser.uid,
            "inventory"
          ),
          {
            ...data,
            createdAt: Date.now()
          }
        );

        showToast(
          "Stock added successfully."
        );
      }

      closeModal("stockModal");

    } catch (error) {

      console.error(error);

      showToast(
        "Unable to save stock.",
        "error"
      );

    } finally {

      setButtonLoading(
        button,
        false,
        "Save Stock"
      );
    }
  }
);


/* =========================================================
   SALE FORM
========================================================= */

function prepareSaleForm() {

  $("saleDate").value =
    todayString();

  populateSaleInventory();

  calculateSalePreview();
}

function populateSaleInventory() {

  const select =
    $("saleInventory");

  const currentValue =
    select.value;

  const available =
    inventory.filter(item => {

      const quantity =
        Number(item.quantity || 0);

      const expiry =
        expiryInfo(item.expiryDate);

      return (
        quantity > 0 &&
        expiry.type !== "expired"
      );
    });

  select.innerHTML =
    `<option value="">
      Select available stock
    </option>`;

  available.forEach(item => {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      item.id;

    option.textContent =
      `${item.name} | Batch: ${
        item.batchNo || "-"
      } | Qty: ${
        item.quantity
      } | ${money(item.salePrice)}`;

    select.appendChild(
      option
    );
  });

  if (
    available.some(
      item =>
        item.id === currentValue
    )
  ) {

    select.value =
      currentValue;
  }
}

function selectedSaleInventory() {

  return inventory.find(
    item =>
      item.id ===
      $("saleInventory").value
  );
}

$("saleInventory").addEventListener(
  "change",
  () => {

    const item =
      selectedSaleInventory();

    if (!item) {

      $("stockAvailableText").textContent =
        "";

      return;
    }

    $("salePrice").value =
      item.salePrice || 0;

    $("saleQuantity").value =
      "";

    $("stockAvailableText").textContent =
      `Available: ${
        item.quantity
      } ${
        item.unit || ""
      }`;

    calculateSalePreview();
  }
);

[
  "saleQuantity",
  "salePrice",
  "saleDiscount"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateSalePreview
  );
});

function calculateSalePreview() {

  const item =
    selectedSaleInventory();

  const quantity =
    Number(
      $("saleQuantity").value || 0
    );

  const salePrice =
    Number(
      $("salePrice").value || 0
    );

  const discount =
    Number(
      $("saleDiscount").value || 0
    );

  const gross =
    quantity * salePrice;

  const total =
    Math.max(
      gross - discount,
      0
    );

  const cost =
    quantity *
    Number(
      item?.purchasePrice || 0
    );

  const profit =
    total - cost;

  $("saleGross").textContent =
    money(gross);

  $("saleDiscountDisplay").textContent =
    money(discount);

  $("saleTotal").textContent =
    money(total);

  $("saleProfit").textContent =
    money(profit);
}


/* =========================================================
   COMPLETE SALE + STOCK TRANSACTION
========================================================= */

$("saleForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!currentUser) return;

    const button =
      $("completeSaleBtn");

    const item =
      selectedSaleInventory();

    if (!item) {

      showToast(
        "Please select a medicine.",
        "error"
      );

      return;
    }

    const quantity =
      Number(
        $("saleQuantity").value
      );

    const salePrice =
      Number(
        $("salePrice").value
      );

    const discount =
      Number(
        $("saleDiscount").value || 0
      );

    const customerName =
      $("customerName").value.trim();

    const salesmanName =
      $("salesmanName").value.trim();

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {

      showToast(
        "Enter a valid quantity.",
        "error"
      );

      return;
    }

    if (quantity > Number(item.quantity)) {

      showToast(
        `Only ${item.quantity} units are available.`,
        "error"
      );

      return;
    }

    if (salePrice < 0) {

      showToast(
        "Sale price cannot be negative.",
        "error"
      );

      return;
    }

    const gross =
      quantity * salePrice;

    if (discount > gross) {

      showToast(
        "Discount cannot be greater than sale amount.",
        "error"
      );

      return;
    }

    if (!customerName) {

      showToast(
        "Customer name is required.",
        "error"
      );

      return;
    }

    if (!salesmanName) {

      showToast(
        "Salesman name is required.",
        "error"
      );

      return;
    }

    setButtonLoading(
      button,
      true
    );

    const saleDate =
      $("saleDate").value ||
      todayString();

    const soldAt =
      new Date(
        `${saleDate}T12:00:00`
      ).getTime();

    const totalSale =
      Math.max(
        gross - discount,
        0
      );

    try {

      const inventoryRef =
        doc(
          db,
          "users",
          currentUser.uid,
          "inventory",
          item.id
        );

      const saleRef =
        doc(
          collection(
            db,
            "users",
            currentUser.uid,
            "sales"
          )
        );

      await runTransaction(
        db,
        async transaction => {

          const stockSnapshot =
            await transaction.get(
              inventoryRef
            );

          if (!stockSnapshot.exists()) {

            throw new Error(
              "Stock item no longer exists."
            );
          }

          const latestStock =
            stockSnapshot.data();

          const latestQuantity =
            Number(
              latestStock.quantity || 0
            );

          if (
            latestQuantity < quantity
          ) {

            throw new Error(
              `Only ${latestQuantity} units are available.`
            );
          }

          const remaining =
            latestQuantity -
            quantity;

          const totalCost =
            quantity *
            Number(
              latestStock.purchasePrice || 0
            );

          const profit =
            totalSale -
            totalCost;

          const invoiceNo =
            $("deliveryNumber").value.trim() ||
            `DEL-${Date.now()}`;

          const saleData = {

            inventoryId:
              item.id,

            medicineName:
              latestStock.name || item.name,

            category:
              latestStock.category || "",

            batchNo:
              latestStock.batchNo || "",

            quantity,

            unit:
              latestStock.unit || "",

            unitCost:
              Number(
                latestStock.purchasePrice || 0
              ),

            unitSalePrice:
              salePrice,

            grossAmount:
              gross,

            discount,

            totalSale,

            totalCost,

            profit,

            customerName,

            customerPhone:
              $("customerPhone").value.trim(),

            customerAddress:
              $("customerAddress").value.trim(),

            salesmanName,

            salesmanPhone:
              $("salesmanPhone").value.trim(),

            deliveryNumber:
              invoiceNo,

            paymentStatus:
              $("paymentStatus").value,

            saleDate,

            soldAt,

            notes:
              $("saleNotes").value.trim(),

            createdAt:
              Date.now()
          };

          transaction.update(
            inventoryRef,
            {
              quantity: remaining,
              updatedAt: Date.now(),
              status:
                remaining > 0
                  ? "available"
                  : "out-of-stock"
            }
          );

          transaction.set(
            saleRef,
            saleData
          );
        }
      );

      showToast(
        "Sale completed and stock updated successfully."
      );

      $("saleForm").reset();

      $("saleDate").value =
        todayString();

      populateSaleInventory();

      calculateSalePreview();

      navigate("history");

    } catch (error) {

      console.error(error);

      showToast(
        error.message ||
        "Unable to complete sale.",
        "error"
      );

    } finally {

      setButtonLoading(
        button,
        false,
        "Complete Sale & Delivery"
      );
    }
  }
);


/* =========================================================
   SALES HISTORY
========================================================= */

function filteredSales() {

  const search =
    $("historySearch").value
      .trim()
      .toLowerCase();

  const from =
    $("historyFrom").value;

  const to =
    $("historyTo").value;

  const payment =
    $("historyPayment").value;

  return sales.filter(sale => {

    const text =
      [
        sale.medicineName,
        sale.customerName,
        sale.salesmanName,
        sale.deliveryNumber,
        sale.batchNo
      ]
        .join(" ")
        .toLowerCase();

    if (
      search &&
      !text.includes(search)
    ) {
      return false;
    }

    const date =
      sale.saleDate ||
      new Date(
        Number(sale.soldAt || 0)
      )
        .toISOString()
        .slice(0, 10);

    if (from && date < from) {
      return false;
    }

    if (to && date > to) {
      return false;
    }

    if (
      payment &&
      sale.paymentStatus !== payment
    ) {
      return false;
    }

    return true;
  });
}

function renderHistory() {

  const data =
    filteredSales();

  const target =
    $("historyTable");

  if (!data.length) {

    target.innerHTML =
      `<div class="empty-state">
        No sales found.
      </div>`;

    return;
  }

  target.innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Date</th>
          <th>Delivery No.</th>
          <th>Medicine</th>
          <th>Customer</th>
          <th>Salesman</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Profit</th>
          <th>Payment</th>
          <th>View</th>
        </tr>

      </thead>

      <tbody>

        ${data.map(sale => `

          <tr>

            <td>
              ${escapeHTML(
                sale.saleDate ||
                dateFromTimestamp(sale.soldAt)
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.deliveryNumber || "-"
              )}
            </td>

            <td>
              <strong>
                ${escapeHTML(
                  sale.medicineName
                )}
              </strong>
              <small style="display:block;color:var(--muted)">
                Batch: ${escapeHTML(
                  sale.batchNo || "-"
                )}
              </small>
            </td>

            <td>
              ${escapeHTML(
                sale.customerName
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.salesmanName
              )}
            </td>

            <td>
              ${sale.quantity}
            </td>

            <td>
              ${money(
                sale.totalSale
              )}
            </td>

            <td>
              <strong>
                ${money(
                  sale.profit
                )}
              </strong>
            </td>

            <td>
              <span class="badge ${
                sale.paymentStatus === "Paid"
                  ? "badge-green"
                  : "badge-orange"
              }">
                ${escapeHTML(
                  sale.paymentStatus || "-"
                )}
              </span>
            </td>

            <td>
              <button
                class="table-action"
                data-view-sale="${sale.id}">
                View
              </button>
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;

  target
    .querySelectorAll(
      "[data-view-sale]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          viewSale(
            button.dataset.viewSale
          );
        }
      );
    });
}


/* =========================================================
   VIEW SALE
========================================================= */

function viewSale(id) {

  const sale =
    sales.find(
      item => item.id === id
    );

  if (!sale) return;

  currentSaleForPrint =
    sale;

  $("saleDetailsContent").innerHTML = `

    <div class="form-grid">

      <div class="form-group">
        <label>Delivery Number</label>
        <div>${escapeHTML(
          sale.deliveryNumber || "-"
        )}</div>
      </div>

      <div class="form-group">
        <label>Date & Time</label>
        <div>${dateTimeFromTimestamp(
          sale.soldAt
        )}</div>
      </div>

      <div class="form-group">
        <label>Medicine</label>
        <div>${escapeHTML(
          sale.medicineName
        )}</div>
      </div>

      <div class="form-group">
        <label>Batch</label>
        <div>${escapeHTML(
          sale.batchNo || "-"
        )}</div>
      </div>

      <div class="form-group">
        <label>Quantity</label>
        <div>${sale.quantity} ${
          escapeHTML(sale.unit || "")
        }</div>
      </div>

      <div class="form-group">
        <label>Unit Sale Price</label>
        <div>${money(
          sale.unitSalePrice
        )}</div>
      </div>

      <div class="form-group">
        <label>Customer</label>
        <div>${escapeHTML(
          sale.customerName
        )}</div>
      </div>

      <div class="form-group">
        <label>Customer Number</label>
        <div>${escapeHTML(
          sale.customerPhone || "-"
        )}</div>
      </div>

      <div class="form-group full">
        <label>Customer Address</label>
        <div>${escapeHTML(
          sale.customerAddress || "-"
        )}</div>
      </div>

      <div class="form-group">
        <label>Salesman</label>
        <div>${escapeHTML(
          sale.salesmanName
        )}</div>
      </div>

      <div class="form-group">
        <label>Salesman Number</label>
        <div>${escapeHTML(
          sale.salesmanPhone || "-"
        )}</div>
      </div>

      <div class="form-group">
        <label>Gross Sale</label>
        <div>${money(
          sale.grossAmount
        )}</div>
      </div>

      <div class="form-group">
        <label>Discount</label>
        <div>${money(
          sale.discount
        )}</div>
      </div>

      <div class="form-group">
        <label>Total Sale</label>
        <div>
          <strong>
            ${money(
              sale.totalSale
            )}
          </strong>
        </div>
      </div>

      <div class="form-group">
        <label>Profit</label>
        <div>
          <strong>
            ${money(
              sale.profit
            )}
          </strong>
        </div>
      </div>

      <div class="form-group">
        <label>Payment</label>
        <div>${escapeHTML(
          sale.paymentStatus || "-"
        )}</div>
      </div>

      <div class="form-group full">
        <label>Notes</label>
        <div>${escapeHTML(
          sale.notes || "-"
        )}</div>
      </div>

    </div>
  `;

  $("viewSaleModal")
    .classList.remove("hidden");
}


/* =========================================================
   PRINT INVOICE
========================================================= */

$("printSaleBtn").addEventListener(
  "click",
  () => {

    const sale =
      currentSaleForPrint;

    if (!sale) return;

    const business =
      currentProfile?.businessName ||
      "Poultry Medicine Business";

    const printWindow =
      window.open(
        "",
        "_blank"
      );

    printWindow.document.write(`

      <!DOCTYPE html>

      <html>

      <head>

        <title>
          ${escapeHTML(
            sale.deliveryNumber || "Invoice"
          )}
        </title>

        <style>

          body {
            font-family: Arial, sans-serif;
            padding: 30px;
            color: #111;
          }

          h1 {
            margin-bottom: 5px;
          }

          .muted {
            color: #666;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }

          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
          }

          .total {
            margin-top: 20px;
            font-size: 18px;
          }

          @media print {
            body {
              padding: 10px;
            }
          }

        </style>

      </head>

      <body>

        <h1>
          ${escapeHTML(business)}
        </h1>

        <p class="muted">
          Poultry Medicine Sales / Delivery Invoice
        </p>

        <hr>

        <p>
          <strong>Delivery No:</strong>
          ${escapeHTML(
            sale.deliveryNumber || "-"
          )}
        </p>

        <p>
          <strong>Date:</strong>
          ${escapeHTML(
            sale.saleDate || "-"
          )}
        </p>

        <p>
          <strong>Customer:</strong>
          ${escapeHTML(
            sale.customerName
          )}
        </p>

        <p>
          <strong>Customer No:</strong>
          ${escapeHTML(
            sale.customerPhone || "-"
          )}
        </p>

        <p>
          <strong>Salesman:</strong>
          ${escapeHTML(
            sale.salesmanName
          )}
        </p>

        <p>
          <strong>Salesman No:</strong>
          ${escapeHTML(
            sale.salesmanPhone || "-"
          )}
        </p>

        <table>

          <thead>

            <tr>
              <th>Medicine</th>
              <th>Batch</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>

          </thead>

          <tbody>

            <tr>

              <td>
                ${escapeHTML(
                  sale.medicineName
                )}
              </td>

              <td>
                ${escapeHTML(
                  sale.batchNo || "-"
                )}
              </td>

              <td>
                ${sale.quantity}
              </td>

              <td>
                ${money(
                  sale.unitSalePrice
                )}
              </td>

              <td>
                ${money(
                  sale.totalSale
                )}
              </td>

            </tr>

          </tbody>

        </table>

        <div class="total">

          <p>
            <strong>Gross:</strong>
            ${money(
              sale.grossAmount
            )}
          </p>

          <p>
            <strong>Discount:</strong>
            ${money(
              sale.discount
            )}
          </p>

          <p>
            <strong>Grand Total:</strong>
            ${money(
              sale.totalSale
            )}
          </p>

        </div>

        <br>

        <p>
          Payment:
          <strong>
            ${escapeHTML(
              sale.paymentStatus || "-"
            )}
          </strong>
        </p>

      </body>

      </html>

    `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {

      printWindow.print();

    }, 400);
  }
);


/* =========================================================
   CUSTOMERS
========================================================= */

function renderCustomers() {

  const map =
    {};

  sales.forEach(sale => {

    const key =
      `${sale.customerName || "Unknown"}|${
        sale.customerPhone || ""
      }`;

    if (!map[key]) {

      map[key] = {

        name:
          sale.customerName || "Unknown",

        phone:
          sale.customerPhone || "-",

        address:
          sale.customerAddress || "-",

        orders: 0,

        quantity: 0,

        total: 0,

        profit: 0,

        lastSale: sale.soldAt || 0
      };
    }

    map[key].orders += 1;

    map[key].quantity +=
      Number(
        sale.quantity || 0
      );

    map[key].total +=
      Number(
        sale.totalSale || 0
      );

    map[key].profit +=
      Number(
        sale.profit || 0
      );

    map[key].lastSale =
      Math.max(
        map[key].lastSale,
        Number(
          sale.soldAt || 0
        )
      );
  });

  const customers =
    Object.values(map);

  const target =
    $("customersTable");

  if (!customers.length) {

    target.innerHTML =
      `<div class="empty-state">
        No customers yet.
      </div>`;

    return;
  }

  target.innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Customer</th>
          <th>Number</th>
          <th>Address</th>
          <th>Orders</th>
          <th>Quantity</th>
          <th>Total Purchase</th>
          <th>Profit</th>
          <th>Last Sale</th>
        </tr>

      </thead>

      <tbody>

        ${customers.map(customer => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(
                  customer.name
                )}
              </strong>
            </td>

            <td>
              ${escapeHTML(
                customer.phone
              )}
            </td>

            <td>
              ${escapeHTML(
                customer.address
              )}
            </td>

            <td>
              ${customer.orders}
            </td>

            <td>
              ${customer.quantity}
            </td>

            <td>
              ${money(
                customer.total
              )}
            </td>

            <td>
              ${money(
                customer.profit
              )}
            </td>

            <td>
              ${dateFromTimestamp(
                customer.lastSale
              )}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}


/* =========================================================
   DELIVERIES
========================================================= */

function filteredDeliveries() {

  const search =
    $("deliverySearch").value
      .trim()
      .toLowerCase();

  const from =
    $("deliveryFrom").value;

  const to =
    $("deliveryTo").value;

  return sales.filter(sale => {

    const text =
      [
        sale.salesmanName,
        sale.salesmanPhone,
        sale.customerName,
        sale.medicineName,
        sale.deliveryNumber
      ]
        .join(" ")
        .toLowerCase();

    if (
      search &&
      !text.includes(search)
    ) {
      return false;
    }

    const date =
      sale.saleDate ||
      new Date(
        Number(sale.soldAt || 0)
      )
        .toISOString()
        .slice(0, 10);

    if (from && date < from) {
      return false;
    }

    if (to && date > to) {
      return false;
    }

    return true;
  });
}

function renderDeliveries() {

  const data =
    filteredDeliveries();

  const quantity =
    data.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.quantity || 0
        ),
      0
    );

  const deliverySales =
    data.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.totalSale || 0
        ),
      0
    );

  const deliveryProfit =
    data.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.profit || 0
        ),
      0
    );

  $("deliveryCount").textContent =
    data.length;

  $("deliveryQuantity").textContent =
    quantity;

  $("deliverySales").textContent =
    money(deliverySales);

  $("deliveryProfit").textContent =
    money(deliveryProfit);

  const target =
    $("deliveriesTable");

  if (!data.length) {

    target.innerHTML =
      `<div class="empty-state">
        No delivery records found.
      </div>`;

    return;
  }

  target.innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Date</th>
          <th>Delivery No.</th>
          <th>Salesman</th>
          <th>Salesman No.</th>
          <th>Customer</th>
          <th>Medicine</th>
          <th>Batch</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Profit</th>
        </tr>

      </thead>

      <tbody>

        ${data.map(sale => `

          <tr>

            <td>
              ${escapeHTML(
                sale.saleDate || "-"
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.deliveryNumber || "-"
              )}
            </td>

            <td>
              <strong>
                ${escapeHTML(
                  sale.salesmanName
                )}
              </strong>
            </td>

            <td>
              ${escapeHTML(
                sale.salesmanPhone || "-"
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.customerName
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.medicineName
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.batchNo || "-"
              )}
            </td>

            <td>
              ${sale.quantity}
            </td>

            <td>
              ${money(
                sale.totalSale
              )}
            </td>

            <td>
              ${money(
                sale.profit
              )}
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;
}


/* =========================================================
   REPORTS
========================================================= */

function renderReports() {

  const totals =
    calculateProfitTotals();

  $("reportTodayProfit").textContent =
    money(totals.todayProfit);

  $("reportMonthProfit").textContent =
    money(totals.monthProfit);

  $("reportYearProfit").textContent =
    money(totals.yearProfit);

  $("reportAllProfit").textContent =
    money(totals.totalProfit);

  renderTopMedicines();
  renderTopSalesmen();
  renderProfitChart();
}

function renderTopMedicines() {

  const map =
    {};

  sales.forEach(sale => {

    const name =
      sale.medicineName || "Unknown";

    if (!map[name]) {

      map[name] = {
        quantity: 0,
        sales: 0,
        profit: 0
      };
    }

    map[name].quantity +=
      Number(
        sale.quantity || 0
      );

    map[name].sales +=
      Number(
        sale.totalSale || 0
      );

    map[name].profit +=
      Number(
        sale.profit || 0
      );
  });

  const list =
    Object.entries(map)
      .sort(
        (a, b) =>
          b[1].quantity -
          a[1].quantity
      )
      .slice(0, 8);

  $("topMedicines").innerHTML =
    list.length
      ? list.map(
          ([name, data]) => `

            <div class="rank-item">

              <div>

                <strong>
                  ${escapeHTML(name)}
                </strong>

                <span>
                  ${data.quantity} units sold
                </span>

              </div>

              <div>

                <strong>
                  ${money(data.profit)}
                </strong>

                <span>
                  Profit
                </span>

              </div>

            </div>
          `
        ).join("")
      : `<div class="empty-state">
          No sales data.
        </div>`;
}

function renderTopSalesmen() {

  const map =
    {};

  sales.forEach(sale => {

    const name =
      sale.salesmanName ||
      "Unknown";

    if (!map[name]) {

      map[name] = {
        deliveries: 0,
        quantity: 0,
        sales: 0
      };
    }

    map[name].deliveries += 1;

    map[name].quantity +=
      Number(
        sale.quantity || 0
      );

    map[name].sales +=
      Number(
        sale.totalSale || 0
      );
  });

  const list =
    Object.entries(map)
      .sort(
        (a, b) =>
          b[1].deliveries -
          a[1].deliveries
      )
      .slice(0, 8);

  $("topSalesmen").innerHTML =
    list.length
      ? list.map(
          ([name, data]) => `

            <div class="rank-item">

              <div>

                <strong>
                  ${escapeHTML(name)}
                </strong>

                <span>
                  ${data.deliveries} deliveries
                </span>

              </div>

              <div>

                <strong>
                  ${data.quantity}
                </strong>

                <span>
                  units
                </span>

              </div>

            </div>

          `
        ).join("")
      : `<div class="empty-state">
          No delivery data.
        </div>`;
}

function renderProfitChart() {

  const target =
    $("profitChart");

  const days = [];

  for (
    let i = 6;
    i >= 0;
    i--
  ) {

    const d =
      new Date();

    d.setDate(
      d.getDate() - i
    );

    const date =
      d.toISOString()
        .slice(0, 10);

    const label =
      d.toLocaleDateString(
        "en-PK",
        {
          weekday: "short"
        }
      );

    let profit = 0;

    sales.forEach(sale => {

      const saleDate =
        sale.saleDate ||
        new Date(
          Number(
            sale.soldAt || 0
          )
        )
          .toISOString()
          .slice(0, 10);

      if (saleDate === date) {

        profit +=
          Number(
            sale.profit || 0
          );
      }
    });

    days.push({
      label,
      profit
    });
  }

  const max =
    Math.max(
      ...days.map(
        day => day.profit
      ),
      1
    );

  target.innerHTML =
    days.map(day => {

      const height =
        Math.max(
          3,
          (
            day.profit /
            max
          ) * 150
        );

      return `

        <div class="chart-bar-wrap">

          <div
            class="chart-bar"
            style="height:${height}px"
            title="${money(day.profit)}">
          </div>

          <span class="chart-label">
            ${day.label}
          </span>

        </div>
      `;

    }).join("");
}


/* =========================================================
   CSV EXPORT
========================================================= */

function downloadCSV(filename, rows) {

  if (!rows.length) {

    showToast(
      "No data to export.",
      "error"
    );

    return;
  }

  const headers =
    Object.keys(rows[0]);

  const csv = [

    headers.join(","),

    ...rows.map(row =>
      headers
        .map(header => {

          const value =
            String(
              row[header] ?? ""
            )
              .replaceAll('"', '""');

          return `"${value}"`;
        })
        .join(",")
    )

  ].join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;

  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  URL.revokeObjectURL(url);
}

$("exportSalesBtn").addEventListener(
  "click",
  () => {

    const rows =
      filteredSales().map(
        sale => ({

          Date:
            sale.saleDate || "",

          Delivery_Number:
            sale.deliveryNumber || "",

          Medicine:
            sale.medicineName || "",

          Batch:
            sale.batchNo || "",

          Quantity:
            sale.quantity || 0,

          Customer:
            sale.customerName || "",

          Customer_Number:
            sale.customerPhone || "",

          Salesman:
            sale.salesmanName || "",

          Salesman_Number:
            sale.salesmanPhone || "",

          Sale_Price:
            sale.unitSalePrice || 0,

          Total_Sale:
            sale.totalSale || 0,

          Profit:
            sale.profit || 0,

          Payment:
            sale.paymentStatus || ""
        })
      );

    downloadCSV(
      "sales-history.csv",
      rows
    );
  }
);

$("exportDeliveriesBtn").addEventListener(
  "click",
  () => {

    const rows =
      filteredDeliveries().map(
        sale => ({

          Date:
            sale.saleDate || "",

          Delivery_Number:
            sale.deliveryNumber || "",

          Salesman:
            sale.salesmanName || "",

          Salesman_Number:
            sale.salesmanPhone || "",

          Customer:
            sale.customerName || "",

          Customer_Number:
            sale.customerPhone || "",

          Customer_Address:
            sale.customerAddress || "",

          Medicine:
            sale.medicineName || "",

          Batch:
            sale.batchNo || "",

          Quantity:
            sale.quantity || 0,

          Total_Sale:
            sale.totalSale || 0,

          Profit:
            sale.profit || 0,

          Payment:
            sale.paymentStatus || ""
        })
      );

    downloadCSV(
      "salesman-deliveries.csv",
      rows
    );
  }
);


/* =========================================================
   FILTER EVENTS
========================================================= */

[
  "inventorySearch",
  "inventoryCategoryFilter",
  "inventoryStatusFilter"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderInventory
  );

  $(id).addEventListener(
    "change",
    renderInventory
  );
});

[
  "historySearch",
  "historyFrom",
  "historyTo",
  "historyPayment"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderHistory
  );

  $(id).addEventListener(
    "change",
    renderHistory
  );
});

[
  "deliverySearch",
  "deliveryFrom",
  "deliveryTo"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderDeliveries
  );

  $(id).addEventListener(
    "change",
    renderDeliveries
  );
});


/* =========================================================
   QUICK SALE
========================================================= */

$("quickSaleBtn").addEventListener(
  "click",
  () => navigate("sale")
);


/* =========================================================
   MODALS
========================================================= */

function closeModal(id) {

  const modal =
    $(id);

  if (modal) {

    modal.classList.add(
      "hidden"
    );
  }
}

document
  .querySelectorAll(
    "[data-close]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        closeModal(
          button.dataset.close
        );
      }
    );
  });

document
  .querySelectorAll(".modal")
  .forEach(modal => {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target === modal
        ) {

          modal.classList.add(
            "hidden"
          );
        }
      }
    );
  });


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderEverything() {

  if (!currentUser) return;

  renderDashboard();

  renderInventory();

  renderHistory();

  renderCustomers();

  renderDeliveries();

  renderReports();

  populateSaleInventory();

  calculateSalePreview();
}


/* =========================================================
   INITIAL SALE DATE
========================================================= */

$("saleDate").value =
  todayString();
