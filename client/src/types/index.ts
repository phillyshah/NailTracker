// API response envelope
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Distributor
export interface Distributor {
  id: string;
  name: string;
  region: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

// Inventory Item
export interface InventoryItem {
  id: string;
  udi: string;
  gtin: string;
  gtinShort: string;
  lot: string;
  expDate: string | null;
  rawBarcode: string;
  productLabel: string | null;
  imageData?: string | null;
  distributorId: string | null;
  distributor?: Distributor | null;
  bankId?: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  usedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history?: AssignmentHistory[];
}

// Assignment History
export interface AssignmentHistory {
  id: string;
  itemId: string;
  fromDistributorId: string | null;
  fromDistributorName: string | null;
  toDistributorId: string | null;
  toDistributorName: string | null;
  changedAt: string;
  changedBy: string | null;
  note: string | null;
}

// Parse result from scan
export interface ParsedItem {
  gtin: string;
  gtinShort: string;
  lot: string;
  expDate: Date | null;
  udi: string;
  rawBarcode: string;
  productLabel: string;
}

export interface ParsedItemWithStatus extends ParsedItem {
  status: 'new' | 'duplicate' | 'error';
  errorMessage?: string;
}

export interface ParseErrorResult {
  error: string;
  rawBarcode: string;
}

// Report types
export interface SummaryReport {
  totalUnits: number;
  activeDistributors: number;
  expiring90: number;
  expiring180: number;
  expired: number;
  unassigned: number;
}

export interface ExpiringItem {
  udi: string;
  productLabel: string | null;
  lot: string;
  expDate: string;
  distributorName: string | null;
  daysUntilExpiry: number;
}
