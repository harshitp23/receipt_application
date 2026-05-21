// ============================================================
//  OurKids Receipt Generator
//  All logic in one file for simplicity.
// ============================================================

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);

const parentName   = $("parentName");
const childName    = $("childName");
const receiptNo    = $("receiptNo");
const receiptDate  = $("receiptDate");
const itemsContainer = $("itemsContainer");
const addItemBtn   = $("addItemBtn");
const downloadBtn  = $("downloadBtn");
const resetBtn     = $("resetBtn");

// Receipt-side refs
const rParentName  = $("rParentName");
const rChildName   = $("rChildName");
const rReceiptNo   = $("rReceiptNo");
const rReceiptDate = $("rReceiptDate");
const rItemsBody   = $("rItemsBody");
const rTotal       = $("rTotal");
const rWords       = $("rWords");

// ============================================================
//  INITIAL SETUP
// ============================================================

// Fill bank details from config.js
$("bankName").textContent    = BANK_DETAILS.bankName;
$("bankHolder").textContent  = BANK_DETAILS.holder;
$("bankAccount").textContent = BANK_DETAILS.accountNo;
$("bankIFSC").textContent    = BANK_DETAILS.ifsc;
$("bankPAN").textContent     = BANK_DETAILS.pan;
$("bankAddress").textContent = BANK_DETAILS.address;

// Default date = 1st of the current month
function firstOfThisMonth() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}
function setDefaultDate() {
  receiptDate.value = firstOfThisMonth();
}
setDefaultDate();

// Receipt number: YYYY-MM-NNN, resets every month, increments per receipt
// Counter is stored per-month in localStorage so it survives reloads.
function buildReceiptNumber(isoDate, counter) {
  const [y, m] = isoDate.split("-");
  return `${y}-${m}-${String(counter).padStart(3, '0')}`;
}
function getCounterForMonth(isoDate) {
  const [y, m] = isoDate.split("-");
  const key = `ourkids_counter_${y}_${m}`;
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved, 10) : 1;
}
function bumpCounterForMonth(isoDate) {
  const [y, m] = isoDate.split("-");
  const key = `ourkids_counter_${y}_${m}`;
  const next = getCounterForMonth(isoDate) + 1;
  localStorage.setItem(key, String(next));
}
function refreshReceiptNumber() {
  const date = receiptDate.value || firstOfThisMonth();
  const counter = getCounterForMonth(date);
  receiptNo.value = buildReceiptNumber(date, counter);
}
refreshReceiptNumber();

// ============================================================
//  LINE ITEMS
// ============================================================

// Fee categories shown in the description dropdown
const FEE_CATEGORIES = [
  "Registration Fee",
  "Daycare Fee",
  "Preschool Fee",
  "Summer Camp Fee",
  "Activity Fee"
];

function createItemRow(category = "", amount = "") {
  const row = document.createElement("div");
  row.className = "item-row";

  const options = FEE_CATEGORIES.map(c =>
    `<option value="${escapeHtml(c)}"${c === category ? " selected" : ""}>${escapeHtml(c)}</option>`
  ).join("");

  row.innerHTML = `
    <select class="item-desc">
      <option value="" disabled${category ? "" : " selected"}>Select fee type</option>
      ${options}
    </select>
    <input type="number" class="item-amount" placeholder="Amount" min="0" step="1" value="${escapeHtml(amount)}">
    <button type="button" class="remove-btn" title="Remove">×</button>
  `;
  row.querySelector(".item-desc").addEventListener("change", updatePreview);
  row.querySelector(".item-amount").addEventListener("input", updatePreview);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    updatePreview();
  });
  itemsContainer.appendChild(row);
  return row;
}

addItemBtn.addEventListener("click", () => {
  createItemRow();
  updatePreview();
});

// Start with two default rows
createItemRow("Daycare Fee", "");
createItemRow("Registration Fee", "");

// ============================================================
//  PREVIEW UPDATE
// ============================================================

function getItems() {
  return Array.from(itemsContainer.querySelectorAll(".item-row")).map(row => ({
    category: row.querySelector(".item-desc").value.trim(),
    amount: parseFloat(row.querySelector(".item-amount").value) || 0
  }));
}

// Some categories read better with the receipt's month/year appended
// e.g. "Daycare Fee" => "Daycare Fee for May 2026"
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

function formatDate(isoDate) {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d,10)} ${months[parseInt(m,10)-1]} ${y}`;
}

function formatINR(n) {
  // Indian number formatting: 1,23,456
  return n.toLocaleString("en-IN");
}

function updatePreview() {
  rParentName.textContent  = parentName.value.trim()  || "—";
  rChildName.textContent   = childName.value.trim()   || "—";
  rReceiptNo.textContent   = receiptNo.value.trim()   || "—";
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

// Bind form inputs
[parentName, childName].forEach(el => {
  el.addEventListener("input", updatePreview);
});
receiptDate.addEventListener("change", () => {
  refreshReceiptNumber();
  updatePreview();
});

updatePreview();

// ============================================================
//  NUMBER TO WORDS (Indian system: lakhs, crores)
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
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  if (crore)    result += threeDigit(crore) + " Crore ";
  if (lakh)     result += threeDigit(lakh) + " Lakh ";
  if (thousand) result += threeDigit(thousand) + " Thousand ";
  if (remainder) result += threeDigit(remainder);

  return result.trim();
}

// ============================================================
//  HTML ESCAPING (prevent injection in dynamic preview)
// ============================================================
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================
//  PDF DOWNLOAD
// ============================================================

downloadBtn.addEventListener("click", async () => {
  // Basic validation
  if (!parentName.value.trim() || !childName.value.trim()) {
    alert("Please fill in the parent and child names.");
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
  labelEl.textContent = "Generating PDF…";

  try {
    const receiptEl = document.getElementById("receipt");

    // Remove any preview-only scaling before rendering
    const originalTransform = receiptEl.style.transform;
    receiptEl.style.transform = "none";

    // Render the receipt DOM to canvas at high resolution
    const canvas = await html2canvas(receiptEl, {
      scale: 2,          // higher = sharper PDF
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: receiptEl.scrollWidth,
      windowHeight: receiptEl.scrollHeight
    });

    receiptEl.style.transform = originalTransform;

    // Build A4 PDF and fit the canvas into it
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();    // 210 mm
    const pdfHeight = pdf.internal.pageSize.getHeight();  // 297 mm

    // Scale image to fit width, preserve aspect ratio
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
    } else {
      // If content overflows one page, split across pages
      let remaining = imgHeight;
      let position = 0;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        remaining -= pdfHeight;
        position -= pdfHeight;
        if (remaining > 0) pdf.addPage();
      }
    }

    const filename = `Receipt_${receiptNo.value || "OurKids"}_${childName.value.trim().replace(/\s+/g, "_")}.pdf`;
    pdf.save(filename);

    // Bump per-month counter so the next receipt advances by 1
    bumpCounterForMonth(receiptDate.value);
    refreshReceiptNumber();
    updatePreview();
  } catch (err) {
    console.error(err);
    alert("Something went wrong generating the PDF. Check the console for details.");
  } finally {
    labelEl.textContent = originalLabel;
    downloadBtn.disabled = false;
  }
});

// ============================================================
//  RESET
// ============================================================
resetBtn.addEventListener("click", () => {
  if (!confirm("Clear all fields?")) return;
  parentName.value = "";
  childName.value = "";
  setDefaultDate();
  refreshReceiptNumber();
  itemsContainer.innerHTML = "";
  createItemRow("Daycare Fee", "");
  createItemRow("Registration Fee", "");
  updatePreview();
});
