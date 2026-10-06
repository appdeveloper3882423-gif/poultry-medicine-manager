// ============================================================
// POULTRY MEDICINE MANAGER
// Firebase + Firestore + Authentication
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  setPersistence,
  browserLocalPersistence
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


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCkyj91iDkxfyFq3ErGucMykxB6h0trplM",
  authDomain: "poultry-medicine-manager-93b79.firebaseapp.com",
  projectId: "poultry-medicine-manager-93b79",
  storageBucket: "poultry-medicine-manager-93b79.firebasestorage.app",
  messagingSenderId: "623127969077",
  appId: "1:623127969077:web:e7e4e4e249607c"
};


// ============================================================
// INITIALIZE
// ============================================================

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);


// ============================================================
// GLOBAL STATE
// ============================================================

const state = {
  user: null,
  profile: {},
  inventory: [],
  sales: [],
  currentPage: "dashboard",
  unsubInventory: null,
  unsubSales: null
};


// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");


// ============================================================
// HELPERS
// ============================================================

function money(value) {

  const number = Number(value) || 0;

  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2
  }).format(number);
}


function number(value) {
  return new Intl.NumberFormat("en-PK").format(Number(value) || 0);
}


function escapeHTML(value = "") {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatDate(timestamp) {

  if (!timestamp) return "-";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}


function formatDateTime(timestamp) {

  if (!timestamp) return "-";

  const date = new Date(timestamp);

  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function todayISO() {

  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function daysUntil(dateString) {

  if (!dateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(dateString + "T00:00:00");
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expiry - today) / (1000 * 60 * 60 * 24)
  );
}


function expiryStatus(item) {

  const qty = Number(item.quantity) || 0;

  if (qty <= 0) {
    return {
      type: "out",
      label: "Out of Stock",
      class: "danger"
    };
  }

  const days = daysUntil(item.expiryDate);

  if (days !== null && days < 0) {
    return {
      type: "expired",
      label: "Expired",
      class: "danger"
    };
  }

  if (days !== null && days <= 7) {
    return {
      type: "expiring",
      label: `Expires in ${days}d`,
      class: "danger"
    };
  }

  if (days !== null && days <= 30) {
    return {
      type: "expiring",
      label: `Expires in ${days}d`,
      class: "warning"
    };
  }

  if (qty <= Number(item.lowStock || 5)) {
    return {
      type: "low",
      label: "Low Stock",
      class: "warning"
    };
  }

  return {
    type: "available",
    label: "Available",
    class: "success"
  };
}


function showToast(message, type = "success") {

  const toast = $("toast");

  toast.textContent = message;

  toast.className = `toast show ${type}`;

  clearTimeout(window.toastTimer);

  window.toastTimer = setTimeout(() => {
    toast.className = "toast";
  }, 3500);
}


function showAuthError(message) {

  const error = $("authError");

  error.textContent = message;
  error.style.display = "block";
}


function clearAuthError() {

  $("authError").style.display = "none";
  $("authError").textContent = "";
}


function generateInvoice() {

  const date = new Date();

  const datePart =
    date.getFullYear().toString() +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");

  const random = Math.floor(100000 + Math.random() * 900000);

  return `PM-${datePart}-${random}`;
}


function sameDay(timestamp, date = new Date()) {

  if (!timestamp) return false;

  const d = new Date(timestamp);

  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}


function sameMonth(timestamp) {

  if (!timestamp) return false;

  const d = new Date(timestamp);
  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  );
}


function sameYear(timestamp) {

  if (!timestamp) return false;

  return new Date(timestamp).getFullYear() === new Date().getFullYear();
}


function getSalesStats() {

  const sales = state.sales;

  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.totalSale || 0),
    0
  );

  const totalProfit = sales.reduce(
    (sum, sale) => sum + Number(sale.profit || 0),
    0
  );

  const todaySales = sales.filter(s => sameDay(s.soldAt));

  const monthSales = sales.filter(s => sameMonth(s.soldAt));

  const yearSales = sales.filter(s => sameYear(s.soldAt));

  const profit = list =>
    list.reduce(
      (sum, sale) => sum + Number(sale.profit || 0),
      0
    );

  return {
    totalSales,
    totalProfit,

    todayProfit: profit(todaySales),
    monthProfit: profit(monthSales),
    yearProfit: profit(yearSales),

    todayCount: todaySales.length,
    monthCount: monthSales.length,
    yearCount: yearSales.length
  };
}


// ============================================================
// AUTH TABS
// ============================================================

document.querySelectorAll(".auth-tab").forEach(button => {

  button.addEventListener("click", () => {

    document
      .querySelectorAll(".auth-tab")
      .forEach(btn => btn.classList.remove("active"));

    button.classList.add("active");

    const type = button.dataset.auth;

    if (type === "login") {

      $("loginForm").classList.remove("hidden");
      $("registerForm").classList.add("hidden");

    } else {

      $("loginForm").classList.add("hidden");
      $("registerForm").classList.remove("hidden");
    }

    clearAuthError();
  });

});


// ============================================================
// REGISTER
// ============================================================

