// ============================================================
// POULTRY MEDICINE MANAGER
// Version 1.0.0
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
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


/* ============================================================
   STATE
============================================================ */

const state = {

  user: null,

  profile: null,

  medicines: [],

  sales: [],

  history: [],

  currentPage: "dashboard",

  editingMedicineId: null

};


/* ============================================================
   DOM HELPERS
============================================================ */

const $ = (id) => document.getElementById(id);

const $$ = (selector) =>
  document.querySelectorAll(selector);


/* ============================================================
   TOAST
============================================================ */

let toastTimer = null;

function showToast(message, type = "success") {

  const toast = $("toast");

  const messageEl = $("toastMessage");

  if (!toast || !messageEl) return;

  messageEl.textContent = message;

  toast.style.background =
    type === "error"
      ? "#c93e3e"
      : "#22242e";

  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}


/* ============================================================
   LOADING
============================================================ */

function showLoader(show) {

  $("loader")?.classList.toggle(
    "hidden",
    !show
  );

}


/* ============================================================
   AUTH SCREEN
============================================================ */

function showAuth() {

  $("authScreen").classList.remove("hidden");

  $("appScreen").classList.add("hidden");

  $("loginForm").classList.remove("hidden");

  $("registerForm").classList.add("hidden");

}


function showApp() {

  $("authScreen").classList.add("hidden");

  $("appScreen").classList.remove("hidden");

}


/* ============================================================
   AUTH FORM SWITCH
============================================================ */

$("showRegisterBtn")?.addEventListener(
  "click",
  () => {

    $("loginForm").classList.add("hidden");

    $("registerForm").classList.remove("hidden");

  }
);


$("showLoginBtn")?.addEventListener(
  "click",
  () => {

    $("registerForm").classList.add("hidden");

    $("loginForm").classList.remove("hidden");

  }
);


/* ============================================================
   REGISTER
============================================================ */

$("registerBtn")?.addEventListener(
  "click",
  async () => {

    const name =
      $("registerName").value.trim();

    const email =
      $("registerEmail").value.trim();

    const password =
      $("registerPassword").value;

    if (!name) {

      showToast(
        "Please enter your name.",
        "error"
      );

      return;
    }

    if (!email) {

      showToast(
        "Please enter your email.",
        "error"
      );

      return;
    }

    if (password.length < 6) {

      showToast(
        "Password must be at least 6 characters.",
        "error"
      );

      return;
    }

    const button = $("registerBtn");

    button.disabled = true;

    button.textContent = "Creating...";

    try {

      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user =
        credential.user;

      await updateProfile(
        user,
        {
          displayName: name
        }
      );

      await setDoc(
        doc(db, "users", user.uid),
        {

          uid: user.uid,

          name,

          email,

          role: "admin",

          active: true,

          createdAt:
            serverTimestamp()

        }
      );

      showToast(
        "Account created successfully."
      );

      $("registerName").value = "";

      $("registerEmail").value = "";

      $("registerPassword").value = "";

    }

    catch (error) {

      console.error(error);

      showToast(
        firebaseErrorMessage(error),
        "error"
      );

    }

    finally {

      button.disabled = false;

      button.textContent =
        "Create Account";

    }

  }
);


/* ============================================================
   LOGIN
============================================================ */

$("loginBtn")?.addEventListener(
  "click",
  async () => {

    const email =
      $("loginEmail").value.trim();

    const password =
      $("loginPassword").value;

    if (!email || !password) {

      showToast(
        "Please enter email and password.",
        "error"
      );

      return;
    }

    const button = $("loginBtn");

    button.disabled = true;

    button.textContent = "Logging in...";

    try {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      showToast(
        "Login successful."
      );

    }

    catch (error) {

      console.error(error);

      showToast(
        firebaseErrorMessage(error),
        "error"
      );

    }

    finally {

      button.disabled = false;

      button.textContent = "Login";

    }

  }
);


/* ============================================================
   FORGOT PASSWORD
============================================================ */

$("forgotPasswordBtn")?.addEventListener(
  "click",
  async () => {

    const email =
      $("loginEmail").value.trim();

    if (!email) {

      showToast(
        "Enter your email first.",
        "error"
      );

      return;
    }

    try {

      await sendPasswordResetEmail(
        auth,
        email
      );

      showToast(
        "Password reset email sent."
      );

    }

    catch (error) {

      console.error(error);

      showToast(
        firebaseErrorMessage(error),
        "error"
      );

    }

  }
);


