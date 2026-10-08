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


/* =====================================================
   FIREBASE
===================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCkyj91iDkxfyFq3ErGucMykxB6h0trplM",
  authDomain: "poultry-medicine-manager-93b79.firebaseapp.com",
  projectId: "poultry-medicine-manager-93b79",
  storageBucket: "poultry-medicine-manager-93b79.firebasestorage.app",
  messagingSenderId: "623127969077",
  appId: "1:623127969077:web:e7e4e4b8a2e25fc4e249607c"
};

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

await setPersistence(auth, browserLocalPersistence);


/* =====================================================
   STATE
===================================================== */

let currentUser = null;
let inventory = [];
let sales = [];
let unsubInventory = null;
let unsubSales = null;

let currentInvoice = null;


/* =====================================================
   DOM HELPERS
===================================================== */

const $ = id => document.getElementById(id);

const money = value => {
  return "Rs. " + Number(value || 0).toLocaleString("en-PK", {
    maximumFractionDigits: 2
  });
};

const todayString = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const escapeHTML = value => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const showToast = (message, type = "success") => {

  const toast = document.createElement("div");

  toast.className = `toast ${type}`;

  toast.textContent = message;

  $("toastContainer").appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
};


const showModal = id => {
  $(id).classList.remove("hidden");
};

const hideModal = id => {
  $(id).classList.add("hidden");
};


/* =====================================================
   AUTH
===================================================== */

function setAuthLoading(button, loading, normalText) {

  if (!button) return;

  button.disabled = loading;

  button.textContent = loading
    ? normalText + "..."
    : normalText;
}


/* Login */

$("loginForm").addEventListener("submit", async e => {

  e.preventDefault();

  const btn = $("loginBtn");

  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;

  try {

    setAuthLoading(btn, true, "Logging in");

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showToast("Login successful.");

  } catch (error) {

    showToast(firebaseError(error), "error");

  } finally {

    setAuthLoading(btn, false, "Logging in");

  }

});


/* Register */

$("registerForm").addEventListener("submit", async e => {

  e.preventDefault();

  const btn = $("registerBtn");

  const name = $("registerName").value.trim();
  const business = $("registerBusiness").value.trim();
  const email = $("registerEmail").value.trim();
  const password = $("registerPassword").value;

  try {

    setAuthLoading(btn, true, "Creating");

    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(result.user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", result.user.uid),
      {
        name,
        businessName: business,
        email,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      { merge: true }
    );

    showToast("Account created successfully.");

  } catch (error) {

    showToast(firebaseError(error), "error");

  } finally {

    setAuthLoading(btn, false, "Create Account");

  }

});


/* Google */

async function googleLogin() {

  try {

    await signInWithPopup(
      auth,
      googleProvider
    );

    showToast("Google login successful.");

  } catch (error) {

    showToast(firebaseError(error), "error");

  }

}

$("googleLoginBtn").addEventListener("click", googleLogin);

$("googleRegisterBtn").addEventListener("click", googleLogin);


/* Auth switch */

$("showRegisterBtn").addEventListener("click", () => {

  $("loginBox").classList.add("hidden");
  $("registerBox").classList.remove("hidden");

});

$("showLoginBtn").addEventListener("click", () => {

  $("registerBox").classList.add("hidden");
  $("loginBox").classList.remove("hidden");

});


/* Password visibility */

document.querySelectorAll(".password-toggle").forEach(btn => {

  btn.addEventListener("click", () => {

    const target = $(btn.dataset.target);

    target.type =
      target.type === "password"
        ? "text"
        : "password";

  });

});


/* Firebase error messages */

function firebaseError(error) {

  const code = error?.code || "";

  const messages = {

    "auth/api-key-not-valid":
      "Firebase API key invalid hai. Firebase Console se current Web App config check karein.",

    "auth/invalid-api-key":
      "Firebase API key invalid hai.",

    "auth/email-already-in-use":
      "Ye email already registered hai.",

    "auth/invalid-email":
      "Email address invalid hai.",

    "auth/weak-password":
      "Password kam az kam 6 characters ka hona chahiye.",

    "auth/invalid-credential":
      "Email ya password incorrect hai.",

    "auth/user-not-found":
      "Is email ka account nahi mila.",

    "auth/wrong-password":
      "Password incorrect hai.",

    "auth/operation-not-allowed":
      "Firebase Authentication mein ye login method enable nahi hai.",

    "auth/unauthorized-domain":
      "Ye website domain Firebase Authentication ke Authorized Domains mein add nahi hai.",

    "auth/popup-blocked":
      "Google login popup browser ne block kar diya.",

    "auth/popup-closed-by-user":
      "Google login popup close kar diya gaya.",

    "auth/network-request-failed":
      "Internet connection check karein."

  };

  return messages[code] ||
    error?.message ||
    "Something went wrong.";
}


/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(auth, async user => {

  currentUser = user;

  if (!user) {

    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");

    cleanupListeners();

    return;
  }

  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  await ensureUserProfile(user);

  setupUserUI(user);

  startRealtimeData();

});


/* =====================================================
   USER PROFILE
===================================================== */

async function ensureUserProfile(user) {

  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {

    await setDoc(userRef, {

      name: user.displayName || "User",

      businessName:
        user.displayName
          ? `${user.displayName}'s Business`
          : "Poultry Medicine Business",

      email: user.email || "",

      photoURL: user.photoURL || "",

      createdAt: Date.now(),

      updatedAt: Date.now()

    });

  } else {

    await setDoc(
      userRef,
      {
        email: user.email || "",
        name: user.displayName || snapshot.data().name || "User",
        photoURL: user.photoURL || "",
        updatedAt: Date.now()
      },
      { merge: true }
    );

  }

}


function setupUserUI(user) {

  const name =
    user.displayName ||
    user.email?.split("@")[0] ||
    "User";

  const email =
    user.email ||
    "";

  const initial =
    name.charAt(0).toUpperCase();

  $("profileName").textContent = name;
  $("profileEmail").textContent = email;

  $("dropdownName").textContent = name;
  $("dropdownEmail").textContent = email;

  $("welcomeName").textContent = name;

  $("settingsName").textContent = name;
  $("settingsEmail").textContent = email;

  $("profileAvatar").textContent = initial;
  $("settingsAvatar").textContent = initial;

  $("settingsBusiness").textContent =
    "Poultry Medicine Business";

}


/* =====================================================
   REALTIME DATA
===================================================== */

function startRealtimeData() {

  cleanupListeners();

  const inventoryRef =
    collection(
      db,
      "users",
      currentUser.uid,
      "inventory"
    );

  const salesRef =
    collection(
      db,
      "users",
      currentUser.uid,
      "sales"
    );


  unsubInventory = onSnapshot(
    inventoryRef,
    snapshot => {

      inventory =
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      renderAll();

    },
    error => {

      console.error(error);

      showToast(
        "Inventory data load nahi ho raha.",
        "error"
      );

    }
  );


  unsubSales = onSnapshot(
    salesRef,
    snapshot => {

      sales =
        snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

      renderAll();

    },
    error => {

      console.error(error);

      showToast(
        "Sales data load nahi ho raha.",
        "error"
      );

    }
  );

}


function cleanupListeners() {

  if (unsubInventory) {
    unsubInventory();
    unsubInventory = null;
  }

  if (unsubSales) {
    unsubSales();
    unsubSales = null;
  }

}


/* =====================================================
   NAVIGATION
===================================================== */

function navigate(page) {

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active-page");
  });

  const target = $("page-" + page);

  if (target) {
    target.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(item => {

    item.classList.toggle(
      "active",
      item.dataset.page === page
    );

  });

  const titles = {

    dashboard: [
      "Dashboard",
      "Overview of your medicine business"
    ],

    inventory: [
      "Inventory",
      "Manage medicines and batches"
    ],

    sales: [
      "Sales",
      "Sales history, invoices and profit"
    ],

    customers: [
      "Customers",
      "Customer purchase history"
    ],

    salesmen: [
      "Salesmen & Delivery",
      "Track delivery performance"
    ],

    reports: [
      "Reports",
      "Business performance and profit"
    ],

    settings: [
      "Settings",
      "Manage your account"
    ]

  };

  if (titles[page]) {

    $("pageTitle").textContent =
      titles[page][0];

    $("pageSubtitle").textContent =
      titles[page][1];

  }

  $("sidebar").classList.remove("open");

  $("profileDropdown").classList.add("hidden");

}