$("registerForm").addEventListener("submit", async event => {

  event.preventDefault();

  clearAuthError();

  const name = $("registerName").value.trim();
  const business = $("registerBusiness").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  if (!name || !business || !email || !password) {
    showAuthError("Please fill all fields.");
    return;
  }

  try {

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const user = credential.user;

    await updateProfile(user, {
      displayName: name
    });

    await setDoc(doc(db, "users", user.uid), {
      name,
      businessName: business,
      email,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    showToast("Account created successfully.");

  } catch (error) {

    console.error(error);

    showAuthError(getFirebaseError(error));
  }

});


// ============================================================
// LOGIN
// ============================================================

$("loginForm").addEventListener("submit", async event => {

  event.preventDefault();

  clearAuthError();

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (error) {

    console.error(error);

    showAuthError(getFirebaseError(error));
  }

});


// ============================================================
// FIREBASE ERROR
// ============================================================

function getFirebaseError(error) {

  const code = error?.code || "";

  const messages = {

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection."
  };

  return messages[code] ||
    error?.message ||
    "Something went wrong. Please try again.";
}


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, async user => {

  if (user) {

    state.user = user;

    await loadProfile();

    showApplication();

    subscribeData();

  } else {

    cleanupListeners();

    state.user = null;
    state.profile = {};
    state.inventory = [];
    state.sales = [];

    authView.classList.remove("hidden");
    appView.classList.add("hidden");
  }

});


// ============================================================
// PROFILE
// ============================================================

async function loadProfile() {

  const ref = doc(db, "users", state.user.uid);

  const snap = await getDoc(ref);

  if (snap.exists()) {

    state.profile = snap.data();

  } else {

    state.profile = {
      name: state.user.displayName || "User",
      businessName: "Poultry Business",
      email: state.user.email || ""
    };

    await setDoc(ref, {
      ...state.profile,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
}


async function saveProfile() {

  const name = $("profileName").value.trim();
  const business = $("profileBusiness").value.trim();

  if (!name || !business) {
    showToast("Please fill all profile fields.", "error");
    return;
  }

  try {

    await updateProfile(state.user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", state.user.uid),
      {
        name,
        businessName: business,
        email: state.user.email,
        updatedAt: Date.now()
      },
      { merge: true }
    );

    state.profile.name = name;
    state.profile.businessName = business;

    updateUserUI();

    showToast("Profile updated successfully.");

  } catch (error) {

    console.error(error);

    showToast("Could not update profile.", "error");
  }
}


$("profileForm").addEventListener("submit", event => {

  event.preventDefault();

  saveProfile();

});


// ============================================================
// APPLICATION UI
// ============================================================

function showApplication() {

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  updateUserUI();

  $("todayDate").textContent =
    new Date().toLocaleDateString("en-PK", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  $("profileName").value =
    state.profile.name || state.user.displayName || "";

  $("profileBusiness").value =
    state.profile.businessName || "";

  $("profileEmail").value =
    state.user.email || "";

  applyTheme();

  showPage("dashboard");
}


function updateUserUI() {

  const name =
    state.profile.name ||
    state.user?.displayName ||
    "User";

  const business =
    state.profile.businessName ||
    "Poultry Business";

  $("sideUserName").textContent = name;
  $("sideBusiness").textContent = business;

  $("welcomeName").textContent = name;

  $("sideAvatar").textContent =
    name.charAt(0).toUpperCase();
}


// ============================================================
// NAVIGATION
// ============================================================

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    showPage(button.dataset.page);

    $("sidebar").classList.remove("open");
  });

});


document.querySelectorAll("[data-page]").forEach(button => {

  if (button.classList.contains("nav-item")) return;

  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });

});


function showPage(page) {

  state.currentPage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active-page");
  });

  const target = $(`page-${page}`);

  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.page === page
    );

  });


  const titles = {

    dashboard: [
      "Dashboard",
      "Overview of your poultry medicine business"
    ],

    inventory: [
      "Medicine Inventory",
      "Manage your complete stock"
    ],

    sale: [
      "New Sale",
      "Create a medicine sale"
    ],

    history: [
      "Sales History",
      "Complete transaction history"
    ],

    customers: [
      "Customers",
      "Manage your customer records"
    ],

    reports: [
      "Reports & Analytics",
      "Business performance overview"
    ],

    settings: [
      "Settings",
      "Manage profile and preferences"
    ]

  };

  const data = titles[page] || titles.dashboard;

  $("pageTitle").textContent = data[0];
  $("pageSubtitle").textContent = data[1];

  if (page === "sale") {
    populateSaleMedicine();
  }

  renderAll();
}


// ============================================================
// SIDEBAR MOBILE
// ============================================================

$("menuBtn").addEventListener("click", () => {

  $("sidebar").classList.toggle("open");

});


// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn").addEventListener("click", async () => {

  if (!confirm("Are you sure you want to logout?")) return;

  await signOut(auth);

});


// ============================================================
// FIRESTORE LISTENERS
// ============================================================

