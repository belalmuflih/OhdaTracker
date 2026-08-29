'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { Expense, FundReceipt } from '@/lib/types';
import { toast } from 'sonner';
import {
  Download,
  Share2,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { useEffect } from 'react';

interface ExportHubProps {
  expenses?: Expense[];
  receipts?: FundReceipt[];
}

export function ExportHub({ expenses: initialExpenses = [], receipts: initialReceipts = [] }: ExportHubProps) {
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [receipts, setReceipts] = useState<FundReceipt[]>(initialReceipts);
  const [loadingData, setLoadingData] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'combined' | 'income' | 'expenses'>('combined');

  useEffect(() => {
    if (!open) return;
    const loadAllData = async () => {
      setLoadingData(true);
      try {
        const [expRes, recRes] = await Promise.all([
          supabase
            .from('expenses')
            .select('*, accounts(name)')
            .order('date', { ascending: true }),
          supabase
            .from('fund_receipts')
            .select('*, accounts(name)')
            .order('date', { ascending: true }),
        ]);
        if (expRes.data) setExpenses(expRes.data);
        if (recRes.data) setReceipts(recRes.data);
      } catch (err) {
        toast.error('Failed to load transaction data for export');
      } finally {
        setLoadingData(false);
      }
    };
    loadAllData();
  }, [open]);

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalIncome = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalBalance = totalIncome - totalExpenses;

  // Format date to DD/MM/YYYY
  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getCombinedReport = () => {
    const allTransactions = [
      ...expenses.map((e) => ({ ...e, type: 'expense' as const })),
      ...receipts.map((r) => ({ ...r, type: 'income' as const })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const accountBalances: Record<string, number> = {};
    
    return allTransactions.map((t) => {
      const accountName = t.accounts?.name ?? '—';
      if (!accountBalances[accountName]) accountBalances[accountName] = 0;

      if (t.type === 'income') {
        accountBalances[accountName] += Number(t.amount);
        return {
          Date: formatDate(t.date),
          Description: (t as any).note || 'Top-Up/Income',
          Account: accountName,
          Credit: Number(t.amount),
          Debit: null,
          'VAT Amount': null,
          Balance: accountBalances[accountName],
        };
      } else {
        accountBalances[accountName] -= Number(t.amount);
        return {
          Date: formatDate(t.date),
          Description: (t as any).description,
          Account: accountName,
          Credit: null,
          Debit: Number(t.amount),
          'VAT Amount': (t as Expense).invoice_type === 'tax_invoice' ? Number((t as Expense).vat_amount || 0) : null,
          Balance: accountBalances[accountName],
        };
      }
    });
  };

  const getIncomeReport = () => {
    const sorted = [...receipts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const accountBalances: Record<string, number> = {};

    return sorted.map((t) => {
      const accountName = t.accounts?.name ?? '—';
      if (!accountBalances[accountName]) accountBalances[accountName] = 0;
      accountBalances[accountName] += Number(t.amount);
      return {
        Date: formatDate(t.date),
        Account: accountName,
        Amount: Number(t.amount),
        'Current Balance': accountBalances[accountName],
        'Description/Reference': t.note || '—',
        'Attachment Reference': t.attachment_url || '—',
      };
    });
  };

  const getExpensesReport = () => {
    const sorted = [...expenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const accountBalances: Record<string, number> = {};

    return sorted.map((t) => {
      const accountName = t.accounts?.name ?? '—';
      if (!accountBalances[accountName]) accountBalances[accountName] = 0;
      accountBalances[accountName] -= Number(t.amount);
      return {
        Date: formatDate(t.date),
        Account: accountName,
        Amount: Number(t.amount),
        'VAT Amount': t.invoice_type === 'tax_invoice' ? Number(t.vat_amount || 0) : '—',
        'Invoice Type': t.invoice_type === 'tax_invoice' ? 'Tax Invoice' : 'Simplified Tax Invoice',
        'Description/Reference': t.description,
        'Current Balance': accountBalances[accountName],
        'Attachment Reference': t.invoice_file_url || '—',
      };
    });
  };

  const getAccountSummaries = () => {
    const summaries: Record<string, { income: number, expense: number }> = {};
    receipts.forEach((r) => {
      const acc = r.accounts?.name ?? '—';
      if (!summaries[acc]) summaries[acc] = { income: 0, expense: 0 };
      summaries[acc].income += Number(r.amount);
    });
    expenses.forEach((e) => {
      const acc = e.accounts?.name ?? '—';
      if (!summaries[acc]) summaries[acc] = { income: 0, expense: 0 };
      summaries[acc].expense += Number(e.amount);
    });
    return Object.entries(summaries).map(([acc, data]) => ({
      Account: acc,
      'Total Income': data.income,
      'Total Expenses': data.expense,
      'Total Spends': data.expense, // Added as requested
      'Remaining Balance': data.income - data.expense,
    }));
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      if (exportType === 'combined') {
        const ws = XLSX.utils.json_to_sheet(getCombinedReport());
        ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Combined Statement');
      } else if (exportType === 'income') {
        const ws = XLSX.utils.json_to_sheet(getIncomeReport());
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');
      } else if (exportType === 'expenses') {
        const ws = XLSX.utils.json_to_sheet(getExpensesReport());
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Expense Statement');
      }

      // Add Account Summaries sheet
      const wsSummaries = XLSX.utils.json_to_sheet(getAccountSummaries());
      wsSummaries['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummaries, 'Account Summaries');

      XLSX.writeFile(wb, `perdiem-${exportType}-${new Date().toISOString().split('T')[0]}.xlsx`);

      // Optionally mark expenses as exported if they requested expenses or combined
      if (exportType !== 'income') {
        const ids = expenses.map((e) => e.id);
        if (ids.length) {
          await supabase.from('expenses').update({ status: 'locked_exported' }).in('id', ids);
        }
      }

      toast.success('Excel report exported!');
    } catch (err) {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const data = exportType === 'combined' ? getCombinedReport() :
                   exportType === 'income' ? getIncomeReport() :
                   getExpensesReport();

      if (!data.length) {
        toast.error('No data to export.');
        setExporting(false);
        return;
      }

      const headers = Object.keys(data[0]);
      const rows = data.map((r) =>
        headers.map((h) => `"${(r as any)[h] ?? ''}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `perdiem-${exportType}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch {
      toast.error('CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    const text = `PerDiem Pro — ${exportType === 'combined' ? 'Account Statement' : exportType === 'income' ? 'Income Report' : 'Expense Report'}\n${new Date().toLocaleDateString()}\nBalance: SAR ${totalBalance.toFixed(2)}\nTotal Expenses: SAR ${totalExpenses.toFixed(2)}`;
    const shareData = { title: 'PerDiem Financial Report', text };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Summary copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            id="export-hub-btn"
            className="gap-2 gradient-brand text-white border-0 hover:opacity-90 cursor-pointer"
          />
        }
      >
        <Download className="w-4 h-4" />
        Export Report
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Export Financials
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground font-medium">Loading transaction data…</span>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Summary */}
            <div className="rounded-2xl bg-muted/40 p-4 space-y-1">
              <div className="text-xs text-muted-foreground">Overall Balance</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{expenses.length + receipts.length} transactions</span>
                <span className={`text-lg font-bold font-mono ${totalBalance >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  SAR {totalBalance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Export Type</p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={exportType === 'combined' ? 'default' : 'outline'}
                  onClick={() => setExportType('combined')}
                  className="text-xs h-10 px-2 cursor-pointer transition-all"
                >
                  Combined
                </Button>
                <Button
                  variant={exportType === 'income' ? 'default' : 'outline'}
                  onClick={() => setExportType('income')}
                  className="text-xs h-10 px-2 cursor-pointer transition-all"
                >
                  Income Only
                </Button>
                <Button
                  variant={exportType === 'expenses' ? 'default' : 'outline'}
                  onClick={() => setExportType('expenses')}
                  className="text-xs h-10 px-2 cursor-pointer transition-all"
                >
                  Expenses Only
                </Button>
              </div>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                id="export-excel-btn"
                variant="outline"
                className="h-20 flex-col gap-2 rounded-2xl hover:bg-emerald-500/10 hover:border-emerald-500/30 group transition-all cursor-pointer"
                onClick={exportExcel}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-xs font-medium">Excel (.xlsx)</span>
              </Button>

              <Button
                id="export-csv-btn"
                variant="outline"
                className="h-20 flex-col gap-2 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 group transition-all cursor-pointer"
                onClick={exportCsv}
                disabled={exporting}
              >
                <FileText className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium">CSV File</span>
              </Button>
            </div>

            <div className="h-px bg-border/60" />

            {/* Share buttons */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Share Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  id="share-native-btn"
                  variant="outline"
                  className="gap-2 rounded-xl cursor-pointer"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  id="copy-report-btn"
                  variant="outline"
                  className="gap-2 rounded-xl cursor-pointer"
                  onClick={handleShare}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
