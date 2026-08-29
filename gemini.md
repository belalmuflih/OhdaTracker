# Project Overview
**App Name:** PerDiem Pro 
**Objective:** Build a premium, highly responsive expense tracker to replace an Excel workflow for managing boss/company per diem funds, featuring a two-party approval and export system.
**Target Audience:** Dual-user system (Logger/Employee on mobile, Reviewer/Boss on desktop/mobile).

# Tech Stack & Infrastructure (STRICT: FREE TIERS ONLY)
- **Framework:** Next.js (App Router), React, TypeScript.
- **Styling:** Tailwind CSS, shadcn/ui (for premium component design).
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth for Role Management).
- **File Storage:** Supabase Storage (for uploading invoice images/PDFs).
- **OCR/Scanning:** Google Gemini API (Free Tier via `@google/genai` SDK) to parse receipt images into JSON.
- **Export/Sharing:** `papaparse` (for CSV) or `xlsx` (for Excel), and the native Web Share API.
- **Hosting:** Vercel.
- **DO NOT** suggest or implement any paid third-party services, APIs, or DBs. 

# Core Features & Requirements
1. **Frictionless Expense Logging:** 
   - A highly optimized, quick-entry form to log expenses in seconds.
   - Required fields: Amount, Description, Date.
2. **Smart Invoice Scanning & Management:**
   - File upload integration (camera access/file picker on mobile, file picker on desktop).
   - **Auto-Fill OCR:** When an invoice is snapped/uploaded, pass the image to the Gemini Free Tier API to extract Amount, Date, and Description. The user just reviews and confirms.
   - **Auto-Categorization:** The app should detect if a Company VAT ID is present on the scan. If yes -> "Tax Invoice". If no -> "Simplified Tax Invoice".
3. **Dynamic Fund Source Tracking:**
   - A dropdown to select the funding account.
   - Users can create, edit, and manage custom accounts (e.g., "Company Main", "Manager's Cash Envelope").
4. **Role-Based Access (The "Export Handshake"):**
   - **Logger Role (You):** Full read/write access to add and edit expenses, and manage accounts.
   - **Reviewer Role (Boss):** Read-only access to view the dashboard and request exports.
   - **Confirmation Workflow:** Before the boss can export the latest data, they must click "Request Export Sync". The Logger receives a UI prompt ("Boss requested an export. Are all recent expenses logged?"). Once the Logger clicks "Confirm & Lock", the Boss is granted access to generate the export.
5. **Export & Sharing Hub:**
   - Generate polished Excel (.xlsx) or CSV reports of confirmed expenses.
   - One-click "Copy Link" to a secure, time-sensitive web view of the report.
   - Integration with the device's native sharing options (iOS/Android Share Sheet) via Web Share API to easily send the file or link via WhatsApp/Email.

# UI/UX "Vibe" Guidelines
- **Overqualified Experience:** The app must look and feel like an enterprise-grade, premium SaaS product. 
- **Mobile-First:** The layout must be flawless on mobile devices (thumb-friendly buttons, bottom navigation if necessary, large tap targets) while expanding gracefully on desktop screens.
- **Aesthetics:** Use a clean, minimalist design system. Utilize smooth page transitions, and skeleton loaders for data fetching.
- **Feedback:** Every action (saving an expense, scanning an invoice, requesting export) must have clear visual feedback (toast notifications, checkmark animations, scanning overlays).

# Database Schema Guidelines
**Table 1: `profiles`** (Linked to Supabase Auth users)
- `id` (UUID, primary key, references auth.users)
- `role` (Enum/String: 'logger', 'boss')

**Table 2: `accounts`** (For dynamic fund sources)
- `id` (UUID, primary key)
- `name` (Text - e.g., "Company Account", "Manager Personal")
- `created_at` (Timestamp)

**Table 3: `expenses`**
- `id` (UUID, primary key)
- `created_at` (Timestamp)
- `amount` (Decimal/Numeric)
- `description` (Text)
- `account_id` (UUID, references `accounts.id`)
- `invoice_type` (Enum/String: 'simplified_tax', 'tax_invoice', 'none')
- `invoice_file_url` (Text - pointing to Supabase Storage)
- `status` (Enum/String: 'draft', 'pending_export_approval', 'locked_exported')

# AI Coding Rules
- Write clean, modular, and reusable React components.
- Default to client-side validation before hitting the database.
- Use Supabase Row Level Security (RLS) policies to enforce that the Boss can only read data, and the Logger can write data.
- For the OCR feature, ensure the prompt explicitly asks for JSON output matching the expense form fields. Show a "scanning/analyzing" UI skeleton while the AI processes the image.
- Ensure the native Web Share API falls back gracefully to a standard "Copy to Clipboard" button on unsupported browsers.
- Handle all loading states and edge cases (e.g., blurred images failing OCR, network drops during upload).