function subscribeData() {

  cleanupListeners();

  const inventoryRef =
    collection(
      db,
      "users",
      state.user.uid,
      "inventory"
    );

  const salesRef =
    collection(
      db,
      "users",
      state.user.uid,
      "sales"
    );


  state.unsubInventory =
    onSnapshot(
      inventoryRef,
      snapshot => {

        state.inventory =
          snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));

        state.inventory.sort(
          (a, b) =>
            Number(b.createdAt || 0) -
            Number(a.createdAt || 0)
        );

        renderAll();

      },
      error => {

        console.error(error);

        showToast(
          "Inventory sync error. Check Firestore rules.",
          "error"
        );

      }
    );


  state.unsubSales =
    onSnapshot(
      salesRef,
      snapshot => {

        state.sales =
          snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          }));

        state.sales.sort(
          (a, b) =>
            Number(b.soldAt || 0) -
            Number(a.soldAt || 0)
        );

        renderAll();

      },
      error => {

        console.error(error);

        showToast(
          "Sales sync error. Check Firestore rules.",
          "error"
        );

      }
    );

}


function cleanupListeners() {

  if (state.unsubInventory) {
    state.unsubInventory();
    state.unsubInventory = null;
  }

  if (state.unsubSales) {
    state.unsubSales();
    state.unsubSales = null;
  }
}


// ============================================================
// RENDER ALL
// ============================================================

function renderAll() {

  if (!state.user) return;

  renderDashboard();
  renderInventory();
  renderSales();
  renderCustomers();
  renderReports();
  populateSaleMedicine();
}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

  const active =
    state.inventory.filter(
      item => Number(item.quantity || 0) > 0
    );

  const totalUnits =
    active.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0),
      0
    );

  const inventoryValue =
    state.inventory.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
        Number(item.purchasePrice || 0),
      0
    );

  const stats = getSalesStats();

  const expiryItems =
    state.inventory.filter(item => {

      const status = expiryStatus(item);

      return (
        status.type === "expired" ||
        status.type === "expiring"
      );
    });


  $("statMedicines").textContent =
    number(active.length);

  $("statUnits").textContent =
    number(totalUnits);

  $("statSales").textContent =
    money(stats.totalSales);

  $("statProfit").textContent =
    money(stats.totalProfit);

  $("todayProfit").textContent =
    money(stats.todayProfit);

  $("monthProfit").textContent =
    money(stats.monthProfit);

  $("yearProfit").textContent =
    money(stats.yearProfit);

  $("todaySalesCount").textContent =
    `${stats.todayCount} sales today`;

  $("monthSalesCount").textContent =
    `${stats.monthCount} sales this month`;

  $("yearSalesCount").textContent =
    `${stats.yearCount} sales this year`;

  $("expiryCount").textContent =
    expiryItems.length;


  renderExpiryList(expiryItems);
  renderRecentSales();
}


function renderExpiryList(items) {

  const container = $("expiryList");

  if (!items.length) {

    container.innerHTML = `
      <div class="empty-small">
        ✅ No expiry alerts at the moment.
      </div>
    `;

    return;
  }


  const sorted =
    [...items].sort(
      (a, b) =>
        (daysUntil(a.expiryDate) ?? 99999) -
        (daysUntil(b.expiryDate) ?? 99999)
    );


  container.innerHTML =
    sorted.slice(0, 6).map(item => {

      const status = expiryStatus(item);

      return `
        <div class="alert-row">
          <div>
            <strong>${escapeHTML(item.name)}</strong>
            <span>Batch: ${escapeHTML(item.batch || "-")}</span>
          </div>

          <div>
            <span class="badge ${status.class}">
              ${escapeHTML(status.label)}
            </span>
          </div>
        </div>
      `;

    }).join("");
}


function renderRecentSales() {

  const container = $("recentSales");

  const sales =
    state.sales.slice(0, 6);

  if (!sales.length) {

    container.innerHTML = `
      <div class="empty-small">
        No sales recorded yet.
      </div>
    `;

    return;
  }


  container.innerHTML =
    sales.map(sale => {

      return `
        <div class="sale-row">

          <div>
            <strong>${escapeHTML(sale.medicineName)}</strong>
            <span>
              ${escapeHTML(sale.customerName || "Walk-in Customer")}
              • ${formatDate(sale.soldAt)}
            </span>
          </div>

          <div>
            <strong>${money(sale.totalSale)}</strong>
            <span class="${Number(sale.profit) >= 0 ? "profit-positive" : "profit-negative"}">
              ${money(sale.profit)}
            </span>
          </div>

        </div>
      `;

    }).join("");
}


// ============================================================
// INVENTORY
// ============================================================