/* Navigation clicks */

document.querySelectorAll("[data-page]").forEach(element => {

  element.addEventListener("click", () => {

    const page = element.dataset.page;

    if (page) {
      navigate(page);
    }

  });

});


$("mobileMenuBtn").addEventListener("click", () => {

  $("sidebar").classList.toggle("open");

});


$("profileBtn").addEventListener("click", () => {

  $("profileDropdown").classList.toggle("hidden");

});


/* =====================================================
   DASHBOARD FILTER CARDS
===================================================== */

document.querySelectorAll("[data-dashboard-filter]").forEach(element => {

  element.addEventListener("click", () => {

    const filter = element.dataset.dashboardFilter;

    if (filter === "sales") {

      navigate("sales");

      $("salesPeriod").value = "all";

      renderSales();

      return;

    }

    navigate("inventory");

    $("inventoryFilter").value =
      filter === "all" ? "all" : filter;

    renderInventory();

  });

});


/* =====================================================
   STOCK MODAL
===================================================== */

function openStockModal(id = null) {

  $("stockForm").reset();

  $("stockId").value = "";

  $("stockModalTitle").textContent =
    id ? "Edit Medicine" : "Add Medicine";

  $("purchaseDate").value =
    todayString();

  $("minStock").value = 20;

  if (id) {

    const item =
      inventory.find(x => x.id === id);

    if (!item) return;

    $("stockId").value = item.id;

    $("medicineName").value = item.name || "";
    $("medicineCategory").value = item.category || "";
    $("batchNumber").value = item.batchNumber || "";
    $("manufacturer").value = item.manufacturer || "";
    $("supplier").value = item.supplier || "";
    $("purchaseDate").value = item.purchaseDate || "";
    $("expiryDate").value = item.expiryDate || "";
    $("quantity").value = item.quantity ?? "";
    $("unit").value = item.unit || "Bottles";
    $("buyPrice").value = item.buyPrice ?? "";
    $("salePrice").value = item.salePrice ?? "";
    $("minStock").value = item.minStock ?? 20;
    $("stockNotes").value = item.notes || "";

  }

  showModal("stockModal");

}


$("inventoryAddBtn").addEventListener(
  "click",
  () => openStockModal()
);

$("dashboardAddStockBtn").addEventListener(
  "click",
  () => openStockModal()
);

$("quickAddStock").addEventListener(
  "click",
  () => openStockModal()
);


/* Save inventory */

