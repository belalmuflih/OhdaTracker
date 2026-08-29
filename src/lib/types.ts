export type Role = 'logger' | 'boss';

export interface Profile {
  id: string;
  role: Role;
  email?: string;
}

export type InvoiceType = 'tax_invoice' | 'simplified_tax';
export type ExpenseStatus = 'draft' | 'pending_export_approval' | 'locked_exported';
export type ReceiptSourceType = 'boss_topup' | 'external';

export interface Account {
  id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  created_at: string;
  amount: number;
  description: string;
  date: string;
  account_id: string | null;
  invoice_type: InvoiceType;
  invoice_file_url: string | null;
  status: ExpenseStatus;
  vat_amount?: number;
  is_vat_inclusive?: boolean;
  accounts?: Account;
}

export interface ExportRequest {
  id: string;
  created_at: string;
  requested_by: string;
  status: 'pending' | 'confirmed';
  confirmed_at: string | null;
}

export interface FundReceipt {
  id: string;
  created_at: string;
  date: string;
  amount: number;
  note: string | null;
  source_type: ReceiptSourceType;
  created_by: string;
  account_id?: string | null;
  attachment_url?: string | null;
  accounts?: Account;
}

export interface OcrResult {
  amount: number;
  date: string;
  description: string;
  invoiceType: InvoiceType | "none";
}