/* ============================================================
   LOGOUT
============================================================ */

$("logoutBtn")?.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

      state.user = null;

      state.profile = null;

      state.medicines = [];

      state.sales = [];

      state.history = [];

      showAuth();

      showToast(
        "Logged out successfully."
      );

    }

    catch (error) {

      console.error(error);

      showToast(
        "Unable to logout.",
        "error"
      );

    }

  }
);


/* ============================================================
   AUTH STATE
============================================================ */

onAuthStateChanged(
  auth,
  async (user) => {

    showLoader(false);

    if (!user) {

      showAuth();

      return;
    }

    state.user = user;

    showApp();

    await loadProfile();

    await loadAllData();

    updateUserUI();

    navigateTo(
      state.currentPage
    );

  }
);


/* ============================================================
   LOAD PROFILE
============================================================ */

async function loadProfile() {

  if (!state.user) return;

  try {

    const profileRef =
      doc(
        db,
        "users",
        state.user.uid
      );

    const snapshot =
      await getDoc(profileRef);

    if (snapshot.exists()) {

      state.profile =
        snapshot.data();

    }

    else {

      state.profile = {

        uid: state.user.uid,

        name:
          state.user.displayName ||
          "User",

        email:
          state.user.email || "",

        role: "admin",

        active: true

      };

      await setDoc(
        profileRef,
        {
          ...state.profile,
          createdAt: serverTimestamp()
        }
      );

    }

  }

  catch (error) {

    console.error(
      "Profile error:",
      error
    );

    showToast(
      "Could not load profile.",
      "error"
    );

  }

}


/* ============================================================
   LOAD ALL DATA
============================================================ */

async function loadAllData() {

  await Promise.all([
    loadMedicines(),
    loadSales(),
    loadHistory()
  ]);

  renderEverything();

}


/* ============================================================
   MEDICINES
============================================================ */

async function loadMedicines() {

  if (!state.user) return;

  try {

    const ref =
      collection(
        db,
        "users",
        state.user.uid,
        "medicines"
      );

    const snapshot =
      await getDocs(ref);

    state.medicines =
      snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

    state.medicines.sort(
      (a, b) =>
        String(a.name || "")
          .localeCompare(
            String(b.name || "")
          )
    );

  }

  catch (error) {

    console.error(error);

    showToast(
      "Could not load medicines.",
      "error"
    );

  }

}


/* ============================================================
   SALES
============================================================ */

async function loadSales() {

  if (!state.user) return;

  try {

    const ref =
      collection(
        db,
        "users",
        state.user.uid,
        "sales"
      );

    const snapshot =
      await getDocs(ref);

    state.sales =
      snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

    state.sales.sort(
      (a, b) =>
        getTimestampMs(b.createdAt) -
        getTimestampMs(a.createdAt)
    );

  }

  catch (error) {

    console.error(error);

    showToast(
      "Could not load sales.",
      "error"
    );

  }

}


/* ============================================================
   HISTORY
============================================================ */

async function loadHistory() {

  if (!state.user) return;

  try {

    const ref =
      collection(
        db,
        "users",
        state.user.uid,
        "history"
      );

    const snapshot =
      await getDocs(ref);

    state.history =
      snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

    state.history.sort(
      (a, b) =>
        getTimestampMs(b.createdAt) -
        getTimestampMs(a.createdAt)
    );

  }

  catch (error) {

    console.error(error);

    showToast(
      "Could not load history.",
      "error"
    );

  }

}


/* ============================================================
   NAVIGATION
============================================================ */

$$(".nav-btn").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        navigateTo(
          button.dataset.page
        );

        $("sidebar").classList.remove(
          "open"
        );

      }
    );

  }
);


$$("[data-go]").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        navigateTo(
          button.dataset.go
        );

      }
    );

  }
);


function navigateTo(page) {

  state.currentPage = page;

  $$(".page").forEach(
    (section) => {

      section.classList.remove(
        "active-page"
      );

    }
  );

  const target =
    $(`${"#"}${page}Page`);

  if (target) {

    target.classList.add(
      "active-page"
    );

  }

  $$(".nav-btn").forEach(
    (button) => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    }
  );

  const titles = {

    dashboard: "Dashboard",

    medicines: "Medicines",

    sales: "Sales",

    reports: "Reports",

    history: "History",

    profile: "Profile"

  };

  $("pageTitle").textContent =
    titles[page] || "Dashboard";

  if (page === "dashboard") {

    renderDashboard();

  }

  if (page === "medicines") {

    renderMedicines();

  }

  if (page === "sales") {

    renderSales();

  }

  if (page === "reports") {

    renderReports();

  }

  if (page === "history") {

    renderHistory();

  }

}


