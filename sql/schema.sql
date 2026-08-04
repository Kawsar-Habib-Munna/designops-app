-- ============================================
-- DesignOps — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================

-- 1. PROFILES (team members — extends Supabase's built-in auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text default 'Designer',        -- e.g. UX Designer, PM, Founder
  avatar_color text default '#5B4FE8',
  created_at timestamptz default now()
);

-- 2. CLIENTS
create table clients (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  industry text,
  website text,
  primary_contact text,
  contact_email text,
  contact_phone text,
  status text default 'lead',          -- lead | discussion | active | retainer | completed
  priority text default 'standard',    -- standard | vip
  account_manager_id uuid references profiles(id),
  notes text,
  created_at timestamptz default now()
);

-- 3. PROJECTS
create table projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  client_id uuid references clients(id) on delete set null,
  status text default 'active',        -- active | review | completed | on_hold
  progress int default 0,              -- 0-100, can be computed or manual
  budget numeric,
  start_date date,
  due_date date,
  project_manager_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- 4. TASKS
create table tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  project_id uuid references projects(id) on delete cascade,
  assignee_id uuid references profiles(id),
  priority text default 'normal',      -- low | normal | high | urgent
  status text default 'todo',          -- todo | in_progress | review | done
  workflow_stage text default 'backlog', -- backlog | ready | wireframing | ui_design | ux_review | client_review | revision | handoff | completed
  is_blocked boolean default false,
  due_date date,
  due_time time,
  estimated_hours numeric,
  logged_hours numeric default 0,
  progress int default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. CHECKLIST ITEMS (subtasks inside a task)
create table checklist_items (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  label text not null,
  is_done boolean default false,
  position int default 0
);

-- 6. COMMENTS
create table comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);

-- 7. ATTACHMENTS (Drive-link based, per our earlier decision)
create table attachments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references tasks(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  file_name text not null,
  file_type text,                      -- figma | pdf | image | zip | other
  drive_url text not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);

-- 8. ACTIVITY LOG (powers every "Recent Activity" feed)
create table activity_log (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references profiles(id),
  action text not null,                 -- task_created | task_completed | file_uploaded | comment_added | review_requested | status_changed
  entity_type text,                     -- task | project | client
  entity_id uuid,
  detail text,
  created_at timestamptz default now()
);

-- 9. MEETINGS
create table meetings (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade,
  title text not null,
  meeting_date date,
  meeting_time text,
  attendees text,
  notes text,
  created_at timestamptz default now()
);

-- ============================================
-- INDEXES (speeds up the queries your screens actually run)
-- ============================================
create index idx_tasks_project on tasks(project_id);
create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_status on tasks(status);
create index idx_projects_client on projects(client_id);
create index idx_comments_task on comments(task_id);
create index idx_attachments_task on attachments(task_id);
create index idx_activity_created on activity_log(created_at desc);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Since this is an internal 9-person tool: every logged-in team member
-- can read everything, and can write to things they'd plausibly touch.
-- ============================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table checklist_items enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table activity_log enable row level security;
alter table meetings enable row level security;

-- Simple team-wide policy: any authenticated user can read/write.
-- (Good enough for an internal tool. Tighten later if you add clients-as-users.)
create policy "team can read profiles" on profiles for select using (auth.role() = 'authenticated');
create policy "users can update own profile" on profiles for update using (auth.uid() = id);
create policy "team can read clients" on clients for select using (auth.role() = 'authenticated');
create policy "team can write clients" on clients for insert with check (auth.role() = 'authenticated');
create policy "team can update clients" on clients for update using (auth.role() = 'authenticated');

create policy "team can read projects" on projects for select using (auth.role() = 'authenticated');
create policy "team can write projects" on projects for insert with check (auth.role() = 'authenticated');
create policy "team can update projects" on projects for update using (auth.role() = 'authenticated');