$("stockForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!currentUser) return;

  const id = $("stockId").value;

  const data = {

    name: $("medicineName").value.trim(),

    category:
      $("medicineCategory").value.trim(),

    batchNumber:
      $("batchNumber").value.trim(),

    manufacturer:
      $("manufacturer").value.trim(),

    supplier:
      $("supplier").value.trim(),

    purchaseDate:
      $("purchaseDate").value,

    expiryDate:
      $("expiryDate").value,

    quantity:
      Number($("quantity").value),

    unit:
      $("unit").value,

    buyPrice:
      Number($("buyPrice").value),

    salePrice:
      Number($("salePrice").value),

    minStock:
      Number($("minStock").value || 20),

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

      showToast("Medicine updated.");

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

      showToast("Medicine added successfully.");

    }

    hideModal("stockModal");

  } catch (error) {

    console.error(error);

    showToast(
      "Medicine save nahi ho saki.",
      "error"
    );

  }

});


/* =====================================================
   INVENTORY
===================================================== */

function getInventoryStatus(item) {

  const qty = Number(item.quantity || 0);

  if (qty <= 0) {
    return "out";
  }

  if (isExpired(item.expiryDate)) {
    return "expired";
  }

  if (isExpirySoon(item.expiryDate)) {
    return "soon";
  }

  if (qty <= Number(item.minStock || 20)) {
    return "low";
  }

  return "good";

}


function isExpired(date) {

  if (!date) return false;

  return date <
    todayString();

}


function daysUntil(date) {

  if (!date) return Infinity;

  const now =
    new Date(todayString() + "T00:00:00");

  const target =
    new Date(date + "T00:00:00");

  return Math.ceil(
    (target - now) / 86400000
  );

}


function isExpirySoon(date) {

  const days = daysUntil(date);

  return days >= 0 && days <= 30;

}


function statusHTML(item) {

  const status =
    getInventoryStatus(item);

  const labels = {

    good: "IN STOCK",
    low: "LOW STOCK",
    out: "OUT OF STOCK",
    expired: "EXPIRED",
    soon: "EXPIRING SOON"

  };

  return `
    <span class="status-badge status-${status}">
      ${labels[status]}
    </span>
  `;

}


