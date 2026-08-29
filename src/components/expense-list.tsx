'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ExpenseForm } from '@/components/expense-form';
import { supabase } from '@/lib/supabase/client';
import { Expense } from '@/lib/types';
import { toast } from 'sonner';
import {
  Receipt,
  FileText,
  Trash2,
  Pencil,
  ExternalLink,
  Tag,
  Calendar,
  Building2,
  BadgeCheck,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpenseListProps {
  expenses: Expense[];
  loading: boolean;
  onRefresh: () => void;
  isLogger: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  totalAmount?: number;
}

const invoiceTypeBadge: Record<string, { label: string; color: string }> = {
  tax_invoice: { label: 'Tax Invoice', color: 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400' },
  simplified_tax: { label: 'Simplified', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400' },
  none: { label: 'No Invoice', color: 'text-muted-foreground bg-muted border-border' },
};

const statusBadge: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground bg-muted border-border' },
  pending_export_approval: { label: 'Pending', color: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400' },
  locked_exported: { label: 'Exported', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400' },
};

function ExpenseSkeleton() {
  return (
    <div className="p-4 rounded-2xl border border-border/60 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function ExpenseList({
  expenses,
  loading,
  onRefresh,
  isLogger,
  hasMore = false,
  onLoadMore,
  totalCount,
  totalAmount,
}: ExpenseListProps) {
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const observerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentSentinel = observerRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [onLoadMore, hasMore, loading]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('expenses').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) toast.error(error.message);
    else { toast.success('Expense deleted'); onRefresh(); }
  };

  const computedTotalAmount = totalAmount !== undefined ? totalAmount : expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading && expenses.length === 0) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <ExpenseSkeleton key={i} />)}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-muted mx-auto flex items-center justify-center">
          <Receipt className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">No expenses yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogger ? 'Log your first expense using the button above.' : 'No expenses have been logged.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Total bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">
          {totalCount !== undefined ? `${expenses.length} of ${totalCount}` : expenses.length} expenses
        </span>
        <span className="text-sm font-bold text-foreground font-mono">
          Total: <span className="text-primary">SAR {computedTotalAmount.toFixed(2)}</span>
        </span>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editExpense && (
            <ExpenseForm
              expense={editExpense}
              onSuccess={() => { setEditOpen(false); onRefresh(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* List */}
      <div className="space-y-3">
        {expenses.map((expense) => {
          const badge = invoiceTypeBadge[expense.invoice_type] ?? invoiceTypeBadge.none;
          const status = statusBadge[expense.status] ?? statusBadge.draft;
          return (
            <div
              key={expense.id}
              className="group p-4 rounded-2xl border border-border/60 bg-card hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <Receipt className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm leading-tight truncate">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(expense.date).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                        {expense.accounts?.name && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3" />
                            {expense.accounts.name}
                          </span>
                        )}
                        {expense.invoice_file_url && (
                          <a
                            href={expense.invoice_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            Invoice
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="font-bold text-foreground font-mono text-sm">
                    SAR {Number(expense.amount).toFixed(2)}
                  </span>
                  {isLogger && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => { setEditExpense(expense); setEditOpen(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                        onClick={() => setDeleteTarget(expense)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3 ml-10">
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', badge.color)}>
                  <Tag className="w-2.5 h-2.5" />
                  {badge.label}
                </span>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', status.color)}>
                  <BadgeCheck className="w-2.5 h-2.5" />
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sentinel / Load more indicator */}
      {hasMore && (
        <div ref={observerRef} className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            Are you sure you want to delete the expense for <strong>"{deleteTarget?.description}"</strong> of <strong>SAR {Number(deleteTarget?.amount).toFixed(2)}</strong>?
            This action cannot be undone.
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="cursor-pointer animate-pulse hover:animate-none" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
