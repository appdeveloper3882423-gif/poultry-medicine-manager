// ============================================================
// POULTRY MEDICINE MANAGER
// Version 1.0.2
// Main Application
// ============================================================

import {
  auth,
  db
} from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction
} from "firebase/firestore";


// ============================================================
// GLOBAL STATE
// ============================================================

let currentUser = null;
let medicines = [];
let sales = [];
let history = [];

const LOW_STOCK_DEFAULT = 5;
const EXPIRY_WARNING_DAYS = 30;


// ============================================================
// HELPERS
// ============================================================

const $ = id => document.getElementById(id);

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function money(value) {
  return "Rs " + Number(value || 0).toLocaleString();
}

function number(value) {
  return Number(value || 0);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  if (window.PoultryUI?.showToast) {
    window.PoultryUI.showToast(message);
  }
}

function userCollection(name) {
  return collection(db, "users", currentUser.uid, name);
}

function userDoc(name, id) {
  return doc(db, "users", currentUser.uid, name, id);
}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(auth, async user => {

  currentUser = user;

  if (user) {

    await loadUserProfile();
    await loadAllData();

    PoultryUI.showApp();

    updateProfileUI();

  } else {

    PoultryUI.showAuth();

  }

});


async function registerUser({ name, email, password }) {

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
        uid: user.uid,
        name,
        email: user.email,
        role: "user",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    showToast("Account created successfully.");

  } catch (error) {

    console.error(error);

    showToast(firebaseError(error));

  }

}


async function loginUser({ email, password }) {

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    showToast("Login successful.");

  } catch (error) {

    console.error(error);

    showToast(firebaseError(error));

  }

}


async function resetPassword(email) {

  try {

    await sendPasswordResetEmail(
      auth,
      email
    );

    showToast(
      "Password reset email sent."
    );

  } catch (error) {

    console.error(error);

    showToast(firebaseError(error));

  }

}


async function logoutUser() {

  try {

    await signOut(auth);

    showToast("Logged out successfully.");

  } catch (error) {

    console.error(error);

    showToast("Logout failed.");

  }

}


function firebaseError(error) {

  const code = error?.code || "";

  const errors = {

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "Account not found.",

    "auth/wrong-password":
      "Email or password is incorrect.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later."

  };

  return errors[code] ||
    error?.message ||
    "Something went wrong.";

}


// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile() {

  if (!currentUser) return;

  try {

    const ref =
      doc(db, "users", currentUser.uid);

    const snap = await getDoc(ref);

    if (!snap.exists()) {

      await setDoc(
        ref,
        {
          uid: currentUser.uid,
          name:
            currentUser.displayName ||
            "User",
          email: currentUser.email,
          role: "user",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

    }

  } catch (error) {

    console.error(
      "Profile error:",
      error
    );

  }

}


function updateProfileUI() {

  if (!currentUser) return;

  const name =
    currentUser.displayName ||
    currentUser.email?.split("@")[0] ||
    "User";

  const email =
    currentUser.email || "-";

  if ($("profileName"))
    $("profileName").textContent = name;

  if ($("profileEmail"))
    $("profileEmail").textContent = email;

  if ($("profileAvatar"))
    $("profileAvatar").textContent =
      name.charAt(0).toUpperCase();

}


// ============================================================
// LOAD ALL DATA
// ============================================================

async function loadAllData() {

  if (!currentUser) return;

  try {

    await Promise.all([
      loadMedicines(),
      loadSales(),
      loadHistory()
    ]);

    refreshEverything();

  } catch (error) {

    console.error(
      "Data loading error:",
      error
    );

    showToast(
      "Could not load your data."
    );

  }

}


// ============================================================
// MEDICINES
// ============================================================

async function loadMedicines() {

  medicines = [];

  const ref =
    userCollection("medicines");

  const snapshot =
    await getDocs(ref);

  snapshot.forEach(item => {

    medicines.push({
      id: item.id,
      ...item.data()
    });

  });

}


function medicineStatus(medicine) {

  const stock =
    number(medicine.stock);

  const minStock =
    number(
      medicine.minStock ??
      LOW_STOCK_DEFAULT
    );

  const expiry =
    medicine.expiry || "";

  if (stock <= 0) {

    return {
      key: "out",
      label: "Out of Stock",
      className: "red"
    };

  }

  if (expiry) {

    const today =
      new Date();

    const expiryDate =
      new Date(expiry);

    if (
      !Number.isNaN(expiryDate.getTime()) &&
      expiryDate < today
    ) {

      return {
        key: "expired",
        label: "Expired",
        className: "red"
      };

    }

  }

  if (stock <= minStock) {

    return {
      key: "low",
      label: "Low Stock",
      className: "orange"
    };

  }

  if (isExpiringSoon(expiry)) {

    return {
      key: "expiring",
      label: "Expiring Soon",
      className: "orange"
    };

  }

  return {
    key: "available",
    label: "Available",
    className: "green"
  };

}


function isExpiringSoon(expiry) {

  if (!expiry) return false;

  const today =
    new Date();

  today.setHours(0, 0, 0, 0);

  const expiryDate =
    new Date(expiry);

  expiryDate.setHours(0, 0, 0, 0);

  const difference =
    Math.ceil(
      (
        expiryDate - today
      ) /
      (1000 * 60 * 60 * 24)
    );

  return (
    difference >= 0 &&
    difference <= EXPIRY_WARNING_DAYS
  );

}


function renderMedicines() {

  const body =
    $("medicineTableBody");

  if (!body) return;

  const search =
    (
      $("medicineSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();

  const filter =
    $("medicineFilter")?.value ||
    "all";

  let list =
    [...medicines];

  if (search) {

    list =
      list.filter(m =>
        String(m.name || "")
          .toLowerCase()
          .includes(search)
      );

  }

  if (filter !== "all") {

    list =
      list.filter(m =>
        medicineStatus(m).key === filter
      );

  }

  if (!list.length) {

    body.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          No medicines found
        </td>
      </tr>
    `;

    return;

  }

  body.innerHTML =
    list.map(medicine => {

      const status =
        medicineStatus(medicine);

      return `
        <tr>

          <td>
            <strong>
              ${escapeHTML(medicine.name)}
            </strong>
          </td>

          <td>
            ${escapeHTML(medicine.category || "-")}
          </td>

          <td>
            ${number(medicine.stock)}
          </td>

          <td>
            ${escapeHTML(medicine.unit || "-")}
          </td>

          <td>
            ${escapeHTML(medicine.expiry || "-")}
          </td>

          <td>
            ${escapeHTML(medicine.stockDate || "-")}
          </td>

          <td>
            <span class="badge ${status.className}">
              ${status.label}
            </span>
          </td>

          <td>

            <button
              type="button"
              onclick="editMedicine('${medicine.id}')"
              style="
                border:0;
                background:#dbeafe;
                color:#1d4ed8;
                padding:7px 9px;
                border-radius:7px;
                margin-right:5px;
              "
            >
              Edit
            </button>

            <button
              type="button"
              onclick="deleteMedicine('${medicine.id}')"
              style="
                border:0;
                background:#fee2e2;
                color:#b91c1c;
                padding:7px 9px;
                border-radius:7px;
              "
            >
              Delete
            </button>

          </td>

        </tr>
      `;

    }).join("");

}


async function saveMedicine() {

  if (!currentUser) return;

  const id =
    $("medicineId").value.trim();

  const medicine = {

    name:
      $("medicineName").value.trim(),

    category:
      $("medicineCategory").value,

    unit:
      $("medicineUnit").value,

    stock:
      number($("medicineStock").value),

    minStock:
      number($("medicineMinStock").value),

    purchasePrice:
      number($("medicinePurchasePrice").value),

    sellingPrice:
      number($("medicineSellingPrice").value),

    expiry:
      $("medicineExpiry").value,

    stockDate:
      $("medicineStockDate").value,

    updatedAt:
      serverTimestamp()

  };


  if (!medicine.name) {

    showToast("Enter medicine name.");
    return;

  }


  try {

    if (id) {

      const old =
        medicines.find(
          item => item.id === id
        );

      await updateDoc(
        userDoc("medicines", id),
        medicine
      );

      await addHistory({

        action: "Medicine Updated",

        medicineId: id,

        medicineName:
          medicine.name,

        quantity:
          medicine.stock,

        details:
          "Medicine information updated."

      });

      showToast(
        "Medicine updated successfully."
      );

    } else {

      const ref =
        await addDoc(
          userCollection("medicines"),
          {
            ...medicine,
            createdAt:
              serverTimestamp()
          }
        );

      await addHistory({

        action: "Stock Added",

        medicineId: ref.id,

        medicineName:
          medicine.name,

        quantity:
          medicine.stock,

        details:
          "New medicine stock entered."

      });

      showToast(
        "Medicine added successfully."
      );

    }

    PoultryUI.closeModal(
      "medicineModal"
    );

    await loadMedicines();

    refreshEverything();

  } catch (error) {

    console.error(error);

    showToast(
      "Could not save medicine."
    );

  }

}


window.editMedicine = function(id) {

  const medicine =
    medicines.find(
      item => item.id === id
    );

  if (!medicine) return;

  $("medicineModalTitle")
    .textContent = "Edit Medicine";

  $("medicineId").value =
    medicine.id;

  $("medicineName").value =
    medicine.name || "";

  $("medicineCategory").value =
    medicine.category || "";

  $("medicineUnit").value =
    medicine.unit || "";

  $("medicineStock").value =
    medicine.stock ?? 0;

  $("medicineMinStock").value =
    medicine.minStock ??
    LOW_STOCK_DEFAULT;

  $("medicinePurchasePrice").value =
    medicine.purchasePrice ?? 0;

  $("medicineSellingPrice").value =
    medicine.sellingPrice ?? 0;

  $("medicineExpiry").value =
    medicine.expiry || "";

  $("medicineStockDate").value =
    medicine.stockDate ||
    todayString();

  PoultryUI.openModal(
    "medicineModal"
  );

};


window.deleteMedicine = async function(id) {

  const medicine =
    medicines.find(
      item => item.id === id
    );

  if (!medicine) return;

  const confirmed =
    confirm(
      `Delete "${medicine.name}"?`
    );

  if (!confirmed) return;

  try {

    await deleteDoc(
      userDoc("medicines", id)
    );

    await addHistory({

      action: "Medicine Deleted",

      medicineId: id,

      medicineName:
        medicine.name,

      quantity:
        medicine.stock || 0,

      details:
        "Medicine removed from inventory."

    });

    showToast(
      "Medicine deleted."
    );

    await loadMedicines();

    refreshEverything();

  } catch (error) {

    console.error(error);

    showToast(
      "Could not delete medicine."
    );

  }

};


// ============================================================
// SALES
// ============================================================

async function loadSales() {

  sales = [];

  const ref =
    userCollection("sales");

  const snapshot =
    await getDocs(ref);

  snapshot.forEach(item => {

    sales.push({
      id: item.id,
      ...item.data()
    });

  });

  sales.sort(
    (a, b) =>
      String(b.saleDate || "")
        .localeCompare(
          String(a.saleDate || "")
        )
  );

}


function populateSaleMedicines() {

  const select =
    $("saleMedicine");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      Select medicine
    </option>
  `;

  medicines
    .filter(
      medicine =>
        number(medicine.stock) > 0
    )
    .forEach(medicine => {

      const option =
        document.createElement("option");

      option.value =
        medicine.id;

      option.textContent =
        `${medicine.name} — Stock: ${medicine.stock} ${medicine.unit || ""}`;

      select.appendChild(option);

    });

}


$("saleMedicine")?.addEventListener(
  "change",
  () => {

    const medicine =
      medicines.find(
        item =>
          item.id ===
          $("saleMedicine").value
      );

    if (!medicine) return;

    const quantity =
      number(
        $("saleQuantity").value
      );

    $("saleCost").value =
      (
        quantity *
        number(medicine.purchasePrice)
      ).toFixed(2);

    $("saleAmount").value =
      (
        quantity *
        number(medicine.sellingPrice)
      ).toFixed(2);

    updateSalePreview();

  }
);


$("saleQuantity")?.addEventListener(
  "input",
  () => {

    const medicine =
      medicines.find(
        item =>
          item.id ===
          $("saleMedicine").value
      );

    if (!medicine) return;

    const quantity =
      number(
        $("saleQuantity").value
      );

    $("saleCost").value =
      (
        quantity *
        number(medicine.purchasePrice)
      ).toFixed(2);

    $("saleAmount").value =
      (
        quantity *
        number(medicine.sellingPrice)
      ).toFixed(2);

    updateSalePreview();

  }
);


function updateSalePreview() {

  const sale =
    number($("saleAmount")?.value);

  const cost =
    number($("saleCost")?.value);

  const profit =
    sale - cost;

  if ($("saleProfitPreview")) {

    $("saleProfitPreview")
      .textContent =
      money(profit);

  }

}


async function saveSale() {

  if (!currentUser) return;

  const medicineId =
    $("saleMedicine").value;

  const quantity =
    number($("saleQuantity").value);

  const saleDate =
    $("saleDate").value ||
    todayString();

  const saleAmount =
    number($("saleAmount").value);

  const costAmount =
    number($("saleCost").value);


  if (!medicineId) {

    showToast(
      "Select a medicine."
    );

    return;

  }

  if (quantity <= 0) {

    showToast(
      "Enter a valid quantity."
    );

    return;

  }


  const medicine =
    medicines.find(
      item => item.id === medicineId
    );

  if (!medicine) {

    showToast(
      "Medicine not found."
    );

    return;

  }


  if (
    quantity >
    number(medicine.stock)
  ) {

    showToast(
      "Not enough stock available."
    );

    return;

  }


  try {

    const medicineRef =
      userDoc(
        "medicines",
        medicineId
      );

    const saleRef =
      doc(
        userCollection("sales")
      );


    await runTransaction(
      db,
      async transaction => {

        const medicineSnap =
          await transaction.get(
            medicineRef
          );

        if (!medicineSnap.exists()) {

          throw new Error(
            "Medicine no longer exists."
          );

        }

        const latest =
          medicineSnap.data();

        const currentStock =
          number(latest.stock);

        if (quantity > currentStock) {

          throw new Error(
            "Not enough stock."
          );

        }

        const newStock =
          currentStock - quantity;


        transaction.update(
          medicineRef,
          {
            stock: newStock,
            updatedAt:
              serverTimestamp()
          }
        );


        transaction.set(
          saleRef,
          {
            medicineId,
            medicineName:
              latest.name,

            quantity,

            saleDate,

            saleAmount,

            costAmount,

            profit:
              saleAmount -
              costAmount,

            createdAt:
              serverTimestamp()
          }
        );

      }
    );


    await addHistory({

      action: "Medicine Sold",

      medicineId,

      medicineName:
        medicine.name,

      quantity,

      details:
        `Sale amount ${money(saleAmount)}, profit ${money(saleAmount - costAmount)}.`

    });


    if (
      number(medicine.stock) -
      quantity <=
      number(
        medicine.minStock ??
        LOW_STOCK_DEFAULT
      )
    ) {

      await addHistory({

        action: "Low Stock",

        medicineId,

        medicineName:
          medicine.name,

        quantity:
          number(medicine.stock) -
          quantity,

        details:
          "Medicine stock reached the low-stock level."

      });

    }


    PoultryUI.closeModal(
      "saleModal"
    );

    showToast(
      "Sale recorded successfully."
    );


    await loadMedicines();
    await loadSales();
    await loadHistory();

    refreshEverything();


  } catch (error) {

    console.error(error);

    showToast(
      error.message ||
      "Could not record sale."
    );

  }

}


// ============================================================
// HISTORY
// ============================================================

async function loadHistory() {

  history = [];

  const ref =
    userCollection("history");

  const snapshot =
    await getDocs(ref);

  snapshot.forEach(item => {

    history.push({
      id: item.id,
      ...item.data()
    });

  });

  history.sort(
    (a, b) =>
      String(b.date || "")
        .localeCompare(
          String(a.date || "")
        )
  );

}


async function addHistory(data) {

  if (!currentUser) return;

  try {

    await addDoc(
      userCollection("history"),
      {
        ...data,

        date:
          todayString(),

        createdAt:
          serverTimestamp()
      }
    );

  } catch (error) {

    console.error(
      "History error:",
      error
    );

  }

}


function renderHistory() {

  const body =
    $("historyTableBody");

  if (!body) return;

  if (!history.length) {

    body.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          No history available
        </td>
      </tr>
    `;

    return;

  }

  body.innerHTML =
    history.map(item => {

      return `
        <tr>

          <td>
            ${escapeHTML(item.date || "-")}
          </td>

          <td>
            <span class="badge blue">
              ${escapeHTML(item.action || "-")}
            </span>
          </td>

          <td>
            ${escapeHTML(item.medicineName || "-")}
          </td>

          <td>
            ${number(item.quantity)}
          </td>

          <td>
            ${escapeHTML(item.details || "-")}
          </td>

        </tr>
      `;

    }).join("");

}


// ============================================================
// DASHBOARD
// ============================================================

function renderDashboard() {

  const totalMedicines =
    medicines.length;

  const totalStock =
    medicines.reduce(
      (sum, item) =>
        sum + number(item.stock),
      0
    );

  const low =
    medicines.filter(
      item =>
        medicineStatus(item).key ===
        "low"
    ).length;

  const expiring =
    medicines.filter(
      item =>
        medicineStatus(item).key ===
        "expiring"
    ).length;


  setText(
    "totalMedicines",
    totalMedicines
  );

  setText(
    "totalStock",
    totalStock
  );

  setText(
    "lowStock",
    low
  );

  setText(
    "expiringSoon",
    expiring
  );


  renderDashboardAlerts();

}


function renderDashboardAlerts() {

  const container =
    $("dashboardAlerts");

  if (!container) return;

  const alerts =
    medicines
      .filter(m => {

        const status =
          medicineStatus(m);

        return (
          status.key === "low" ||
          status.key === "out" ||
          status.key === "expired" ||
          status.key === "expiring"
        );

      })
      .slice(0, 6);


  if (!alerts.length) {

    container.innerHTML = `
      <div class="empty-state">
        No stock alerts
      </div>
    `;

    return;

  }


  container.innerHTML =
    alerts.map(m => {

      const status =
        medicineStatus(m);

      return `
        <div class="alert-row">

          <span>
            <strong>
              ${escapeHTML(m.name)}
            </strong>
            <br>
            <small>
              Stock: ${number(m.stock)}
            </small>
          </span>

          <span class="badge ${status.className}">
            ${status.label}
          </span>

        </div>
      `;

    }).join("");

}


// ============================================================
// ALERTS PAGE
// ============================================================

function renderAlerts() {

  const container =
    $("alertsList");

  if (!container) return;

  const alerts =
    medicines.filter(m => {

      const status =
        medicineStatus(m);

      return (
        status.key === "low" ||
        status.key === "out" ||
        status.key === "expired" ||
        status.key === "expiring"
      );

    });


  if (!alerts.length) {

    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:35px;margin-bottom:10px;">
          ✓
        </div>
        No medicine alerts right now.
      </div>
    `;

    return;

  }


  container.innerHTML =
    alerts.map(m => {

      const status =
        medicineStatus(m);

      return `
        <div class="alert-row">

          <div>

            <strong>
              ${escapeHTML(m.name)}
            </strong>

            <div
              style="
                color:#64748b;
                margin-top:4px;
                font-size:12px;
              "
            >
              Stock: ${number(m.stock)}
              ${escapeHTML(m.unit || "")}
              • Expiry: ${escapeHTML(m.expiry || "-")}
            </div>

          </div>

          <span class="badge ${status.className}">
            ${status.label}
          </span>

        </div>
      `;

    }).join("");

}


// ============================================================
// PROFIT
// ============================================================

function getDateObject(dateString) {

  if (!dateString) return null;

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) return null;

  return date;

}


function isToday(dateString) {

  return dateString ===
    todayString();

}


function isThisWeek(dateString) {

  const date =
    getDateObject(dateString);

  if (!date) return false;

  const now =
    new Date();

  const day =
    now.getDay();

  const mondayOffset =
    day === 0 ? 6 : day - 1;

  const monday =
    new Date(now);

  monday.setDate(
    now.getDate() -
    mondayOffset
  );

  monday.setHours(
    0, 0, 0, 0
  );

  return date >= monday;

}


function isThisMonth(dateString) {

  const date =
    getDateObject(dateString);

  if (!date) return false;

  const now =
    new Date();

  return (
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth()
  );

}


function calculateProfit(filterFn) {

  return sales
    .filter(sale =>
      filterFn(sale.saleDate)
    )
    .reduce(
      (sum, sale) =>
        sum + number(sale.profit),
      0
    );

}


function renderProfit() {

  const todayProfit =
    calculateProfit(isToday);

  const weekProfit =
    calculateProfit(isThisWeek);

  const monthProfit =
    calculateProfit(isThisMonth);


  const totalProfit =
    sales.reduce(
      (sum, sale) =>
        sum + number(sale.profit),
      0
    );


  const revenue =
    sales.reduce(
      (sum, sale) =>
        sum + number(sale.saleAmount),
      0
    );


  const quantity =
    sales.reduce(
      (sum, sale) =>
        sum + number(sale.quantity),
      0
    );


  setText(
    "todayProfit",
    money(todayProfit)
  );

  setText(
    "weekProfit",
    money(weekProfit)
  );

  setText(
    "monthProfit",
    money(monthProfit)
  );

  setText(
    "totalSalesCount",
    sales.length
  );

  setText(
    "totalQuantitySold",
    quantity
  );

  setText(
    "totalRevenue",
    money(revenue)
  );

  setText(
    "totalProfit",
    money(totalProfit)
  );

}


// ============================================================
// SALES TABLE
// ============================================================

function renderSales() {

  const body =
    $("salesTableBody");

  if (!body) return;

  const search =
    (
      $("salesSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  let list =
    [...sales];


  if (search) {

    list =
      list.filter(sale =>
        String(
          sale.medicineName || ""
        )
          .toLowerCase()
          .includes(search)
      );

  }


  if (!list.length) {

    body.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          No sales found
        </td>
      </tr>
    `;

    return;

  }


  body.innerHTML =
    list.map(sale => {

      return `
        <tr>

          <td>
            ${escapeHTML(
              sale.saleDate || "-"
            )}
          </td>

          <td>
            <strong>
              ${escapeHTML(
                sale.medicineName || "-"
              )}
            </strong>
          </td>

          <td>
            ${number(sale.quantity)}
          </td>

          <td>
            ${money(sale.saleAmount)}
          </td>

          <td>
            ${money(sale.costAmount)}
          </td>

          <td>
            <strong>
              ${money(sale.profit)}
            </strong>
          </td>

        </tr>
      `;

    }).join("");

}


// ============================================================
// REFRESH UI
// ============================================================

function refreshEverything() {

  renderDashboard();

  renderMedicines();

  renderSales();

  renderHistory();

  renderAlerts();

  renderProfit();

  populateSaleMedicines();

}


// ============================================================
// EVENT CONNECTIONS
// ============================================================

window.addEventListener(
  "poultry:login",
  event => {

    loginUser(
      event.detail
    );

  }
);


window.addEventListener(
  "poultry:register",
  event => {

    registerUser(
      event.detail
    );

  }
);


window.addEventListener(
  "poultry:forgot-password",
  event => {

    resetPassword(
      event.detail.email
    );

  }
);


window.addEventListener(
  "poultry:logout",
  () => {

    logoutUser();

  }
);


window.addEventListener(
  "poultry:save-medicine",
  () => {

    saveMedicine();

  }
);


window.addEventListener(
  "poultry:save-sale",
  () => {

    saveSale();

  }
);


window.addEventListener(
  "poultry:refresh",
  async () => {

    await loadAllData();

    showToast(
      "Data refreshed."
    );

  }
);


// ============================================================
// SEARCH / FILTER
// ============================================================

$("medicineSearch")?.addEventListener(
  "input",
  renderMedicines
);


$("medicineFilter")?.addEventListener(
  "change",
  renderMedicines
);


$("salesSearch")?.addEventListener(
  "input",
  renderSales
);


// ============================================================
// STARTUP
// ============================================================

if ($("medicineStockDate")) {

  $("medicineStockDate").value =
    todayString();

}

if ($("saleDate")) {

  $("saleDate").value =
    todayString();

}

console.log(
  "Poultry Medicine Manager v1.0.2 loaded."
);