function renderInventory() {

  const search =
    $("inventorySearch").value
      .trim()
      .toLowerCase();

  const filter =
    $("inventoryFilter").value;

  const category =
    $("inventoryCategory").value;


  let list = [...inventory];


  if (search) {

    list = list.filter(item => {

      return [
        item.name,
        item.batchNumber,
        item.supplier,
        item.manufacturer,
        item.category
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    });

  }


  if (filter !== "all") {

    list = list.filter(
      item =>
        getInventoryStatus(item) === filter
    );

  }


  if (category !== "all") {

    list = list.filter(
      item =>
        item.category === category
    );

  }


  const container =
    $("inventoryTable");


  if (!list.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <strong>No medicines found</strong>
        <span>Try changing your filters.</span>
      </div>
    `;

    return;

  }


  container.innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Medicine</th>
          <th>Batch</th>
          <th>Category</th>
          <th>Quantity</th>
          <th>Buy Price</th>
          <th>Sale Price</th>
          <th>Expiry</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        ${list.map(item => `

          <tr>

            <td>
              <strong>${escapeHTML(item.name)}</strong>
              <small>${escapeHTML(item.supplier || "")}</small>
            </td>

            <td>${escapeHTML(item.batchNumber)}</td>

            <td>${escapeHTML(item.category)}</td>

            <td>
              ${Number(item.quantity || 0)}
              ${escapeHTML(item.unit || "")}
            </td>

            <td>${money(item.buyPrice)}</td>

            <td>${money(item.salePrice)}</td>

            <td>${escapeHTML(item.expiryDate)}</td>

            <td>${statusHTML(item)}</td>

            <td>

              <div class="action-buttons">

                <button
                  class="icon-action"
                  title="Sell"
                  data-sale-item="${item.id}"
                >
                  💰
                </button>

                <button
                  class="icon-action"
                  title="Edit"
                  data-edit-item="${item.id}"
                >
                  ✏️
                </button>

                <button
                  class="icon-action delete"
                  title="Delete"
                  data-delete-item="${item.id}"
                >
                  🗑
                </button>

              </div>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;


  container
    .querySelectorAll("[data-edit-item]")
    .forEach(btn => {

      btn.addEventListener("click", () => {

        openStockModal(
          btn.dataset.editItem
        );

      });

    });


  container
    .querySelectorAll("[data-sale-item]")
    .forEach(btn => {

      btn.addEventListener("click", () => {

        openSaleModal(
          btn.dataset.saleItem
        );

      });

    });


  container
    .querySelectorAll("[data-delete-item]")
    .forEach(btn => {

      btn.addEventListener("click", async () => {

        const id =
          btn.dataset.deleteItem;

        if (!confirm(
          "Delete this medicine permanently?"
        )) return;

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

          showToast("Medicine deleted.");

        } catch (error) {

          showToast(
            "Delete failed.",
            "error"
          );

        }

      });

    });

}


/* Inventory filters */

$("inventorySearch").addEventListener(
  "input",
  renderInventory
);

$("inventoryFilter").addEventListener(
  "change",
  renderInventory
);

$("inventoryCategory").addEventListener(
  "change",
  renderInventory
);


/* Categories */

function renderCategories() {

  const categories =
    [...new Set(
      inventory
        .map(x => x.category)
        .filter(Boolean)
    )]
    .sort();

  $("inventoryCategory").innerHTML = `
    <option value="all">All Categories</option>

    ${categories.map(category => `
      <option value="${escapeHTML(category)}">
        ${escapeHTML(category)}
      </option>
    `).join("")}
  `;

}


/* =====================================================
   SALES MODAL
===================================================== */

function generateInvoiceNumber() {

  const number =
    String(Date.now()).slice(-6);

  return "PM-" + number;

}


function openSaleModal(itemId = null) {

  $("saleForm").reset();

  $("deliveryDate").value =
    todayString();

  $("invoiceNumber").value =
    generateInvoiceNumber();

  populateSaleInventory(itemId);

  updateSalePreview();

  showModal("saleModal");

}


function populateSaleInventory(selectedId = null) {

  const options =
    inventory
      .filter(item => Number(item.quantity || 0) > 0)
      .filter(item => !isExpired(item.expiryDate))
      .map(item => `

        <option
          value="${item.id}"
          ${selectedId === item.id ? "selected" : ""}
        >
          ${escapeHTML(item.name)}
          | Batch: ${escapeHTML(item.batchNumber)}
          | Stock: ${item.quantity} ${escapeHTML(item.unit || "")}
        </option>

      `)
      .join("");

  $("saleInventory").innerHTML = `

    <option value="">
      Select medicine
    </option>

    ${options}

  `;

  updateSelectedSaleItem();

}


$("saleInventory").addEventListener(
  "change",
  updateSelectedSaleItem
);


function updateSelectedSaleItem() {

  const id =
    $("saleInventory").value;

  const item =
    inventory.find(x => x.id === id);

  if (!item) {

    $("availableStock").textContent = "";

    $("saleUnitPrice").value = "";

    return;

  }

  $("availableStock").textContent =
    `Available: ${item.quantity} ${item.unit || ""}`;

  $("saleUnitPrice").value =
    item.salePrice || 0;

  updateSalePreview();

}


$("saleQuantity").addEventListener(
  "input",
  updateSalePreview
);

$("saleUnitPrice").addEventListener(
  "input",
  updateSalePreview
);

$("saleDiscount").addEventListener(
  "input",
  updateSalePreview
);


function calculateSaleTotals() {

  const quantity =
    Number($("saleQuantity").value || 0);

  const price =
    Number($("saleUnitPrice").value || 0);

  const discount =
    Number($("saleDiscount").value || 0);

  const subtotal =
    quantity * price;

  const total =
    Math.max(
      0,
      subtotal - discount
    );

  return {
    quantity,
    price,
    discount,
    subtotal,
    total
  };

}


function updateSalePreview() {

  const totals =
    calculateSaleTotals();

  $("saleSubtotal").textContent =
    money(totals.subtotal);

  $("saleDiscountPreview").textContent =
    money(totals.discount);

  $("saleGrandTotal").textContent =
    money(totals.total);

}


/* =====================================================
   COMPLETE SALE
===================================================== */

$("saleForm").addEventListener("submit", async e => {

  e.preventDefault();

  if (!currentUser) return;

  const inventoryId =
    $("saleInventory").value;

  if (!inventoryId) {

    showToast(
      "Medicine select karein.",
      "error"
    );

    return;

  }


  const quantity =
    Number($("saleQuantity").value);

  const salePrice =
    Number($("saleUnitPrice").value);

  const discount =
    Number($("saleDiscount").value || 0);

  const customer =
    $("customerName").value.trim();

  const totals =
    calculateSaleTotals();


  if (quantity <= 0) {

    showToast(
      "Quantity valid honi chahiye.",
      "error"
    );

    return;

  }


  if (salePrice < 0) {

    showToast(
      "Sale price invalid hai.",
      "error"
    );

    return;

  }


  try {

    const inventoryRef =
      doc(
        db,
        "users",
        currentUser.uid,
        "inventory",
        inventoryId
      );


    const salesCollection =
      collection(
        db,
        "users",
        currentUser.uid,
        "sales"
      );


    const saleRef =
      doc(salesCollection);


    await runTransaction(
      db,
      async transaction => {

        const stockSnapshot =
          await transaction.get(
            inventoryRef
          );


        if (!stockSnapshot.exists()) {

          throw new Error(
            "Medicine not found."
          );

        }


        const item =
          stockSnapshot.data();


        const currentQty =
          Number(item.quantity || 0);


        if (quantity > currentQty) {

          throw new Error(
            `Only ${currentQty} ${item.unit || ""} available hai.`
          );

        }


        const remaining =
          currentQty - quantity;


        const costPerUnit =
          Number(item.buyPrice || 0);


        const totalCost =
          costPerUnit * quantity;


        const profit =
          totals.total - totalCost;


        transaction.update(
          inventoryRef,
          {
            quantity: remaining,
            updatedAt: Date.now()
          }
        );


        transaction.set(
          saleRef,
          {

            invoiceNumber:
              $("invoiceNumber").value,

            inventoryId,

            medicineName:
              item.name || "",

            category:
              item.category || "",

            batchNumber:
              item.batchNumber || "",

            customerName:
              customer,

            customerPhone:
              $("customerPhone").value.trim(),

            salesmanName:
              $("salesmanName").value.trim(),

            salesmanPhone:
              $("salesmanPhone").value.trim(),

            quantity,

            unit:
              item.unit || "",

            buyPrice:
              costPerUnit,

            salePrice:

              salePrice,

            subtotal:
              totals.subtotal,

            discount,

            total:
              totals.total,

            profit,

            deliveryDate:
              $("deliveryDate").value,

            paymentStatus:
              $("paymentStatus").value,

            paidAmount:
              Number($("paidAmount").value || 0),

            remainingAmount:
              Math.max(
                0,
                totals.total -
                Number($("paidAmount").value || 0)
              ),

            notes:
              $("saleNotes").value.trim(),

            createdAt:
              Date.now()

          }
        );

      }
    );


    currentInvoice = {

      invoiceNumber:
        $("invoiceNumber").value,

      medicineName:
        inventory.find(
          x => x.id === inventoryId
        )?.name || "",

      batchNumber:
        inventory.find(
          x => x.id === inventoryId
        )?.batchNumber || "",

      customerName:
        customer,

      customerPhone:
        $("customerPhone").value.trim(),

      salesmanName:
        $("salesmanName").value.trim(),

      salesmanPhone:
        $("salesmanPhone").value.trim(),

      quantity,

      unit:
        inventory.find(
          x => x.id === inventoryId
        )?.unit || "",

      salePrice,

      subtotal:
        totals.subtotal,

      discount,

      total:
        totals.total,

      paidAmount:
        Number($("paidAmount").value || 0),

      remainingAmount:
        Math.max(
          0,
          totals.total -
          Number($("paidAmount").value || 0)
        ),

      deliveryDate:
        $("deliveryDate").value

    };


    hideModal("saleModal");

    showToast(
      "Sale completed successfully."
    );

    renderInvoice(currentInvoice);

    showModal("invoiceModal");


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Sale complete nahi ho saki.",
      "error"
    );

  }

});


