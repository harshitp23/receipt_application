// ============================================================
//  OurKids Receipt Generator
//  Firebase modular SDK + Firestore + Google auth
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, setDoc, getDocs,
  query, orderBy, where, limit, serverTimestamp, deleteDoc,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

// ============================================================
//  FIREBASE INIT
// ============================================================
const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);

let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("Persistence init failed, falling back to default:", e);
  db = getFirestore(firebaseApp);
}

const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);

const authGate    = $("authGate");
const appRoot     = $("appRoot");
const signInBtn   = $("signInBtn");
const signOutBtn  = $("signOutBtn");
const authError   = $("authError");
const userBadge   = $("userBadge");

const receiptNo    = $("receiptNo");
const receiptDate  = $("receiptDate");
const parentSelect = $("parentSelect");
const childName    = $("childName");
const itemsContainer = $("itemsContainer");
const itemsEmpty   = $("itemsEmpty");
const addItemBtn   = $("addItemBtn");
const downloadBtn  = $("downloadBtn");
const resetBtn     = $("resetBtn");
const pastReceiptsBtn = $("pastReceiptsBtn");
const editingBanner   = $("editingBanner");
const editingReceiptNo = $("editingReceiptNo");
const cancelEditBtn   = $("cancelEditBtn");

const rParentName  = $("rParentName");
const rChildName   = $("rChildName");
const rReceiptNo   = $("rReceiptNo");
const rReceiptDate = $("rReceiptDate");
const rItemsBody   = $("rItemsBody");
const rTotal       = $("rTotal");
const rWords       = $("rWords");

const newParentModal = $("newParentModal");
const newParentName  = $("newParentName");
const newChildName   = $("newChildName");
const newParentError = $("newParentError");
const saveNewParentBtn = $("saveNewParentBtn");

const pastReceiptsModal = $("pastReceiptsModal");
const receiptsSearch = $("receiptsSearch");
const receiptsList   = $("receiptsList");

const loadingOverlay = $("loadingOverlay");
const loadingText    = $("loadingText");

// ============================================================
//  STATE
// ============================================================
let currentUser = null;
let parentsCache = [];   
let receiptsCache = [];   
let editingReceiptId = null; 
const FEE_CATEGORIES = [
  "Registration Fee",
  "Daycare Fee",
  "Preschool Fee",
  "Summer Camp Fee",
  "Activity Fee"
];

// ============================================================
//  AUTH FLOW
// ============================================================

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Check email is allowed
    if (!ALLOWED_EMAILS.includes(user.email)) {
      authError.textContent = `Sorry, ${user.email} is not authorized. Contact admin to add your email.`;
      authError.style.display = "block";
      await signOut(auth);
      return;
    }
    currentUser = user;
    authGate.style.display = "none";
    appRoot.style.display = "grid";
    userBadge.textContent = user.email;
    await bootstrapApp();
  } else {
    currentUser = null;
    authGate.style.display = "flex";
    appRoot.style.display = "none";
  }
});

signInBtn.addEventListener("click", async () => {
  authError.style.display = "none";
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    authError.textContent = "Sign-in failed: " + err.message;
    authError.style.display = "block";
  }
});

signOutBtn.addEventListener("click", async () => {
  if (confirm("Sign out?")) await signOut(auth);
});

// ============================================================
//  BOOTSTRAP — runs once after auth succeeds
// ============================================================

async function bootstrapApp() {
  // Fill bank details
  $("bankName").textContent    = BANK_DETAILS.bankName;
  $("bankHolder").textContent  = BANK_DETAILS.holder;
  $("bankAccount").textContent = BANK_DETAILS.accountNo;
  $("bankIFSC").textContent    = BANK_DETAILS.ifsc;
  $("bankPAN").textContent     = BANK_DETAILS.pan;
  $("bankAddress").textContent = BANK_DETAILS.address;

  setDefaultDate();
  await loadParents();
  await refreshReceiptNumber();
  updatePreview();
}

// ============================================================
//  DATE + RECEIPT NUMBER
// ============================================================

function firstOfThisMonth() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function setDefaultDate() {
  receiptDate.value = firstOfThisMonth();
}

