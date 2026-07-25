import { ean13CheckDigit } from "./ean13";

// A physical "customer account card" barcode — scanned at POS to select
// which account a sale should be charged to, as an alternative to typing/
// searching the customer's name. Deterministic from the account's own id
// (same reasoning as generateInternalBarcode/generateConsolidationBarcode):
// no separate "activate this card" step, and a damaged/lost card can be
// reprinted just by generating the same code again.
//
// Uses the "27" GS1 restricted-circulation (internal-use) prefix — a
// fourth, distinct value from "20" (weigh-scale price labels), "28"
// (order-consolidation barcodes), and "29" (auto-generated product
// barcodes), so none of the four formats can ever be confused for one
// another (they all pass the same EAN-13 checksum; only the prefix tells
// them apart).
//
// Layout:
//   digits 1-2:   "27"       customer-account-card prefix
//   digits 3-9:   account id zero-padded to 7 digits (comfortably covers
//                            this app's whole lifetime of accounts; throws
//                            rather than silently truncating/colliding if
//                            ever exceeded)
//   digits 10-12: "000"      reserved for future use
//   digit 13:     check      standard EAN-13 check digit (see ean13.ts)
export function generateCustomerAccountBarcode(accountId: number): string {
  if (!Number.isInteger(accountId) || accountId < 0 || accountId > 9999999) {
    throw new Error(`generateCustomerAccountBarcode: accountId ${accountId} must be an integer between 0 and 9999999`);
  }
  const first12 = `27${String(accountId).padStart(7, "0")}000`;
  return first12 + ean13CheckDigit(first12);
}

// Decode: given any scanned/typed 13-digit code, returns the account id if
// it's a validly-formed customer-account card (wrong length, wrong prefix,
// or a bad check digit all return null — never silently accept a
// corrupted scan), otherwise null so the caller falls through to its
// normal product-barcode lookup.
export function parseCustomerAccountBarcode(code: string): number | null {
  if (!/^\d{13}$/.test(code) || !code.startsWith("27")) return null;
  if (ean13CheckDigit(code.slice(0, 12)) !== Number(code[12])) return null;
  return Number(code.slice(2, 9));
}
