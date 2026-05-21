// ============================================================
//  EDIT THIS FILE WITH YOUR REAL DETAILS
//  Nothing else needs changing.
// ============================================================

const BANK_DETAILS = {
  bankName:     "ICICI Bank",
  holder:       "Rhea Prithiani",
  accountNo:    "0123 4567 8901",
  ifsc:         "ICIC0001234",
  pan:          "ABCDE1234F",
  address:      "12, Whitefield Main Rd, Bengaluru 560066"
};

// Receipt numbering: PREFIX + random 4-digit number
// e.g. "2026-7423". Each new receipt generates a fresh random number.
const RECEIPT_PREFIX = "2026-";
const RECEIPT_RANDOM_DIGITS = 4;   // 4 digits => 1000–9999
