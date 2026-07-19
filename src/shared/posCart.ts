import type { OrderItemInput, Product } from "./types";

// The single place a POS cart line's total is computed — used by every
// add/edit path (manual tile tap, keypad qty/weight entry) so none of
// them can drift from another.
export function calculateLineTotal(item: Pick<OrderItemInput, "wantedPrice" | "unitPrice" | "kg" | "quantity">): number | null {
  if (item.wantedPrice) return Number(item.wantedPrice.toFixed(2));
  if (!item.unitPrice) return null;
  if (item.kg) return Number((item.kg * item.unitPrice).toFixed(2));
  if (item.quantity) return Number((item.quantity * item.unitPrice).toFixed(2));
  return null;
}

// Builds the cart line for a product just added to a POS sale — the same
// function for a manual tile tap, a quick-pick tap, a search-result click,
// and a barcode scan, so there's no divergent "add" code path to fall out
// of sync. `wantedPrice` carries a weigh-label's baked-in price through
// from a scanned variable-measure barcode; omitted for every other add.
export function buildCartLine(p: Pick<Product, "id" | "name" | "pricePerUnit" | "unitDefault">, wantedPrice?: number): OrderItemInput {
  const estimatedKg = wantedPrice && p.pricePerUnit ? Number((wantedPrice / p.pricePerUnit).toFixed(3)) : 1;
  const line: OrderItemInput = {
    productId: p.id,
    name: p.name,
    notes: "",
    department: "counter",
    unitPrice: p.pricePerUnit,
    kg: p.unitDefault === "qty" ? null : estimatedKg,
    quantity: p.unitDefault === "qty" ? 1 : null,
    wantedPrice: wantedPrice ?? null,
    lineTotal: null
  };
  return { ...line, lineTotal: calculateLineTotal(line) };
}