$("quickSaleBtn").addEventListener(
  "click",
  () => openSaleModal()
);

$("quickNewSale").addEventListener(
  "click",
  () => openSaleModal()
);

$("salesNewBtn").addEventListener(
  "click",
  () => openSaleModal()
);


/* =====================================================
   SALES RENDER
===================================================== */

function renderSales() {

  const search =
    $("salesSearch").value
      .trim()
      .toLowerCase();

  const period =
    $("salesPeriod").value;


  let list =
    [...sales]
      .sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      );


  if (search) {

    list = list.filter(sale => {

      return [
        sale.medicineName,
        sale.customerName,
        sale.salesmanName,
        sale.invoiceNumber,
        sale.batchNumber
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);

    });

  }


  const today =
    todayString();

  if (period === "today") {

    list =
      list.filter(
        x =>
          x.deliveryDate === today
      );

  }


  if (period === "month") {

    const prefix =
      today.slice(0, 7);

    list =
      list.filter(
        x =>
          String(x.deliveryDate || "")
            .startsWith(prefix)
      );

  }


  if (period === "year") {

    const prefix =
      today.slice(0, 4);

    list =
      list.filter(
        x =>
          String(x.deliveryDate || "")
            .startsWith(prefix)
      );

  }


  if (!list.length) {

    $("salesTable").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <strong>No sales found</strong>
        <span>Sales will appear here after completing a sale.</span>
      </div>
    `;

    return;

  }


  $("salesTable").innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Invoice</th>
          <th>Date</th>
          <th>Medicine</th>
          <th>Customer</th>
          <th>Salesman</th>
          <th>Qty</th>
          <th>Total</th>
          <th>Profit</th>
          <th>Payment</th>
          <th>Action</th>
        </tr>

      </thead>

      <tbody>

        ${list.map(sale => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(sale.invoiceNumber)}
              </strong>
            </td>

            <td>
              ${escapeHTML(sale.deliveryDate)}
            </td>

            <td>
              ${escapeHTML(sale.medicineName)}
              <small>
                ${escapeHTML(sale.batchNumber)}
              </small>
            </td>

            <td>
              ${escapeHTML(sale.customerName)}
              <small>
                ${escapeHTML(sale.customerPhone || "")}
              </small>
            </td>

            <td>
              ${escapeHTML(sale.salesmanName || "-")}
            </td>

            <td>
              ${sale.quantity}
              ${escapeHTML(sale.unit || "")}
            </td>

            <td>
              ${money(sale.total)}
            </td>

            <td>
              <strong>
                ${money(sale.profit)}
              </strong>
            </td>

            <td>
              ${paymentBadge(sale.paymentStatus)}
            </td>

            <td>

              <button
                class="icon-action"
                data-print-sale="${sale.id}"
                title="Invoice"
              >
                🧾
              </button>

            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;


  $("salesTable")
    .querySelectorAll("[data-print-sale]")
    .forEach(btn => {

      btn.addEventListener("click", () => {

        const sale =
          sales.find(
            x =>
              x.id === btn.dataset.printSale
          );

        if (!sale) return;

        currentInvoice =
          invoiceFromSale(sale);

        renderInvoice(currentInvoice);

        showModal("invoiceModal");

      });

    });

}


function paymentBadge(status) {

  const labels = {

    paid: "PAID",
    partial: "PARTIAL",
    unpaid: "UNPAID"

  };

  return `
    <span class="status-badge ${
      status === "paid"
        ? "status-good"
        : status === "partial"
          ? "status-soon"
          : "status-expired"
    }">
      ${labels[status] || "UNKNOWN"}
    </span>
  `;

}


$("salesSearch").addEventListener(
  "input",
  renderSales
);

$("salesPeriod").addEventListener(
  "change",
  renderSales
);


/* =====================================================
   CUSTOMER DATA
===================================================== */

function getCustomers() {

  const map = new Map();


  sales.forEach(sale => {

    const name =
      sale.customerName?.trim();

    if (!name) return;

    const key =
      name.toLowerCase();


    if (!map.has(key)) {

      map.set(key, {

        name,

        phone:
          sale.customerPhone || "",

        sales: 0,

        quantity: 0,

        profit: 0,

        lastDate:
          sale.deliveryDate || ""

      });

    }


    const customer =
      map.get(key);


    customer.sales +=
      Number(sale.total || 0);

    customer.quantity +=
      Number(sale.quantity || 0);

    customer.profit +=
      Number(sale.profit || 0);


    if (
      String(sale.deliveryDate || "") >
      String(customer.lastDate || "")
    ) {

      customer.lastDate =
        sale.deliveryDate;

    }

  });


  return [...map.values()];

}


function renderCustomers() {

  const search =
    $("customerSearch").value
      .trim()
      .toLowerCase();


  let list =
    getCustomers();


  if (search) {

    list =
      list.filter(customer =>
        `${customer.name} ${customer.phone}`
          .toLowerCase()
          .includes(search)
      );

  }


  if (!list.length) {

    $("customersGrid").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <strong>No customers found</strong>
      </div>
    `;

    return;

  }


  $("customersGrid").innerHTML =

    list.map(customer => `

      <div class="person-card">

        <div class="person-top">

          <div class="person-avatar">
            ${escapeHTML(
              customer.name.charAt(0).toUpperCase()
            )}
          </div>

          <div>
            <h3>
              ${escapeHTML(customer.name)}
            </h3>

            <small>
              ${escapeHTML(customer.phone || "No phone")}
            </small>
          </div>

        </div>


        <div class="person-stats">

          <div class="person-stat">
            <span>Total Purchases</span>
            <strong>${money(customer.sales)}</strong>
          </div>

          <div class="person-stat">
            <span>Quantity</span>
            <strong>${customer.quantity}</strong>
          </div>

          <div class="person-stat">
            <span>Profit</span>
            <strong>${money(customer.profit)}</strong>
          </div>

          <div class="person-stat">
            <span>Last Purchase</span>
            <strong>${escapeHTML(customer.lastDate)}</strong>
          </div>

        </div>

      </div>

    `).join("");

}


