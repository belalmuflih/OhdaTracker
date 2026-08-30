'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/currency';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SmartScanner } from '@/components/smart-scanner';
import { supabase } from '@/lib/supabase/client';
import { Account, Expense, InvoiceType, OcrResult } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, Plus, Receipt, ChevronDown, ChevronUp, Calculator } from 'lucide-react';

interface ExpenseFormProps {
  onSuccess: () => void;
  expense?: Expense; // for editing
}

export function ExpenseForm({ onSuccess, expense }: ExpenseFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showScanner, setShowScanner] = useState(!expense);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    amount: expense?.amount?.toString() ?? '',
    description: expense?.description ?? '',
    date: expense?.date ?? new Date().toISOString().split('T')[0],
    account_id: expense?.account_id ?? '',
    invoice_type: (expense?.invoice_type ?? 'simplified_tax') as InvoiceType,
    vat_amount: expense?.vat_amount?.toString() ?? '',
    is_vat_inclusive: expense?.is_vat_inclusive ?? false,
  });

  // Track if user manually overrode the VAT amount
  const [manualVat, setManualVat] = useState(!!expense?.vat_amount);

  useEffect(() => {
    supabase.from('accounts').select('*').order('name').then(({ data }) => {
      if (data) setAccounts(data);
    });
  }, []);

  // Auto-calculate VAT when amount or is_vat_inclusive changes, if not manually overridden
  useEffect(() => {
    if (form.invoice_type !== 'tax_invoice' || manualVat) return;
    
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      setForm((prev) => ({ ...prev, vat_amount: '' }));
      return;
    }

    let calculatedVat = 0;
    if (form.is_vat_inclusive) {
      calculatedVat = amt - (amt / 1.15);
    } else {
      calculatedVat = amt * 0.15;
    }
    
    setForm((prev) => ({ ...prev, vat_amount: calculatedVat.toFixed(2) }));
  }, [form.amount, form.is_vat_inclusive, form.invoice_type, manualVat]);

  const set = (key: keyof typeof form, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleOcrResult = (result: OcrResult) => {
    const invType: InvoiceType =
      result.invoiceType === 'none' ? 'simplified_tax' : (result.invoiceType as InvoiceType);
    setForm((prev) => ({
      ...prev,
      amount: result.amount?.toString() ?? prev.amount,
      description: result.description ?? prev.description,
      date: result.date ?? prev.date,
      invoice_type: invType,
    }));
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `invoices/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('invoices').upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from('invoices').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.description.trim()) return toast.error('Description is required');
    if (isNaN(amount) || amount <= 0) return toast.error('Please enter a valid amount');

    let vat_amount = 0;
    if (form.invoice_type === 'tax_invoice') {
      vat_amount = parseFloat(form.vat_amount);
      if (isNaN(vat_amount) || vat_amount < 0) return toast.error('Please enter a valid VAT amount');
    }

    setLoading(true);

    let invoice_file_url = expense?.invoice_file_url ?? null;
    if (selectedFile) {
      const url = await uploadFile(selectedFile);
      if (url) invoice_file_url = url;
    }

    const payload = {
      amount,
      description: form.description.trim(),
      date: form.date,
      account_id: form.account_id || null,
      invoice_type: form.invoice_type,
      invoice_file_url,
      vat_amount: form.invoice_type === 'tax_invoice' ? vat_amount : 0,
      is_vat_inclusive: form.invoice_type === 'tax_invoice' ? form.is_vat_inclusive : false,
    };

    let error;
    if (expense) {
      ({ error } = await supabase.from('expenses').update(payload).eq('id', expense.id));
    } else {
      ({ error } = await supabase.from('expenses').insert(payload));
    }

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(expense ? 'Expense updated!' : 'Expense logged!');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Invoice Scanner */}
      <div className="space-y-2">
        <button
          type="button"
          className="flex items-center justify-between w-full text-sm font-medium text-foreground/80 group cursor-pointer"
          onClick={() => setShowScanner((s) => !s)}
        >
          <span className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Scan Invoice <span className="text-xs text-muted-foreground font-normal ml-1">— optional, AI auto-fill</span>
          </span>
          {showScanner ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {showScanner && (
          <SmartScanner
            onResult={handleOcrResult}
            onFileSelected={(f) => setSelectedFile(f)}
          />
        )}
      </div>

      <div className="h-px bg-border/60" />

      {/* Core fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 space-y-2">
          <Label htmlFor="amount" className="text-sm font-medium">Amount *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-mono">
              SAR
            </span>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => {
                setManualVat(false); // Reset manual VAT when amount changes
                set('amount', e.target.value);
              }}
              className="pl-12 h-11 font-mono text-base"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">{formatCurrency(form.amount)}</p>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 space-y-2">
          <Label htmlFor="date" className="text-sm font-medium cursor-pointer">Date *</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="h-11 cursor-pointer"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
        <Input
          id="description"
          placeholder="e.g. Team lunch at Burger Boutique"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          className="h-11"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Account</Label>
          <Select value={form.account_id} onValueChange={(v) => set('account_id', v ?? '')}>
            <SelectTrigger id="account-select" className="h-11 cursor-pointer">
              <SelectValue>
                {accounts.find(a => a.id === form.account_id)?.name || "Select account…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id} className="cursor-pointer">
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Invoice Type</Label>
          <Select
            value={form.invoice_type}
            onValueChange={(v) => v && set('invoice_type', v as InvoiceType)}
          >
            <SelectTrigger id="invoice-type-select" className="h-11 cursor-pointer">
              <SelectValue>
                {form.invoice_type === 'tax_invoice' ? 'Tax Invoice (VAT)' : 'Simplified Tax Invoice'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simplified_tax" className="cursor-pointer">Simplified Tax Invoice</SelectItem>
              <SelectItem value="tax_invoice" className="cursor-pointer">Tax Invoice (VAT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* VAT Fields - Only show when Tax Invoice is selected */}
      {form.invoice_type === 'tax_invoice' && (
        <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              VAT Details
            </Label>
            
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80 transition-opacity">
  <input
    type="checkbox"
    checked={form.is_vat_inclusive}
    onChange={(e) => {
      setManualVat(false); // Reset manual VAT when toggle changes
      set('is_vat_inclusive', e.target.checked);
    }}
    className="w-4 h-4 rounded border-primary text-primary focus:ring-primary cursor-pointer accent-primary"
  />
  <span className="font-medium">Amount is VAT Inclusive</span>
</label>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="vat_amount" className="text-xs text-muted-foreground">VAT Amount (SAR)</Label>
            <Input
              id="vat_amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.vat_amount}
              onChange={(e) => {
                setManualVat(true);
                set('vat_amount', e.target.value);
              }}
              className="h-11 font-mono bg-background"
              required
            />
            {!manualVat && form.amount && !isNaN(parseFloat(form.amount)) && (
              <p className="text-xs text-muted-foreground">
                Auto-calculated {form.is_vat_inclusive ? 'inclusive' : 'exclusive'} of 15% VAT. 
                You can edit the amount manually if needed.
              </p>
            )}
          </div>
        </div>
      )}

      <Button
        id="expense-submit-btn"
        type="submit"
        className="w-full h-11 gradient-brand text-white font-semibold border-0 hover:opacity-90 transition-opacity cursor-pointer"
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            {expense ? 'Update Expense' : 'Log Expense'}
          </>
        )}
      </Button>
    </form>
  );
}