async function refreshReceiptNumber() {
  if (editingReceiptId) return; 

  const date = receiptDate.value || firstOfThisMonth();
  const [y, m] = date.split("-");
  const prefix = `${y}-${m}-`;

  try {
    const ref = collection(db, "receipts");
    const q = query(ref, orderBy("counter", "desc"), limit(1));
    const snap = await getDocs(q);

    let nextNum = 1;
    if (!snap.empty) {
      const lastCounter = snap.docs[0].data().counter;
      if (typeof lastCounter === "number") {
        nextNum = lastCounter + 1;
      } else {
        const lastRcptNo = snap.docs[0].data().receiptNo || "";
        const parsed = parseInt(lastRcptNo.split("-").pop(), 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
    }

    const allSnap = await getDocs(query(ref, orderBy("receiptNo", "desc"), limit(50)));
    for (const d of allSnap.docs) {
      const rn = d.data().receiptNo || "";
      const parsed = parseInt(rn.split("-").pop(), 10);
      if (!isNaN(parsed) && parsed >= nextNum) {
        nextNum = parsed + 1;
      }
    }

    receiptNo.value = prefix + String(nextNum).padStart(3, "0");
  } catch (err) {
    console.error("Failed to get next receipt number:", err);
    receiptNo.value = prefix + "001";
  }
}

// ============================================================
//  PARENTS — load + dropdown
// ============================================================

async function loadParents() {
  try {
    const snap = await getDocs(query(collection(db, "parents"), orderBy("parentName")));
    parentsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderParentDropdown();
  } catch (err) {
    console.error("Failed to load parents:", err);
    parentSelect.innerHTML = '<option value="" disabled selected>Failed to load — retry?</option>';
  }
}

function renderParentDropdown(selectedId = "") {
  const placeholderSel = selectedId ? "" : " selected";
  let html = `<option value="" disabled${placeholderSel}>Select parent...</option>`;
  for (const p of parentsCache) {
    const sel = p.id === selectedId ? " selected" : "";
    html += `<option value="${escapeAttr(p.id)}"${sel}>${escapeHtml(p.parentName)}</option>`;
  }
  html += `<option value="__ADD_NEW__">+ Add new parent</option>`;
  parentSelect.innerHTML = html;
}

parentSelect.addEventListener("change", () => {
  const val = parentSelect.value;
  if (val === "__ADD_NEW__") {
    openNewParentModal();
    return;
  }
  const parent = parentsCache.find(p => p.id === val);
  if (parent) {
    childName.value = parent.childName;
  }
  refreshUpdateParentBtn();
  updatePreview();
});

const updateParentRecordBtn = $("updateParentRecordBtn");
function refreshUpdateParentBtn() {
  const parent = parentsCache.find(p => p.id === parentSelect.value);
  const typed = childName.value.trim();
  const shouldShow = parent && typed && typed !== parent.childName;
  updateParentRecordBtn.style.display = shouldShow ? "inline-block" : "none";
}

childName.addEventListener("input", () => {
  refreshUpdateParentBtn();
  updatePreview();
});

updateParentRecordBtn.addEventListener("click", async () => {
  const parent = parentsCache.find(p => p.id === parentSelect.value);
  if (!parent) return;
  const newName = childName.value.trim();
  if (!newName) return;
  if (!confirm(`Update ${parent.parentName}'s child name from "${parent.childName}" to "${newName}" in the database?`)) return;

  updateParentRecordBtn.disabled = true;
  updateParentRecordBtn.textContent = "Saving...";
  try {
    await setDoc(doc(db, "parents", parent.id), { childName: newName }, { merge: true });
    parent.childName = newName;
    refreshUpdateParentBtn();
  } catch (err) {
    console.error(err);
    alert("Failed to update: " + err.message);
  } finally {
    updateParentRecordBtn.disabled = false;
    updateParentRecordBtn.textContent = "Save change to parent record";
  }
});

// ============================================================
//  NEW PARENT MODAL
// ============================================================

function openNewParentModal() {
  newParentName.value = "";
  newChildName.value = "";
  newParentError.style.display = "none";
  newParentModal.style.display = "flex";
  setTimeout(() => newParentName.focus(), 50);
}

function closeNewParentModal() {
  newParentModal.style.display = "none";
  // Reset dropdown if no parent is currently selected (user cancelled)
  if (!parentsCache.find(p => p.id === parentSelect.value)) {
    parentSelect.value = "";
  }
}

newParentModal.addEventListener("click", (e) => {
  if (e.target.dataset.close !== undefined) closeNewParentModal();
});

saveNewParentBtn.addEventListener("click", async () => {
  const pname = newParentName.value.trim();
  const cname = newChildName.value.trim();
  if (!pname || !cname) {
    newParentError.textContent = "Both fields are required.";
    newParentError.style.display = "block";
    return;
  }

  saveNewParentBtn.disabled = true;
  saveNewParentBtn.textContent = "Saving...";
  try {
    const id = slugify(pname + "_" + cname) + "_" + Date.now().toString(36);
    await setDoc(doc(db, "parents", id), {
      parentName: pname,
      childName: cname,
      createdAt: serverTimestamp()
    });
    parentsCache.push({ id, parentName: pname, childName: cname });
    parentsCache.sort((a, b) => a.parentName.localeCompare(b.parentName));
    renderParentDropdown(id);
    childName.value = cname;
    newParentModal.style.display = "none";
    updatePreview();
  } catch (err) {
    console.error(err);
    newParentError.textContent = "Failed to save: " + err.message;
    newParentError.style.display = "block";
  } finally {
    saveNewParentBtn.disabled = false;
    saveNewParentBtn.textContent = "Save parent";
  }
});

// ============================================================
//  LINE ITEMS
// ============================================================

function createItemRow(category = "", amount = "") {
  itemsEmpty.style.display = "none";
  const row = document.createElement("div");
  row.className = "item-row";
  const options = FEE_CATEGORIES.map(c =>
    `<option value="${escapeAttr(c)}"${c === category ? " selected" : ""}>${escapeHtml(c)}</option>`
  ).join("");
  row.innerHTML = `
    <select class="item-desc">
      <option value="" disabled${category ? "" : " selected"}>Select fee type</option>
      ${options}
    </select>
    <input type="number" class="item-amount" placeholder="Amount" min="0" step="1" value="${escapeAttr(amount)}">
    <button type="button" class="remove-btn" title="Remove">×</button>
  `;
  row.querySelector(".item-desc").addEventListener("change", updatePreview);
  row.querySelector(".item-amount").addEventListener("input", updatePreview);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    if (!itemsContainer.children.length) itemsEmpty.style.display = "block";
    updatePreview();
  });
  itemsContainer.appendChild(row);
  return row;
}

