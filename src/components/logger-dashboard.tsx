'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Expense, ExportRequest, FundReceipt, Account } from '@/lib/types';
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
import { fmtNum } from '@/lib/currency';
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
  Filter,
  X,
} from 'lucide-react';

export function LoggerDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<FundReceipt[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FundReceipt | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ExportRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [pageSize, setPageSize] = useState(5);
  const [expensesPage, setExpensesPage] = useState(0);
  const [expensesHasMore, setExpensesHasMore] = useState(true);
  const [receiptsPage, setReceiptsPage] = useState(0);
  const [receiptsHasMore, setReceiptsHasMore] = useState(true);
  // Aggregate totals across all data (not just current page)
  const [totalSpentAll, setTotalSpentAll] = useState(0);
  const [totalReceivedAll, setTotalReceivedAll] = useState(0);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);
  const [totalReceiptsCount, setTotalReceiptsCount] = useState(0);

  // Accounts list for filtering
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Expenses Filter States
  const [expSearch, setExpSearch] = useState('');
  const [debouncedExpSearch, setDebouncedExpSearch] = useState('');
  const [expAccount, setExpAccount] = useState('all');
  const [expInvoiceType, setExpInvoiceType] = useState('all');
  const [expStatus, setExpStatus] = useState('all');
  const [expStartDate, setExpStartDate] = useState('');
  const [expEndDate, setExpEndDate] = useState('');
  const [showExpFilters, setShowExpFilters] = useState(false);

  // Top-Up Filter States
  const [recSearch, setRecSearch] = useState('');
  const [debouncedRecSearch, setDebouncedRecSearch] = useState('');
  const [recAccount, setRecAccount] = useState('all');
  const [recStartDate, setRecStartDate] = useState('');
  const [recEndDate, setRecEndDate] = useState('');
  const [showRecFilters, setShowRecFilters] = useState(false);

  // Debounce search inputs
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedExpSearch(expSearch), 300);
    return () => clearTimeout(handler);
  }, [expSearch]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedRecSearch(recSearch), 300);
    return () => clearTimeout(handler);
  }, [recSearch]);

  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      const { data } = await supabase.from('accounts').select('*').order('name');
      if (data) setAccounts(data);
    };
    fetchAccounts();
  }, []);

  const fetchAggregates = useCallback(async () => {
    let expQuery = supabase.from('expenses').select('amount');
    if (debouncedExpSearch) expQuery = expQuery.ilike('description', `%${debouncedExpSearch}%`);
    if (expAccount !== 'all') expQuery = expQuery.eq('account_id', expAccount);
    if (expInvoiceType !== 'all') expQuery = expQuery.eq('invoice_type', expInvoiceType);
    if (expStatus !== 'all') expQuery = expQuery.eq('status', expStatus);
    if (expStartDate) expQuery = expQuery.gte('date', expStartDate);
    if (expEndDate) expQuery = expQuery.lte('date', expEndDate);

    let recQuery = supabase.from('fund_receipts').select('amount');
    if (debouncedRecSearch) recQuery = recQuery.ilike('note', `%${debouncedRecSearch}%`);
    if (recAccount !== 'all') recQuery = recQuery.eq('account_id', recAccount);
    if (recStartDate) recQuery = recQuery.gte('date', recStartDate);
    if (recEndDate) recQuery = recQuery.lte('date', recEndDate);

    const [expAllRes, recAllRes] = await Promise.all([expQuery, recQuery]);
    const totalSpent = expAllRes.data?.reduce((s, e) => s + Number(e.amount), 0) ?? 0;
    const totalReceived = recAllRes.data?.reduce((s, r) => s + Number(r.amount), 0) ?? 0;
    setTotalSpentAll(totalSpent);
    setTotalReceivedAll(totalReceived);
  }, [debouncedExpSearch, expAccount, expInvoiceType, expStatus, expStartDate, expEndDate, debouncedRecSearch, recAccount, recStartDate, recEndDate]);

  // Fetch a single page of expenses
  const fetchExpensesPage = useCallback(async (pageNum: number) => {
    setExpensesLoading(true);
    const offset = pageNum * pageSize;
    let query = supabase
      .from('expenses')
      .select('*, accounts(name)', { count: 'exact' });

    if (debouncedExpSearch) {
      query = query.ilike('description', `%${debouncedExpSearch}%`);
    }
    if (expAccount !== 'all') {
      query = query.eq('account_id', expAccount);
    }
    if (expInvoiceType !== 'all') {
      query = query.eq('invoice_type', expInvoiceType);
    }
    if (expStatus !== 'all') {
      query = query.eq('status', expStatus);
    }
    if (expStartDate) {
      query = query.gte('date', expStartDate);
    }
    if (expEndDate) {
      query = query.lte('date', expEndDate);
    }

    const expRes = await query
      .order('date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (expRes.data) {
      setExpenses(expRes.data);
      const total = expRes.count ?? 0;
      setExpensesHasMore(total > (offset + expRes.data.length));
      setTotalExpensesCount(total);
    }
    setExpensesLoading(false);
    setExpensesPage(pageNum);
    await fetchAggregates();
  }, [pageSize, debouncedExpSearch, expAccount, expInvoiceType, expStatus, expStartDate, expEndDate, fetchAggregates]);

  // Fetch a single page of top‑up receipts
  const fetchReceiptsPage = useCallback(async (pageNum: number) => {
    setReceiptsLoading(true);
    const offset = pageNum * pageSize;
    let query = supabase
      .from('fund_receipts')
      .select('*, accounts(name)', { count: 'exact' });

    if (debouncedRecSearch) {
      query = query.ilike('note', `%${debouncedRecSearch}%`);
    }
    if (recAccount !== 'all') {
      query = query.eq('account_id', recAccount);
    }
    if (recStartDate) {
      query = query.gte('date', recStartDate);
    }
    if (recEndDate) {
      query = query.lte('date', recEndDate);
    }

    const recRes = await query
      .order('date', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (recRes.data) {
      setReceipts(recRes.data);
      const total = recRes.count ?? 0;
      setReceiptsHasMore(total > (offset + recRes.data.length));
      setTotalReceiptsCount(total);
    }
    setReceiptsLoading(false);
    setReceiptsPage(pageNum);
    await fetchAggregates();
  }, [pageSize, debouncedRecSearch, recAccount, recStartDate, recEndDate, fetchAggregates]);

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

  // Load pages when filters or page config changes
  useEffect(() => {
    fetchExpensesPage(0);
  }, [fetchExpensesPage]);

  useEffect(() => {
    fetchReceiptsPage(0);
  }, [fetchReceiptsPage]);

  useEffect(() => {
    fetchPendingRequest();
  }, [fetchPendingRequest]);


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
          toast.success(`Your boss added SAR ${fmtNum(rec.amount)} to your per diem!`, {
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
            value: `SAR ${fmtNum(balance)}`,
            icon: Wallet,
            sub: 'Remaining per diem',
            color: balance >= 0 ? 'text-emerald-500' : 'text-destructive',
          },
          {
            label: 'Total Received',
            value: `SAR ${fmtNum(totalReceived)}`,
            icon: ArrowDownCircle,
            sub: 'All top-ups & receipts',
            color: 'text-primary',
          },
          {
            label: 'This Month',
            value: `SAR ${fmtNum(thisMonth.reduce((s, e) => s + Number(e.amount), 0))}`,
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
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent Expenses</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                onClick={() => setShowExpFilters(!showExpFilters)}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {(expSearch || expAccount !== 'all' || expInvoiceType !== 'all' || expStatus !== 'all' || expStartDate || expEndDate) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {showExpFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-4 rounded-xl bg-muted/30 border border-border/40 fade-in">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Search</label>
                    <input
                      type="text"
                      placeholder="Search description..."
                      value={expSearch}
                      onChange={(e) => setExpSearch(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account</label>
                    <select
                      value={expAccount}
                      onChange={(e) => setExpAccount(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50 text-ellipsis overflow-hidden"
                    >
                      <option value="all">All Accounts</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoice Type</label>
                    <select
                      value={expInvoiceType}
                      onChange={(e) => setExpInvoiceType(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    >
                      <option value="all">All Types</option>
                      <option value="tax_invoice">Tax Invoice</option>
                      <option value="simplified_tax">Simplified Tax</option>
                      <option value="none">No Invoice</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                    <select
                      value={expStatus}
                      onChange={(e) => setExpStatus(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="pending_export_approval">Pending</option>
                      <option value="locked_exported">Exported</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">From Date</label>
                    <input
                      type="date"
                      value={expStartDate}
                      onChange={(e) => setExpStartDate(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">To Date</label>
                    <input
                      type="date"
                      value={expEndDate}
                      onChange={(e) => setExpEndDate(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  {(expSearch || expAccount !== 'all' || expInvoiceType !== 'all' || expStatus !== 'all' || expStartDate || expEndDate) && (
                    <div className="md:col-span-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setExpSearch('');
                          setExpAccount('all');
                          setExpInvoiceType('all');
                          setExpStatus('all');
                          setExpStartDate('');
                          setExpEndDate('');
                        }}
                        className="h-8 px-2.5 text-xs text-destructive hover:text-destructive flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Clear Filters
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <ExpenseList
                expenses={expenses}
                loading={expensesLoading}
                onRefresh={() => fetchExpensesPage(0)}
                isLogger={true}
              />
              {/* Pagination controls */}
              <div className="flex items-center justify-between border-t border-border/30 pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={goPrev} disabled={expensesPage === 0}>Previous</Button>
                  <Button size="sm" variant="outline" onClick={goNext} disabled={!expensesHasMore}>Next</Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.ceil(totalExpensesCount / pageSize))}
                    value={expensesPage + 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        const page = Math.max(0, Math.min(val - 1, Math.ceil(totalExpensesCount / pageSize) - 1));
                        fetchExpensesPage(page);
                      }
                    }}
                    className="w-12 h-8 rounded border border-border/30 bg-background text-center px-1 font-medium text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span>of {Math.max(1, Math.ceil(totalExpensesCount / pageSize))}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Receipts */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
                Topped Up History
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                onClick={() => setShowRecFilters(!showRecFilters)}
              >
                <Filter className="w-3 h-3" />
                Filters
                {(recSearch || recAccount !== 'all' || recStartDate || recEndDate) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {showRecFilters && (
                <div className="grid grid-cols-1 gap-2.5 mb-3 p-3 rounded-xl bg-muted/30 border border-border/40 fade-in">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Search</label>
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={recSearch}
                      onChange={(e) => setRecSearch(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Account</label>
                    <select
                      value={recAccount}
                      onChange={(e) => setRecAccount(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 text-ellipsis overflow-hidden"
                    >
                      <option value="all">All Accounts</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">From Date</label>
                    <input
                      type="date"
                      value={recStartDate}
                      onChange={(e) => setRecStartDate(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">To Date</label>
                    <input
                      type="date"
                      value={recEndDate}
                      onChange={(e) => setRecEndDate(e.target.value)}
                      className="w-full rounded border border-border/30 bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  {(recSearch || recAccount !== 'all' || recStartDate || recEndDate) && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          setRecSearch('');
                          setRecAccount('all');
                          setRecStartDate('');
                          setRecEndDate('');
                        }}
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Clear
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <ReceiptList
                receipts={receipts}
                loading={receiptsLoading}
                onRefresh={() => fetchReceiptsPage(0)}
                onEdit={(r) => setEditingReceipt(r)}
              />
              {/* Pagination controls for top‑up receipts */}
              <div className="flex items-center justify-between border-t border-border/30 pt-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <Button size="xs" variant="outline" className="h-8 px-2.5 text-xs" onClick={goPrevReceipts} disabled={receiptsPage === 0}>Prev</Button>
                  <Button size="xs" variant="outline" className="h-8 px-2.5 text-xs" onClick={goNextReceipts} disabled={!receiptsHasMore}>Next</Button>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Page</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, Math.ceil(totalReceiptsCount / pageSize))}
                    value={receiptsPage + 1}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        const page = Math.max(0, Math.min(val - 1, Math.ceil(totalReceiptsCount / pageSize) - 1));
                        fetchReceiptsPage(page);
                      }
                    }}
                    className="w-10 h-8 rounded border border-border/30 bg-background text-center px-1 font-medium text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span>/ {Math.max(1, Math.ceil(totalReceiptsCount / pageSize))}</span>
                </div>
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