function renderInventory() {

  const tbody = $("inventoryTable");

  const search =
    ($("inventorySearch")?.value || "")
      .trim()
      .toLowerCase();

  const statusFilter =
    $("inventoryStatus")?.value || "all";


  let items = [...state.inventory];


  if (search) {

    items = items.filter(item => {

      const text = [
        item.name,
        item.batch,
        item.supplier,
        item.category
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });
  }


  if (statusFilter !== "all") {

    items = items.filter(item => {

      const status = expiryStatus(item);

      return status.type === statusFilter;
    });
  }


  if (!items.length) {

    tbody.innerHTML = "";

    $("inventoryEmpty").classList.remove("hidden");

    return;
  }

  $("inventoryEmpty").classList.add("hidden");


  tbody.innerHTML =
    items.map(item => {

      const status = expiryStatus(item);

      return `
        <tr>

          <td>
            <strong>${escapeHTML(item.name)}</strong>
            <br>
            <small>${escapeHTML(item.category || "")}</small>
          </td>

          <td>${escapeHTML(item.batch || "-")}</td>

          <td>
            ${number(item.quantity)}
            ${escapeHTML(item.unit || "")}
          </td>

          <td>${money(item.purchasePrice)}</td>

          <td>${money(item.sellingPrice)}</td>

          <td>${escapeHTML(item.supplier || "-")}</td>

          <td>${escapeHTML(item.expiryDate || "-")}</td>

          <td>
            <span class="badge ${status.class}">
              ${escapeHTML(status.label)}
            </span>
          </td>

          <td>
            <div class="table-actions">

              <button
                class="icon-btn"
                title="Sell"
                data-action="sell"
                data-id="${item.id}">
                💰
              </button>

              <button
                class="icon-btn"
                title="Edit"
                data-action="edit-stock"
                data-id="${item.id}">
                ✏️
              </button>

              <button
                class="icon-btn"
                title="Delete"
                data-action="delete-stock"
                data-id="${item.id}">
                🗑️
              </button>

            </div>
          </td>

        </tr>
      `;

    }).join("");
}


// ============================================================
// INVENTORY SEARCH
// ============================================================

$("inventorySearch").addEventListener(
  "input",
  renderInventory
);

$("inventoryStatus").addEventListener(
  "change",
  renderInventory
);


// ============================================================
// ADD STOCK BUTTON
// ============================================================

$("addStockBtn").addEventListener(
  "click",
  () => openStockModal()
);


// ============================================================
// STOCK MODAL
// ============================================================

function openStockModal(item = null) {

  $("stockForm").reset();

  $("stockId").value = "";

  $("stockModalTitle").textContent =
    item ? "Edit Stock" : "Add Stock";


  if (item) {

    $("stockId").value = item.id;

    $("stockName").value = item.name || "";

    $("stockCategory").value =
      item.category || "Other";

    $("stockBatch").value =
      item.batch || "";

    $("stockQuantity").value =
      item.quantity ?? 0;

    $("stockUnit").value =
      item.unit || "Bottle";

    $("stockLow").value =
      item.lowStock ?? 5;

    $("stockBuyPrice").value =
      item.purchasePrice ?? 0;

    $("stockSellPrice").value =
      item.sellingPrice ?? 0;

    $("stockSupplier").value =
      item.supplier || "";

    $("stockPurchaseDate").value =
      item.purchaseDate || "";

    $("stockExpiry").value =
      item.expiryDate || "";

    $("stockNotes").value =
      item.notes || "";
  }


  $("stockModal").classList.remove("hidden");
}


document.querySelectorAll("[data-close]").forEach(button => {

  button.addEventListener("click", () => {

    $(button.dataset.close).classList.add("hidden");

  });

});


$("stockModal").addEventListener("click", event => {

  if (event.target === $("stockModal")) {
    $("stockModal").classList.add("hidden");
  }

});


// ============================================================
// SAVE STOCK
// ============================================================

$("stockForm").addEventListener("submit", async event => {

  event.preventDefault();

  if (!state.user) return;


  const id = $("stockId").value.trim();

  const data = {

    name: $("stockName").value.trim(),

    category:
      $("stockCategory").value,

    batch:
      $("stockBatch").value.trim(),

    quantity:
      Number($("stockQuantity").value || 0),

    unit:
      $("stockUnit").value,

    lowStock:
      Number($("stockLow").value || 5),

    purchasePrice:
      Number($("stockBuyPrice").value || 0),

    sellingPrice:
      Number($("stockSellPrice").value || 0),

    supplier:
      $("stockSupplier").value.trim(),

    purchaseDate:
      $("stockPurchaseDate").value,

    expiryDate:
      $("stockExpiry").value,

    notes:
      $("stockNotes").value.trim(),

    updatedAt:
      Date.now()
  };


  if (!data.name) {

    showToast(
      "Medicine name is required.",
      "error"
    );

    return;
  }


  try {

    const inventoryRef =
      collection(
        db,
        "users",
        state.user.uid,
        "inventory"
      );


    if (id) {

      await updateDoc(
        doc(
          db,
          "users",
          state.user.uid,
          "inventory",
          id
        ),
        data
      );

      showToast("Stock updated successfully.");

    } else {

      await addDoc(
        inventoryRef,
        {
          ...data,
          createdAt: Date.now()
        }
      );

      showToast("Stock added successfully.");
    }


    $("stockModal").classList.add("hidden");

  } catch (error) {

    console.error(error);

    showToast(
      "Could not save stock. Check Firestore rules.",
      "error"
    );
  }

});


// ============================================================
// INVENTORY ACTIONS
// ============================================================

$("inventoryTable").addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest("[data-action]");

    if (!button) return;

    const id = button.dataset.id;

    const item =
      state.inventory.find(
        x => x.id === id
      );

    if (!item) return;


    if (button.dataset.action === "edit-stock") {

      openStockModal(item);

      return;
    }


    if (button.dataset.action === "sell") {

      showPage("sale");

      setTimeout(() => {

        $("saleMedicine").value = id;

        updateSaleProductInfo();

      }, 50);

      return;
    }


    if (button.dataset.action === "delete-stock") {

      if (
        !confirm(
          `Delete "${item.name}" from inventory? Sales history will remain safe.`
        )
      ) return;


      try {

        await deleteDoc(
          doc(
            db,
            "users",
            state.user.uid,
            "inventory",
            id
          )
        );

        showToast("Stock deleted.");

      } catch (error) {

        console.error(error);

        showToast(
          "Could not delete stock.",
          "error"
        );
      }
    }

  }
);