create policy "team can read tasks" on tasks for select using (auth.role() = 'authenticated');
create policy "team can write tasks" on tasks for insert with check (auth.role() = 'authenticated');
create policy "team can update tasks" on tasks for update using (auth.role() = 'authenticated');
create policy "team can delete tasks" on tasks for delete using (auth.role() = 'authenticated');

create policy "team can read checklist" on checklist_items for select using (auth.role() = 'authenticated');
create policy "team can write checklist" on checklist_items for all using (auth.role() = 'authenticated');

create policy "team can read comments" on comments for select using (auth.role() = 'authenticated');
create policy "team can write comments" on comments for insert with check (auth.role() = 'authenticated');

create policy "team can read attachments" on attachments for select using (auth.role() = 'authenticated');
create policy "team can write attachments" on attachments for insert with check (auth.role() = 'authenticated');

create policy "team can read activity" on activity_log for select using (auth.role() = 'authenticated');
create policy "team can write activity" on activity_log for insert with check (auth.role() = 'authenticated');

create policy "team can read meetings" on meetings for select using (auth.role() = 'authenticated');
create policy "team can write meetings" on meetings for all using (auth.role() = 'authenticated');

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- When someone signs up via Supabase Auth, auto-create their profile row.
-- ============================================
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- AUTO-UPDATE "updated_at" ON TASKS
-- ============================================
create function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on tasks
  for each row execute procedure public.set_updated_at();

-- ============================================
-- REALTIME
-- Task List পেজের লাইভ আপডেট (postgres_changes সাবস্ক্রিপশন) কাজ করার জন্য
-- tasks টেবিলকে supabase_realtime publication-এ যোগ করা দরকার।
-- ============================================
alter publication supabase_realtime add table tasks;

-- ============================================
-- PROJECT DETAILS পেজের জন্য এক্সট্রা কলাম/টেবিল
-- (fresh install ও আগে থেকে schema রান করা — দুই ক্ষেত্রেই নিরাপদে চলবে)
-- ============================================
alter table projects add column if not exists description text;
alter table projects add column if not exists category text;

create table if not exists milestones (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at date,
  progress int default 0,
  position int default 0,
  created_at timestamptz default now()
);

alter table milestones enable row level security;

create policy "team can read milestones" on milestones for select using (auth.role() = 'authenticated');
create policy "team can write milestones" on milestones for all using (auth.role() = 'authenticated');

create index idx_milestones_project on milestones(project_id);

-- profiles টেবিলে আগে শুধু read পলিসি ছিল, update পলিসি ছিল না — তাই প্রোফাইল
-- পেজ থেকে নাম/রোল পরিবর্তন RLS-এ চুপচাপ ব্লক হয়ে যাচ্ছিল (এরর ছাড়াই ০ রো আপডেট)।
drop policy if exists "users can update own profile" on profiles;
create policy "users can update own profile" on profiles for update using (auth.uid() = id);

-- ============================================
-- CALENDAR পেজের জন্য meetings টেবিল আপগ্রেড
-- আগে meeting_time একটা ফ্রি-টেক্সট ফিল্ড ছিল আর কোনো duration/link কলাম ছিল না,
-- তাই সময়-ভিত্তিক ক্যালেন্ডার গ্রিডে বসানো/ড্র্যাগ করা সম্ভব ছিল না।
-- নোট: এই টেবিলে এর আগে কোনো তৈরি করার UI ছিল না, তাই ধরে নেওয়া হচ্ছে টেবিল খালি —
-- যদি meeting_time কলামে আগে থেকে কোনো non-time টেক্সট ডেটা থাকে, নিচের
-- "alter column ... type time" লাইনটা এরর দেবে; সেক্ষেত্রে আগে সেই রো-গুলো
-- ঠিক করে/মুছে নিতে হবে।
-- ============================================
alter table meetings alter column meeting_time type time using nullif(meeting_time, '')::time;
alter table meetings add column if not exists duration_minutes int default 60;
alter table meetings add column if not exists meeting_link text;

