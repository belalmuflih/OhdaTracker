'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Expense, ExportRequest, FundReceipt } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExpenseForm } from '@/components/expense-form';
import { ExpenseList } from '@/components/expense-list';
import { AccountManager } from '@/components/account-manager';
import { ExportHub } from '@/components/export-hub';
import { FundReceiptForm } from '@/components/fund-receipt-form';
import { ReceiptList } from '@/components/receipt-list';
import { toast } from 'sonner';
import {
  Plus,
  Clock,
  ReceiptText,
  Bell,
  CheckCircle2,
  Loader2,
  Wallet,
  ArrowDownCircle,
  Pencil,
  ArrowUpCircle,
} from 'lucide-react';

export function LoggerDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<FundReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FundReceipt | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ExportRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [pageSize, setPageSize] = useState(10);
  const [expensesPage, setExpensesPage] = useState(0);
  const [expensesHasMore, setExpensesHasMore] = useState(true);
  const [receiptsPage, setReceiptsPage] = useState(0);
  const [receiptsHasMore, setReceiptsHasMore] = useState(true);
  // Aggregate totals across all data (not just current page)
  const [totalSpentAll, setTotalSpentAll] = useState(0);
  const [totalReceivedAll, setTotalReceivedAll] = useState(0);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);


  // Fetch a single page of expenses
  const fetchExpensesPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    const offset = pageNum * pageSize;
    const expRes = await supabase
      .from('expenses')
      .select('*, accounts(name)', { count: 'exact' })
      .order('date', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (expRes.data) {
      setExpenses(expRes.data);
      const total = expRes.count ?? 0;
      setExpensesHasMore(total > (offset + expRes.data.length));
      setTotalExpensesCount(total);
    }
    setLoading(false);
    setExpensesPage(pageNum);
    await fetchAggregates();
  }, [pageSize]);

  // Fetch a single page of top‑up receipts
  const fetchReceiptsPage = useCallback(async (pageNum: number) => {
    setLoading(true);
    const offset = pageNum * pageSize;
    const recRes = await supabase
      .from('fund_receipts')
      .select('*, accounts(name)', { count: 'exact' })
      .order('date', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (recRes.data) {
      setReceipts(recRes.data);
      const total = recRes.count ?? 0;
      setReceiptsHasMore(total > (offset + recRes.data.length));
    }
    setLoading(false);
    setReceiptsPage(pageNum);
  }, [pageSize]);

  // Fetch pending export request (does not depend on pagination)
  const fetchPendingRequest = useCallback(async () => {
    const reqRes = await supabase
      .from('export_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (reqRes.data) setPendingRequest(reqRes.data);
  }, []);

  // Initial load for both lists
  const fetchInitialData = useCallback(async () => {
    await Promise.all([fetchExpensesPage(0), fetchReceiptsPage(0), fetchPendingRequest()]);
  }, [fetchExpensesPage, fetchReceiptsPage, fetchPendingRequest]);

  const fetchAggregates = async () => {
    const [expAllRes, recAllRes] = await Promise.all([
      supabase.from('expenses').select('amount'),
      supabase.from('fund_receipts').select('amount'),
    ]);
    const totalSpent = expAllRes.data?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
    const totalReceived = recAllRes.data?.reduce((s, r) => s + Number(r.amount), 0) ?? 0;
    setTotalSpentAll(totalSpent);
    setTotalReceivedAll(totalReceived);
  };

  // load first page on mount
  // Load initial pages for expenses and receipts on mount
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Real-time: new export requests from boss
  useEffect(() => {
    const channel = supabase
      .channel('export-requests-logger')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'export_requests' }, (payload) => {
        const req = payload.new as ExportRequest;
        if (req.status === 'pending') {
          setPendingRequest(req);
          toast.warning('Your reviewer requested an export sync. Please confirm when ready!', {
            duration: 10000,
            icon: '🔔',
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Real-time: new fund receipts (e.g. boss top-up)
  useEffect(() => {
    const channel = supabase
      .channel('fund-receipts-logger')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fund_receipts' }, (payload) => {
        const rec = payload.new as FundReceipt;
        setReceipts((prev) => [rec, ...prev]);
        if (rec.source_type === 'boss_topup') {
          toast.success(`Your boss added SAR ${Number(rec.amount).toFixed(2)} to your per diem!`, {
            duration: 8000,
            icon: '💰',
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const confirmExport = async () => {
    if (!pendingRequest) return;
    setConfirming(true);
    const { error } = await supabase
      .from('export_requests')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', pendingRequest.id);
    setConfirming(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Export confirmed! The Reviewer can now generate the report.');
      setPendingRequest(null);
    }
  };

  // Pagination handlers
  // Pagination for expenses
  const goPrev = () => {
    if (expensesPage > 0) fetchExpensesPage(expensesPage - 1);
  };
  const goNext = () => {
    if (expensesHasMore) fetchExpensesPage(expensesPage + 1);
  };

  // Pagination for top‑up receipts
  const goPrevReceipts = () => {
    if (receiptsPage > 0) fetchReceiptsPage(receiptsPage - 1);
  };
  const goNextReceipts = () => {
    if (receiptsHasMore) fetchReceiptsPage(receiptsPage + 1);
  };

  // Use aggregate totals for stats (covers all pages)
  const totalReceived = totalReceivedAll;
  const totalSpent = totalSpentAll;
  const balance = totalReceived - totalSpent;

  const thisMonth = expenses.filter((e) => {
    const now = new Date();
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <div className="space-y-6 fade-up">
      {/* Export Confirmation Banner */}
      {pendingRequest && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Bell className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Reviewer requested an export sync
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Make sure all recent expenses are logged, then confirm to unlock the export.
            </p>
          </div>
          <Button
            id="confirm-export-btn"
            size="sm"
            className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border-0 flex-shrink-0 whitespace-nowrap cursor-pointer"
            onClick={confirmExport}
            disabled={confirming}
          >
            {confirming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Confirm & Lock
          </Button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Balance',
            value: `SAR ${balance.toFixed(2)}`,
            icon: Wallet,
            sub: 'Remaining per diem',
            color: balance >= 0 ? 'text-emerald-500' : 'text-destructive',
          },
          {
            label: 'Total Received',
            value: `SAR ${totalReceived.toFixed(2)}`,
            icon: ArrowDownCircle,
            sub: 'All top-ups & receipts',
            color: 'text-primary',
          },
          {
            label: 'This Month',
            value: `SAR ${thisMonth.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)}`,
            icon: Clock,
            sub: `${thisMonth.length} items`,
            color: 'text-primary',
          },
          {
            label: 'Total Entries',
            value: totalExpensesCount.toString(),
            icon: ReceiptText,
            sub: 'All expenses',
            color: 'text-primary',
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-2xl border-border/60">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <p className={`text-lg font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action bar */}
       {/* Items per page selector */}
       <div className="flex items-center gap-4 mb-4">
         <label className="text-sm font-medium text-muted-foreground">Items per page:</label>
         <select
           value={pageSize}
           onChange={(e) => {
             setPageSize(Number(e.target.value));
             // Reset both lists when page size changes
             fetchExpensesPage(0);
             fetchReceiptsPage(0);
           }}
           className="rounded border border-border/30 bg-background px-2 py-1 text-sm"
         >
           <option value={5}>5</option>
           <option value={10}>10</option>
           <option value={20}>20</option>
           <option value={50}>50</option>
         </select>
       </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger
            render={
              <Button
                id="add-expense-btn"
                className="gap-2 gradient-brand text-white border-0 hover:opacity-90 cursor-pointer"
              />
            }
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Expense</DialogTitle>
            </DialogHeader>
            <ExpenseForm
              onSuccess={() => { setAddOpen(false); fetchExpensesPage(0); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
          <DialogTrigger
            render={
              <Button
                id="log-receipt-btn"
                variant="outline"
                className="gap-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
              />
            }
          >
            <ArrowUpCircle className="w-4 h-4" />
            Top Up
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Top Up</DialogTitle>
            </DialogHeader>
            <FundReceiptForm
              defaultSourceType="external"
              onSuccess={() => { setReceiptOpen(false); fetchReceiptsPage(0); }}
            />
          </DialogContent>
        </Dialog>

        <ExportHub expenses={expenses} receipts={receipts} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Expense list */}
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Expenses</CardTitle>
            </CardHeader>
            <CardContent>
                <ExpenseList
                  expenses={expenses}
                  loading={loading}
                  onRefresh={() => fetchExpensesPage(0)}
                  isLogger={true}
                />
                {/* Pagination controls */}
                <div className="flex justify-center space-x-4 my-4">
                  <Button onClick={goPrev} disabled={expensesPage === 0}>Previous</Button>
                  <Button onClick={goNext} disabled={!expensesHasMore}>Next</Button>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Receipts */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                Topped Up History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptList
                receipts={receipts}
                loading={loading}
                onRefresh={() => fetchReceiptsPage(0)}
                onEdit={(r) => setEditingReceipt(r)}
              />
                          {/* Pagination controls for top‑up receipts */}
              <div className="flex justify-center space-x-4 my-4">
                <Button onClick={goPrevReceipts} disabled={receiptsPage === 0}>Previous</Button>
                <Button onClick={goNextReceipts} disabled={!receiptsHasMore}>Next</Button>
              </div>
            </CardContent>
          </Card>

          {/* Edit receipt dialog */}
          <Dialog open={!!editingReceipt} onOpenChange={(open) => !open && setEditingReceipt(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Edit Receipt
                </DialogTitle>
              </DialogHeader>
              {editingReceipt && (
                <FundReceiptForm
                  editReceipt={editingReceipt}
                  onSuccess={() => { setEditingReceipt(null); fetchReceiptsPage(0); }}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Accounts */}
          <Card className="rounded-2xl border-border/60">
            <CardContent className="pt-5">
              <AccountManager />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
