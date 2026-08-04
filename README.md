# DesignOps

Next.js (TypeScript + Tailwind + App Router) + Supabase দিয়ে বানানো DesignOps এজেন্সি টুল।

## প্রজেক্ট স্ট্রাকচার

```
app/
  page.tsx              → হোমপেজ
  dashboard/page.tsx     → Dashboard — রিয়েল Supabase ডেটা (KPI, প্রজেক্ট, টাস্ক, অ্যাক্টিভিটি, workload)
  tasks/page.tsx          → Task List — দেখা, তৈরি করা, স্ট্যাটাস পরিবর্তন
  components/SignInScreen.tsx → ম্যাজিক-লিংক সাইন-ইন ফর্ম
lib/
  supabaseClient.ts      → Supabase ক্লায়েন্ট (সব পেজ এখান থেকে ইমপোর্ট করবে)
  useSession.ts           → বর্তমান লগইন সেশন হুক
sql/
  schema.sql              → পুরো ডেটাবেস স্কিমা (টেবিল, RLS, ট্রিগার, realtime)
```

## সেটআপ

### ১. Supabase প্রজেক্ট তৈরি করুন
1. https://supabase.com এ ফ্রি অ্যাকাউন্ট খুলুন
2. "New Project" → নাম দিন → region: Singapore
3. তৈরি হতে ১-২ মিনিট লাগবে

### ২. ডেটাবেস স্কিমা বসান
1. Dashboard → **SQL Editor** → **New Query**
2. `sql/schema.sql`-এর পুরো কন্টেন্ট পেস্ট করে **Run** চাপুন
3. **Table Editor**-এ গিয়ে চেক করুন — `profiles`, `clients`, `projects`, `tasks` ইত্যাদি টেবিল দেখা উচিত

### ৩. Authentication সেটআপ করুন
- Dashboard → **Authentication** → **Providers** → Email চালু আছে কিনা দেখুন (ডিফল্টে থাকে)
- Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**-এ `http://localhost:3000` যোগ করুন (ম্যাজিক-লিংক ক্লিক করলে এখানে ফিরে আসবে; প্রোডাকশনে আসল ডোমেইনও যোগ করতে হবে)
- টিম মেম্বারদের ইনভাইট করুন: **Authentication** → **Users** → **Invite User** — এতে স্বয়ংক্রিয়ভাবে `profiles` টেবিলে তাদের সারি তৈরি হয়ে যাবে
- এই অ্যাপে পাসওয়ার্ড লাগে না — সাইন-ইন পেজে ইমেইল দিলে Supabase একটা ম্যাজিক লিংক পাঠায়, সেটায় ক্লিক করলেই লগইন হয়ে যায়

### ৪. এনভায়রনমেন্ট ভ্যারিয়েবল বসান
`.env.local` ফাইলে Supabase Dashboard → Settings → API থেকে URL ও anon key বসান:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### ৫. রান করুন

```bash
npm install
npm run dev
```

`localhost:3000` → "ড্যাশবোর্ড দেখুন" বা "টাস্ক লিস্ট দেখুন" → প্রথমবার সাইন-ইন স্ক্রিন আসবে → টিম ইমেইল দিন → ইমেইলে আসা লিংকে ক্লিক করুন → লগইন হয়ে ড্যাশবোর্ড/টাস্ক লিস্টে রিয়েল ডেটা দেখা যাবে।

## এখন যা ডাইনামিক
- **Dashboard**: Active Projects, Pending/Due/Overdue Tasks, Team Members, Completion Rate — সব লাইভ কাউন্ট Supabase থেকে। Project Overview, My Tasks, Activity Feed, Team Workload, আজকের মিটিং — সবই রিয়েল টেবিল থেকে (`projects`, `tasks`, `activity_log`, `meetings`, `profiles`)
- **My Tasks**-এ টাস্কের গোল বাটনে ক্লিক করলে স্ট্যাটাস `done` হয়ে যায় এবং `activity_log`-এ একটা এন্ট্রি যোগ হয়
- **Task List** (`/tasks`): টাস্ক তৈরি ও স্ট্যাটাস পরিবর্তন — দুটোই `activity_log`-এ লেখে, তাই Dashboard-এর Activity Feed-এ দেখা যাবে
- **ইনসাইট প্যানেল**: real AI/LLM কল নয় — overdue count, সবচেয়ে বেশি workload থাকা মানুষ, ও ডেডলাইনের কাছাকাছি প্রজেক্ট থেকে সহজ নিয়ম-ভিত্তিক ৩-৪ লাইন জেনারেট করা হয়

## এরপর কী করবেন
1. **Kanban Board** — drag/drop-এ `tasks` টেবিলের `status`/`workflow_stage` আপডেট (একই প্যাটার্নে `handleStatusChange`)
2. **Client Hub** — `clients` টেবিলের উপর CRUD + `projects` join
3. প্রোডাকশনে ডিপ্লয় করলে Supabase **Redirect URLs**-এ আসল ডোমেইন যোগ করতে ভুলো না, নাহলে ম্যাজিক-লিংক লগইন কাজ করবে না

## নোট
- ফাইল/অ্যাটাচমেন্ট: `attachments` টেবিলে শুধু Google Drive লিংক (`drive_url`) স্টোর হয় — কোনো ফাইল Supabase Storage-এ আপলোড হয় না
- RLS: "যেকোনো লগইন করা টিম মেম্বার সব দেখতে/লিখতে পারবে" — ৯ জনের ইন্টারনাল টুলের জন্য যথেষ্ট
- Realtime: `tasks` টেবিল `supabase_realtime` publication-এ যোগ করা আছে (`sql/schema.sql`-এর শেষে), তাই Task List পেজের লাইভ সাবস্ক্রিপশন কাজ করবে
- Dashboard একবার লোড হওয়ার পর ডেটা রিফ্রেশ হয় না (পেজ রিলোড বা টাস্ক টগল করলে বাদে) — realtime সাবস্ক্রিপশন এখনো শুধু Task List পেজে আছে