/* ============================================================
   MOBILE MENU
============================================================ */

$("menuBtn")?.addEventListener(
  "click",
  () => {

    $("sidebar").classList.toggle(
      "open"
    );

  }
);


/* ============================================================
   USER UI
============================================================ */

function updateUserUI() {

  const name =
    state.profile?.name ||
    state.user?.displayName ||
    "User";

  const email =
    state.profile?.email ||
    state.user?.email ||
    "";

  $("welcomeText").textContent =
    `Welcome, ${name}`;

  $("profileName").textContent =
    name;

  $("profileEmail").textContent =
    email;

  const letter =
    name
      .charAt(0)
      .toUpperCase() || "U";

  $("userAvatar").textContent =
    letter;

  $("profileAvatar").textContent =
    letter;

}


/* ============================================================
   ADD MEDICINE
============================================================ */

$("addMedicineBtn")?.addEventListener(
  "click",
  () => {

    openMedicineModal();

  }
);


function openMedicineModal(
  medicine = null
) {

  $("medicineForm").reset();

  state.editingMedicineId =
    medicine?.id || null;

  $("medicineId").value =
    medicine?.id || "";

  $("medicineModalTitle").textContent =
    medicine
      ? "Edit Medicine"
      : "Add Medicine";

  if (medicine) {

    $("medicineName").value =
      medicine.name || "";

    $("medicineCompany").value =
      medicine.company || "";

    $("medicineCategory").value =
      medicine.category || "";

    $("medicineUnit").value =
      medicine.unit || "";

    $("purchasePrice").value =
      medicine.purchasePrice ?? "";

    $("sellingPrice").value =
      medicine.sellingPrice ?? "";

    $("stockQuantity").value =
      medicine.stock ?? 0;

    $("minimumStock").value =
      medicine.minimumStock ?? 5;

    $("purchaseDate").value =
      medicine.purchaseDate || "";

    $("expiryDate").value =
      medicine.expiryDate || "";

    $("medicineNotes").value =
      medicine.notes || "";

  }

  $("medicineModal").classList.remove(
    "hidden"
  );

}


/* ============================================================
   SAVE MEDICINE
============================================================ */

$("medicineForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (!state.user) return;

    const id =
      $("medicineId").value;

    const medicineData = {

      name:
        $("medicineName").value.trim(),

      company:
        $("medicineCompany").value.trim(),

      category:
        $("medicineCategory").value,

      unit:
        $("medicineUnit").value,

      purchasePrice:
        Number(
          $("purchasePrice").value
        ),

      sellingPrice:
        Number(
          $("sellingPrice").value
        ),

      stock:
        Number(
          $("stockQuantity").value
        ),

      minimumStock:
        Number(
          $("minimumStock").value || 0
        ),

      purchaseDate:
        $("purchaseDate").value,

      expiryDate:
        $("expiryDate").value,

      notes:
        $("medicineNotes").value.trim(),

      updatedAt:
        serverTimestamp()

    };


    if (!medicineData.name) {

      showToast(
        "Medicine name is required.",
        "error"
      );

      return;
    }


    try {

      const medicinesRef =
        collection(
          db,
          "users",
          state.user.uid,
          "medicines"
        );


      if (id) {

        await updateDoc(
          doc(
            medicinesRef,
            id
          ),
          medicineData
        );

        await addHistory(
          "Medicine Updated",
          `${medicineData.name} was updated.`,
          "edit"
        );

        showToast(
          "Medicine updated."
        );

      }

      else {

        const newDoc =
          await addDoc(
            medicinesRef,
            {
              ...medicineData,

              createdAt:
                serverTimestamp()
            }
          );

        await addHistory(
          "Medicine Added",
          `${medicineData.name} was added with ${medicineData.stock} ${medicineData.unit}.`,
          "add"
        );

        showToast(
          "Medicine added successfully."
        );

      }


      closeModal(
        "medicineModal"
      );

      await loadMedicines();

      await loadHistory();

      renderEverything();

    }

    catch (error) {

      console.error(error);

      showToast(
        firebaseErrorMessage(error),
        "error"
      );

    }

  }
);


