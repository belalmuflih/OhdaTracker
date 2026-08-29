-- ============================================================
-- PerDiem Pro - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- If you are starting fresh or formatting the DB, you can drop existing tables:
drop table if exists public.export_requests, public.expenses, public.fund_receipts, public.accounts, public.profiles cascade;

-- 1. Create the profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('logger', 'boss')),
  created_at timestamptz default now()
);

-- 2. Create the accounts table (fund sources)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- 3. Create the expenses table
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null default current_date,
  amount numeric(12, 2) not null,
  description text not null,
  account_id uuid references public.accounts(id) on delete set null,
  invoice_type text not null default 'simplified_tax' check (invoice_type in ('tax_invoice', 'simplified_tax')),
  invoice_file_url text,
  status text not null default 'draft' check (status in ('draft', 'pending_export_approval', 'locked_exported')),
  vat_amount numeric(12, 2) default 0,
  is_vat_inclusive boolean default false
);

-- 4. Create the fund_receipts table (Add Money / Top-up)
create table if not exists public.fund_receipts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  date date not null default current_date,
  amount numeric(12, 2) not null,
  note text,
  source_type text not null default 'external' check (source_type in ('boss_topup', 'external')),
  created_by uuid references auth.users(id),
  account_id uuid references public.accounts(id) on delete set null,
  attachment_url text
);

-- 5. Create the export_requests table (for the export handshake)
create table if not exists public.export_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  requested_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  confirmed_at timestamptz
);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.expenses enable row level security;
alter table public.fund_receipts enable row level security;
alter table public.export_requests enable row level security;

-- Helper function to get the current user's role
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- PROFILES: Users can read and update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Default new users to 'logger' role; a boss must be manually set
  insert into public.profiles (id, role)
  values (new.id, 'logger');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Authenticated users can view accounts" on public.accounts;
drop policy if exists "Loggers can insert accounts" on public.accounts;
drop policy if exists "Loggers can update accounts" on public.accounts;
drop policy if exists "Loggers can delete accounts" on public.accounts;

-- ACCOUNTS: All authenticated users can read; only loggers can write
create policy "Authenticated users can view accounts"
  on public.accounts for select
  to authenticated
  using (true);

create policy "Loggers can insert accounts"
  on public.accounts for insert
  to authenticated
  with check (public.get_my_role() = 'logger');

create policy "Loggers can update accounts"
  on public.accounts for update
  to authenticated
  using (public.get_my_role() = 'logger');

create policy "Loggers can delete accounts"
  on public.accounts for delete
  to authenticated
  using (public.get_my_role() = 'logger');

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Authenticated users can view expenses" on public.expenses;
drop policy if exists "Loggers can insert expenses" on public.expenses;
drop policy if exists "Loggers can update expenses" on public.expenses;

-- EXPENSES: All authenticated users can read; only loggers can write
create policy "Authenticated users can view expenses"
  on public.expenses for select
  to authenticated
  using (true);

create policy "Loggers can insert expenses"
  on public.expenses for insert
  to authenticated
  with check (public.get_my_role() = 'logger');

create policy "Loggers can update expenses"
  on public.expenses for update
  to authenticated
  using (public.get_my_role() = 'logger');

create policy "Loggers can delete expenses"
  on public.expenses for delete
  to authenticated
  using (public.get_my_role() = 'logger');

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Authenticated users can view fund receipts" on public.fund_receipts;
drop policy if exists "Loggers can insert fund receipts" on public.fund_receipts;
drop policy if exists "Loggers can update fund receipts" on public.fund_receipts;
drop policy if exists "Loggers can delete fund receipts" on public.fund_receipts;

-- FUND RECEIPTS: All authenticated users can read; only loggers can write
create policy "Authenticated users can view fund receipts"
  on public.fund_receipts for select
  to authenticated
  using (true);

create policy "Loggers can insert fund receipts"
  on public.fund_receipts for insert
  to authenticated
  with check (public.get_my_role() = 'logger');

create policy "Loggers can update fund receipts"
  on public.fund_receipts for update
  to authenticated
  using (public.get_my_role() = 'logger');

create policy "Loggers can delete fund receipts"
  on public.fund_receipts for delete
  to authenticated
  using (public.get_my_role() = 'logger');

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Authenticated users can view export requests" on public.export_requests;
drop policy if exists "Boss can create export requests" on public.export_requests;
drop policy if exists "Loggers can confirm export requests" on public.export_requests;

-- EXPORT REQUESTS: All can read; boss can insert; logger can update (confirm)
create policy "Authenticated users can view export requests"
  on public.export_requests for select
  to authenticated
  using (true);

create policy "Boss can create export requests"
  on public.export_requests for insert
  to authenticated
  with check (public.get_my_role() = 'boss');

create policy "Loggers can confirm export requests"
  on public.export_requests for update
  to authenticated
  using (public.get_my_role() = 'logger');

-- ============================================================
-- Storage: Create invoice bucket
-- ============================================================
-- Run this separately if the bucket doesn't exist:
-- insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false);

-- Drop existing policies if they exist to allow re-running this script
drop policy if exists "Loggers can upload invoices" on storage.objects;
drop policy if exists "Authenticated users can view invoices" on storage.objects;

-- Storage RLS: Loggers can upload, all authenticated can read
create policy "Loggers can upload invoices"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'invoices' AND public.get_my_role() = 'logger');

create policy "Authenticated users can view invoices"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'invoices');

-- ============================================================
-- Seed Data (Optional - for testing)
-- ============================================================
-- Insert a default account
-- insert into public.accounts (name) values ('Company Main') on conflict do nothing;