$("customerSearch").addEventListener(
  "input",
  renderCustomers
);


/* =====================================================
   SALESMEN
===================================================== */

function getSalesmen() {

  const map = new Map();


  sales.forEach(sale => {

    const name =
      sale.salesmanName?.trim();

    if (!name) return;


    const key =
      name.toLowerCase();


    if (!map.has(key)) {

      map.set(key, {

        name,

        phone:
          sale.salesmanPhone || "",

        deliveries: 0,

        quantity: 0,

        sales: 0,

        profit: 0

      });

    }


    const person =
      map.get(key);


    person.deliveries++;

    person.quantity +=
      Number(sale.quantity || 0);

    person.sales +=
      Number(sale.total || 0);

    person.profit +=
      Number(sale.profit || 0);

  });


  return [...map.values()];

}


function renderSalesmen() {

  const search =
    $("salesmanSearch").value
      .trim()
      .toLowerCase();


  let list =
    getSalesmen();


  if (search) {

    list =
      list.filter(person =>
        `${person.name} ${person.phone}`
          .toLowerCase()
          .includes(search)
      );

  }


  if (!list.length) {

    $("salesmenGrid").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🚚</div>
        <strong>No salesman records found</strong>
      </div>
    `;

    return;

  }


  $("salesmenGrid").innerHTML =

    list.map(person => `

      <div class="person-card">

        <div class="person-top">

          <div class="person-avatar">
            🚚
          </div>

          <div>
            <h3>
              ${escapeHTML(person.name)}
            </h3>

            <small>
              ${escapeHTML(person.phone || "No phone")}
            </small>
          </div>

        </div>


        <div class="person-stats">

          <div class="person-stat">
            <span>Deliveries</span>
            <strong>${person.deliveries}</strong>
          </div>

          <div class="person-stat">
            <span>Quantity</span>
            <strong>${person.quantity}</strong>
          </div>

          <div class="person-stat">
            <span>Sales</span>
            <strong>${money(person.sales)}</strong>
          </div>

          <div class="person-stat">
            <span>Profit</span>
            <strong>${money(person.profit)}</strong>
          </div>

        </div>

      </div>

    `).join("");

}


$("salesmanSearch").addEventListener(
  "input",
  renderSalesmen
);


/* =====================================================
   REPORTS
===================================================== */

function datePrefix(type) {

  const today =
    todayString();

  if (type === "today") {
    return today;
  }

  if (type === "month") {
    return today.slice(0, 7);
  }

  if (type === "year") {
    return today.slice(0, 4);
  }

  return "";

}


function calculateProfit(type) {

  const prefix =
    datePrefix(type);


  return sales
    .filter(sale => {

      if (!prefix) return true;

      return String(
        sale.deliveryDate || ""
      ).startsWith(prefix);

    })
    .reduce(
      (sum, sale) =>
        sum + Number(sale.profit || 0),
      0
    );

}


function calculateSales(type) {

  const prefix =
    datePrefix(type);


  return sales
    .filter(sale => {

      if (!prefix) return true;

      return String(
        sale.deliveryDate || ""
      ).startsWith(prefix);

    })
    .reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );

}


function renderReports() {

  $("reportTodayProfit").textContent =
    money(calculateProfit("today"));

  $("reportMonthProfit").textContent =
    money(calculateProfit("month"));

  $("reportYearProfit").textContent =
    money(calculateProfit("year"));

  $("reportTotalProfit").textContent =
    money(calculateProfit("all"));


  const medicineMap = new Map();


  sales.forEach(sale => {

    const key =
      sale.medicineName || "Unknown";

    if (!medicineMap.has(key)) {

      medicineMap.set(key, {

        name: key,

        quantity: 0,

        sales: 0,

        profit: 0

      });

    }


    const item =
      medicineMap.get(key);


    item.quantity +=
      Number(sale.quantity || 0);

    item.sales +=
      Number(sale.total || 0);

    item.profit +=
      Number(sale.profit || 0);

  });


  const topMedicines =
    [...medicineMap.values()]
      .sort(
        (a, b) =>
          b.quantity - a.quantity
      )
      .slice(0, 5);


  $("topMedicines").innerHTML =

    topMedicines.length

      ? topMedicines.map(item => `

          <div class="alert-item">

            <div>
              <strong>
                ${escapeHTML(item.name)}
              </strong>

              <small>
                ${item.quantity} units sold
              </small>
            </div>

            <div>
              <strong>
                ${money(item.profit)}
              </strong>

              <small>
                Profit
              </small>
            </div>

          </div>

        `).join("")

      : `
        <div class="empty-state">
          No sales yet.
        </div>
      `;


  const topSalesmen =
    getSalesmen()
      .sort(
        (a, b) =>
          b.sales - a.sales
      )
      .slice(0, 5);


  $("topSalesmen").innerHTML =

    topSalesmen.length

      ? topSalesmen.map(person => `

          <div class="alert-item">

            <div>
              <strong>
                ${escapeHTML(person.name)}
              </strong>

              <small>
                ${person.deliveries} deliveries
              </small>
            </div>

            <div>
              <strong>
                ${money(person.sales)}
              </strong>

              <small>
                Sales
              </small>
            </div>

          </div>

        `).join("")

      : `
        <div class="empty-state">
          No salesman data yet.
        </div>
      `;

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

  const low =
    inventory.filter(
      x =>
        getInventoryStatus(x) === "low"
    );

  const expired =
    inventory.filter(
      x =>
        getInventoryStatus(x) === "expired"
    );

  const soon =
    inventory.filter(
      x =>
        getInventoryStatus(x) === "soon"
    );

  const out =
    inventory.filter(
      x =>
        getInventoryStatus(x) === "out"
    );


  $("totalStockItems").textContent =
    inventory.length;

  $("lowStockCount").textContent =
    low.length;

  $("expiredCount").textContent =
    expired.length;

  $("expirySoonCount").textContent =
    soon.length;

  $("outStockCount").textContent =
    out.length;


  const totalSales =
    sales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0
    );


  const totalProfit =
    sales.reduce(
      (sum, sale) =>
        sum + Number(sale.profit || 0),
      0
    );


  const inventoryValue =
    inventory.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
        Number(item.buyPrice || 0),
      0
    );


  $("totalSales").textContent =
    money(totalSales);

  $("totalProfit").textContent =
    money(totalProfit);

  $("inventoryValue").textContent =
    money(inventoryValue);


  $("todaySales").textContent =
    money(calculateSales("today"));

  $("todayProfit").textContent =
    money(calculateProfit("today"));

  $("monthSales").textContent =
    money(calculateSales("month"));

  $("yearSales").textContent =
    money(calculateSales("year"));


  $("dashboardAlerts").innerHTML =

    low.length

      ? low.slice(0, 5).map(item => `

          <div class="alert-item">

            <div>
              <strong>
                ${escapeHTML(item.name)}
              </strong>

              <small>
                ${item.quantity} ${escapeHTML(item.unit || "")}
                remaining
              </small>
            </div>

            <span class="alert-status low">
              LOW
            </span>

          </div>

        `).join("")

      : `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <strong>No low stock</strong>
          <span>Everything looks good.</span>
        </div>
      `;


  $("dashboardExpiry").innerHTML =

    [...expired, ...soon]
      .slice(0, 5)
      .map(item => {

        const status =
          getInventoryStatus(item);

        const days =
          daysUntil(item.expiryDate);


        return `

          <div class="alert-item">

            <div>
              <strong>
                ${escapeHTML(item.name)}
              </strong>

              <small>
                Expiry: ${escapeHTML(item.expiryDate)}
              </small>
            </div>

            <span class="alert-status ${status}">
              ${
                status === "expired"
                  ? "EXPIRED"
                  : `${days} DAYS`
              }
            </span>

          </div>

        `;

      })
      .join("") ||

    `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <strong>No expiry alerts</strong>
      </div>
    `;


  renderRecentSales();

}


function renderRecentSales() {

  const list =
    [...sales]
      .sort(
        (a, b) =>
          Number(b.createdAt || 0) -
          Number(a.createdAt || 0)
      )
      .slice(0, 5);


  if (!list.length) {

    $("recentSalesTable").innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <strong>No sales yet</strong>
      </div>
    `;

    return;

  }


  $("recentSalesTable").innerHTML = `

    <table class="data-table">

      <thead>

        <tr>
          <th>Invoice</th>
          <th>Medicine</th>
          <th>Customer</th>
          <th>Date</th>
          <th>Total</th>
        </tr>

      </thead>

      <tbody>

        ${list.map(sale => `

          <tr>

            <td>
              ${escapeHTML(sale.invoiceNumber)}
            </td>

            <td>
              ${escapeHTML(sale.medicineName)}
            </td>

            <td>
              ${escapeHTML(sale.customerName)}
            </td>

            <td>
              ${escapeHTML(sale.deliveryDate)}
            </td>

            <td>
              <strong>
                ${money(sale.total)}
              </strong>
            </td>

          </tr>

        `).join("")}

      </tbody>

    </table>
  `;

}


