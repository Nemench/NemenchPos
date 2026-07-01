export type OrderStatus = "New" | "Received" | "Ready" | "Done";
export type UnitDefault = "kg" | "qty" | "kg_qty";
export type Department = "kitchen" | "counter";
export type DeptStatus = "n/a" | "New" | "Received" | "Ready" | "Done";

export type Role = "admin" | "cashier" | "master_cashier" | "counter" | "kitchen" | "stock_taker";

export interface User {
  id: number;
  name: string;
  role: Role;
  department: Department | null;
  isActive: number;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface UserInput {
  name: string;
  pin: string;
  role: Role;
  department: Department | null;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  unitDefault: UnitDefault;
  pricePerUnit: number | null;
  prepNotes: string;
  department: Department;
  isActive: number;
  lowStockThreshold: number | null;
  onHandQty: number;
  lastCountedAt: string | null;
  lastCountedById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  id?: number;
  name: string;
  category: string;
  unitDefault: UnitDefault;
  pricePerUnit: number | null;
  prepNotes: string;
  department: Department;
  lowStockThreshold: number | null;
}

export type Grade = "A" | "B" | "C" | "A,B" | "A,C" | "B,C";
export type BatchStatus = "open" | "finalized";

export interface Supplier {
  id: number;
  name: string;
  isActive: number;
  createdAt: string;
}

export interface WeighInBatch {
  id: number;
  status: BatchStatus;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
  finalizedAt: string | null;
}

export interface WeighInLineInput {
  productId: number;
  grade: Grade;
  piecesReceived: number;
  weightKg: number;
  supplierId: number;
}

export interface WeighInLine extends WeighInLineInput {
  id: number;
  batchId: number;
  productName: string | null;
  supplierName: string | null;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
}

export interface OrderItemInput {
  productId?: number | null;
  name: string;
  kg: number | null;
  quantity: number | null;
  notes: string;
  unitPrice?: number | null;
  lineTotal?: number | null;
  department: Department;
}

export interface OrderItem extends OrderItemInput {
  id: number;
  orderId: number;
}

export interface DeliveryAddress {
  street: string;
  area: string;
  buildingType: "house" | "building" | "";
  apartment: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  orderType: "pickup" | "delivery";
  deliveryAddress: DeliveryAddress;
  requestedTime: string;
  assignedTo: string;
  items: OrderItemInput[];
}

export interface Order {
  id: number;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  orderType: "pickup" | "delivery";
  deliveryAddress: DeliveryAddress;
  requestedTime: string;
  assignedTo: string | null;
  status: OrderStatus;
  kitchenStatus: DeptStatus;
  counterStatus: DeptStatus;
  requestedById: number | null;
  requestedByName: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}