/* ============================================================
   DELETE MEDICINE
============================================================ */

async function deleteMedicine(id) {

  const medicine =
    state.medicines.find(
      (item) =>
        item.id === id
    );

  if (!medicine) return;

  const confirmed =
    confirm(
      `Delete "${medicine.name}"?`
    );

  if (!confirmed) return;

  try {

    await deleteDoc(
      doc(
        db,
        "users",
        state.user.uid,
        "medicines",
        id
      )
    );

    await addHistory(
      "Medicine Deleted",
      `${medicine.name} was deleted.`,
      "delete"
    );

    showToast(
      "Medicine deleted."
    );

    await loadMedicines();

    await loadHistory();

    renderEverything();

  }

  catch (error) {

    console.error(error);

    showToast(
      firebaseErrorMessage(error),
      "error"
    );

  }

}


/* ============================================================
   RENDER MEDICINES
============================================================ */

function renderMedicines() {

  const container =
    $("medicineList");

  if (!container) return;

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
    [...state.medicines];


  list =
    list.filter(
      (medicine) => {

        const text =
          `${medicine.name || ""} ${medicine.company || ""} ${medicine.category || ""}`
            .toLowerCase();

        if (
          search &&
          !text.includes(search)
        ) {
          return false;
        }

        const status =
          getMedicineStatus(medicine);

        if (
          filter !== "all" &&
          status !== filter
        ) {
          return false;
        }

        return true;

      }
    );


  if (!list.length) {

    container.innerHTML = `
      <div class="panel empty-state">
        No medicines found.
      </div>
    `;

    return;
  }


  container.innerHTML =
    list.map(
      (medicine) =>
        medicineCardHTML(medicine)
    ).join("");


  container
    .querySelectorAll(
      "[data-edit-medicine]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            const medicine =
              state.medicines.find(
                (item) =>
                  item.id ===
                  button.dataset.editMedicine
              );

            if (medicine) {

              openMedicineModal(
                medicine
              );

            }

          }
        );

      }
    );


  container
    .querySelectorAll(
      "[data-delete-medicine]"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            deleteMedicine(
              button.dataset.deleteMedicine
            );

          }
        );

      }
    );

}


function medicineCardHTML(
  medicine
) {

  const status =
    getMedicineStatus(
      medicine
    );

  const statusLabels = {

    available: "Available",

    low: "Low Stock",

    out: "Out of Stock",

    expiring: "Expiring Soon",

    expired: "Expired"

  };

  return `

    <div class="medicine-card">

      <div class="medicine-top">

        <div>

          <div class="medicine-name">
            ${escapeHTML(
              medicine.name || "Unnamed"
            )}
          </div>

          <div class="medicine-company">
            ${escapeHTML(
              medicine.company || "No company"
            )}
          </div>

        </div>

        <span
          class="status-badge status-${status}"
        >
          ${statusLabels[status]}
        </span>

      </div>


      <div class="medicine-meta">

        <div class="meta-item">

          <span>Stock</span>

          <strong>
            ${formatNumber(
              medicine.stock
            )}
            ${escapeHTML(
              medicine.unit || ""
            )}
          </strong>

        </div>


        <div class="meta-item">

          <span>Category</span>

          <strong>
            ${escapeHTML(
              medicine.category || "-"
            )}
          </strong>

        </div>


        <div class="meta-item">

          <span>Purchase</span>

          <strong>
            ${formatMoney(
              medicine.purchasePrice
            )}
          </strong>

        </div>


        <div class="meta-item">

          <span>Selling</span>

          <strong>
            ${formatMoney(
              medicine.sellingPrice
            )}
          </strong>

        </div>


        <div class="meta-item">

          <span>Expiry</span>

          <strong>
            ${formatDate(
              medicine.expiryDate
            )}
          </strong>

        </div>


        <div class="meta-item">

          <span>Profit / Unit</span>

          <strong>
            ${formatMoney(
              Number(
                medicine.sellingPrice || 0
              ) -
              Number(
                medicine.purchasePrice || 0
              )
            )}
          </strong>

        </div>

      </div>


      <div class="medicine-actions">

        <button
          class="edit-btn"
          data-edit-medicine="${medicine.id}"
        >
          Edit
        </button>

        <button
          class="delete-btn"
          data-delete-medicine="${medicine.id}"
        >
          Delete
        </button>

      </div>

    </div>

  `;

}