addItemBtn.addEventListener("click", () => {
  createItemRow();
  updatePreview();
});

function getItems() {
  return Array.from(itemsContainer.querySelectorAll(".item-row")).map(row => ({
    category: row.querySelector(".item-desc").value.trim(),
    amount: parseFloat(row.querySelector(".item-amount").value) || 0
  }));
}

function expandDescription(category, isoDate) {
  if (!category) return "";
  const monthly = ["Daycare Fee", "Preschool Fee", "Activity Fee"];
  if (monthly.includes(category) && isoDate) {
    const [y, m] = isoDate.split("-");
    const months = ["January","February","March","April","May","June",
                    "July","August","September","October","November","December"];
    return `${category} for ${months[parseInt(m,10)-1]} ${y}`;
  }
  return category;
}

// ============================================================
//  PREVIEW UPDATE
// ============================================================

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d,10)} ${months[parseInt(m,10)-1]} ${y}`;
}

function formatINR(n) {
  return n.toLocaleString("en-IN");
}

function updatePreview() {
  const selectedParent = parentsCache.find(p => p.id === parentSelect.value);
  rParentName.textContent  = selectedParent ? selectedParent.parentName : "—";
  rChildName.textContent   = childName.value.trim() || "—";
  rReceiptNo.textContent   = receiptNo.value.trim() || "—";
  rReceiptDate.textContent = formatDate(receiptDate.value);

  const items = getItems();
  rItemsBody.innerHTML = "";
  let total = 0;
  items.forEach((item, i) => {
    const fullDesc = expandDescription(item.category, receiptDate.value);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="sno">${i + 1}</td>
      <td>${escapeHtml(fullDesc) || "<span style='color:#bbb'>—</span>"}</td>
      <td class="amt">${item.amount ? formatINR(item.amount) : ""}</td>
    `;
    rItemsBody.appendChild(tr);
    total += item.amount;
  });

  rTotal.textContent = "₹ " + formatINR(total);
  rWords.textContent = total > 0
    ? "INR " + numberToWordsIndian(total) + " Only"
    : "—";
}

receiptDate.addEventListener("change", async () => {
  await refreshReceiptNumber();
  updatePreview();
});

// ============================================================
//  NUMBER TO WORDS (Indian)
// ============================================================

