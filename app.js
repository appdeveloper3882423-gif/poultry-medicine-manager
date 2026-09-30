// ============================================================
// POULTRY MEDICINE MANAGER
// Main Application
// Version 1.0.3
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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


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
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function money(value) {
  return "Rs " + Number(value || 0).toLocaleString();
}


function number(value) {
  const result = Number(value);

  return Number.isFinite(result) ? result : 0;
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


function setText(id, value) {

  if ($(id)) {
    $(id).textContent = value;
  }

}


function userCollection(name) {

  if (!currentUser) {
    throw new Error("User is not logged in.");
  }

  return collection(
    db,
    "users",
    currentUser.uid,
    name
  );

}


function userDoc(name, id) {

  if (!currentUser) {
    throw new Error("User is not logged in.");
  }

  return doc(
    db,
    "users",
    currentUser.uid,
    name,
    id
  );

}


// ============================================================
// FIREBASE ERROR HANDLER
// ============================================================

function firebaseError(error) {

  console.error("Firebase Error:", error);

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
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Please check your internet connection.",

    "auth/operation-not-allowed":
      "Email/Password authentication is not enabled in Firebase.",

    "permission-denied":
      "Firebase permission denied. Please check Firestore Rules."

  };

  return (
    errors[code] ||
    error?.message ||
    "Something went wrong."
  );

}


// ============================================================
// AUTH
// ============================================================

onAuthStateChanged(
  auth,
  async user => {

    currentUser = user;

    if (!user) {

      if (window.PoultryUI) {
        window.PoultryUI.showAuth();
      }

      return;

    }


    try {

      await loadUserProfile();

      await loadAllData();

      if (window.PoultryUI) {
        window.PoultryUI.showApp();
      }

      updateProfileUI();

    } catch (error) {

      console.error(
        "Authentication state error:",
        error
      );

      showToast(
        "Could not load your account data."
      );

    }

  }
);


// ============================================================
// REGISTER
// ============================================================