-- ঐচ্ছিক সময়সীমা — ক্যালেন্ডারে টাস্ক ডেডলাইনের জন্য শুধু তারিখ না, নির্দিষ্ট সময়ও
-- (যেমন "বিকাল ৫টা") দেওয়ার অপশন। null রাখলে সারাদিনের ডেডলাইন হিসেবেই থাকবে।
alter table tasks add column if not exists due_time time;

-- ============================================
-- এডমিন রোল
-- শুধু is_admin=true প্রোফাইলরাই টিম মেম্বার যোগ/রিমুভ করতে বা অন্য কাউকে এডমিন
-- বানাতে পারবে (দেখুন app/api/team/*)। যে অ্যাকাউন্টটা সবার আগে তৈরি হয়
-- (profiles টেবিল তখনো খালি থাকে) সে স্বয়ংক্রিয়ভাবে এডমিন হয়ে যায়, যাতে
-- কাউকে ম্যানুয়ালি SQL চালিয়ে নিজেকে এডমিন বানাতে না হয়।
-- ============================================
alter table profiles add column if not exists is_admin boolean default false;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    (select count(*) from public.profiles) = 0
  );
  return new;
end;
$$ language plpgsql security definer;

-- is_admin কলাম শুধু service_role (Admin API রুট) দিয়েই বদলানো যাবে — নাহলে
-- "users can update own profile" পলিসির আওতায় (auth.uid() = id) যেকোনো লগইন
-- করা ইউজার ব্রাউজার থেকে সরাসরি নিজেকেই এডমিন বানিয়ে ফেলতে পারত।
create or replace function public.protect_admin_flag()
returns trigger as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    raise exception 'is_admin শুধু service_role (admin API) দিয়ে পরিবর্তন করা যায়।';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_admin_flag_trigger on profiles;
create trigger protect_admin_flag_trigger
  before update on profiles
  for each row execute procedure public.protect_admin_flag();

-- মেম্বার রিমুভ করলে (auth.users থেকে ডিলিট) তার করা টাস্ক/কমেন্ট/অ্যাক্টিভিটি
-- যেন FK ভায়োলেশন এরর ছাড়াই "আনঅ্যাসাইনড" (NULL) হয়ে যায় — আগে এই ফরেন কী-গুলোর
-- কোনো ON DELETE অ্যাকশন সেট করা ছিল না (ডিফল্ট NO ACTION)।
alter table tasks drop constraint if exists tasks_assignee_id_fkey;
alter table tasks add constraint tasks_assignee_id_fkey foreign key (assignee_id) references profiles(id) on delete set null;

alter table tasks drop constraint if exists tasks_created_by_fkey;
alter table tasks add constraint tasks_created_by_fkey foreign key (created_by) references profiles(id) on delete set null;

alter table projects drop constraint if exists projects_project_manager_id_fkey;
alter table projects add constraint projects_project_manager_id_fkey foreign key (project_manager_id) references profiles(id) on delete set null;

alter table clients drop constraint if exists clients_account_manager_id_fkey;
alter table clients add constraint clients_account_manager_id_fkey foreign key (account_manager_id) references profiles(id) on delete set null;

alter table comments drop constraint if exists comments_author_id_fkey;
alter table comments add constraint comments_author_id_fkey foreign key (author_id) references profiles(id) on delete set null;

alter table attachments drop constraint if exists attachments_uploaded_by_fkey;
alter table attachments add constraint attachments_uploaded_by_fkey foreign key (uploaded_by) references profiles(id) on delete set null;

alter table activity_log drop constraint if exists activity_log_actor_id_fkey;
alter table activity_log add constraint activity_log_actor_id_fkey foreign key (actor_id) references profiles(id) on delete set null;

-- ============================================
-- FILES পেজ
-- attachments টেবিলে আগে শুধু read/insert পলিসি ছিল — ফাইল রিমুভ করার কোনো
-- উপায় ছিল না (delete পলিসি ছাড়া RLS চুপচাপ ব্লক করে দেয়)।
-- ============================================
drop policy if exists "team can write attachments" on attachments;
create policy "team can write attachments" on attachments for all using (auth.role() = 'authenticated');
