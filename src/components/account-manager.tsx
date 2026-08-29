'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { Account } from '@/lib/types';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, Landmark } from 'lucide-react';

export function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const fetchAccounts = async () => {
    const { data } = await supabase.from('accounts').select('*').order('created_at');
    if (data) setAccounts(data);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openCreate = () => { setEditTarget(null); setName(''); setOpen(true); };
  const openEdit = (acc: Account) => { setEditTarget(acc); setName(acc.name); setOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Account name is required');
    setLoading(true);

    let error;
    if (editTarget) {
      ({ error } = await supabase.from('accounts').update({ name: name.trim() }).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('accounts').insert({ name: name.trim() }));
    }

    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editTarget ? 'Account updated!' : 'Account created!');
      setOpen(false);
      fetchAccounts();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('accounts').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) toast.error(error.message);
    else { toast.success('Account deleted'); fetchAccounts(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Landmark className="w-4 h-4 text-primary" />
          Fund Accounts
        </h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                id="add-account-btn"
                size="sm"
                variant="outline"
                className="gap-1.5 h-8 text-xs"
              />
            }
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </DialogTrigger>

          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{editTarget ? 'Edit Account' : 'New Account'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name *</Label>
                <Input
                  id="account-name"
                  placeholder="e.g. Company Main, Manager's Cash"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                  autoFocus
                  required
                />
              </div>
              <Button
                id="save-account-btn"
                type="submit"
                className="w-full h-11 gradient-brand text-white border-0"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : editTarget ? 'Update' : 'Create'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {accounts.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground rounded-xl border border-dashed border-border/60">
            No accounts yet. Create one to get started.
          </div>
        )}
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40 hover:bg-muted/60 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Landmark className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{acc.name}</span>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => openEdit(acc)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                onClick={() => setDeleteTarget(acc)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div className="py-3 text-sm text-muted-foreground">
            Are you sure you want to delete the account <strong>"{deleteTarget?.name}"</strong>? 
            Any expenses linked to this account will be unlinked. This action cannot be undone.
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
