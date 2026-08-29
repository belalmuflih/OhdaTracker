'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { FundReceipt } from '@/lib/types';
import { Loader2, ArrowDownCircle, TrendingDown, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ReceiptListProps {
  receipts: FundReceipt[];
  loading?: boolean;
  onRefresh?: () => void;
  onEdit?: (receipt: FundReceipt) => void;
}

export function ReceiptList({ receipts, loading, onRefresh, onEdit }: ReceiptListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundReceipt | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    const { error } = await supabase.from('fund_receipts').delete().eq('id', deleteTarget.id);
    setDeletingId(null);
    setDeleteTarget(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Receipt deleted');
      onRefresh?.();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No receipts yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {receipts.map((r) => (
        <div
          key={r.id}
          className="group flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            r.source_type === 'boss_topup'
              ? 'bg-emerald-500/15 text-emerald-500'
              : 'bg-blue-500/15 text-blue-500'
          }`}>
            {r.source_type === 'boss_topup'
              ? <ArrowDownCircle className="w-4 h-4" />
              : <TrendingDown className="w-4 h-4" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {r.note || (r.source_type === 'boss_topup' ? 'Boss Top-Up' : 'External Receipt')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(r.date), 'MMM d, yyyy')} ·{' '}
              <span className={`font-medium ${
                r.source_type === 'boss_topup' ? 'text-emerald-500' : 'text-blue-500'
              }`}>
                {r.source_type === 'boss_topup' ? 'Top-up' : 'External'}
              </span>
            </p>
          </div>

          <span className="text-sm font-bold font-mono text-emerald-500 flex-shrink-0">
            +{Number(r.amount).toFixed(2)}
          </span>

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => onEdit(r)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
              onClick={() => setDeleteTarget(r)}
              disabled={deletingId === r.id}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            Are you sure you want to delete this Top-Up of <strong>SAR {Number(deleteTarget?.amount).toFixed(2)}</strong>?
            This action cannot be undone.
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" className="cursor-pointer animate-pulse hover:animate-none" onClick={handleDeleteConfirm} disabled={!!deletingId}>
              {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