// ============================================================
// SALE PRODUCT SELECT
// ============================================================

function populateSaleMedicine() {

  const select = $("saleMedicine");

  if (!select) return;

  const current = select.value;

  const available =
    state.inventory.filter(
      item =>
        Number(item.quantity || 0) > 0 &&
        expiryStatus(item).type !== "expired"
    );


  select.innerHTML = `
    <option value="">Select medicine</option>

    ${available.map(item => `
      <option value="${item.id}">
        ${escapeHTML(item.name)}
        — ${number(item.quantity)}
        ${escapeHTML(item.unit || "")}
      </option>
    `).join("")}
  `;


  if (
    current &&
    available.some(item => item.id === current)
  ) {
    select.value = current;
  }


  updateSaleProductInfo();
}


$("saleMedicine").addEventListener(
  "change",
  updateSaleProductInfo
);


function updateSaleProductInfo() {

  const id = $("saleMedicine").value;

  const item =
    state.inventory.find(
      x => x.id === id
    );


  if (!item) {

    $("availableStock").textContent =
      "Select medicine to see available quantity.";

    $("salePrice").value = "";

    calculateSale();

    return;
  }


  $("availableStock").textContent =
    `Available: ${number(item.quantity)} ${item.unit || ""} • Purchase cost: ${money(item.purchasePrice)} / unit`;

  $("salePrice").value =
    item.sellingPrice ?? 0;

  $("saleQuantity").max =
    Number(item.quantity);

  calculateSale();
}


// ============================================================
// SALE CALCULATOR
// ============================================================

[
  "saleQuantity",
  "salePrice",
  "saleDiscount"
].forEach(id => {

  $(id).addEventListener(
    "input",
    calculateSale
  );

});


function calculateSale() {

  const qty =
    Number($("saleQuantity").value || 0);

  const price =
    Number($("salePrice").value || 0);

  const discount =
    Number($("saleDiscount").value || 0);

  const id =
    $("saleMedicine").value;

  const item =
    state.inventory.find(
      x => x.id === id
    );


  const gross =
    qty * price;

  const total =
    Math.max(0, gross - discount);

  const cost =
    item
      ? qty * Number(item.purchasePrice || 0)
      : 0;

  const profit =
    total - cost;


  $("summaryGross").textContent =
    money(gross);

  $("summaryDiscount").textContent =
    money(discount);

  $("summaryTotal").textContent =
    money(total);

  $("summaryProfit").textContent =
    money(profit);


  $("summaryProfit").classList.toggle(
    "profit-positive",
    profit >= 0
  );

  $("summaryProfit").classList.toggle(
    "profit-negative",
    profit < 0
  );
}


// ============================================================
// COMPLETE SALE
// ============================================================

$("saleForm").addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    if (!state.user) return;


    const inventoryId =
      $("saleMedicine").value;

    const quantity =
      Number($("saleQuantity").value || 0);

    const salePrice =
      Number($("salePrice").value || 0);

    const discount =
      Number($("saleDiscount").value || 0);

    const customerName =
      $("customerName").value.trim() ||
      "Walk-in Customer";

    const customerPhone =
      $("customerPhone").value.trim();

    const paymentStatus =
      $("paymentStatus").value;

    const notes =
      $("saleNotes").value.trim();


    if (!inventoryId) {

      showToast(
        "Please select a medicine.",
        "error"
      );

      return;
    }


    if (quantity <= 0) {

      showToast(
        "Quantity must be greater than zero.",
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


    try {

      await runTransaction(
        db,
        async transaction => {

          const inventoryRef =
            doc(
              db,
              "users",
              state.user.uid,
              "inventory",
              inventoryId
            );


          const stockSnapshot =
            await transaction.get(
              inventoryRef
            );


          if (!stockSnapshot.exists()) {

            throw new Error(
              "Stock item no longer exists."
            );
          }


          const stock =
            stockSnapshot.data();


          const available =
            Number(stock.quantity || 0);


          if (quantity > available) {

            throw new Error(
              `Only ${available} units are available.`
            );
          }


          if (
            stock.expiryDate &&
            daysUntil(stock.expiryDate) < 0
          ) {

            throw new Error(
              "This medicine is expired and cannot be sold."
            );
          }


          const unitCost =
            Number(
              stock.purchasePrice || 0
            );


          const gross =
            quantity * salePrice;


          const finalDiscount =
            Math.min(
              Math.max(discount, 0),
              gross
            );


          const totalSale =
            gross - finalDiscount;


          const totalCost =
            quantity * unitCost;


          const profit =
            totalSale - totalCost;


          const remaining =
            available - quantity;


          const saleRef =
            doc(
              collection(
                db,
                "users",
                state.user.uid,
                "sales"
              )
            );


          const saleData = {

            invoiceNo:
              generateInvoice(),

            inventoryId,

            medicineName:
              stock.name || "",

            category:
              stock.category || "",

            batch:
              stock.batch || "",

            quantity,

            unit:
              stock.unit || "",

            purchasePrice:
              unitCost,

            salePrice,

            discount:
              finalDiscount,

            grossSale:
              gross,

            totalSale,

            totalCost,

            profit,

            customerName,

            customerPhone,

            paymentStatus,

            notes,

            soldAt:
              Date.now()

          };


          transaction.update(
            inventoryRef,
            {
              quantity: remaining,
              updatedAt: Date.now()
            }
          );


          transaction.set(
            saleRef,
            saleData
          );

        }
      );


      showToast(
        "Sale completed successfully. Stock and profit updated."
      );


      $("saleForm").reset();

      $("customerName").value =
        "Walk-in Customer";

      $("saleDiscount").value = "0";

      $("summaryGross").textContent =
        money(0);

      $("summaryDiscount").textContent =
        money(0);

      $("summaryTotal").textContent =
        money(0);

      $("summaryProfit").textContent =
        money(0);

      populateSaleMedicine();


    } catch (error) {

      console.error(error);

      showToast(
        error.message ||
        "Could not complete sale.",
        "error"
      );
    }

  }
);


