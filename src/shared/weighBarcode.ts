// Digi SM-110 (and most other retail scales') "variable price" barcodes: an
// EAN-13 the scale itself generates per-label, with the final TOTAL PRICE
// for that specific weighed portion baked into the digits (weight x
// per-kg rate, computed once by the scale/label printer, not the per-kg
// rate itself) — not a fixed catalog barcode, so a normal exact-match
// lookup will never find it twice (the price differs every time the item
// is weighed). Confirmed against two real labels for the same product at
// different weights, which decoded to the exact same R720/kg unit price:
//
//   Sweet Chili Sticks  0.098kg  2000550070568  -> item code 00550, price R70.56
//   Sweet Chili Sticks  0.190kg  2000550136806  -> item code 00550, price R136.80
//   (70.56 / 0.098 == 136.80 / 0.190 == 720 R/kg)
//
// Layout:
//   digits 1-2:  "20"       restricted-circulation prefix flagging a
//                           scale-generated (not GS1-assigned) barcode
//   digits 3-7:  item code  the scale's own 5-digit internal item code —
//                           the ONLY stable/identifying part. Store this
//                           in the product's `itemCode` column, NEVER in
//                           `barcode` (that field is for a fixed-unit
//                           product's single static EAN-13 — a weighed
//                           product doesn't have one of those; a fresh
//                           13-digit code is built per label via
//                           buildWeighBarcode below, not stored).
//   digits 8-12: price      Rand.cents, e.g. "07056" -> R70.56. Changes on
//                           every label — this is the weighed portion's
//                           total price, not the per-kg rate (the rate
//                           only ever lives on the product record).
//   digit 13:    check      standard EAN-13 check digit over digits 1-12,
//                           recalculated every time since digits 8-12 changed.

import { ean13CheckDigit } from "./ean13";

export interface WeighBarcode {
  itemCode: string;
  price: number;
}

// Decode: given any scanned/typed 13-digit code, returns null if it's not
// a validly-formed weigh-barcode (wrong length, wrong prefix, or a bad
// check digit — never silently accept a corrupted scan), otherwise the
// item code (product identity) and price (this specific label's amount)
// split apart. Callers must look products up by `itemCode`, never by the
// full decoded string — the full string is unique per LABEL, not per
// PRODUCT.
export function parseWeighBarcode(code: string): WeighBarcode | null {
  if (!/^\d{13}$/.test(code) || !code.startsWith("20")) return null;
  if (ean13CheckDigit(code.slice(0, 12)) !== Number(code[12])) return null;
  return { itemCode: code.slice(2, 7), price: Number(code.slice(7, 12)) / 100 };
}

// Encode: the counterpart parseWeighBarcode never had — builds a fresh
// 13-digit weigh-barcode from a stable item code and this label's total
// price (already computed as weight x per-kg rate by the caller; this
// function only knows about the price digits, not weight or rate, mirroring
// how the real scale hardware's own barcode never encodes weight either).
// Used by the label-printing tab every time it prints a weighed product's
// label — it builds a new code here, it never reads or reuses a stored one.
export function buildWeighBarcode(itemCode: string, price: number): string {
  if (!/^\d{5}$/.test(itemCode)) {
    throw new Error(`buildWeighBarcode: itemCode "${itemCode}" must be exactly 5 digits`);
  }
  const priceCents = Math.round(price * 100);
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > 99999) {
    throw new Error(`buildWeighBarcode: price ${price} must be between R0 and R999.99`);
  }
  const first12 = `20${itemCode}${String(priceCents).padStart(5, "0")}`;
  return first12 + ean13CheckDigit(first12);
}