/* =====================================================
   INVOICE
===================================================== */

/*
   IMPORTANT:
   Customer invoice mein:
   - BUY PRICE nahi
   - PROFIT nahi
   - COST nahi
*/

function invoiceFromSale(sale) {

  return {

    invoiceNumber:
      sale.invoiceNumber,

    medicineName:
      sale.medicineName,

    batchNumber:
      sale.batchNumber,

    customerName:
      sale.customerName,

    customerPhone:
      sale.customerPhone,

    salesmanName:
      sale.salesmanName,

    salesmanPhone:
      sale.salesmanPhone,

    quantity:
      sale.quantity,

    unit:
      sale.unit,

    salePrice:
      sale.salePrice,

    subtotal:
      sale.subtotal,

    discount:
      sale.discount,

    total:
      sale.total,

    paidAmount:
      sale.paidAmount,

    remainingAmount:
      sale.remainingAmount,

    deliveryDate:
      sale.deliveryDate

  };

}


function renderInvoice(invoice) {

  const business =
    $("settingsBusiness").textContent ||
    "Poultry Medicine Manager";


  $("invoiceContent").innerHTML = `

    <div class="invoice-header">

      <h1>
        ${escapeHTML(business)}
      </h1>

      <p>
        Poultry Medicine Invoice
      </p>

    </div>


    <div class="invoice-info">

      <div>
        <strong>Invoice #</strong>
        ${escapeHTML(invoice.invoiceNumber)}
      </div>

      <div>
        <strong>Date</strong>
        ${escapeHTML(invoice.deliveryDate)}
      </div>

      <div>
        <strong>Customer</strong>
        ${escapeHTML(invoice.customerName)}
      </div>

      <div>
        <strong>Customer Phone</strong>
        ${escapeHTML(invoice.customerPhone || "-")}
      </div>

      <div>
        <strong>Salesman</strong>
        ${escapeHTML(invoice.salesmanName || "-")}
      </div>

      <div>
        <strong>Salesman Phone</strong>
        ${escapeHTML(invoice.salesmanPhone || "-")}
      </div>

    </div>


    <table class="invoice-table">

      <thead>

        <tr>
          <th>Medicine</th>
          <th>Batch</th>
          <th>Qty</th>
          <th>Rate</th>
          <th>Total</th>
        </tr>

      </thead>

      <tbody>

        <tr>

          <td>
            ${escapeHTML(invoice.medicineName)}
          </td>

          <td>
            ${escapeHTML(invoice.batchNumber)}
          </td>

          <td>
            ${invoice.quantity}
            ${escapeHTML(invoice.unit || "")}
          </td>

          <td>
            ${money(invoice.salePrice)}
          </td>

          <td>
            ${money(invoice.subtotal)}
          </td>

        </tr>

      </tbody>

    </table>


    <div class="invoice-total">

      <div>
        <span>Subtotal</span>
        <strong>${money(invoice.subtotal)}</strong>
      </div>

      <div>
        <span>Discount</span>
        <strong>${money(invoice.discount)}</strong>
      </div>

      <div class="final">
        <span>Total</span>
        <strong>${money(invoice.total)}</strong>
      </div>

      <div>
        <span>Paid</span>
        <strong>${money(invoice.paidAmount)}</strong>
      </div>

      <div>
        <span>Remaining</span>
        <strong>${money(invoice.remainingAmount)}</strong>
      </div>

    </div>


    <div class="invoice-footer">

      Thank you for your business.

    </div>

  `;

}