// ============================================================
// SALES HISTORY
// ============================================================

function renderSales() {

  const tbody = $("salesTable");

  const search =
    ($("historySearch")?.value || "")
      .trim()
      .toLowerCase();

  const from =
    $("historyFrom")?.value || "";

  const to =
    $("historyTo")?.value || "";

  const payment =
    $("historyPayment")?.value || "all";


  let sales =
    [...state.sales];


  if (search) {

    sales =
      sales.filter(sale => {

        const text = [
          sale.invoiceNo,
          sale.medicineName,
          sale.customerName,
          sale.customerPhone,
          sale.batch
        ]
          .join(" ")
          .toLowerCase();

        return text.includes(search);
      });
  }


  if (from) {

    const fromDate =
      new Date(from + "T00:00:00").getTime();

    sales =
      sales.filter(
        sale =>
          Number(sale.soldAt || 0) >= fromDate
      );
  }


  if (to) {

    const toDate =
      new Date(to + "T23:59:59").getTime();

    sales =
      sales.filter(
        sale =>
          Number(sale.soldAt || 0) <= toDate
      );
  }


  if (payment !== "all") {

    sales =
      sales.filter(
        sale =>
          sale.paymentStatus === payment
      );
  }


  if (!sales.length) {

    tbody.innerHTML = "";

    $("salesEmpty").classList.remove("hidden");

    return;
  }


  $("salesEmpty").classList.add("hidden");


  tbody.innerHTML =
    sales.map(sale => {

      const profit =
        Number(sale.profit || 0);

      return `
        <tr>

          <td>${formatDateTime(sale.soldAt)}</td>

          <td>
            <strong>
              ${escapeHTML(sale.invoiceNo || "-")}
            </strong>
          </td>

          <td>
            ${escapeHTML(sale.medicineName || "-")}
            <br>
            <small>Batch: ${escapeHTML(sale.batch || "-")}</small>
          </td>

          <td>
            ${escapeHTML(sale.customerName || "-")}
            <br>
            <small>${escapeHTML(sale.customerPhone || "")}</small>
          </td>

          <td>${number(sale.quantity)}</td>

          <td>
            <strong>${money(sale.totalSale)}</strong>
          </td>

          <td class="${profit >= 0 ? "profit-positive" : "profit-negative"}">
            ${money(profit)}
          </td>

          <td>
            <span class="badge ${
              sale.paymentStatus === "Paid"
                ? "success"
                : sale.paymentStatus === "Pending"
                  ? "danger"
                  : "warning"
            }">
              ${escapeHTML(sale.paymentStatus || "Paid")}
            </span>
          </td>

          <td>

            <button
              class="icon-btn"
              title="Print"
              data-print-sale="${sale.id}">
              🖨️
            </button>

          </td>

        </tr>
      `;

    }).join("");
}


// ============================================================
// HISTORY FILTERS
// ============================================================

[
  "historySearch",
  "historyFrom",
  "historyTo",
  "historyPayment"
].forEach(id => {

  $(id).addEventListener(
    "input",
    renderSales
  );

  $(id).addEventListener(
    "change",
    renderSales
  );

});


// ============================================================
// PRINT SALE
// ============================================================

$("salesTable").addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-print-sale]"
      );

    if (!button) return;

    const sale =
      state.sales.find(
        x => x.id === button.dataset.printSale
      );

    if (sale) {
      printSale(sale);
    }

  }
);


