'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Expense, ExportRequest, FundReceipt, Account } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExportHub } from '@/components/export-hub';
import { ExpenseList } from '@/components/expense-list';
import { FundReceiptForm } from '@/components/fund-receipt-form';
import { ReceiptList } from '@/components/receipt-list';
import { toast } from 'sonner';
import { fmtNum } from '@/lib/currency';
import {
  TrendingUp,
  ReceiptText,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowUpCircle,
  Wallet,
  Pencil,
  Filter,
  X,
} from 'lucide-react';

export function BossDashboard() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [receipts, setReceipts] = useState<FundReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<ExportRequest | null>(null);
  const [exportReady, setExportReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FundReceipt | null>(null);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    let expQuery = supabase.from('expenses').select('*, accounts(name)');
    if (debouncedExpSearch) expQuery = expQuery.ilike('description', `%${debouncedExpSearch}%`);
    if (expAccount !== 'all') expQuery = expQuery.eq('account_id', expAccount);
    if (expInvoiceType !== 'all') expQuery = expQuery.eq('invoice_type', expInvoiceType);
    if (expStatus !== 'all') expQuery = expQuery.eq('status', expStatus);
    if (expStartDate) expQuery = expQuery.gte('date', expStartDate);
    if (expEndDate) expQuery = expQuery.lte('date', expEndDate);

    let recQuery = supabase.from('fund_receipts').select('*, accounts(name)');
    if (debouncedRecSearch) recQuery = recQuery.ilike('note', `%${debouncedRecSearch}%`);
    if (recAccount !== 'all') recQuery = recQuery.eq('account_id', recAccount);
    if (recStartDate) recQuery = recQuery.gte('date', recStartDate);
    if (recEndDate) recQuery = recQuery.lte('date', recEndDate);

    const [expRes, reqRes, recRes] = await Promise.all([
      expQuery.order('date', { ascending: false }),
      supabase
        .from('export_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      recQuery.order('date', { ascending: false }),
    ]);

    if (expRes.data) setExpenses(expRes.data);
    if (recRes.data) setReceipts(recRes.data);
    setPendingRequest(reqRes.data);
    setExportReady(false);
    setLoading(false);
  }, [debouncedExpSearch, expAccount, expInvoiceType, expStatus, expStartDate, expEndDate, debouncedRecSearch, recAccount, recStartDate, recEndDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Listen for real-time changes to export_requests
  useEffect(() => {
    const channel = supabase
      .channel('export-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'export_requests' }, (payload) => {
        if ((payload.new as ExportRequest)?.status === 'confirmed') {
          setExportReady(true);
          toast.success('Logger confirmed! You can now generate the export.');
        }
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const requestExportSync = async () => {
    setRequesting(true);
    const { error } = await supabase
      .from('export_requests')
      .insert({ requested_by: user?.id, status: 'pending' });
    setRequesting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Export sync requested! Waiting for Logger confirmation…');
      fetchData();
    }
  };

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalFunded = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const balance = totalFunded - totalSpent;

  const thisMonth = expenses.filter((e) => {
    const now = new Date();
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <div className="space-y-6 fade-up">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Balance',
            value: `SAR ${fmtNum(balance)}`,
            icon: Wallet,
            sub: 'Funded − Spent',
            color: balance >= 0 ? 'text-emerald-500' : 'text-destructive',
          },
          {
            label: 'Total Funded',
            value: `SAR ${fmtNum(totalFunded)}`,
            icon: ArrowUpCircle,
            sub: 'All top-ups',
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
            label: 'Total Records',
            value: expenses.length.toString(),
            icon: ReceiptText,
            sub: 'Logged expenses',
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Export Handshake */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                Export Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!pendingRequest && !exportReady && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Before exporting, request the Logger to confirm all recent expenses are logged.
                  </p>
                  <Button
                    id="request-export-sync-btn"
                    className="gap-2 gradient-brand text-white border-0 hover:opacity-90"
                    onClick={requestExportSync}
                    disabled={requesting}
                  >
                    {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Request Export Sync
                  </Button>
                </div>
              )}

              {pendingRequest && !exportReady && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Waiting for Logger confirmation…
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The Logger has been notified to review and confirm all expenses.
                    </p>
                  </div>
                </div>
              )}

              {exportReady && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Logger confirmed! Export is ready.
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All expenses are accounted for. You can now generate the report.
                      </p>
                    </div>
                  </div>
                  <ExportHub expenses={expenses} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense list (read-only) */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                All Expenses
              </CardTitle>
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
                loading={loading}
                onRefresh={fetchData}
                isLogger={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar — Top-up */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
                Per Diem Top-Up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Add funds to the logger's per diem balance.
              </p>
              <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
                <DialogTrigger
                  render={
                    <Button
                      id="topup-btn"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    />
                  }
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Send Top-Up
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Per Diem Top-Up</DialogTitle>
                  </DialogHeader>
                  <FundReceiptForm
                    defaultSourceType="boss_topup"
                    onSuccess={() => { setTopupOpen(false); fetchData(); }}
                  />
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Receipt history */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Funding History</CardTitle>
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
                loading={loading}
                onRefresh={fetchData}
                onEdit={(r) => setEditingReceipt(r)}
              />
            </CardContent>
          </Card>

          {/* Edit receipt dialog */}
          <Dialog open={!!editingReceipt} onOpenChange={(open) => !open && setEditingReceipt(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" /> Edit Top-Up
                </DialogTitle>
              </DialogHeader>
              {editingReceipt && (
                <FundReceiptForm
                  editReceipt={editingReceipt}
                  onSuccess={() => { setEditingReceipt(null); fetchData(); }}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