function numberToWordsIndian(num) {
  if (num === 0) return "Zero";
  num = Math.floor(num);
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function twoDigit(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  }
  function threeDigit(n) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    let str = "";
    if (h) str += ones[h] + " Hundred";
    if (rest) str += (h ? " " : "") + twoDigit(rest);
    return str;
  }
  let result = "";
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000);    num %= 100000;
  const thousand = Math.floor(num / 1000);  num %= 1000;
  const remainder = num;
  if (crore)    result += threeDigit(crore) + " Crore ";
  if (lakh)     result += threeDigit(lakh) + " Lakh ";
  if (thousand) result += threeDigit(thousand) + " Thousand ";
  if (remainder) result += threeDigit(remainder);
  return result.trim();
}

// ============================================================
//  ESCAPING
// ============================================================
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function escapeAttr(str) { return escapeHtml(str); }
function slugify(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

// ============================================================
//  SAVE RECEIPT (called after PDF download)
// ============================================================

async function saveReceiptToFirestore() {
  const parent = parentsCache.find(p => p.id === parentSelect.value);
  if (!parent) throw new Error("No parent selected");

  const items = getItems().filter(i => i.category && i.amount > 0);
  const total = items.reduce((s, i) => s + i.amount, 0);

  const [y, m] = receiptDate.value.split("-");
  const counterFromRcptNo = parseInt(receiptNo.value.split("-").pop(), 10);

  const data = {
    receiptNo:  receiptNo.value,
    counter:    isNaN(counterFromRcptNo) ? null : counterFromRcptNo,
    year:       parseInt(y, 10),
    month:      parseInt(m, 10),
    date:       receiptDate.value,
    parentId:   parent.id,
    parentName: parent.parentName,
    childName:  childName.value.trim() || parent.childName,
    items:      items,
    total:      total,
    updatedAt:  serverTimestamp()
  };

  const docId = editingReceiptId || receiptNo.value;
  if (!editingReceiptId) data.createdAt = serverTimestamp();

  await setDoc(doc(db, "receipts", docId), data, { merge: true });
  return docId;
}

// ============================================================
//  PDF DOWNLOAD (+ save to Firestore)
// ============================================================

downloadBtn.addEventListener("click", async () => {
  const parent = parentsCache.find(p => p.id === parentSelect.value);
  if (!parent) {
    alert("Please select a parent.");
    return;
  }
  const items = getItems().filter(i => i.category && i.amount > 0);
  if (items.length === 0) {
    alert("Please add at least one line item with a fee type and amount.");
    return;
  }

  downloadBtn.disabled = true;
  const labelEl = downloadBtn.querySelector(".btn-label");
  const originalLabel = labelEl.textContent;
  labelEl.textContent = "Generating...";

  try {
    labelEl.textContent = editingReceiptId ? "Saving changes..." : "Saving receipt...";
    await saveReceiptToFirestore();

    labelEl.textContent = "Generating PDF...";
    const receiptEl = $("receipt");
    const originalTransform = receiptEl.style.transform;
    receiptEl.style.transform = "none";

    const canvas = await html2canvas(receiptEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: receiptEl.scrollWidth,
      windowHeight: receiptEl.scrollHeight
    });
    receiptEl.style.transform = originalTransform;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    } else {
      let remaining = imgHeight, position = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        remaining -= pdfHeight;
        position -= pdfHeight;
        if (remaining > 0) pdf.addPage();
      }
    }
    const filenameChild = (childName.value.trim() || parent.childName).replace(/\s+/g, "_");
    const filename = `Receipt_${receiptNo.value}_${filenameChild}.pdf`;
    pdf.save(filename);

    if (!editingReceiptId) {
      await refreshReceiptNumber();
      updatePreview();
    } else {
      exitEditMode();
    }
  } catch (err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    labelEl.textContent = originalLabel;
    downloadBtn.disabled = false;
    updateDownloadButtonLabel();
  }
});

function updateDownloadButtonLabel() {
  const label = downloadBtn.querySelector(".btn-label");
  label.textContent = editingReceiptId ? "Save changes & download PDF" : "Download PDF";
}

// ============================================================
//  RESET / NEW RECEIPT
// ============================================================

resetBtn.addEventListener("click", () => {
  if (!confirm("Start a new blank receipt?")) return;
  startNewReceipt();
});

async function startNewReceipt() {
  exitEditMode();
  parentSelect.value = "";
  childName.value = "";
  refreshUpdateParentBtn();
  setDefaultDate();
  await refreshReceiptNumber();
  itemsContainer.innerHTML = "";
  itemsEmpty.style.display = "block";
  updatePreview();
}

// ============================================================
//  EDIT MODE
// ============================================================

function enterEditMode(receipt) {
  editingReceiptId = receipt.id;
  editingBanner.style.display = "flex";
  editingReceiptNo.textContent = receipt.receiptNo;
  updateDownloadButtonLabel();
  resetBtn.textContent = "Cancel edit";
}