function printSale(sale) {

  const business =
    state.profile.businessName ||
    "Poultry Medicine Business";


  const html = `
<!DOCTYPE html>
<html>
<head>
<title>${escapeHTML(sale.invoiceNo)}</title>

<style>

body {
  font-family: Arial, sans-serif;
  padding: 30px;
  color: #111;
}

.receipt {
  max-width: 600px;
  margin: auto;
}

h1 {
  margin-bottom: 3px;
}

.muted {
  color: #666;
}

hr {
  border: 0;
  border-top: 1px solid #ddd;
  margin: 20px 0;
}

.row {
  display: flex;
  justify-content: space-between;
  padding: 7px 0;
}

.total {
  font-size: 20px;
  font-weight: bold;
}

.profit {
  color: green;
  font-weight: bold;
}

</style>
</head>

<body>

<div class="receipt">

<h1>${escapeHTML(business)}</h1>

<p class="muted">Poultry Medicine Sales Receipt</p>

<hr>

<div class="row">
<strong>Invoice</strong>
<span>${escapeHTML(sale.invoiceNo)}</span>
</div>

<div class="row">
<strong>Date</strong>
<span>${formatDateTime(sale.soldAt)}</span>
</div>

<div class="row">
<strong>Customer</strong>
<span>${escapeHTML(sale.customerName)}</span>
</div>

<div class="row">
<strong>Phone</strong>
<span>${escapeHTML(sale.customerPhone || "-")}</span>
</div>

<hr>

<div class="row">
<strong>Medicine</strong>
<span>${escapeHTML(sale.medicineName)}</span>
</div>

<div class="row">
<strong>Batch</strong>
<span>${escapeHTML(sale.batch || "-")}</span>
</div>

<div class="row">
<strong>Quantity</strong>
<span>${number(sale.quantity)} ${escapeHTML(sale.unit || "")}</span>
</div>

<div class="row">
<strong>Sale Price</strong>
<span>${money(sale.salePrice)}</span>
</div>

<div class="row">
<strong>Gross</strong>
<span>${money(sale.grossSale)}</span>
</div>

<div class="row">
<strong>Discount</strong>
<span>${money(sale.discount)}</span>
</div>

<div class="row total">
<strong>Total</strong>
<span>${money(sale.totalSale)}</span>
</div>

<div class="row profit">
<strong>Profit</strong>
<span>${money(sale.profit)}</span>
</div>

<hr>

<p class="muted">
Payment: ${escapeHTML(sale.paymentStatus || "Paid")}
</p>

<p class="muted">
Thank you for your business.
</p>

</div>

<script>
window.onload = function() {
  window.print();
};
<\/script>

</body>
</html>
`;


  const printWindow =
    window.open(
      "",
      "_blank",
      "width=700,height=800"
    );


  if (!printWindow) {

    showToast(
      "Please allow pop-ups to print receipt.",
      "error"
    );

    return;
  }


  printWindow.document.write(html);
  printWindow.document.close();
}


// ============================================================
// CUSTOMERS
// ============================================================

function renderCustomers() {

  const tbody = $("customersTable");

  const map = new Map();


  state.sales.forEach(sale => {

    const name =
      sale.customerName ||
      "Walk-in Customer";

    const phone =
      sale.customerPhone || "";

    const key =
      `${name.toLowerCase()}|${phone}`;


    if (!map.has(key)) {

      map.set(key, {

        name,

        phone,

        total: 0,

        profit: 0,

        count: 0,

        lastPurchase: 0

      });

    }


    const customer =
      map.get(key);


    customer.total +=
      Number(sale.totalSale || 0);

    customer.profit +=
      Number(sale.profit || 0);

    customer.count++;

    customer.lastPurchase =
      Math.max(
        customer.lastPurchase,
        Number(sale.soldAt || 0)
      );

  });


  const customers =
    [...map.values()].sort(
      (a, b) =>
        b.lastPurchase -
        a.lastPurchase
    );


  if (!customers.length) {

    tbody.innerHTML = "";

    $("customersEmpty").classList.remove("hidden");

    return;
  }


  $("customersEmpty").classList.add("hidden");


  tbody.innerHTML =
    customers.map(customer => {

      return `
        <tr>

          <td>
            <strong>${escapeHTML(customer.name)}</strong>
          </td>

          <td>
            ${escapeHTML(customer.phone || "-")}
          </td>

          <td>
            ${money(customer.total)}
          </td>

          <td class="${
            customer.profit >= 0
              ? "profit-positive"
              : "profit-negative"
          }">
            ${money(customer.profit)}
          </td>

          <td>
            ${number(customer.count)}
          </td>

          <td>
            ${formatDate(customer.lastPurchase)}
          </td>

        </tr>
      `;

    }).join("");
}


// ============================================================
// REPORTS
// ============================================================

function renderReports() {

  const stats =
    getSalesStats();


  const inventoryValue =
    state.inventory.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
        Number(item.purchasePrice || 0),
      0
    );


  $("reportTodayProfit").textContent =
    money(stats.todayProfit);

  $("reportMonthProfit").textContent =
    money(stats.monthProfit);

  $("reportYearProfit").textContent =
    money(stats.yearProfit);

  $("reportInventoryValue").textContent =
    money(inventoryValue);


  $("reportTodaySales").textContent =
    `${stats.todayCount} sales`;

  $("reportMonthSales").textContent =
    `${stats.monthCount} sales`;

  $("reportYearSales").textContent =
    `${stats.yearCount} sales`;


  renderTopProducts();
  renderSevenDays();
}


