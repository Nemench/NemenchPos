import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { isValidEan13 } from "../src/shared/ean13";
import { KotDatabase } from "./database";

describe("reconcileMissingBarcodes", () => {
  let dataDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemenchpos-test-"));
    originalDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = dataDir;
  });

  afterEach(() => {
    if (originalDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = originalDataDir;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("fills in a valid EAN-13 for every qty product missing one, leaves existing barcodes and weighed products untouched", () => {
    const db = new KotDatabase();
    db.initialize();
    // Simulate the exact gap this exists to catch: rows written directly
    // to the table (as CSV import does, and as any pre-migration database
    // would have) rather than through upsertProduct, which already
    // auto-generates a barcode on its own and so can't reproduce the bug.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (db as any).db as BetterSqlite3.Database;
    const now = new Date().toISOString();
    const insert = raw.prepare(
      "INSERT INTO products (name, category, unitDefault, department, barcode, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 'counter', ?, 1, ?, ?)"
    );
    const missingId = Number(insert.run("Boerewors", "Beef", "qty", null, now, now).lastInsertRowid);
    const existingId = Number(insert.run("Lamb Chops", "Lamb", "qty", "2900099000006", now, now).lastInsertRowid);
    const weighedId = Number(insert.run("Beef Mince", "Beef", "kg", null, now, now).lastInsertRowid);

    const fixedIds = db.reconcileMissingBarcodes();

    expect(fixedIds).toEqual([missingId]);

    const rows = raw.prepare("SELECT id, barcode FROM products WHERE id IN (?, ?, ?)").all(missingId, existingId, weighedId) as { id: number; barcode: string | null }[];
    const byId = new Map(rows.map((r) => [r.id, r.barcode]));

    expect(byId.get(missingId)).toMatch(/^\d{13}$/);
    expect(isValidEan13(byId.get(missingId)!)).toBe(true);
    // Never overwrites a barcode that was already there.
    expect(byId.get(existingId)).toBe("2900099000006");
    // Weighed products deliberately never get a static barcode.
    expect(byId.get(weighedId)).toBeNull();
  });

  it("is a no-op (and returns no ids) when every qty product already has a barcode", () => {
    const db = new KotDatabase();
    db.initialize();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (db as any).db as BetterSqlite3.Database;
    const now = new Date().toISOString();
    raw.prepare("INSERT INTO products (name, category, unitDefault, department, barcode, isActive, createdAt, updatedAt) VALUES (?, ?, 'qty', 'counter', ?, 1, ?, ?)")
      .run("Boerewors", "Beef", "2900001000005", now, now);

    expect(db.reconcileMissingBarcodes()).toEqual([]);
  });
});
