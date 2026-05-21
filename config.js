// ============================================================
//  EDIT THIS FILE WITH YOUR REAL DETAILS
//  See README.md for Firebase setup instructions.
// ============================================================

// ---- Bank details printed on every receipt ----
const BANK_DETAILS = {
  bankName:     "ICICI Bank",
  holder:       "Rhea Prithiani",
  accountNo:    "0123 4567 8901",
  ifsc:         "ICIC0001234",
  pan:          "ABCDE1234F",
  address:      "12, Whitefield Main Rd, Bengaluru 560066"
};

// ---- Firebase config ----
// Get this from your Firebase project (Project Settings → General → Your apps → Web app).
// These values are SAFE to be public — security comes from Firestore rules + auth,
// not from hiding the config.
const FIREBASE_CONFIG = {
  apiKey:            "PASTE_FROM_FIREBASE_CONSOLE",
  authDomain:        "PASTE_FROM_FIREBASE_CONSOLE",
  projectId:         "receipt-gen-5abe2",
  storageBucket:     "PASTE_FROM_FIREBASE_CONSOLE",
  messagingSenderId: "PASTE_FROM_FIREBASE_CONSOLE",
  appId:             "PASTE_FROM_FIREBASE_CONSOLE"
};

// ---- Allowed Google account emails ----
// Only these emails can sign in. Anyone else gets rejected even after Google auth.
// Add your school's Google account email(s) here.
const ALLOWED_EMAILS = [
  "your-school@gmail.com"
  // "another-staff@gmail.com",
];

// Receipt numbers are auto-generated as YYYY-MM-NNN
// (e.g. 2026-05-001). The counter resets on the 1st of each month.