function renderTopProducts() {

  const container =
    $("topProducts");


  const map = new Map();


  state.sales.forEach(sale => {

    const name =
      sale.medicineName || "Unknown";

    if (!map.has(name)) {

      map.set(name, {
        profit: 0,
        quantity: 0,
        sales: 0
      });

    }


    const item =
      map.get(name);

    item.profit +=
      Number(sale.profit || 0);

    item.quantity +=
      Number(sale.quantity || 0);

    item.sales++;

  });


  const products =
    [...map.entries()]
      .sort(
        (a, b) =>
          b[1].profit -
          a[1].profit
      )
      .slice(0, 7);


  if (!products.length) {

    container.innerHTML = `
      <div class="empty-small">
        No sales data available.
      </div>
    `;

    return;
  }


  container.innerHTML =
    products.map(
      ([name, data], index) => {

        return `
          <div class="report-product">

            <div>
              <strong>
                ${index + 1}. ${escapeHTML(name)}
              </strong>

              <span>
                ${number(data.quantity)} units •
                ${number(data.sales)} sales
              </span>
            </div>

            <strong class="${
              data.profit >= 0
                ? "profit-positive"
                : "profit-negative"
            }">
              ${money(data.profit)}
            </strong>

          </div>
        `;

      }
    ).join("");
}


function renderSevenDays() {

  const container =
    $("sevenDayReport");


  const days = [];


  for (let i = 6; i >= 0; i--) {

    const date = new Date();

    date.setHours(0, 0, 0, 0);

    date.setDate(
      date.getDate() - i
    );


    const profit =
      state.sales
        .filter(sale => sameDay(sale.soldAt, date))
        .reduce(
          (sum, sale) =>
            sum + Number(sale.profit || 0),
          0
        );


    days.push({
      date,
      profit
    });

  }


  const max =
    Math.max(
      ...days.map(x => Math.max(x.profit, 0)),
      1
    );


  container.innerHTML =
    days.map(day => {

      const width =
        Math.max(
          3,
          (Math.max(day.profit, 0) / max) * 100
        );


      return `
        <div class="day-bar">

          <label>
            ${day.date.toLocaleDateString(
              "en-PK",
              { weekday: "short" }
            )}
          </label>

          <div class="bar-bg">
            <div
              class="bar"
              style="width:${width}%">
            </div>
          </div>

          <strong>
            ${money(day.profit)}
          </strong>

        </div>
      `;

    }).join("");
}


// ============================================================
// QUICK SALE
// ============================================================

$("quickSaleBtn").addEventListener(
  "click",
  () => showPage("sale")
);


// ============================================================
// EXPORT SALES CSV
// ============================================================

$("exportSalesBtn").addEventListener(
  "click",
  exportSalesCSV
);


function csvEscape(value) {

  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}


function downloadFile(
  filename,
  content,
  type = "text/plain"
) {

  const blob =
    new Blob(
      [content],
      { type }
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


function exportSalesCSV() {

  const headers = [
    "Date",
    "Invoice",
    "Medicine",
    "Category",
    "Batch",
    "Quantity",
    "Unit Cost",
    "Sale Price",
    "Discount",
    "Total Sale",
    "Total Cost",
    "Profit",
    "Customer",
    "Phone",
    "Payment"
  ];


  const rows =
    state.sales.map(sale => [

      formatDateTime(sale.soldAt),

      sale.invoiceNo,

      sale.medicineName,

      sale.category,

      sale.batch,

      sale.quantity,

      sale.purchasePrice,

      sale.salePrice,

      sale.discount,

      sale.totalSale,

      sale.totalCost,

      sale.profit,

      sale.customerName,

      sale.customerPhone,

      sale.paymentStatus

    ]);


  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row.map(csvEscape).join(",")
    )
    .join("\n");


  downloadFile(
    `poultry-sales-${todayISO()}.csv`,
    csv,
    "text/csv;charset=utf-8;"
  );


  showToast("Sales CSV exported.");
}


// ============================================================
// EXPORT COMPLETE JSON
// ============================================================

$("exportAllBtn").addEventListener(
  "click",
  exportCompleteBackup
);

$("settingsExportBtn").addEventListener(
  "click",
  exportCompleteBackup
);


function exportCompleteBackup() {

  const backup = {

    exportedAt:
      new Date().toISOString(),

    profile:
      state.profile,

    inventory:
      state.inventory,

    sales:
      state.sales

  };


  downloadFile(
    `poultry-manager-backup-${todayISO()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json"
  );


  showToast(
    "Complete backup downloaded."
  );
}


// ============================================================
// DARK MODE
// ============================================================

function applyTheme() {

  const dark =
    localStorage.getItem(
      "poultryDarkMode"
    ) === "true";

  document.body.classList.toggle(
    "dark",
    dark
  );

  $("darkModeToggle").checked =
    dark;
}


$("darkModeToggle").addEventListener(
  "change",
  event => {

    const dark =
      event.target.checked;

    localStorage.setItem(
      "poultryDarkMode",
      dark
    );

    applyTheme();

  }
);


// ============================================================
// STOCK DATE DEFAULTS
// ============================================================

function setDefaultStockDates() {

  if (!$("stockPurchaseDate").value) {

    $("stockPurchaseDate").value =
      todayISO();
  }

}


$("addStockBtn").addEventListener(
  setDefaultStockDates
);


// ============================================================
// INITIAL
// ============================================================

window.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {

      $("stockModal").classList.add(
        "hidden"
      );

      $("sidebar").classList.remove(
        "open"
      );

    }

  }
);