$("printInvoiceBtn").addEventListener(
  "click",
  () => window.print()
);


/* =====================================================
   EXPORT CSV
===================================================== */

$("exportBtn").addEventListener(
  "click",
  () => {

    if (!sales.length) {

      showToast(
        "Export karne ke liye sales nahi hain.",
        "warning"
      );

      return;

    }


    const headers = [
      "Invoice",
      "Date",
      "Medicine",
      "Batch",
      "Customer",
      "Customer Phone",
      "Salesman",
      "Salesman Phone",
      "Quantity",
      "Sale Price",
      "Discount",
      "Total",
      "Profit",
      "Payment Status"
    ];


    const rows =
      sales.map(sale => [

        sale.invoiceNumber,
        sale.deliveryDate,
        sale.medicineName,
        sale.batchNumber,
        sale.customerName,
        sale.customerPhone,
        sale.salesmanName,
        sale.salesmanPhone,
        sale.quantity,
        sale.salePrice,
        sale.discount,
        sale.total,
        sale.profit,
        sale.paymentStatus

      ]);


    const csv = [

      headers,

      ...rows

    ]
      .map(row =>
        row.map(value =>
          `"${String(value ?? "")
            .replaceAll('"', '""')}"`
        ).join(",")
      )
      .join("\n");


    const blob =
      new Blob(
        [csv],
        { type: "text/csv;charset=utf-8;" }
      );


    const url =
      URL.createObjectURL(blob);


    const a =
      document.createElement("a");

    a.href = url;

    a.download =
      `poultry-sales-${todayString()}.csv`;

    a.click();

    URL.revokeObjectURL(url);

    showToast("CSV exported.");

  }
);


/* =====================================================
   LOGOUT
===================================================== */

async function logout() {

  try {

    await signOut(auth);

    showToast("Logged out successfully.");

  } catch (error) {

    showToast(
      "Logout failed.",
      "error"
    );

  }

}


$("logoutBtn").addEventListener(
  "click",
  logout
);

$("dropdownLogout").addEventListener(
  "click",
  logout
);

$("settingsLogout").addEventListener(
  "click",
  logout
);


/* =====================================================
   MODAL CLOSE
===================================================== */

document.querySelectorAll("[data-close]").forEach(button => {

  button.addEventListener("click", () => {

    hideModal(
      button.dataset.close
    );

  });

});


document.querySelectorAll(".modal").forEach(modal => {

  modal.addEventListener("click", e => {

    if (e.target === modal) {
      modal.classList.add("hidden");
    }

  });

});


/* =====================================================
   GLOBAL RENDER
===================================================== */

function renderAll() {

  renderCategories();

  renderDashboard();

  renderInventory();

  renderSales();

  renderCustomers();

  renderSalesmen();

  renderReports();

}


/* =====================================================
   START
===================================================== */

console.log(
  "Poultry Medicine Manager loaded successfully."
);