async function registerUser(data) {

  if (!data) return;

  const name =
    String(data.name || "").trim();

  const email =
    String(data.email || "").trim();

  const password =
    String(data.password || "");


  if (!name) {

    showToast("Enter your full name.");

    return;

  }


  if (!email) {

    showToast("Enter your email address.");

    return;

  }


  if (password.length < 6) {

    showToast(
      "Password must be at least 6 characters."
    );

    return;

  }


  try {

    showToast("Creating your account...");


    const result =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );


    const user =
      result.user;


    try {

      await updateProfile(
        user,
        {
          displayName: name
        }
      );

    } catch (profileError) {

      console.warn(
        "Profile name update warning:",
        profileError
      );

    }


    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      {
        uid: user.uid,
        name,
        email: user.email,
        role: "user",
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      {
        merge: true
      }
    );


    showToast(
      "Account created successfully."
    );


    const registerForm =
      $("registerForm");

    if (registerForm) {
      registerForm.reset();
    }


  } catch (error) {

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// LOGIN
// ============================================================

async function loginUser(data) {

  if (!data) return;

  const email =
    String(data.email || "").trim();

  const password =
    String(data.password || "");


  if (!email) {

    showToast("Enter your email address.");

    return;

  }


  if (!password) {

    showToast("Enter your password.");

    return;

  }


  try {

    showToast("Logging in...");


    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );


    showToast(
      "Login successful."
    );


  } catch (error) {

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// PASSWORD RESET
// ============================================================

async function resetPassword(email) {

  const cleanEmail =
    String(email || "").trim();


  if (!cleanEmail) {

    showToast(
      "Enter your email address first."
    );

    return;

  }


  try {

    await sendPasswordResetEmail(
      auth,
      cleanEmail
    );


    showToast(
      "Password reset email sent."
    );


  } catch (error) {

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {

  try {

    await signOut(auth);

    medicines = [];
    sales = [];
    history = [];

    showToast(
      "Logged out successfully."
    );

  } catch (error) {

    console.error(error);

    showToast(
      "Logout failed."
    );

  }

}


// ============================================================
// USER PROFILE
// ============================================================

async function loadUserProfile() {

  if (!currentUser) return;


  const ref =
    doc(
      db,
      "users",
      currentUser.uid
    );


  try {

    const snap =
      await getDoc(ref);


    if (!snap.exists()) {

      await setDoc(
        ref,
        {
          uid: currentUser.uid,
          name:
            currentUser.displayName ||
            "User",
          email:
            currentUser.email || "",
          role: "user",
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );

    }

  } catch (error) {

    console.error(
      "Profile error:",
      error
    );

    throw error;

  }

}


function updateProfileUI() {

  if (!currentUser) return;


  const name =
    currentUser.displayName ||
    currentUser.email?.split("@")[0] ||
    "User";


  const email =
    currentUser.email ||
    "-";


  setText(
    "profileName",
    name
  );


  setText(
    "profileEmail",
    email
  );


  const avatar =
    $("profileAvatar");


  if (avatar) {

    avatar.textContent =
      name.charAt(0).toUpperCase();

  }

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

    throw error;

  }

}


// ============================================================
// MEDICINES
// ============================================================

async function loadMedicines() {

  medicines = [];


  const snapshot =
    await getDocs(
      userCollection("medicines")
    );


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

    const expiryDate =
      new Date(
        expiry + "T23:59:59"
      );


    if (
      !Number.isNaN(
        expiryDate.getTime()
      ) &&
      expiryDate < new Date()
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

  today.setHours(
    0,
    0,
    0,
    0
  );


  const expiryDate =
    new Date(
      expiry + "T00:00:00"
    );


  if (
    Number.isNaN(
      expiryDate.getTime()
    )
  ) {

    return false;

  }


  expiryDate.setHours(
    0,
    0,
    0,
    0
  );


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


// ============================================================
// RENDER MEDICINES
// ============================================================

function renderMedicines() {

  const body =
    $("medicineTableBody");


  if (!body) return;


  const search =
    String(
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
      list.filter(
        medicine =>
          String(
            medicine.name || ""
          )
            .toLowerCase()
            .includes(search)
      );

  }


  if (filter !== "all") {

    list =
      list.filter(
        medicine =>
          medicineStatus(medicine).key ===
          filter
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
    list.map(
      medicine => {

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
              ${escapeHTML(
                medicine.category || "-"
              )}
            </td>

            <td>
              ${number(medicine.stock)}
            </td>

            <td>
              ${escapeHTML(
                medicine.unit || "-"
              )}
            </td>

            <td>
              ${escapeHTML(
                medicine.expiry || "-"
              )}
            </td>

            <td>
              ${escapeHTML(
                medicine.stockDate || "-"
              )}
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

      }
    ).join("");

}


// ============================================================
// SAVE MEDICINE
// ============================================================

async function saveMedicine() {

  if (!currentUser) {

    showToast("Please login first.");

    return;

  }


  const id =
    $("medicineId")?.value.trim() || "";


  const medicine = {

    name:
      $("medicineName")?.value.trim() || "",

    category:
      $("medicineCategory")?.value || "",

    unit:
      $("medicineUnit")?.value || "",

    stock:
      number(
        $("medicineStock")?.value
      ),

    minStock:
      number(
        $("medicineMinStock")?.value
      ),

    purchasePrice:
      number(
        $("medicinePurchasePrice")?.value
      ),

    sellingPrice:
      number(
        $("medicineSellingPrice")?.value
      ),

    expiry:
      $("medicineExpiry")?.value || "",

    stockDate:
      $("medicineStockDate")?.value ||
      todayString(),

    updatedAt:
      serverTimestamp()

  };


  if (!medicine.name) {

    showToast(
      "Enter medicine name."
    );

    return;

  }


  try {

    if (id) {

      await updateDoc(
        userDoc(
          "medicines",
          id
        ),
        medicine
      );


      await addHistory({

        action:
          "Medicine Updated",

        medicineId:
          id,

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

        action:
          "Stock Added",

        medicineId:
          ref.id,

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


    window.PoultryUI?.closeModal(
      "medicineModal"
    );


    await loadMedicines();

    await loadHistory();

    refreshEverything();


  } catch (error) {

    console.error(error);

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// EDIT MEDICINE
// ============================================================

window.editMedicine =
  function(id) {

    const medicine =
      medicines.find(
        item => item.id === id
      );


    if (!medicine) return;


    setText(
      "medicineModalTitle",
      "Edit Medicine"
    );


    if ($("medicineId"))
      $("medicineId").value =
        medicine.id;


    if ($("medicineName"))
      $("medicineName").value =
        medicine.name || "";


    if ($("medicineCategory"))
      $("medicineCategory").value =
        medicine.category || "";


    if ($("medicineUnit"))
      $("medicineUnit").value =
        medicine.unit || "";


    if ($("medicineStock"))
      $("medicineStock").value =
        medicine.stock ?? 0;


    if ($("medicineMinStock"))
      $("medicineMinStock").value =
        medicine.minStock ??
        LOW_STOCK_DEFAULT;


    if ($("medicinePurchasePrice"))
      $("medicinePurchasePrice").value =
        medicine.purchasePrice ?? 0;


    if ($("medicineSellingPrice"))
      $("medicineSellingPrice").value =
        medicine.sellingPrice ?? 0;


    if ($("medicineExpiry"))
      $("medicineExpiry").value =
        medicine.expiry || "";


    if ($("medicineStockDate"))
      $("medicineStockDate").value =
        medicine.stockDate ||
        todayString();


    window.PoultryUI?.openModal(
      "medicineModal"
    );

  };


// ============================================================
// DELETE MEDICINE
// ============================================================

window.deleteMedicine =
  async function(id) {

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
        userDoc(
          "medicines",
          id
        )
      );


      await addHistory({

        action:
          "Medicine Deleted",

        medicineId:
          id,

        medicineName:
          medicine.name,

        quantity:
          medicine.stock || 0,

        details:
          "Medicine removed from inventory."

      });


      await loadMedicines();

      await loadHistory();

      refreshEverything();


      showToast(
        "Medicine deleted."
      );


    } catch (error) {

      console.error(error);

      showToast(
        firebaseError(error)
      );

    }

  };


// ============================================================
// SALES
// ============================================================

async function loadSales() {

  sales = [];


  const snapshot =
    await getDocs(
      userCollection("sales")
    );


  snapshot.forEach(item => {

    sales.push({
      id: item.id,
      ...item.data()
    });

  });


  sales.sort(
    (a, b) =>
      String(
        b.saleDate || ""
      ).localeCompare(
        String(
          a.saleDate || ""
        )
      )
  );

}


// ============================================================
// SALE MEDICINES
// ============================================================

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
    .forEach(
      medicine => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          medicine.id;


        option.textContent =
          `${medicine.name} — Stock: ${medicine.stock} ${medicine.unit || ""}`;


        select.appendChild(
          option
        );

      }
    );

}


// ============================================================
// SALE PRICE CALCULATION
// ============================================================

function updateSaleValues() {

  const medicine =
    medicines.find(
      item =>
        item.id ===
        $("saleMedicine")?.value
    );


  if (!medicine) {

    updateSalePreview();

    return;

  }


  const quantity =
    number(
      $("saleQuantity")?.value
    );


  const cost =
    quantity *
    number(
      medicine.purchasePrice
    );


  const sale =
    quantity *
    number(
      medicine.sellingPrice
    );


  if ($("saleCost"))
    $("saleCost").value =
      cost.toFixed(2);


  if ($("saleAmount"))
    $("saleAmount").value =
      sale.toFixed(2);


  updateSalePreview();

}


function updateSalePreview() {

  const sale =
    number(
      $("saleAmount")?.value
    );


  const cost =
    number(
      $("saleCost")?.value
    );


  const profit =
    sale - cost;


  if ($("saleProfitPreview")) {

    $("saleProfitPreview")
      .textContent =
      money(profit);

  }

}


// ============================================================
// SAVE SALE
// ============================================================

async function saveSale() {

  if (!currentUser) {

    showToast(
      "Please login first."
    );

    return;

  }


  const medicineId =
    $("saleMedicine")?.value || "";


  const quantity =
    number(
      $("saleQuantity")?.value
    );


  const saleDate =
    $("saleDate")?.value ||
    todayString();


  const saleAmount =
    number(
      $("saleAmount")?.value
    );


  const costAmount =
    number(
      $("saleCost")?.value
    );


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
      item =>
        item.id === medicineId
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


    let soldMedicineName =
      medicine.name;


    let newStock = 0;


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
          number(
            latest.stock
          );


        if (
          quantity >
          currentStock
        ) {

          throw new Error(
            "Not enough stock."
          );

        }


        newStock =
          currentStock -
          quantity;


        soldMedicineName =
          latest.name;


        transaction.update(
          medicineRef,
          {
            stock:
              newStock,

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

      action:
        "Medicine Sold",

      medicineId,

      medicineName:
        soldMedicineName,

      quantity,

      details:
        `Sale ${money(saleAmount)}, Profit ${money(saleAmount - costAmount)}, Remaining Stock ${newStock}.`

    });


    if (
      newStock <=
      number(
        medicine.minStock ??
        LOW_STOCK_DEFAULT
      )
    ) {

      await addHistory({

        action:
          "Low Stock",

        medicineId,

        medicineName:
          soldMedicineName,

        quantity:
          newStock,

        details:
          "Medicine stock reached the low-stock level."

      });

    }


    window.PoultryUI?.closeModal(
      "saleModal"
    );


    await loadMedicines();

    await loadSales();

    await loadHistory();


    refreshEverything();


    showToast(
      "Sale recorded successfully."
    );


  } catch (error) {

    console.error(error);

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// HISTORY
// ============================================================

async function loadHistory() {

  history = [];


  const snapshot =
    await getDocs(
      userCollection("history")
    );


  snapshot.forEach(item => {

    history.push({
      id: item.id,
      ...item.data()
    });

  });


  history.sort(
    (a, b) =>
      String(
        b.date || ""
      ).localeCompare(
        String(
          a.date || ""
        )
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
    history.map(
      item => `

        <tr>

          <td>
            ${escapeHTML(
              item.date || "-"
            )}
          </td>

          <td>
            <span class="badge blue">
              ${escapeHTML(
                item.action || "-"
              )}
            </span>
          </td>

          <td>
            ${escapeHTML(
              item.medicineName || "-"
            )}
          </td>

          <td>
            ${number(
              item.quantity
            )}
          </td>

          <td>
            ${escapeHTML(
              item.details || "-"
            )}
          </td>

        </tr>

      `
    ).join("");

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
        sum +
        number(item.stock),
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
      .filter(
        medicine => {

          const status =
            medicineStatus(
              medicine
            );


          return (
            status.key === "low" ||
            status.key === "out" ||
            status.key === "expired" ||
            status.key === "expiring"
          );

        }
      )
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
    alerts.map(
      medicine => {

        const status =
          medicineStatus(
            medicine
          );


        return `
          <div class="alert-row">

            <span>

              <strong>
                ${escapeHTML(
                  medicine.name
                )}
              </strong>

              <br>

              <small>
                Stock:
                ${number(
                  medicine.stock
                )}
              </small>

            </span>

            <span
              class="badge ${status.className}"
            >
              ${status.label}
            </span>

          </div>
        `;

      }
    ).join("");

}


// ============================================================
// ALERTS
// ============================================================

function renderAlerts() {

  const container =
    $("alertsList");


  if (!container) return;


  const alerts =
    medicines.filter(
      medicine => {

        const status =
          medicineStatus(
            medicine
          );


        return (
          status.key === "low" ||
          status.key === "out" ||
          status.key === "expired" ||
          status.key === "expiring"
        );

      }
    );


  if (!alerts.length) {

    container.innerHTML = `
      <div class="empty-state">

        <div
          style="
            font-size:35px;
            margin-bottom:10px;
          "
        >
          ✓
        </div>

        No medicine alerts right now.

      </div>
    `;

    return;

  }


  container.innerHTML =
    alerts.map(
      medicine => {

        const status =
          medicineStatus(
            medicine
          );


        return `
          <div class="alert-row">

            <div>

              <strong>
                ${escapeHTML(
                  medicine.name
                )}
              </strong>

              <div
                style="
                  color:#64748b;
                  margin-top:4px;
                  font-size:12px;
                "
              >
                Stock:
                ${number(
                  medicine.stock
                )}
                ${escapeHTML(
                  medicine.unit || ""
                )}

                • Expiry:
                ${escapeHTML(
                  medicine.expiry || "-"
                )}

              </div>

            </div>

            <span
              class="badge ${status.className}"
            >
              ${status.label}
            </span>

          </div>
        `;

      }
    ).join("");

}


// ============================================================
// PROFIT
// ============================================================

function getDateObject(dateString) {

  if (!dateString) return null;


  const date =
    new Date(
      dateString + "T00:00:00"
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }


  return date;

}


function isToday(dateString) {

  return (
    dateString ===
    todayString()
  );

}


function isThisWeek(dateString) {

  const date =
    getDateObject(
      dateString
    );


  if (!date) return false;


  const now =
    new Date();


  const day =
    now.getDay();


  const mondayOffset =
    day === 0
      ? 6
      : day - 1;


  const monday =
    new Date(now);


  monday.setDate(
    now.getDate() -
    mondayOffset
  );


  monday.setHours(
    0,
    0,
    0,
    0
  );


  return date >= monday;

}


function isThisMonth(dateString) {

  const date =
    getDateObject(
      dateString
    );


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
    .filter(
      sale =>
        filterFn(
          sale.saleDate
        )
    )
    .reduce(
      (sum, sale) =>
        sum +
        number(
          sale.profit
        ),
      0
    );

}


function renderProfit() {

  const todayProfit =
    calculateProfit(
      isToday
    );


  const weekProfit =
    calculateProfit(
      isThisWeek
    );


  const monthProfit =
    calculateProfit(
      isThisMonth
    );


  const totalProfit =
    sales.reduce(
      (sum, sale) =>
        sum +
        number(
          sale.profit
        ),
      0
    );


  const revenue =
    sales.reduce(
      (sum, sale) =>
        sum +
        number(
          sale.saleAmount
        ),
      0
    );


  const quantity =
    sales.reduce(
      (sum, sale) =>
        sum +
        number(
          sale.quantity
        ),
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
    String(
      $("salesSearch")?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  let list =
    [...sales];


  if (search) {

    list =
      list.filter(
        sale =>
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
    list.map(
      sale => `

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
            ${number(
              sale.quantity
            )}
          </td>

          <td>
            ${money(
              sale.saleAmount
            )}
          </td>

          <td>
            ${money(
              sale.costAmount
            )}
          </td>

          <td>
            <strong>
              ${money(
                sale.profit
              )}
            </strong>
          </td>

        </tr>

      `
    ).join("");

}


// ============================================================
// REFRESH EVERYTHING
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

    registerSafeCall(
      loginUser(
        event.detail
      )
    );

  }
);


window.addEventListener(
  "poultry:register",
  event => {

    registerSafeCall(
      registerUser(
        event.detail
      )
    );

  }
);


window.addEventListener(
  "poultry:forgot-password",
  event => {

    registerSafeCall(
      resetPassword(
        event.detail?.email
      )
    );

  }
);


window.addEventListener(
  "poultry:logout",
  () => {

    registerSafeCall(
      logoutUser()
    );

  }
);


window.addEventListener(
  "poultry:save-medicine",
  () => {

    registerSafeCall(
      saveMedicine()
    );

  }
);


window.addEventListener(
  "poultry:save-sale",
  () => {

    registerSafeCall(
      saveSale()
    );

  }
);


window.addEventListener(
  "poultry:refresh",
  () => {

    registerSafeCall(
      refreshData()
    );

  }
);


async function registerSafeCall(promise) {

  try {

    await promise;

  } catch (error) {

    console.error(
      "Unhandled application error:",
      error
    );

    showToast(
      firebaseError(error)
    );

  }

}


// ============================================================
// REFRESH DATA
// ============================================================

async function refreshData() {

  if (!currentUser) {

    showToast(
      "Please login first."
    );

    return;

  }


  showToast(
    "Refreshing data..."
  );


  await loadAllData();


  showToast(
    "Data refreshed."
  );

}


// ============================================================
// STARTUP EVENTS
// ============================================================

function setupEvents() {


  // ---------------- AUTH SWITCH ----------------

  $("showRegisterBtn")?.addEventListener(
    "click",
    () => {

      $("loginForm")?.classList.add(
        "hidden"
      );

      $("registerForm")?.classList.remove(
        "hidden"
      );

      $("loginSwitchText")?.classList.add(
        "hidden"
      );

      $("registerSwitchText")?.classList.remove(
        "hidden"
      );

    }
  );


  $("showLoginBtn")?.addEventListener(
    "click",
    () => {

      $("registerForm")?.classList.add(
        "hidden"
      );

      $("loginForm")?.classList.remove(
        "hidden"
      );

      $("registerSwitchText")?.classList.add(
        "hidden"
      );

      $("loginSwitchText")?.classList.remove(
        "hidden"
      );

    }
  );


  // ---------------- AUTH FORMS ----------------

  $("loginForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      window.dispatchEvent(
        new CustomEvent(
          "poultry:login",
          {
            detail: {

              email:
                $("loginEmail")?.value.trim(),

              password:
                $("loginPassword")?.value || ""

            }
          }
        )
      );

    }
  );


  $("registerForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      const password =
        $("registerPassword")?.value || "";


      const confirm =
        $("registerConfirmPassword")?.value || "";


      if (
        password !== confirm
      ) {

        showToast(
          "Passwords do not match."
        );

        return;

      }


      window.dispatchEvent(
        new CustomEvent(
          "poultry:register",
          {
            detail: {

              name:
                $("registerName")?.value.trim(),

              email:
                $("registerEmail")?.value.trim(),

              password

            }
          }
        )
      );

    }
  );


  $("forgotPasswordBtn")?.addEventListener(
    "click",
    () => {

      const email =
        $("loginEmail")?.value.trim();


      if (!email) {

        showToast(
          "Enter your email address first."
        );

        $("loginEmail")?.focus();

        return;

      }


      window.dispatchEvent(
        new CustomEvent(
          "poultry:forgot-password",
          {
            detail: {
              email
            }
          }
        )
      );

    }
  );


  // ---------------- LOGOUT ----------------

  $("logoutBtn")?.addEventListener(
    "click",
    () => {

      window.dispatchEvent(
        new CustomEvent(
          "poultry:logout"
        )
      );

    }
  );


  // ---------------- SIDEBAR ----------------

  $("menuBtn")?.addEventListener(
    "click",
    () => {

      $("sidebar")?.classList.toggle(
        "open"
      );

    }
  );


  document
    .querySelectorAll(".nav-item")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const pageId =
              button.dataset.page;


            document
              .querySelectorAll(".nav-item")
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );


            button.classList.add(
              "active"
            );


            document
              .querySelectorAll(".page")
              .forEach(
                page =>
                  page.classList.remove(
                    "active"
                  )
              );


            $(pageId)?.classList.add(
              "active"
            );


            $("sidebar")?.classList.remove(
              "open"
            );

          }
        );

      }
    );


  // ---------------- QUICK NAVIGATION ----------------

  document
    .querySelectorAll("[data-open-page]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const pageId =
              button.dataset.openPage;


            document
              .querySelectorAll(".nav-item")
              .forEach(
                item => {

                  item.classList.toggle(
                    "active",
                    item.dataset.page ===
                    pageId
                  );

                }
              );


            document
              .querySelectorAll(".page")
              .forEach(
                page =>
                  page.classList.remove(
                    "active"
                  )
              );


            $(pageId)?.classList.add(
              "active"
            );

          }
        );

      }
    );


  // ---------------- MODALS ----------------

  document
    .querySelectorAll("[data-close-modal]")
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            window.PoultryUI?.closeModal(
              button.dataset.closeModal
            );

          }
        );

      }
    );


  document
    .querySelectorAll(".modal-overlay")
    .forEach(
      overlay => {

        overlay.addEventListener(
          "click",
          event => {

            if (
              event.target === overlay
            ) {

              overlay.classList.add(
                "hidden"
              );

            }

          }
        );

      }
    );


  // ---------------- ADD MEDICINE ----------------

  $("addMedicineBtn")?.addEventListener(
    "click",
    () => {

      setText(
        "medicineModalTitle",
        "Add Medicine"
      );


      $("medicineForm")?.reset();


      if ($("medicineId"))
        $("medicineId").value = "";


      if ($("medicineMinStock"))
        $("medicineMinStock").value =
          LOW_STOCK_DEFAULT;


      if ($("medicineStockDate"))
        $("medicineStockDate").value =
          todayString();


      window.PoultryUI?.openModal(
        "medicineModal"
      );

    }
  );


  $("quickAddMedicine")?.addEventListener(
    "click",
    () => {

      $("addMedicineBtn")?.click();

    }
  );


  // ---------------- SALE ----------------

  $("recordSaleBtn")?.addEventListener(
    "click",
    () => {

      $("saleForm")?.reset();


      if ($("saleDate"))
        $("saleDate").value =
          todayString();


      populateSaleMedicines();

      updateSalePreview();


      window.PoultryUI?.openModal(
        "saleModal"
      );

    }
  );


  $("quickSale")?.addEventListener(
    "click",
    () => {

      $("recordSaleBtn")?.click();

    }
  );


  // ---------------- SALE CALCULATION ----------------

  $("saleMedicine")?.addEventListener(
    "change",
    updateSaleValues
  );


  $("saleQuantity")?.addEventListener(
    "input",
    updateSaleValues
  );


  $("saleAmount")?.addEventListener(
    "input",
    updateSalePreview
  );


  $("saleCost")?.addEventListener(
    "input",
    updateSalePreview
  );


  // ---------------- FORMS ----------------

  $("medicineForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      window.dispatchEvent(
        new CustomEvent(
          "poultry:save-medicine"
        )
      );

    }
  );


  $("saleForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();


      window.dispatchEvent(
        new CustomEvent(
          "poultry:save-sale"
        )
      );

    }
  );


  // ---------------- SEARCH ----------------

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


  // ---------------- REFRESH ----------------

  $("refreshBtn")?.addEventListener(
    "click",
    () => {

      window.dispatchEvent(
        new CustomEvent(
          "poultry:refresh"
        )
      );

    }
  );


  // ---------------- ESCAPE ----------------

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape"
      ) {

        document
          .querySelectorAll(
            ".modal-overlay"
          )
          .forEach(
            modal =>
              modal.classList.add(
                "hidden"
              )
          );

      }

    }
  );


  // ---------------- GLOBAL UI ----------------

  window.PoultryUI = {

    showApp() {

      $("authScreen")?.classList.add(
        "hidden"
      );

      $("appScreen")?.classList.remove(
        "hidden"
      );

    },


    showAuth() {

      $("appScreen")?.classList.add(
        "hidden"
      );

      $("authScreen")?.classList.remove(
        "hidden"
      );

    },


    openModal(id) {

      $(id)?.classList.remove(
        "hidden"
      );

    },


    closeModal(id) {

      $(id)?.classList.add(
        "hidden"
      );

    },


    showToast,


    setText

  };


}


// ============================================================
// START APPLICATION
// ============================================================

setupEvents();


console.log(
  "Poultry Medicine Manager v1.0.3 loaded successfully."
);
