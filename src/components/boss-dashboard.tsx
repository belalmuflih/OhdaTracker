'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Expense, ExportRequest, FundReceipt } from '@/lib/types';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ExportHub } from '@/components/export-hub';
import { ExpenseList } from '@/components/expense-list';
import { FundReceiptForm } from '@/components/fund-receipt-form';
import { ReceiptList } from '@/components/receipt-list';
import { toast } from 'sonner';
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [expRes, reqRes, recRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, accounts(name)')
        .order('date', { ascending: false }),
      supabase
        .from('export_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('fund_receipts')
        .select('*')
        .order('date', { ascending: false }),
    ]);
    if (expRes.data) setExpenses(expRes.data);
    if (recRes.data) setReceipts(recRes.data);
    setPendingRequest(reqRes.data);
    setExportReady(false);
    setLoading(false);
  }, []);

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
            value: `SAR ${balance.toFixed(2)}`,
            icon: Wallet,
            sub: 'Funded − Spent',
            color: balance >= 0 ? 'text-emerald-500' : 'text-destructive',
          },
          {
            label: 'Total Funded',
            value: `SAR ${totalFunded.toFixed(2)}`,
            icon: ArrowUpCircle,
            sub: 'All top-ups',
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                All Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Funding History</CardTitle>
            </CardHeader>
            <CardContent>
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
