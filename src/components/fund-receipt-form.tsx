'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FundReceipt, ReceiptSourceType, Account } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Paperclip } from 'lucide-react';

interface FundReceiptFormProps {
  defaultSourceType?: ReceiptSourceType;
  editReceipt?: FundReceipt;
  onSuccess: () => void;
}

export function FundReceiptForm({ defaultSourceType = 'external', editReceipt, onSuccess }: FundReceiptFormProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState(editReceipt ? String(editReceipt.amount) : '');
  const [date, setDate] = useState(editReceipt?.date ?? new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState(editReceipt?.note ?? '');
  const [accountId, setAccountId] = useState(editReceipt?.account_id ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const sourceType = editReceipt?.source_type ?? defaultSourceType;

  useEffect(() => {
    supabase.from('accounts').select('*').order('name').then(({ data }) => {
      if (data) setAccounts(data);
    });
  }, []);

  const uploadFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `receipts/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('invoices').upload(path, file); // reusing invoices bucket for attachments
    if (error) return null;
    const { data } = supabase.storage.from('invoices').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!accountId) {
      toast.error('Please select an account');
      return;
    }

    setSaving(true);

    let attachment_url = editReceipt?.attachment_url ?? null;
    if (selectedFile) {
      const url = await uploadFile(selectedFile);
      if (url) attachment_url = url;
    }

    const payload = {
      amount: amt,
      date,
      note: note.trim() || null,
      account_id: accountId,
      attachment_url
    };

    const { error } = editReceipt
      ? await supabase.from('fund_receipts').update(payload).eq('id', editReceipt.id)
      : await supabase.from('fund_receipts').insert({
        ...payload,
        source_type: sourceType,
        created_by: user?.id,
      });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editReceipt ? 'Receipt updated!' : sourceType === 'boss_topup' ? 'Top-up recorded!' : 'Top-Up Recorded!');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="receipt-amount" className="text-sm font-medium">
            Amount (SAR) *
          </Label>
          <Input
            id="receipt-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 bg-muted/40 border-border/60 focus:border-primary/60 transition-colors font-mono"
            required
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="receipt-date" className="text-sm font-medium cursor-pointer">
            Date *
          </Label>
          <Input
            id="receipt-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-11 bg-muted/40 border-border/60 focus:border-primary/60 transition-colors cursor-pointer"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Account *</Label>
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
          <SelectTrigger id="receipt-account" className="h-11 bg-muted/40 cursor-pointer">
            <SelectValue>
              {accounts.find((acc) => acc.id === accountId)?.name || "Select receiving account…"}
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
        <Label htmlFor="receipt-note" className="text-sm font-medium">
          Reference / Note <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="receipt-note"
          type="text"
          placeholder={defaultSourceType === 'boss_topup' ? 'e.g. Monthly per diem top-up' : 'e.g. Cash from client'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-11 bg-muted/40 border-border/60 focus:border-primary/60 transition-colors"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="receipt-file" className="text-sm font-medium cursor-pointer">
          Attachment <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="relative">
          <Input
            id="receipt-file"
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="h-11 pt-2.5 bg-muted/40 border-border/60 focus:border-primary/60 transition-colors cursor-pointer file:cursor-pointer"
          />
          <Paperclip className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <Button
        id="receipt-submit-btn"
        type="submit"
        className="w-full h-11 gradient-brand text-white font-semibold border-0 hover:opacity-90 transition-opacity cursor-pointer"
        disabled={saving}
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : defaultSourceType === 'boss_topup' ? (
          'Record Top-Up'
        ) : (
          'Top Up'
        )}
      </Button>
    </form>
  );
}
