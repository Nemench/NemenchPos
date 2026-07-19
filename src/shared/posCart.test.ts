import { describe, it, expect } from "vitest";
import { buildCartLine, calculateLineTotal } from "./posCart";
import type { Product } from "./types";

const fixedUnitProduct: Pick<Product, "id" | "name" | "pricePerUnit" | "unitDefault"> = {
  id: 1, name: "Boerewors 500g Pack", pricePerUnit: 89.99, unitDefault: "qty"
};

const weighedProduct: Pick<Product, "id" | "name" | "pricePerUnit" | "unitDefault"> = {
  id: 2, name: "Sweet Chilli Sticks", pricePerUnit: 720, unitDefault: "kg"
};

describe("buildCartLine", () => {
  it("a manually-tapped fixed-unit product gets quantity 1 at its listed price", () => {
    const line = buildCartLine(fixedUnitProduct);
    expect(line.quantity).toBe(1);
    expect(line.kg).toBeNull();
    expect(line.lineTotal).toBe(89.99);
  });

  it("a manually-tapped weighed product defaults to 1kg pending real weight entry via the keypad", () => {
    const line = buildCartLine(weighedProduct);
    expect(line.kg).toBe(1);
    expect(line.quantity).toBeNull();
    expect(line.lineTotal).toBe(720);
  });

  it("a fixed-unit product ignores any wantedPrice for its weight/quantity fields (still quantity-based)", () => {
    const line = buildCartLine(fixedUnitProduct, 50);
    expect(line.quantity).toBe(1);
    expect(line.kg).toBeNull();
    expect(line.lineTotal).toBe(50); // wantedPrice still wins for the total
  });
});

describe("calculateLineTotal", () => {
  it("prefers an explicit wantedPrice over recomputing from kg/quantity x unitPrice", () => {
    expect(calculateLineTotal({ wantedPrice: 42.5, unitPrice: 100, kg: 1, quantity: null })).toBe(42.5);
  });

  it("falls back to kg x unitPrice when there's no wantedPrice", () => {
    expect(calculateLineTotal({ wantedPrice: null, unitPrice: 720, kg: 0.138, quantity: null })).toBe(99.36);
  });

  it("returns null when there's nothing to compute from", () => {
    expect(calculateLineTotal({ wantedPrice: null, unitPrice: null, kg: null, quantity: null })).toBeNull();
  });
});