function exitEditMode() {
  editingReceiptId = null;
  editingBanner.style.display = "none";
  updateDownloadButtonLabel();
  resetBtn.textContent = "New";
}

cancelEditBtn.addEventListener("click", () => {
  if (confirm("Discard edits and start fresh?")) startNewReceipt();
});

// ============================================================
//  PAST RECEIPTS MODAL
// ============================================================

pastReceiptsBtn.addEventListener("click", async () => {
  pastReceiptsModal.style.display = "flex";
  receiptsList.innerHTML = '<p class="empty-hint">Loading...</p>';
  receiptsSearch.value = "";
  await loadReceipts();
  renderReceiptsList();
});

pastReceiptsModal.addEventListener("click", (e) => {
  if (e.target.dataset.close !== undefined) {
    pastReceiptsModal.style.display = "none";
  }
});

receiptsSearch.addEventListener("input", () => renderReceiptsList());

async function loadReceipts() {
  try {
    const snap = await getDocs(query(collection(db, "receipts"), orderBy("receiptNo", "desc")));
    receiptsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error(err);
    receiptsList.innerHTML = `<p class="empty-hint">Failed to load: ${escapeHtml(err.message)}</p>`;
  }
}

function renderReceiptsList() {
  const q = receiptsSearch.value.trim().toLowerCase();
  const filtered = q
    ? receiptsCache.filter(r =>
        (r.parentName || "").toLowerCase().includes(q) ||
        (r.childName || "").toLowerCase().includes(q) ||
        (r.receiptNo || "").toLowerCase().includes(q))
    : receiptsCache;

  if (filtered.length === 0) {
    receiptsList.innerHTML = '<p class="empty-hint">No receipts found.</p>';
    return;
  }

  receiptsList.innerHTML = filtered.map(r => `
    <div class="receipt-row" data-id="${escapeAttr(r.id)}">
      <div class="receipt-row-main">
        <div class="receipt-row-no">${escapeHtml(r.receiptNo)}</div>
        <div class="receipt-row-meta">
          <span class="receipt-row-parent">${escapeHtml(r.parentName)}</span>
          <span class="receipt-row-sep">·</span>
          <span class="receipt-row-child">${escapeHtml(r.childName)}</span>
          <span class="receipt-row-sep">·</span>
          <span class="receipt-row-date">${escapeHtml(formatDate(r.date))}</span>
        </div>
      </div>
      <div class="receipt-row-amt">₹ ${formatINR(r.total || 0)}</div>
      <div class="receipt-row-actions">
        <button class="btn-secondary btn-sm" data-action="open" data-id="${escapeAttr(r.id)}">Open</button>
        <button class="btn-danger btn-sm" data-action="delete" data-id="${escapeAttr(r.id)}" title="Delete">×</button>
      </div>
    </div>
  `).join("");

  receiptsList.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === "open") openReceipt(id);
      else if (action === "delete") deleteReceipt(id);
    });
  });
}

function openReceipt(id) {
  const r = receiptsCache.find(x => x.id === id);
  if (!r) return;

  let parent = parentsCache.find(p => p.id === r.parentId);
  if (!parent) {
    parent = { id: r.parentId || "missing_" + id, parentName: r.parentName, childName: r.childName };
    parentsCache.push(parent);
    parentsCache.sort((a, b) => a.parentName.localeCompare(b.parentName));
  }

  enterEditMode(r);
  receiptDate.value = r.date;
  receiptNo.value = r.receiptNo;
  renderParentDropdown(parent.id);
  childName.value = r.childName;
  refreshUpdateParentBtn();

  itemsContainer.innerHTML = "";
  itemsEmpty.style.display = "none";
  for (const item of (r.items || [])) {
    createItemRow(item.category, item.amount);
  }
  if (!(r.items && r.items.length)) itemsEmpty.style.display = "block";

  pastReceiptsModal.style.display = "none";
  updatePreview();
}

async function deleteReceipt(id) {
  const r = receiptsCache.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`Delete receipt ${r.receiptNo} for ${r.parentName}? This can't be undone.`)) return;

  try {
    await deleteDoc(doc(db, "receipts", id));
    receiptsCache = receiptsCache.filter(x => x.id !== id);
    renderReceiptsList();
    if (editingReceiptId === id) startNewReceipt();
  } catch (err) {
    console.error(err);
    alert("Failed to delete: " + err.message);
  }
}