/* ============================================================
   MEDICINE FILTER
============================================================ */

$("medicineSearch")?.addEventListener(
  "input",
  renderMedicines
);

$("medicineFilter")?.addEventListener(
  "change",
  renderMedicines
);


/* ============================================================
   NEW SALE
============================================================ */

$("newSaleBtn")?.addEventListener(
  "click",
  () => {

    openSaleModal();

  }
);


function openSaleModal() {

  $("saleForm").reset();

  $("saleMedicineInfo")
    .classList.add("hidden");

  $("saleTotal").textContent =
    "Rs. 0";

  $("saleProfit").textContent =
    "Rs. 0";

  populateSaleMedicines();

  $("saleModal")
    .classList.remove("hidden");

}


function populateSaleMedicines() {

  const select =
    $("saleMedicine");

  select.innerHTML = `
    <option value="">
      Select medicine
    </option>
  `;


  state.medicines
    .filter(
      (medicine) =>
        Number(medicine.stock || 0) > 0 &&
        getMedicineStatus(medicine) !== "expired"
    )
    .forEach(
      (medicine) => {

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


/* ============================================================
   SALE MEDICINE CHANGE
============================================================ */

$("saleMedicine")?.addEventListener(
  "change",
  updateSalePreview
);

$("saleQuantity")?.addEventListener(
  "input",
  updateSalePreview
);


function updateSalePreview() {

  const medicine =
    state.medicines.find(
      (item) =>
        item.id ===
        $("saleMedicine").value
    );


  if (!medicine) {

    $("saleMedicineInfo")
      .classList.add("hidden");

    $("saleTotal").textContent =
      "Rs. 0";

    $("saleProfit").textContent =
      "Rs. 0";

    return;

  }


  $("saleMedicineInfo")
    .classList.remove("hidden");

  $("saleAvailableStock").textContent =
    `${medicine.stock} ${medicine.unit || ""}`;

  $("salePurchasePrice").textContent =
    formatMoney(
      medicine.purchasePrice
    );

  $("saleSellingPrice").textContent =
    formatMoney(
      medicine.sellingPrice
    );


  const quantity =
    Number(
      $("saleQuantity").value || 0
    );

  const total =
    quantity *
    Number(
      medicine.sellingPrice || 0
    );

  const profit =
    quantity *
    (
      Number(
        medicine.sellingPrice || 0
      ) -
      Number(
        medicine.purchasePrice || 0
      )
    );


  $("saleTotal").textContent =
    formatMoney(total);

  $("saleProfit").textContent =
    formatMoney(profit);

}


/* ============================================================
   COMPLETE SALE
============================================================ */

$("saleForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    if (!state.user) return;

    const medicineId =
      $("saleMedicine").value;

    const quantity =
      Number(
        $("saleQuantity").value
      );

    const customerName =
      $("customerName").value.trim();


    const medicine =
      state.medicines.find(
        (item) =>
          item.id === medicineId
      );


    if (!medicine) {

      showToast(
        "Please select a medicine.",
        "error"
      );

      return;
    }


    if (
      !quantity ||
      quantity <= 0
    ) {

      showToast(
        "Enter a valid quantity.",
        "error"
      );

      return;
    }


    if (
      quantity >
      Number(medicine.stock || 0)
    ) {

      showToast(
        "Not enough stock available.",
        "error"
      );

      return;
    }


    const purchasePrice =
      Number(
        medicine.purchasePrice || 0
      );

    const sellingPrice =
      Number(
        medicine.sellingPrice || 0
      );

    const total =
      quantity * sellingPrice;

    const cost =
      quantity * purchasePrice;

    const profit =
      total - cost;


    try {

      const medicineRef =
        doc(
          db,
          "users",
          state.user.uid,
          "medicines",
          medicine.id
        );

      const salesRef =
        collection(
          db,
          "users",
          state.user.uid,
          "sales"
        );


      await runTransaction(
        db,
        async (transaction) => {

          const snapshot =
            await transaction.get(
              medicineRef
            );

          if (!snapshot.exists()) {

            throw new Error(
              "Medicine no longer exists."
            );

          }

          const current =
            snapshot.data();

          const currentStock =
            Number(
              current.stock || 0
            );

          if (
            currentStock <
            quantity
          ) {

            throw new Error(
              "Not enough stock available."
            );

          }


          transaction.update(
            medicineRef,
            {

              stock:
                currentStock -
                quantity,

              updatedAt:
                serverTimestamp()

            }
          );


          const newSaleRef =
            doc(salesRef);

          transaction.set(
            newSaleRef,
            {

              medicineId:
                medicine.id,

              medicineName:
                medicine.name,

              quantity,

              unit:
                medicine.unit || "",

              purchasePrice,

              sellingPrice,

              total,

              cost,

              profit,

              customerName,

              createdAt:
                serverTimestamp()

            }
          );

        }
      );


      await addHistory(
        "Medicine Sold",
        `${medicine.name} — ${quantity} ${medicine.unit || "units"} sold for ${formatMoney(total)}. Profit: ${formatMoney(profit)}.`,
        "sale"
      );


      closeModal(
        "saleModal"
      );

      showToast(
        "Sale completed successfully."
      );


      await loadMedicines();

      await loadSales();

      await loadHistory();

      renderEverything();

    }

    catch (error) {

      console.error(error);

      showToast(
        error.message ||
        "Could not complete sale.",
        "error"
      );

    }

  }
);


/* ============================================================
   HISTORY
============================================================ */

async function addHistory(
  title,
  description,
  type
) {

  if (!state.user) return;

  try {

    await addDoc(
      collection(
        db,
        "users",
        state.user.uid,
        "history"
      ),
      {

        title,

        description,

        type,

        createdAt:
          serverTimestamp()

      }
    );

  }

  catch (error) {

    console.error(
      "History error:",
      error
    );

  }

}


/* ============================================================
   RENDER EVERYTHING
============================================================ */

function renderEverything() {

  renderDashboard();

  renderMedicines();

  renderSales();

  renderReports();

  renderHistory();

}


/* ============================================================
   DASHBOARD
============================================================ */

function renderDashboard() {

  const totalMedicines =
    state.medicines.length;

  const totalStock =
    state.medicines.reduce(
      (sum, medicine) =>
        sum +
        Number(
          medicine.stock || 0
        ),
      0
    );


  const lowStock =
    state.medicines.filter(
      (medicine) =>
        getMedicineStatus(medicine) ===
        "low"
    ).length;


  const expiring =
    state.medicines.filter(
      (medicine) =>
        getMedicineStatus(medicine) ===
        "expiring"
    ).length;


  const today =
    getPeriodStats("today");

  const week =
    getPeriodStats("week");

  const month =
    getPeriodStats("month");


  $("statMedicines").textContent =
    formatNumber(
      totalMedicines
    );

  $("statStock").textContent =
    formatNumber(
      totalStock
    );

  $("statTodaySales").textContent =
    formatMoney(
      today.sales
    );

  $("statTodayProfit").textContent =
    formatMoney(
      today.profit
    );

  $("statLowStock").textContent =
    formatNumber(
      lowStock
    );

  $("statExpiring").textContent =
    formatNumber(
      expiring
    );


  $("todayProfit").textContent =
    formatMoney(
      today.profit
    );

  $("todaySalesCount").textContent =
    `${today.count} sales`;

  $("weekProfit").textContent =
    formatMoney(
      week.profit
    );

  $("weekSalesCount").textContent =
    `${week.count} sales`;

  $("monthProfit").textContent =
    formatMoney(
      month.profit
    );

  $("monthSalesCount").textContent =
    `${month.count} sales`;


  renderRecentSales();

}


/* ============================================================
   RECENT SALES
============================================================ */

function renderRecentSales() {

  const container =
    $("recentSales");

  const sales =
    state.sales.slice(
      0,
      5
    );


  if (!sales.length) {

    container.innerHTML = `
      <div class="empty-state">
        No sales recorded yet.
      </div>
    `;

    return;
  }


  container.innerHTML = `
    <table>

      <thead>

        <tr>

          <th>Medicine</th>

          <th>Qty</th>

          <th>Total</th>

          <th>Profit</th>

          <th>Date</th>

        </tr>

      </thead>

      <tbody>

        ${sales.map(
          (sale) => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(
                  sale.medicineName || "-"
                )}
              </strong>
            </td>

            <td>
              ${formatNumber(
                sale.quantity
              )}
            </td>

            <td>
              ${formatMoney(
                sale.total
              )}
            </td>

            <td class="profit-positive">
              ${formatMoney(
                sale.profit
              )}
            </td>

            <td>
              ${formatDateTime(
                sale.createdAt
              )}
            </td>

          </tr>

        `
        ).join("")}

      </tbody>

    </table>
  `;

}


/* ============================================================
   SALES PAGE
============================================================ */

function renderSales() {

  const total =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total || 0
        ),
      0
    );

  const profit =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.profit || 0
        ),
      0
    );

  const items =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.quantity || 0
        ),
      0
    );


  $("salesPageTotal").textContent =
    formatMoney(total);

  $("salesPageProfit").textContent =
    formatMoney(profit);

  $("salesPageItems").textContent =
    formatNumber(items);


  const container =
    $("salesTable");


  if (!state.sales.length) {

    container.innerHTML = `
      <div class="empty-state">
        No sales recorded yet.
      </div>
    `;

    return;
  }


  container.innerHTML = `
    <table>

      <thead>

        <tr>

          <th>Medicine</th>
          <th>Quantity</th>
          <th>Purchase Cost</th>
          <th>Sale Amount</th>
          <th>Profit</th>
          <th>Customer</th>
          <th>Date</th>

        </tr>

      </thead>

      <tbody>

        ${state.sales.map(
          (sale) => `

          <tr>

            <td>
              <strong>
                ${escapeHTML(
                  sale.medicineName || "-"
                )}
              </strong>
            </td>

            <td>
              ${formatNumber(
                sale.quantity
              )}
            </td>

            <td>
              ${formatMoney(
                sale.cost
              )}
            </td>

            <td>
              ${formatMoney(
                sale.total
              )}
            </td>

            <td class="profit-positive">
              ${formatMoney(
                sale.profit
              )}
            </td>

            <td>
              ${escapeHTML(
                sale.customerName ||
                "-"
              )}
            </td>

            <td>
              ${formatDateTime(
                sale.createdAt
              )}
            </td>

          </tr>

        `
        ).join("")}

      </tbody>

    </table>
  `;

}


/* ============================================================
   REPORTS
============================================================ */

function renderReports() {

  const today =
    getPeriodStats("today");

  const week =
    getPeriodStats("week");

  const month =
    getPeriodStats("month");


  $("reportTodaySales").textContent =
    formatMoney(
      today.sales
    );

  $("reportTodayProfit").textContent =
    `Profit: ${formatMoney(today.profit)}`;


  $("reportWeekSales").textContent =
    formatMoney(
      week.sales
    );

  $("reportWeekProfit").textContent =
    `Profit: ${formatMoney(week.profit)}`;


  $("reportMonthSales").textContent =
    formatMoney(
      month.sales
    );

  $("reportMonthProfit").textContent =
    `Profit: ${formatMoney(month.profit)}`;


  const totalRevenue =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total || 0
        ),
      0
    );

  const totalCost =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.cost || 0
        ),
      0
    );

  const totalProfit =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.profit || 0
        ),
      0
    );

  const totalItems =
    state.sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.quantity || 0
        ),
      0
    );


  $("reportRevenue").textContent =
    formatMoney(
      totalRevenue
    );

  $("reportCost").textContent =
    formatMoney(
      totalCost
    );

  $("reportProfit").textContent =
    formatMoney(
      totalProfit
    );

  $("reportItems").textContent =
    formatNumber(
      totalItems
    );

}


/* ============================================================
   PERIOD STATS
============================================================ */

function getPeriodStats(
  period
) {

  const now =
    new Date();

  const start =
    new Date(now);

  start.setHours(
    0,
    0,
    0,
    0
  );


  if (period === "week") {

    const day =
      start.getDay();

    const diff =
      day === 0
        ? 6
        : day - 1;

    start.setDate(
      start.getDate() -
      diff
    );

  }


  if (period === "month") {

    start.setDate(1);

  }


  let sales = 0;

  let profit = 0;

  let count = 0;


  state.sales.forEach(
    (sale) => {

      const date =
        timestampToDate(
          sale.createdAt
        );

      if (!date) return;

      if (date >= start) {

        sales +=
          Number(
            sale.total || 0
          );

        profit +=
          Number(
            sale.profit || 0
          );

        count++;

      }

    }
  );


  return {
    sales,
    profit,
    count
  };

}


/* ============================================================
   HISTORY RENDER
============================================================ */

function renderHistory() {

  const container =
    $("historyList");

  if (!state.history.length) {

    container.innerHTML = `
      <div class="panel empty-state">
        No history available yet.
      </div>
    `;

    return;
  }


  container.innerHTML =
    state.history
      .map(
        (item) => `

        <div class="history-item">

          <div class="history-icon">
            ${historyIcon(
              item.type
            )}
          </div>

          <div class="history-content">

            <strong>
              ${escapeHTML(
                item.title || "Activity"
              )}
            </strong>

            <span>
              ${escapeHTML(
                item.description || ""
              )}
            </span>

          </div>

          <small>
            ${formatDateTime(
              item.createdAt
            )}
          </small>

        </div>

      `
      )
      .join("");

}


/* ============================================================
   MODALS
============================================================ */

$$("[data-close]").forEach(
  (button) => {

    button.addEventListener(
      "click",
      () => {

        closeModal(
          button.dataset.close
        );

      }
    );

  }
);


function closeModal(id) {

  $(id)?.classList.add(
    "hidden"
  );

}


$("medicineModal")?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      $("medicineModal")
    ) {

      closeModal(
        "medicineModal"
      );

    }

  }
);


$("saleModal")?.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      $("saleModal")
    ) {

      closeModal(
        "saleModal"
      );

    }

  }
);


/* ============================================================
   MEDICINE STATUS
============================================================ */

function getMedicineStatus(
  medicine
) {

  const stock =
    Number(
      medicine.stock || 0
    );

  if (stock <= 0) {

    return "out";

  }


  const expiry =
    parseDate(
      medicine.expiryDate
    );


  if (expiry) {

    const now =
      new Date();

    now.setHours(
      0,
      0,
      0,
      0
    );

    const diff =
      expiry.getTime() -
      now.getTime();

    const days =
      Math.ceil(
        diff /
        (1000 * 60 * 60 * 24)
      );


    if (days < 0) {

      return "expired";

    }


    if (days <= 30) {

      return "expiring";

    }

  }


  const minimum =
    Number(
      medicine.minimumStock ?? 5
    );


  if (
    stock <= minimum
  ) {

    return "low";

  }


  return "available";

}


/* ============================================================
   UTILITIES
============================================================ */

function parseDate(value) {

  if (!value) return null;

  const date =
    new Date(
      `${value}T00:00:00`
    );

  return isNaN(
    date.getTime()
  )
    ? null
    : date;

}


function timestampToDate(
  timestamp
) {

  if (!timestamp) return null;

  if (
    typeof timestamp.toDate ===
    "function"
  ) {

    return timestamp.toDate();

  }

  if (
    timestamp instanceof Date
  ) {

    return timestamp;

  }

  return null;

}


function getTimestampMs(
  timestamp
) {

  const date =
    timestampToDate(
      timestamp
    );

  return date
    ? date.getTime()
    : 0;

}


function formatMoney(
  value
) {

  const number =
    Number(value || 0);

  return `Rs. ${number.toLocaleString(
    "en-PK",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )}`;

}


function formatNumber(
  value
) {

  return Number(
    value || 0
  ).toLocaleString(
    "en-PK"
  );

}


function formatDate(
  value
) {

  if (!value) return "-";

  const date =
    parseDate(value);

  if (!date) return "-";

  return date.toLocaleDateString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );

}


function formatDateTime(
  timestamp
) {

  const date =
    timestampToDate(
      timestamp
    );

  if (!date) return "Just now";

  return date.toLocaleString(
    "en-PK",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function historyIcon(
  type
) {

  const icons = {

    add: "➕",

    edit: "✏️",

    delete: "🗑️",

    sale: "🛒",

    stock: "📦"

  };

  return icons[type] || "📋";

}


function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* ============================================================
   FIREBASE ERROR MESSAGES
============================================================ */

function firebaseErrorMessage(
  error
) {

  const code =
    error?.code || "";

  const messages = {

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/invalid-email":
      "Please enter a valid email.",

    "auth/weak-password":
      "Password is too weak.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "permission-denied":
      "Permission denied. Check Firebase security rules."

  };


  return (
    messages[code] ||
    error?.message ||
    "Something went wrong."
  );

}


/* ============================================================
   INITIAL UI
============================================================ */

showLoader(true);


/* ============================================================
   END
============================================================ */
