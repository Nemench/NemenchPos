// Standard EAN-13 check digit algorithm, shared by every barcode format
// this app generates or parses (see weighBarcode.ts and internalBarcode.ts)
// so the checksum math lives in exactly one place.
//
// Digits 1-12 (left to right, 1-indexed): odd positions x1, even positions
// x3; sum, then check digit = (10 - (sum mod 10)) mod 10. Validated against
// real-world barcodes in ean13.test.ts.
export function ean13CheckDigit(first12Digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(first12Digits[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// Full structural validation for any barcode entering the system (manual
// entry, CSV import, a preset scanned from a real product) — exactly 13
// digits, and the 13th must match what ean13CheckDigit computes from the
// first 12. Used to reject/flag a malformed preset barcode before saving,
// per CASE 1's requirement.
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

// Recalculates the correct check digit for any 12-or-13-digit numeric
// string, returning a corrected 13-digit code — useful for imports/manual
// entry where the first 12 digits are right but the check digit was
// mistyped or never computed. Throws on anything that isn't 12-13 plain
// digits, since there's nothing sensible to "recalculate" from garbage
// input (that's a job for isValidEan13 + a user-facing rejection, not this).
export function recalculateEan13CheckDigit(code: string): string {
  if (!/^\d{12,13}$/.test(code)) {
    throw new Error(`recalculateEan13CheckDigit: "${code}" must be 12 or 13 digits`);
  }
  const first12 = code.slice(0, 12);
  return first12 + ean13CheckDigit(first12);
}
