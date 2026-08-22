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

-- আসল কাস্টম ফোল্ডার (আগে "Folders" শুধু প্রজেক্ট-ভিত্তিক অটো-গ্রুপিং ছিল,
-- ম্যানুয়ালি ফোল্ডার তৈরি করার কোনো উপায় ছিল না) — এক লেভেল নেস্টিং সাপোর্ট করে
-- (parent_id), মকআপের "New Folder" মোডালের "কোথায় রাখবেন" অপশনের সাথে মিলিয়ে।
create table if not exists folders (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  parent_id uuid references folders(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table folders enable row level security;
create policy "team can read folders" on folders for select using (auth.role() = 'authenticated');
create policy "team can write folders" on folders for all using (auth.role() = 'authenticated');

create index if not exists idx_folders_parent on folders(parent_id);

alter table attachments add column if not exists folder_id uuid references folders(id) on delete set null;

-- ফোল্ডার তৈরির সময় ঐচ্ছিকভাবে কোন প্রজেক্টের সাথে সম্পর্কিত তা ট্যাগ করা যায়
alter table folders add column if not exists project_id uuid references projects(id) on delete set null;

-- ============================================
-- DISCUSSIONS & VOTING পেজ
-- টিম আলোচনা (থ্রেড + রিপ্লাই + রিঅ্যাকশন) এবং ভোট (অপশন + রেসপন্স) —
-- বাকি টেবিলগুলোর মতোই: ৯ জনের ইন্টারনাল টুল, যেকোনো authenticated ইউজার
-- পড়তে/লিখতে পারবে।
-- ============================================
create table if not exists discussions (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  category text,
  tags text,
  project_id uuid references projects(id) on delete set null,
  author_id uuid references profiles(id) on delete set null,
  status text default 'open',          -- open | resolved | closed
  is_pinned boolean default false,
  is_draft boolean default false,
  is_archived boolean default false,
  created_at timestamptz default now()
);

create table if not exists discussion_mentions (
  discussion_id uuid references discussions(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  primary key (discussion_id, profile_id)
);

create table if not exists discussion_attachments (
  id uuid default gen_random_uuid() primary key,
  discussion_id uuid references discussions(id) on delete cascade,
  file_name text not null,
  file_type text,
  url text not null,
  created_at timestamptz default now()
);

create table if not exists discussion_replies (
  id uuid default gen_random_uuid() primary key,
  discussion_id uuid references discussions(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists reply_attachments (
  id uuid default gen_random_uuid() primary key,
  reply_id uuid references discussion_replies(id) on delete cascade,
  file_name text not null,
  file_type text,
  url text not null
);

create table if not exists reply_reactions (
  id uuid default gen_random_uuid() primary key,
  reply_id uuid references discussion_replies(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique (reply_id, profile_id, emoji)
);

create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  project_id uuid references projects(id) on delete set null,
  author_id uuid references profiles(id) on delete set null,
  allow_multiple boolean default false,
  is_anonymous boolean default false,
  ends_at timestamptz,
  status text default 'open',          -- open | closed
  is_pinned boolean default false,
  is_draft boolean default false,
  is_archived boolean default false,
  created_at timestamptz default now()
);

create table if not exists vote_options (
  id uuid default gen_random_uuid() primary key,
  vote_id uuid references votes(id) on delete cascade,
  label text not null,
  position int default 0
);

create table if not exists vote_responses (
  id uuid default gen_random_uuid() primary key,
  vote_id uuid references votes(id) on delete cascade,
  option_id uuid references vote_options(id) on delete cascade,
  voter_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (vote_id, voter_id, option_id)
);

alter table discussions enable row level security;
alter table discussion_mentions enable row level security;
alter table discussion_attachments enable row level security;
alter table discussion_replies enable row level security;
alter table reply_attachments enable row level security;
alter table reply_reactions enable row level security;
alter table votes enable row level security;
alter table vote_options enable row level security;
alter table vote_responses enable row level security;

create policy "team can read discussions" on discussions for select using (auth.role() = 'authenticated');
create policy "team can write discussions" on discussions for all using (auth.role() = 'authenticated');

create policy "team can read discussion_mentions" on discussion_mentions for select using (auth.role() = 'authenticated');
create policy "team can write discussion_mentions" on discussion_mentions for all using (auth.role() = 'authenticated');

create policy "team can read discussion_attachments" on discussion_attachments for select using (auth.role() = 'authenticated');
create policy "team can write discussion_attachments" on discussion_attachments for all using (auth.role() = 'authenticated');

create policy "team can read discussion_replies" on discussion_replies for select using (auth.role() = 'authenticated');
create policy "team can write discussion_replies" on discussion_replies for all using (auth.role() = 'authenticated');

create policy "team can read reply_attachments" on reply_attachments for select using (auth.role() = 'authenticated');
create policy "team can write reply_attachments" on reply_attachments for all using (auth.role() = 'authenticated');

create policy "team can read reply_reactions" on reply_reactions for select using (auth.role() = 'authenticated');
create policy "team can write reply_reactions" on reply_reactions for all using (auth.role() = 'authenticated');

create policy "team can read votes" on votes for select using (auth.role() = 'authenticated');
create policy "team can write votes" on votes for all using (auth.role() = 'authenticated');

create policy "team can read vote_options" on vote_options for select using (auth.role() = 'authenticated');
create policy "team can write vote_options" on vote_options for all using (auth.role() = 'authenticated');

create policy "team can read vote_responses" on vote_responses for select using (auth.role() = 'authenticated');
create policy "team can write vote_responses" on vote_responses for all using (auth.role() = 'authenticated');

create index if not exists idx_discussions_project on discussions(project_id);
create index if not exists idx_discussion_replies_discussion on discussion_replies(discussion_id);
create index if not exists idx_reply_reactions_reply on reply_reactions(reply_id);
create index if not exists idx_vote_options_vote on vote_options(vote_id);
create index if not exists idx_vote_responses_vote on vote_responses(vote_id);
create index if not exists idx_vote_responses_voter on vote_responses(voter_id);

-- ============================================
-- ভোটেও এখন ডিসকাশনের মতোই অ্যাটাচমেন্ট (ফাইল আপলোড / Drive লিংক) যোগ করা যায়
-- ============================================
create table if not exists vote_attachments (
  id uuid default gen_random_uuid() primary key,
  vote_id uuid references votes(id) on delete cascade,
  file_name text not null,
  file_type text,
  url text not null,
  created_at timestamptz default now()
);

alter table vote_attachments enable row level security;
create policy "team can read vote_attachments" on vote_attachments for select using (auth.role() = 'authenticated');
create policy "team can write vote_attachments" on vote_attachments for all using (auth.role() = 'authenticated');

create index if not exists idx_vote_attachments_vote on vote_attachments(vote_id);

-- ============================================
-- NOTIFICATIONS পেজ
-- in-app নোটিফিকেশন ফিড — recipient_id নিজের নোটিফিকেশনই দেখতে/আপডেট/ডিলিট
-- করতে পারবে (এটা ব্যক্তিগত ডেটা, তাই বাকি টেবিলগুলোর মতো broad "team can
-- read all" পলিসি না দিয়ে recipient_id = auth.uid() দিয়ে রেস্ট্রিক্ট করা
-- হয়েছে)। insert broad রাখা হয়েছে যেহেতু কেউ অন্য কারো জন্য নোটিফিকেশন
-- তৈরি করে (যেমন টাস্ক অ্যাসাইন করলে assignee-র জন্য)।
-- ============================================
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  recipient_id uuid references profiles(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  type text not null,                  -- task_assigned | discussion_created | discussion_mention | discussion_reply | vote_created
  title text not null,
  subtitle text,
  meta text,
  entity_type text,
  entity_id uuid,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table notifications enable row level security;
create policy "recipient can read own notifications" on notifications for select using (recipient_id = auth.uid());
create policy "team can insert notifications" on notifications for insert with check (auth.role() = 'authenticated');
create policy "recipient can update own notifications" on notifications for update using (recipient_id = auth.uid());
create policy "recipient can delete own notifications" on notifications for delete using (recipient_id = auth.uid());

create index if not exists idx_notifications_recipient on notifications(recipient_id, created_at desc);

-- ইমেইল/হোয়াটসঅ্যাপ নোটিফিকেশনের জন্য প্রোফাইলে দরকারি কলাম — শুধু
-- Discussions ও Votes-এর জন্যই এই দুই চ্যানেল সেট করা আছে (এই দুইটাই একমাত্র
-- ইভেন্ট যা আসলে বাইরের চ্যানেলে পাঠানো হয়), বাকি সব ইন-অ্যাপ ফিডেই সীমাবদ্ধ।
alter table profiles add column if not exists whatsapp_number text;
alter table profiles add column if not exists notify_email_discussions boolean default true;
alter table profiles add column if not exists notify_email_votes boolean default true;
alter table profiles add column if not exists notify_whatsapp_discussions boolean default false;
alter table profiles add column if not exists notify_whatsapp_votes boolean default false;

-- বেল আইকনের আনরিড কাউন্ট লাইভ আপডেট হওয়ার জন্য (নতুন নোটিফিকেশন এলে রিফ্রেশ
-- ছাড়াই ব্যাজ বদলাবে) — tasks টেবিলের মতোই realtime publication-এ যোগ করা।
alter publication supabase_realtime add table notifications;

-- ============================================
-- প্রোফাইল ছবি (avatar_url) — ProfileMenu থেকে আপলোড করা ছবি Google Drive-এ
-- (files/discussions যেভাবে করে সেই একই resumable upload দিয়ে) সেভ হয়ে এই
-- কলামে drive_url রাখা হয় — attachments টেবিলের মতো, শুধু profile-এর নিজস্ব
-- একটা মাত্র ছবির জন্য আলাদা টেবিল না বানিয়ে সরাসরি কলাম হিসেবে রাখা হয়েছে
-- যেহেতু এক ইউজারের একটাই প্রোফাইল ছবি থাকে।
-- ============================================
alter table profiles add column if not exists avatar_url text;

-- ============================================
-- সোশ্যাল লিংক (Behance/LinkedIn) — পাবলিক ল্যান্ডিং পেজের Team কার্ডে
-- দেখানো হয়, প্রতিটা মেম্বার নিজে ProfileMenu থেকে নিজের লিংক বসাতে পারবে।
-- খালি থাকলে সংশ্লিষ্ট বাটনটা লুকানো থাকে (fake/অকার্যকর বাটন দেখানো হয় না)।
-- ============================================
alter table profiles add column if not exists behance_url text;
alter table profiles add column if not exists linkedin_url text;

-- ============================================
-- পোর্টফোলিও কেস স্টাডি — পাবলিক ল্যান্ডিং পেজের Work সেকশনে দেখানো প্রজেক্টগুলো
-- আগে কোডে হার্ডকোড করা ছিল, এখন app-এর ভেতরের /portfolio পেজ থেকে টিম নিজেই
-- কেস স্টাডি (wireframe/prototype/final UI ছবি + Figma prototype লিংক) যোগ/
-- এডিট/ডিলিট করতে পারবে। published=true না হলে পাবলিক সাইটে দেখা যাবে না
-- (draft হিসেবে রাখা যাবে)।
-- ============================================
create table if not exists case_studies (
  id uuid default gen_random_uuid() primary key,
  slug text not null unique,
  title text not null,
  client_name text,
  summary text,
  tags text[] default '{}',
  cover_image text,
  figma_prototype_url text,
  order_index int default 0,
  published boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- প্রতিটা কেস স্টাডির wireframe/prototype/final_ui সেকশনের একাধিক ছবি —
-- attachments টেবিলের মতোই Drive-hosted লিংক, শুধু case_study_id দিয়ে গ্রুপ করা।
create table if not exists case_study_images (
  id uuid default gen_random_uuid() primary key,
  case_study_id uuid references case_studies(id) on delete cascade,
  section text not null check (section in ('wireframe', 'prototype', 'final_ui')),
  image_url text not null,
  caption text,
  order_index int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_case_study_images_case_study on case_study_images(case_study_id);

alter table case_studies enable row level security;
alter table case_study_images enable row level security;

drop policy if exists "team can read case studies" on case_studies;
drop policy if exists "team can write case studies" on case_studies;
drop policy if exists "team can update case studies" on case_studies;
drop policy if exists "team can delete case studies" on case_studies;
create policy "team can read case studies" on case_studies for select using (auth.role() = 'authenticated');
create policy "team can write case studies" on case_studies for insert with check (auth.role() = 'authenticated');
create policy "team can update case studies" on case_studies for update using (auth.role() = 'authenticated');
create policy "team can delete case studies" on case_studies for delete using (auth.role() = 'authenticated');

drop policy if exists "team can read case study images" on case_study_images;
drop policy if exists "team can write case study images" on case_study_images;
drop policy if exists "team can delete case study images" on case_study_images;
create policy "team can read case study images" on case_study_images for select using (auth.role() = 'authenticated');
create policy "team can write case study images" on case_study_images for insert with check (auth.role() = 'authenticated');
create policy "team can delete case study images" on case_study_images for delete using (auth.role() = 'authenticated');

drop trigger if exists case_studies_updated_at on case_studies;
create trigger case_studies_updated_at
  before update on case_studies
  for each row execute procedure public.set_updated_at();

-- ============================================
-- কেস স্টাডি — ফুল case study কাঠামো (Overview থেকে Team পর্যন্ত ১৬টা সেকশন)
-- আগের case_study_images টেবিল মাত্র ৩টা সেকশন (wireframe/prototype/final_ui)
-- আর শুধু ছবি সাপোর্ট করত। এখনো কোনো real ডেটা এতে সেভ হয়নি (আপলোড বাগের
-- কারণে) — তাই এটা বাদ দিয়ে দুইটা নতুন, বেশি ফ্লেক্সিবল টেবিল দিয়ে বদলানো হলো:
--   case_study_sections → প্রতিটা সেকশনের লেখা (content) — এক কেস স্টাডিতে
--     প্রতিটা section_key-এর জন্য সর্বোচ্চ একটা রো (upsert করে সেভ হয়)।
--   case_study_media → প্রতিটা সেকশনের একাধিক মিডিয়া — ছবি/ভিডিও (Drive-এ
--     আপলোড হয়) অথবা লিংক (বাইরের যেকোনো URL, যেমন Figma/YouTube)।
-- ============================================
drop table if exists case_study_images;

create table if not exists case_study_sections (
  id uuid default gen_random_uuid() primary key,
  case_study_id uuid references case_studies(id) on delete cascade,
  section_key text not null check (section_key in (
    'overview', 'problem_solution', 'user_persona', 'empathy_map', 'competitive_analysis',
    'moscow', 'kano', 'ia_sitemap', 'user_flow', 'wireframe', 'screens_brief', 'mockups',
    'prototype', 'usability_testing', 'ai_help', 'team'
  )),
  content text,
  updated_at timestamptz default now(),
  unique (case_study_id, section_key)
);

create table if not exists case_study_media (
  id uuid default gen_random_uuid() primary key,
  case_study_id uuid references case_studies(id) on delete cascade,
  section_key text not null check (section_key in (
    'overview', 'problem_solution', 'user_persona', 'empathy_map', 'competitive_analysis',
    'moscow', 'kano', 'ia_sitemap', 'user_flow', 'wireframe', 'screens_brief', 'mockups',
    'prototype', 'usability_testing', 'ai_help', 'team'
  )),
  media_type text not null check (media_type in ('image', 'video', 'link')),
  url text not null,
  caption text,
  order_index int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_case_study_sections_cs on case_study_sections(case_study_id);
create index if not exists idx_case_study_media_cs on case_study_media(case_study_id);

alter table case_study_sections enable row level security;
alter table case_study_media enable row level security;

drop policy if exists "team can read case study sections" on case_study_sections;
drop policy if exists "team can write case study sections" on case_study_sections;
drop policy if exists "team can update case study sections" on case_study_sections;
create policy "team can read case study sections" on case_study_sections for select using (auth.role() = 'authenticated');
create policy "team can write case study sections" on case_study_sections for insert with check (auth.role() = 'authenticated');
create policy "team can update case study sections" on case_study_sections for update using (auth.role() = 'authenticated');

drop policy if exists "team can read case study media" on case_study_media;
drop policy if exists "team can write case study media" on case_study_media;
drop policy if exists "team can delete case study media" on case_study_media;
create policy "team can read case study media" on case_study_media for select using (auth.role() = 'authenticated');
create policy "team can write case study media" on case_study_media for insert with check (auth.role() = 'authenticated');
create policy "team can delete case study media" on case_study_media for delete using (auth.role() = 'authenticated');

-- ============================================
-- TO-DO — Tasks পেজ থেকে আলাদা: এটা প্রজেক্ট/ওয়ার্কফ্লো-এর সাথে বাঁধা না,
-- শুধু "কে কী করবে" ছোট personal/team to-do। শুধু এডমিনরাই নতুন to-do
-- তৈরি/অ্যাসাইন/রিঅ্যাসাইন/ডিলিট করতে পারবে (UI-তে গেট করা), যেকোনো মেম্বার
-- নিজের নামে থাকা to-do complete/incomplete টগল করতে পারবে। "Overdue"
-- আলাদা status না — due_date পার হয়ে গেলে আর status='pending' থাকলে সেটাই
-- overdue (কোনো cron/ব্যাকগ্রাউন্ড জব লাগে না)।
-- ============================================
create table if not exists todos (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  assignee_id uuid references profiles(id) on delete cascade,
  created_by uuid references profiles(id),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  due_date date,
  due_time time,
  project_id uuid references projects(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_todos_assignee on todos(assignee_id);
create index if not exists idx_todos_status on todos(status);

alter table todos enable row level security;

drop policy if exists "team can read todos" on todos;
drop policy if exists "team can write todos" on todos;
drop policy if exists "team can update todos" on todos;
drop policy if exists "team can delete todos" on todos;
create policy "team can read todos" on todos for select using (auth.role() = 'authenticated');
create policy "team can write todos" on todos for insert with check (auth.role() = 'authenticated');
create policy "team can update todos" on todos for update using (auth.role() = 'authenticated');
create policy "team can delete todos" on todos for delete using (auth.role() = 'authenticated');

drop trigger if exists todos_updated_at on todos;
create trigger todos_updated_at
  before update on todos
  for each row execute procedure public.set_updated_at();

-- ============================================
-- CLIENT PORTAL — ফেজ ১: অ্যাকাউন্ট টাইপ ও RLS সিকিউরিটি ফাউন্ডেশন
-- এতদিন প্রতিটা টেবিলের RLS পলিসি ছিল auth.role() = 'authenticated' —
-- মানে যেকোনো লগইন করা ইউজার (টিম মেম্বার হোক বা না হোক) সব প্রজেক্ট/টাস্ক/
-- টিম-মেম্বার/ইন্টারনাল ডেটা পড়তে পারত। এখন ক্লায়েন্ট পোর্টাল অ্যাকাউন্ট
-- (একই Supabase Auth প্রজেক্টে, আলাদা auth সিস্টেম না) যোগ হওয়ার আগে এটা
-- আবশ্যিকভাবে ঠিক করতে হবে — নাহলে যেকোনো ক্লায়েন্ট লগইন করেই ভেতরের সব
-- ডেটা দেখতে পারত। এই মাইগ্রেশন শুধু সিকিউরিটি ফাউন্ডেশন — এখনো কোনো নতুন
-- ক্লায়েন্ট-ফেসিং স্ক্রিন/ফিচার যোগ হয়নি।
-- ============================================

-- profiles-এ account_type — 'team' | 'client'। বিদ্যমান সব রো এখন 'team'
-- (তারা সবাই আসল টিম মেম্বার), যেটাই সঠিক।
alter table profiles add column if not exists account_type text not null default 'team' check (account_type in ('team', 'client'));

-- ক্লায়েন্ট পোর্টাল অ্যাকাউন্টকে auth.users-এর সাথে লিংক করতে clients
-- টেবিলে user_id — এখনো শুধু এই একটা কলামই যোগ হলো, বাকি অনবোর্ডিং ফিল্ড
-- (full_name, phone, company_size ইত্যাদি) পরে Screen 3/4 বানানোর সময় যোগ
-- হবে, এখন স্কোপ শুধু সিকিউরিটির জন্য যা লাগে তার মধ্যেই রাখা হয়েছে।
alter table clients add column if not exists user_id uuid references auth.users(id) on delete cascade;
create unique index if not exists idx_clients_user_id on clients(user_id) where user_id is not null;

-- RLS পলিসিতে বারবার ব্যবহারের জন্য হেল্পার ফাংশন — security definer দিয়ে
-- বানানো (function owner-এর পারমিশনে রান হয়), তাই profiles-এর নিজের RLS-এর
-- সাথে infinite recursion হয় না।
create or replace function public.is_team_member()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and account_type = 'team'
  );
$$;

-- নতুন সাইনআপে profiles রো অটো-তৈরি হওয়ার trigger আপডেট — signup metadata-তে
-- account_type='client' পাঠানো হলে profiles-এ কিছুই insert হবে না। ফলে
-- ক্লায়েন্ট অ্যাকাউন্ট Team Workload, টাস্ক অ্যাসাইনি ড্রপডাউন, avatar
-- stack — কোথাও দেখা যাবে না, বিদ্যমান কোনো পেজে কোনো কোড পরিবর্তন ছাড়াই।
-- অ্যাডমিন-তৈরি টিম মেম্বার (/api/team/create-member) আগের মতোই কাজ করবে,
-- যেহেতু সেখানে account_type পাঠানো হয় না (ডিফল্ট 'team')।
create or replace function public.handle_new_user()
returns trigger as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', 'team') = 'client' then
    return new;
  end if;
  insert into public.profiles (id, full_name, account_type)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'team');
  return new;
end;
$$ language plpgsql security definer;

-- ============================================
-- বিদ্যমান সব internal টেবিলের RLS auth.role()='authenticated' থেকে
-- is_team_member()-এ পরিবর্তন।
-- ============================================

drop policy if exists "team can read profiles" on profiles;
create policy "team can read profiles" on profiles for select using (public.is_team_member());

drop policy if exists "team can read clients" on clients;
drop policy if exists "team can write clients" on clients;
drop policy if exists "team can update clients" on clients;
drop policy if exists "client can read own record" on clients;
drop policy if exists "client can create own record" on clients;
drop policy if exists "client can update own record" on clients;
create policy "team can read clients" on clients for select using (public.is_team_member());
create policy "team can write clients" on clients for insert with check (public.is_team_member());
create policy "team can update clients" on clients for update using (public.is_team_member());
-- ক্লায়েন্ট নিজের রেকর্ড পড়তে/বানাতে/আপডেট করতে পারবে (ভবিষ্যতের
-- রেজিস্ট্রেশন স্ক্রিনের জন্য দরকার)
create policy "client can read own record" on clients for select using (user_id = auth.uid());
create policy "client can create own record" on clients for insert with check (user_id = auth.uid());
create policy "client can update own record" on clients for update using (user_id = auth.uid());

drop policy if exists "team can read projects" on projects;
drop policy if exists "team can write projects" on projects;
drop policy if exists "team can update projects" on projects;
drop policy if exists "client can read own projects" on projects;
create policy "team can read projects" on projects for select using (public.is_team_member());
create policy "team can write projects" on projects for insert with check (public.is_team_member());
create policy "team can update projects" on projects for update using (public.is_team_member());
-- ক্লায়েন্ট শুধু নিজের প্রজেক্ট(গুলো) দেখতে পারবে, বাকি কারো না
create policy "client can read own projects" on projects for select using (
  exists (select 1 from clients where clients.id = projects.client_id and clients.user_id = auth.uid())
);

drop policy if exists "team can read tasks" on tasks;
drop policy if exists "team can write tasks" on tasks;
drop policy if exists "team can update tasks" on tasks;
drop policy if exists "team can delete tasks" on tasks;
create policy "team can read tasks" on tasks for select using (public.is_team_member());
create policy "team can write tasks" on tasks for insert with check (public.is_team_member());
create policy "team can update tasks" on tasks for update using (public.is_team_member());
create policy "team can delete tasks" on tasks for delete using (public.is_team_member());

drop policy if exists "team can read checklist" on checklist_items;
drop policy if exists "team can write checklist" on checklist_items;
create policy "team can read checklist" on checklist_items for select using (public.is_team_member());
create policy "team can write checklist" on checklist_items for all using (public.is_team_member());

drop policy if exists "team can read comments" on comments;
drop policy if exists "team can write comments" on comments;
create policy "team can read comments" on comments for select using (public.is_team_member());
create policy "team can write comments" on comments for insert with check (public.is_team_member());

drop policy if exists "team can read attachments" on attachments;
drop policy if exists "team can write attachments" on attachments;
create policy "team can read attachments" on attachments for select using (public.is_team_member());
create policy "team can write attachments" on attachments for all using (public.is_team_member());

drop policy if exists "team can read activity" on activity_log;
drop policy if exists "team can write activity" on activity_log;
create policy "team can read activity" on activity_log for select using (public.is_team_member());
create policy "team can write activity" on activity_log for insert with check (public.is_team_member());

drop policy if exists "team can read meetings" on meetings;
drop policy if exists "team can write meetings" on meetings;
create policy "team can read meetings" on meetings for select using (public.is_team_member());
create policy "team can write meetings" on meetings for all using (public.is_team_member());

drop policy if exists "team can read milestones" on milestones;
drop policy if exists "team can write milestones" on milestones;
create policy "team can read milestones" on milestones for select using (public.is_team_member());
create policy "team can write milestones" on milestones for all using (public.is_team_member());

drop policy if exists "team can read folders" on folders;
drop policy if exists "team can write folders" on folders;
create policy "team can read folders" on folders for select using (public.is_team_member());
create policy "team can write folders" on folders for all using (public.is_team_member());

drop policy if exists "team can read discussions" on discussions;
drop policy if exists "team can write discussions" on discussions;
create policy "team can read discussions" on discussions for select using (public.is_team_member());
create policy "team can write discussions" on discussions for all using (public.is_team_member());

drop policy if exists "team can read discussion_mentions" on discussion_mentions;
drop policy if exists "team can write discussion_mentions" on discussion_mentions;
create policy "team can read discussion_mentions" on discussion_mentions for select using (public.is_team_member());
create policy "team can write discussion_mentions" on discussion_mentions for all using (public.is_team_member());

drop policy if exists "team can read discussion_attachments" on discussion_attachments;
drop policy if exists "team can write discussion_attachments" on discussion_attachments;
create policy "team can read discussion_attachments" on discussion_attachments for select using (public.is_team_member());
create policy "team can write discussion_attachments" on discussion_attachments for all using (public.is_team_member());

drop policy if exists "team can read discussion_replies" on discussion_replies;
drop policy if exists "team can write discussion_replies" on discussion_replies;
create policy "team can read discussion_replies" on discussion_replies for select using (public.is_team_member());
create policy "team can write discussion_replies" on discussion_replies for all using (public.is_team_member());

drop policy if exists "team can read reply_attachments" on reply_attachments;
drop policy if exists "team can write reply_attachments" on reply_attachments;
create policy "team can read reply_attachments" on reply_attachments for select using (public.is_team_member());
create policy "team can write reply_attachments" on reply_attachments for all using (public.is_team_member());

drop policy if exists "team can read reply_reactions" on reply_reactions;
drop policy if exists "team can write reply_reactions" on reply_reactions;
create policy "team can read reply_reactions" on reply_reactions for select using (public.is_team_member());
create policy "team can write reply_reactions" on reply_reactions for all using (public.is_team_member());

drop policy if exists "team can read votes" on votes;
drop policy if exists "team can write votes" on votes;
create policy "team can read votes" on votes for select using (public.is_team_member());
create policy "team can write votes" on votes for all using (public.is_team_member());

drop policy if exists "team can read vote_options" on vote_options;
drop policy if exists "team can write vote_options" on vote_options;
create policy "team can read vote_options" on vote_options for select using (public.is_team_member());
create policy "team can write vote_options" on vote_options for all using (public.is_team_member());

drop policy if exists "team can read vote_responses" on vote_responses;
drop policy if exists "team can write vote_responses" on vote_responses;
create policy "team can read vote_responses" on vote_responses for select using (public.is_team_member());
create policy "team can write vote_responses" on vote_responses for all using (public.is_team_member());

drop policy if exists "team can read vote_attachments" on vote_attachments;
drop policy if exists "team can write vote_attachments" on vote_attachments;
create policy "team can read vote_attachments" on vote_attachments for select using (public.is_team_member());
create policy "team can write vote_attachments" on vote_attachments for all using (public.is_team_member());

drop policy if exists "team can read case studies" on case_studies;
drop policy if exists "team can write case studies" on case_studies;
drop policy if exists "team can update case studies" on case_studies;
drop policy if exists "team can delete case studies" on case_studies;
create policy "team can read case studies" on case_studies for select using (public.is_team_member());
create policy "team can write case studies" on case_studies for insert with check (public.is_team_member());
create policy "team can update case studies" on case_studies for update using (public.is_team_member());
create policy "team can delete case studies" on case_studies for delete using (public.is_team_member());

drop policy if exists "team can read case study sections" on case_study_sections;
drop policy if exists "team can write case study sections" on case_study_sections;
drop policy if exists "team can update case study sections" on case_study_sections;
create policy "team can read case study sections" on case_study_sections for select using (public.is_team_member());
create policy "team can write case study sections" on case_study_sections for insert with check (public.is_team_member());
create policy "team can update case study sections" on case_study_sections for update using (public.is_team_member());

drop policy if exists "team can read case study media" on case_study_media;
drop policy if exists "team can write case study media" on case_study_media;
drop policy if exists "team can delete case study media" on case_study_media;
create policy "team can read case study media" on case_study_media for select using (public.is_team_member());
create policy "team can write case study media" on case_study_media for insert with check (public.is_team_member());
create policy "team can delete case study media" on case_study_media for delete using (public.is_team_member());

drop policy if exists "team can read todos" on todos;
drop policy if exists "team can write todos" on todos;
drop policy if exists "team can update todos" on todos;
drop policy if exists "team can delete todos" on todos;
create policy "team can read todos" on todos for select using (public.is_team_member());
create policy "team can write todos" on todos for insert with check (public.is_team_member());
create policy "team can update todos" on todos for update using (public.is_team_member());
create policy "team can delete todos" on todos for delete using (public.is_team_member());

-- CLIENT PORTAL — ফেজ ২: onboarding ডেটা মডেল (Screen 4 — client_requirements,
-- client_files) + clients টেবিলে অনবোর্ডিং-এর বাকি কলাম। clients.user_id ও
-- is_team_member()/RLS foundation আগেই ফেজ ১-এ যোগ হয়েছে।

alter table clients add column if not exists designation text;
alter table clients add column if not exists company_size text;

create table if not exists client_requirements (
  id uuid default gen_random_uuid() primary key,
  client_id uuid not null references clients(id) on delete cascade,
  project_name text,
  project_type text,
  project_description text,
  goals text,
  target_audience text,
  required_features text,
  expected_timeline text,
  budget_range text,
  reference_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists idx_client_requirements_client_id on client_requirements(client_id);

create table if not exists client_files (
  id uuid default gen_random_uuid() primary key,
  client_id uuid not null references clients(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  file_type text,
  size_bytes bigint,
  drive_url text not null,
  category text not null default 'other', -- requirements | sow | invoice | receipt | design | deliverable | other
  uploaded_by text not null default 'client', -- client | team
  created_at timestamptz default now()
);
create index if not exists idx_client_files_client_id on client_files(client_id);

alter table client_requirements enable row level security;
alter table client_files enable row level security;

drop policy if exists "team can read client_requirements" on client_requirements;
drop policy if exists "client can read own requirements" on client_requirements;
drop policy if exists "client can write own requirements" on client_requirements;
drop policy if exists "client can update own requirements" on client_requirements;
create policy "team can read client_requirements" on client_requirements for select using (public.is_team_member());
create policy "client can read own requirements" on client_requirements for select using (
  exists (select 1 from clients where clients.id = client_requirements.client_id and clients.user_id = auth.uid())
);
create policy "client can write own requirements" on client_requirements for insert with check (
  exists (select 1 from clients where clients.id = client_requirements.client_id and clients.user_id = auth.uid())
);
create policy "client can update own requirements" on client_requirements for update using (
  exists (select 1 from clients where clients.id = client_requirements.client_id and clients.user_id = auth.uid())
);

drop policy if exists "team can read client_files" on client_files;
drop policy if exists "team can write client_files" on client_files;
drop policy if exists "team can delete client_files" on client_files;
drop policy if exists "client can read own files" on client_files;
drop policy if exists "client can write own files" on client_files;
create policy "team can read client_files" on client_files for select using (public.is_team_member());
create policy "team can write client_files" on client_files for insert with check (public.is_team_member());
create policy "team can delete client_files" on client_files for delete using (public.is_team_member());
create policy "client can read own files" on client_files for select using (
  exists (select 1 from clients where clients.id = client_files.client_id and clients.user_id = auth.uid())
);
create policy "client can write own files" on client_files for insert with check (
  exists (select 1 from clients where clients.id = client_files.client_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ৩: ক্লায়েন্টরা নিজের activity_log এন্ট্রি লিখতে পারবে
-- (শুধু entity_type='client', নিজের client_id-এর জন্য) — Screen 7 (Admin Client
-- Details)-এর Activity টাইমলাইনে onboarding submit-এর মতো ঘটনা দেখানোর জন্য।
drop policy if exists "client can write own activity" on activity_log;
create policy "client can write own activity" on activity_log for insert with check (
  entity_type = 'client' and exists (select 1 from clients where clients.id = activity_log.entity_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ৪: Screens 9-13 (Client Project Dashboard, SOW,
-- SOW Signature, Payment Request, Payment Confirmation)।
--
-- milestones টেবিল আগে থেকেই আছে (admin /projects/[id]-এ ব্যবহার করে) — Screen 9-এর
-- "client-safe milestones" এটাই read-only দেখাবে, নতুন কোনো টেবিল লাগেনি।
drop policy if exists "client can read own project milestones" on milestones;
create policy "client can read own project milestones" on milestones for select using (
  exists (select 1 from projects join clients on clients.id = projects.client_id where projects.id = milestones.project_id and clients.user_id = auth.uid())
);

-- SOW: version-per-row (project_id, version) — "Create New Version" নতুন রো ইনসার্ট
-- করে, পুরনো ভার্সনগুলো v1/v2/v3 হিসেবে দেখা যাবে। ক্লায়েন্ট শুধু read করতে পারে,
-- সাইন করা হয় নিচের sign_sow() ফাংশন দিয়ে (RPC) — সরাসরি UPDATE পলিসি না দিয়ে,
-- যাতে ক্লায়েন্ট sign করা ছাড়া scope/deliverables/terms বদলাতে না পারে।
create table if not exists sows (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  version int not null default 1,
  scope text,
  objectives text,
  deliverables text,
  timeline text,
  payment_terms text,
  revision_policy text,
  client_responsibilities text,
  terms text,
  document_url text, -- ঐচ্ছিক: টাইপ করার বদলে সরাসরি PDF/DOC আপলোড (Drive পাইপলাইন রিইউজ)
  status text not null default 'draft', -- draft | sent | signed
  notify_client boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  sent_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  signature_text text
);
create unique index if not exists idx_sows_project_version on sows(project_id, version);
create index if not exists idx_sows_project on sows(project_id);

alter table sows enable row level security;
drop policy if exists "team can read sows" on sows;
drop policy if exists "team can write sows" on sows;
drop policy if exists "team can update sows" on sows;
drop policy if exists "client can read own project sows" on sows;
create policy "team can read sows" on sows for select using (public.is_team_member());
create policy "team can write sows" on sows for insert with check (public.is_team_member());
create policy "team can update sows" on sows for update using (public.is_team_member());
create policy "client can read own project sows" on sows for select using (
  exists (select 1 from projects join clients on clients.id = projects.client_id where projects.id = sows.project_id and clients.user_id = auth.uid())
);

create or replace function public.sign_sow(p_sow_id uuid, p_full_name text, p_signature text)
returns void
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
  v_client_user_id uuid;
begin
  select sows.project_id into v_project_id from sows where sows.id = p_sow_id;
  if v_project_id is null then
    raise exception 'SOW not found';
  end if;

  select clients.user_id into v_client_user_id
  from projects join clients on clients.id = projects.client_id
  where projects.id = v_project_id;

  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized to sign this SOW';
  end if;

  update sows
  set status = 'signed', signed_at = now(), signed_by_name = p_full_name, signature_text = p_signature
  where id = p_sow_id and status = 'sent';

  if not found then
    raise exception 'This SOW is not awaiting signature';
  end if;
end;
$$;
grant execute on function public.sign_sow(uuid, text, text) to authenticated;

-- INVOICES (Screen 12 — Payment Request) ও PAYMENTS (Screen 13 — Payment
-- Confirmation)। কোনো পেমেন্ট গেটওয়ে ইন্টিগ্রেট করা নেই বলে ম্যানুয়াল ফ্লো:
-- ক্লায়েন্ট নিজের transaction id/method জমা দেয় (submit_payment RPC), এডমিন
-- ব্যাংক/মোবাইল-ওয়ালেট স্টেটমেন্টের সাথে মিলিয়ে "Confirm Payment" চাপে।
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  payment_type text not null default 'milestone', -- deposit | milestone | final | additional
  amount numeric not null,
  currency text not null default 'BDT',
  description text,
  due_date date,
  payment_method text,
  status text not null default 'pending', -- pending | processing | paid | failed | cancelled | refunded
  notify_client boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_invoices_project on invoices(project_id);
create index if not exists idx_invoices_client on invoices(client_id);

create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid not null references invoices(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  amount numeric,
  payment_method text,
  transaction_id text,
  payment_date date,
  notes text,
  submitted_by text not null default 'client', -- client | team
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_payments_invoice on payments(invoice_id);

alter table invoices enable row level security;
alter table payments enable row level security;

drop policy if exists "team can read invoices" on invoices;
drop policy if exists "team can write invoices" on invoices;
drop policy if exists "team can update invoices" on invoices;
drop policy if exists "client can read own invoices" on invoices;
create policy "team can read invoices" on invoices for select using (public.is_team_member());
create policy "team can write invoices" on invoices for insert with check (public.is_team_member());
create policy "team can update invoices" on invoices for update using (public.is_team_member());
create policy "client can read own invoices" on invoices for select using (
  exists (select 1 from clients where clients.id = invoices.client_id and clients.user_id = auth.uid())
);

drop policy if exists "team can read payments" on payments;
drop policy if exists "team can write payments" on payments;
drop policy if exists "team can update payments" on payments;
drop policy if exists "client can read own payments" on payments;
create policy "team can read payments" on payments for select using (public.is_team_member());
create policy "team can write payments" on payments for insert with check (public.is_team_member());
create policy "team can update payments" on payments for update using (public.is_team_member());
create policy "client can read own payments" on payments for select using (
  exists (select 1 from clients where clients.id = payments.client_id and clients.user_id = auth.uid())
);

create or replace function public.submit_payment(
  p_invoice_id uuid, p_amount numeric, p_method text, p_transaction_id text, p_payment_date date, p_notes text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
  v_client_id uuid;
  v_client_user_id uuid;
  v_payment_id uuid;
begin
  select invoices.project_id, invoices.client_id into v_project_id, v_client_id from invoices where invoices.id = p_invoice_id;
  if v_client_id is null then
    raise exception 'Invoice not found';
  end if;

  select clients.user_id into v_client_user_id from clients where clients.id = v_client_id;
  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  insert into payments (invoice_id, project_id, client_id, amount, payment_method, transaction_id, payment_date, notes, submitted_by)
  values (p_invoice_id, v_project_id, v_client_id, p_amount, p_method, p_transaction_id, p_payment_date, p_notes, 'client')
  returning id into v_payment_id;

  update invoices set status = 'processing' where id = p_invoice_id and status = 'pending';

  return v_payment_id;
end;
$$;
grant execute on function public.submit_payment(uuid, numeric, text, text, date, text) to authenticated;

-- ক্লায়েন্ট নিজের প্রজেক্টের PM/অ্যাকাউন্ট ম্যানেজারের নাম-ছবি দেখতে পারবে (Screen 9-এর
-- "Project Manager / Client Contact") — পুরো টিম লিস্ট না, শুধু এই দুইজন।
drop policy if exists "client can read own project team contacts" on profiles;
create policy "client can read own project team contacts" on profiles for select using (
  exists (
    select 1 from projects join clients on clients.id = projects.client_id
    where clients.user_id = auth.uid() and projects.project_manager_id = profiles.id
  )
  or exists (
    select 1 from clients where clients.user_id = auth.uid() and clients.account_manager_id = profiles.id
  )
);

-- CLIENT PORTAL — ফেজ ৫: Screens 14-24 (Payment History/Receipt, Progress,
-- Feedback, Messages, Files, Approvals, Change Requests, Updates, Final
-- Delivery, Completion)।

-- Screen 15 রিসিট নাম্বার — payment confirm করার সময় সেট হয়।
alter table payments add column if not exists receipt_number text;

-- Screen 16 — প্রতিটা milestone-এর ছোট বিবরণ (আগে শুধু title ছিল)।
alter table milestones add column if not exists description text;

-- Screen 19 — admin কোনো ফাইল ক্লায়েন্ট থেকে লুকিয়ে রাখতে পারবে (Share/Hide)।
alter table client_files add column if not exists hidden_from_client boolean not null default false;
drop policy if exists "client can read own files" on client_files;
create policy "client can read own files" on client_files for select using (
  not hidden_from_client and exists (select 1 from clients where clients.id = client_files.client_id and clients.user_id = auth.uid())
);
drop policy if exists "team can update client_files" on client_files;
create policy "team can update client_files" on client_files for update using (public.is_team_member());

-- Screen 23/24 — ফাইনাল ডেলিভারি/প্রজেক্ট কমপ্লিশনের জন্য প্রজেক্ট-লেভেল স্টেট।
alter table projects add column if not exists final_delivery_status text; -- null | ready | approved | changes_requested
alter table projects add column if not exists final_delivery_notes text;
alter table projects add column if not exists completed_at timestamptz;

-- Screen 17 — FEEDBACK
create table if not exists client_feedback (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  attachment_url text,
  status text not null default 'new', -- new | in_progress | resolved | rejected
  assigned_to uuid references profiles(id),
  converted_task_id uuid references tasks(id) on delete set null,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_client_feedback_project on client_feedback(project_id);
alter table client_feedback enable row level security;
drop policy if exists "team can read client_feedback" on client_feedback;
drop policy if exists "team can update client_feedback" on client_feedback;
drop policy if exists "client can read own feedback" on client_feedback;
drop policy if exists "client can write own feedback" on client_feedback;
create policy "team can read client_feedback" on client_feedback for select using (public.is_team_member());
create policy "team can update client_feedback" on client_feedback for update using (public.is_team_member());
create policy "client can read own feedback" on client_feedback for select using (
  exists (select 1 from clients where clients.id = client_feedback.client_id and clients.user_id = auth.uid())
);
create policy "client can write own feedback" on client_feedback for insert with check (
  exists (select 1 from clients where clients.id = client_feedback.client_id and clients.user_id = auth.uid())
);

-- Screen 18 — MESSAGES (ইন্টারনাল টিম চ্যাট/discussions থেকে আলাদা)
create table if not exists client_messages (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  sender text not null, -- client | team
  sender_id uuid references profiles(id),
  message text,
  attachment_url text,
  created_at timestamptz default now(),
  read_at timestamptz
);
create index if not exists idx_client_messages_project on client_messages(project_id, created_at);
alter table client_messages enable row level security;
drop policy if exists "team can read client_messages" on client_messages;
drop policy if exists "team can write client_messages" on client_messages;
drop policy if exists "team can update client_messages" on client_messages;
drop policy if exists "client can read own messages" on client_messages;
drop policy if exists "client can write own messages" on client_messages;
drop policy if exists "client can update own messages" on client_messages;
create policy "team can read client_messages" on client_messages for select using (public.is_team_member());
create policy "team can write client_messages" on client_messages for insert with check (public.is_team_member() and sender = 'team');
create policy "team can update client_messages" on client_messages for update using (public.is_team_member());
create policy "client can read own messages" on client_messages for select using (
  exists (select 1 from clients where clients.id = client_messages.client_id and clients.user_id = auth.uid())
);
create policy "client can write own messages" on client_messages for insert with check (
  sender = 'client' and exists (select 1 from clients where clients.id = client_messages.client_id and clients.user_id = auth.uid())
);
create policy "client can update own messages" on client_messages for update using (
  exists (select 1 from clients where clients.id = client_messages.client_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ১৬: Screen 18 (Messages) রিডিজাইন। real sender_id দিয়ে
-- conversation গ্রুপিং (নতুন কোনো ডুপ্লিকেট conversation/thread টেবিল লাগেনি —
-- একই project-এর একটাই real থ্রেড, sender অনুযায়ী client-side গ্রুপ করা হয়,
-- "Starred" localStorage-এ, ডিভাইস-লোকাল — কোনো fake server-side sync দাবি করা
-- হচ্ছে না)। attachment এখন real filename/size/type সহ (আগে শুধু URL ছিল)।
alter table client_messages add column if not exists attachment_name text;
alter table client_messages add column if not exists attachment_size bigint;
alter table client_messages add column if not exists attachment_type text;

-- ক্লায়েন্ট এখন যেকোনো real sender-এর প্রোফাইল (নাম/role/avatar) দেখতে পারবে যে
-- তাকে অন্তত একটা মেসেজ পাঠিয়েছে (আগে শুধু project_manager-এর প্রোফাইল দেখা যেত,
-- অন্য টিম মেম্বার রিপ্লাই করলে নাম না পেয়ে জেনেরিক ফলব্যাকে পড়ে যেত)।
drop policy if exists "client can read message sender profiles" on profiles;
create policy "client can read message sender profiles" on profiles for select using (
  exists (
    select 1 from client_messages join clients on clients.id = client_messages.client_id
    where client_messages.sender_id = profiles.id and clients.user_id = auth.uid()
  )
);

-- Screen 20 — APPROVALS
create table if not exists client_approvals (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  item text not null,
  status text not null default 'awaiting', -- awaiting | approved | changes_requested
  comment text,
  attachment_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  responded_at timestamptz
);
create index if not exists idx_client_approvals_project on client_approvals(project_id);
alter table client_approvals enable row level security;
drop policy if exists "team can read client_approvals" on client_approvals;
drop policy if exists "team can write client_approvals" on client_approvals;
drop policy if exists "client can read own approvals" on client_approvals;
drop policy if exists "client can respond own approvals" on client_approvals;
create policy "team can read client_approvals" on client_approvals for select using (public.is_team_member());
create policy "team can write client_approvals" on client_approvals for insert with check (public.is_team_member());
create policy "client can read own approvals" on client_approvals for select using (
  exists (select 1 from clients where clients.id = client_approvals.client_id and clients.user_id = auth.uid())
);
create policy "client can respond own approvals" on client_approvals for update using (
  exists (select 1 from clients where clients.id = client_approvals.client_id and clients.user_id = auth.uid())
);

-- Screen 21 — CHANGE REQUESTS (ক্লায়েন্ট তৈরি করে, শুধু টিম রিভিউ/আপডেট করতে পারে)
create table if not exists change_requests (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  reason text,
  attachment_url text,
  status text not null default 'pending', -- pending | under_review | approved | rejected
  additional_cost numeric,
  additional_time text,
  admin_notes text,
  converted_task_id uuid references tasks(id) on delete set null,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_change_requests_project on change_requests(project_id);
alter table change_requests enable row level security;
drop policy if exists "team can read change_requests" on change_requests;
drop policy if exists "team can update change_requests" on change_requests;
drop policy if exists "client can read own change_requests" on change_requests;
drop policy if exists "client can write own change_requests" on change_requests;
create policy "team can read change_requests" on change_requests for select using (public.is_team_member());
create policy "team can update change_requests" on change_requests for update using (public.is_team_member());
create policy "client can read own change_requests" on change_requests for select using (
  exists (select 1 from clients where clients.id = change_requests.client_id and clients.user_id = auth.uid())
);
create policy "client can write own change_requests" on change_requests for insert with check (
  exists (select 1 from clients where clients.id = change_requests.client_id and clients.user_id = auth.uid())
);

-- Screen 22 — PROJECT UPDATES (টিম পাবলিশ করে, ক্লায়েন্ট শুধু পড়ে)
create table if not exists project_updates (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references projects(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  description text,
  attachment_url text,
  notify_client boolean not null default true,
  author_id uuid references profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_project_updates_project on project_updates(project_id, created_at);
alter table project_updates enable row level security;
drop policy if exists "team can read project_updates" on project_updates;
drop policy if exists "team can write project_updates" on project_updates;
drop policy if exists "client can read own updates" on project_updates;
create policy "team can read project_updates" on project_updates for select using (public.is_team_member());
create policy "team can write project_updates" on project_updates for insert with check (public.is_team_member());
create policy "client can read own updates" on project_updates for select using (
  exists (select 1 from clients where clients.id = project_updates.client_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ৬: Screen 4 (Onboarding) রিডিজাইনে নতুন যোগ হওয়া ফিল্ড।
alter table clients add column if not exists preferred_contact_method text;
alter table clients add column if not exists country text;
alter table clients add column if not exists timezone text;
alter table client_requirements add column if not exists competitors text;
alter table client_requirements add column if not exists existing_assets text;
alter table client_requirements add column if not exists priority text default 'normal';

-- CLIENT PORTAL — ফেজ ৭: Screen 5 (Empty Dashboard) রিডিজাইন। এডমিন client-এর
-- কাছে অতিরিক্ত তথ্য চাইলে (Screen 7-এর নতুন "Request Information" অ্যাকশন) সেটা
-- এখানে সেভ হয়, ড্যাশবোর্ডে "Action Required" স্টেট হিসেবে দেখা যায়।
alter table clients add column if not exists admin_request text;
alter table clients add column if not exists admin_request_at timestamptz;

-- Screen 5-এর Recent Activity টাইমলাইনের জন্য — ক্লায়েন্ট নিজের entity_type='client'
-- অ্যাক্টিভিটি পড়তে পারবে (আগে শুধু insert পলিসি ছিল, select ছিল না)।
drop policy if exists "client can read own activity" on activity_log;
create policy "client can read own activity" on activity_log for select using (
  entity_type = 'client' and exists (select 1 from clients where clients.id = activity_log.entity_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ৮: Screen 6 (Admin Client List) রিডিজাইন। "Archive Client"
-- আলাদা boolean হিসেবে রাখা হয়েছে (clients.status ওভাররাইট না করে) যাতে আর্কাইভ
-- করার আগের আসল স্টেজ (active/discussion/completed ইত্যাদি) হারিয়ে না যায় —
-- "Unarchive" করলে ঠিক আগের স্টেটাসেই ফিরে যায়।
alter table clients add column if not exists is_archived boolean not null default false;

-- CLIENT PORTAL — ফেজ ৯: Screen 7 (Admin Client Details) রিডিজাইন। "Internal Notes"-এর
-- জন্য নতুন টেবিল — ক্লায়েন্টের একক notes ফিল্ড ওভাররাইট না করে (সেটা এখনো Edit
-- Client মোডালে আছে), একাধিক timestamped/authored নোট রাখার জন্য (comments
-- টেবিলের মতোই প্যাটার্ন, শুধু টিমের জন্য — ক্লায়েন্ট এটা কখনো দেখে না)।
create table if not exists client_notes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid not null references clients(id) on delete cascade,
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_client_notes_client on client_notes(client_id, created_at desc);

alter table client_notes enable row level security;
drop policy if exists "team can read client_notes" on client_notes;
drop policy if exists "team can write client_notes" on client_notes;
drop policy if exists "team can update client_notes" on client_notes;
drop policy if exists "team can delete client_notes" on client_notes;
create policy "team can read client_notes" on client_notes for select using (public.is_team_member());
create policy "team can write client_notes" on client_notes for insert with check (public.is_team_member());
create policy "team can update client_notes" on client_notes for update using (public.is_team_member());
create policy "team can delete client_notes" on client_notes for delete using (public.is_team_member());

-- CLIENT PORTAL — ফেজ ১০: Screen 8 (Create Project) রিডিজাইন।
-- scope_note/deliverables_note ছোট formatted-text কলাম হিসেবে রাখা হয়েছে —
-- structured scope/deliverables টেবিল বানানো হয়নি যেহেতু SOW টেবিল (Screen 10-11)-ই
-- আসল structured scope/deliverables/payment_terms রাখে; এখানে শুধু agency-র
-- initial planning নোট, যেটা পরে SOW বানানোর সময় রেফারেন্স হিসেবে কাজে লাগবে।
alter table projects add column if not exists scope_note text;
alter table projects add column if not exists deliverables_note text;
alter table projects add column if not exists payment_structure text; -- full | deposit_final | milestones | custom

-- client_visible=false দিয়ে প্রজেক্ট client portal-এ লুকানো থাকে (Screen 5/9
-- কোনো কোড পরিবর্তন ছাড়াই এই RLS পলিসিতেই real-এ কাজ করে — hidden প্রজেক্ট
-- client-এর কাছে row-ই আসে না, তাই Screen 5 dashboard redirect করে না, Screen 9
-- সরাসরি URL দিয়েও অ্যাক্সেস করা যায় না)।
alter table projects add column if not exists client_visible boolean not null default true;
drop policy if exists "client can read own projects" on projects;
create policy "client can read own projects" on projects for select using (
  client_visible = true and exists (select 1 from clients where clients.id = projects.client_id and clients.user_id = auth.uid())
);

-- CLIENT PORTAL — ফেজ ১১: Screen 10 (SOW) রিডিজাইন। বিদ্যমান sows টেবিলের
-- scope/objectives/deliverables/timeline/payment_terms/revision_policy/
-- client_responsibilities/terms কলামগুলো অক্ষত রেখে (Screen 11-এ sign_sow()
-- এখনো ওগুলোই ব্যবহার করে) নিচের নতুন কলাম যোগ করা হলো — এগুলো commercial
-- টার্মের "স্ন্যাপশট" (প্রজেক্টের সাথে live-bound না, তাই সাইন করার পরে project
-- বদলালেও সাইন করা SOW অপরিবর্তিত থাকে) + admin-অনলি metadata।
alter table sows add column if not exists sow_number text;
alter table sows add column if not exists valid_until date;
alter table sows add column if not exists project_value numeric;
alter table sows add column if not exists currency text default 'BDT';
alter table sows add column if not exists payment_structure text;
alter table sows add column if not exists agency_responsibilities text;
alter table sows add column if not exists communication_terms text;
alter table sows add column if not exists viewed_at timestamptz;
alter table sows add column if not exists superseded_by uuid references sows(id) on delete set null;
-- status ভ্যালু বাড়লো: draft | sent | signed | superseded | cancelled
-- (কলামটা আগে থেকেই plain text, নতুন constraint লাগেনি)।

-- আগের RLS পলিসিতে status ফিল্টার ছিল না — মানে client সরাসরি Supabase কল করলে
-- draft SOW-ও পড়তে পারত (শুধু UI-তে লুকানো ছিল, real সিকিউরিটি না)। এখন draft
-- বাদে সবকিছু (sent/signed/superseded/cancelled) client পড়তে পারবে, draft
-- কখনোই RLS লেভেলেই বাইরে যাবে না।
drop policy if exists "client can read own project sows" on sows;
create policy "client can read own project sows" on sows for select using (
  status != 'draft' and exists (select 1 from projects join clients on clients.id = projects.client_id where projects.id = sows.project_id and clients.user_id = auth.uid())
);

-- Sent→Viewed ট্র্যাকিং real করার জন্য — sign_sow()-এর ঠিক একই security-definer
-- প্যাটার্ন (ক্লায়েন্টকে সরাসরি sows UPDATE পলিসি না দিয়ে, শুধু viewed_at-টাই
-- নিজের প্রজেক্টের জন্য সেট করতে দেওয়া হয়)।
create or replace function public.mark_sow_viewed(p_sow_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
  v_client_user_id uuid;
begin
  select sows.project_id into v_project_id from sows where sows.id = p_sow_id;
  if v_project_id is null then
    raise exception 'SOW not found';
  end if;

  select clients.user_id into v_client_user_id
  from projects join clients on clients.id = projects.client_id
  where projects.id = v_project_id;

  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized to view this SOW';
  end if;

  update sows set viewed_at = now() where id = p_sow_id and viewed_at is null;
end;
$$;
grant execute on function public.mark_sow_viewed(uuid) to authenticated;

-- CLIENT PORTAL — ফেজ ১২: Screen 11 (SOW Signature) রিডিজাইন। sows-কে একটা
-- আলাদা "sow_signatures" audit টেবিল না বানিয়ে (একটা SOW ভার্সন একবারই সাইন
-- হয় — 1:1 সম্পর্ক, আলাদা টেবিল শুধু ডুপ্লিকেশন হতো) নিজের কলামেই signature
-- method/image/confirmation রেকর্ড রাখা হলো।
alter table sows add column if not exists signature_method text; -- typed | drawn | uploaded
alter table sows add column if not exists signature_image_url text;
alter table sows add column if not exists confirmation_statements text;

-- sign_sow()-এর পুরনো ৩-প্যারামিটার সিগনেচার নতুনটার সাথে coexist করত (Postgres
-- ওভারলোড আলাদা ফাংশন হিসেবে গণ্য করে), তাই আগেরটা explicit drop করে reuse করা
-- হলো — এখন version-mismatch protection (client যে ভার্সন দেখেছে ঠিক সেটাই
-- সাইন হচ্ছে কিনা) + signature method/image/confirmation সবই এক কলে যায়।
drop function if exists public.sign_sow(uuid, text, text);

create or replace function public.sign_sow(
  p_sow_id uuid,
  p_full_name text,
  p_signature text,
  p_signature_method text default 'typed',
  p_signature_image_url text default null,
  p_confirmation_statements text default null,
  p_expected_version int default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
  v_client_user_id uuid;
  v_current_version int;
begin
  select sows.project_id, sows.version into v_project_id, v_current_version from sows where sows.id = p_sow_id;
  if v_project_id is null then
    raise exception 'SOW not found';
  end if;

  select clients.user_id into v_client_user_id
  from projects join clients on clients.id = projects.client_id
  where projects.id = v_project_id;

  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized to sign this SOW';
  end if;

  if p_expected_version is not null and p_expected_version != v_current_version then
    raise exception 'VERSION_MISMATCH';
  end if;

  update sows
  set status = 'signed',
      signed_at = now(),
      signed_by_name = p_full_name,
      signature_text = p_signature,
      signature_method = p_signature_method,
      signature_image_url = p_signature_image_url,
      confirmation_statements = p_confirmation_statements
  where id = p_sow_id and status = 'sent';

  if not found then
    raise exception 'This SOW is not awaiting signature';
  end if;
end;
$$;
grant execute on function public.sign_sow(uuid, text, text, text, text, text, int) to authenticated;

-- CLIENT PORTAL — ফেজ ১৩: SOW এডিটর সরলীকরণ (নতুন মকআপ অনুযায়ী)। এডমিন এখন
-- SOW-এর নিজস্ব Start Date/Expected Delivery সেট করে (প্রজেক্টের start_date/
-- due_date থেকে আলাদা হতে পারে) — timeline টেক্সটে এমবেড করার বদলে real date
-- কলামে রাখা হলো যাতে ফর্ম রিলোড করলে ঠিকভাবে পার্স হয়।
alter table sows add column if not exists start_date date;
alter table sows add column if not exists delivery_date date;

-- CLIENT PORTAL — ফেজ ১৪: Screen 12 (Payment Request) রিডিজাইন। বিদ্যমান invoices
-- টেবিলই রিইউজ (নতুন কোনো ডুপ্লিকেট ফাইন্যান্সিয়াল টেবিল না) — SOW-এর ঠিক same
-- draft/sent প্যাটার্ন: draft ক্লায়েন্টের কাছে RLS-এই অদৃশ্য, request_number
-- sow_number-এর মতোই অটো-জেনারেটেড, sent_at/viewed_at real ট্র্যাকিং
-- (mark_invoice_viewed RPC, mark_sow_viewed-এর security-definer প্যাটার্ন রিইউজ)।
-- internal_note client-এর কাছে RLS দিয়ে না, বরং ক্লায়েন্ট-সাইড কোয়েরি কখনো এই
-- কলাম select করে না (এই কোডবেসে সবখানে কলাম-লেভেল সুরক্ষা এভাবেই হয়, দেখুন
-- clients.admin_request-এর মতো ক্ষেত্রে যেখানে column-level RLS/view কোথাও নেই)।
alter table invoices add column if not exists request_number text;
alter table invoices add column if not exists sow_id uuid references sows(id) on delete set null;
alter table invoices add column if not exists milestone_id uuid references milestones(id) on delete set null;
alter table invoices add column if not exists percentage numeric;
alter table invoices add column if not exists client_instructions text;
alter table invoices add column if not exists internal_note text;
alter table invoices add column if not exists document_url text;
alter table invoices add column if not exists sent_at timestamptz;
alter table invoices add column if not exists viewed_at timestamptz;
alter table invoices add column if not exists cancelled_at timestamptz;
-- status ভ্যালুতে 'draft' যোগ হলো: draft | pending | processing | paid | failed |
-- cancelled | refunded (কলাম আগে থেকেই plain text, নতুন constraint লাগেনি)।
-- "Sent"/"Viewed"/"Overdue" আলাদা স্ট্যাটাস ভ্যালু না — SOW-এর isExpired প্যাটার্নের
-- মতোই sent_at/viewed_at/due_date থেকে UI-তে derive করা হয়।

drop policy if exists "client can read own invoices" on invoices;
create policy "client can read own invoices" on invoices for select using (
  status != 'draft' and exists (select 1 from clients where clients.id = invoices.client_id and clients.user_id = auth.uid())
);

create or replace function public.mark_invoice_viewed(p_invoice_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_client_user_id uuid;
begin
  select clients.user_id into v_client_user_id
  from invoices join clients on clients.id = invoices.client_id
  where invoices.id = p_invoice_id;

  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized to view this payment request';
  end if;

  update invoices set viewed_at = now() where id = p_invoice_id and viewed_at is null;
end;
$$;
grant execute on function public.mark_invoice_viewed(uuid) to authenticated;

-- CLIENT PORTAL — ফেজ ১৫: Screen 13 (Payment Confirmation)। বিদ্যমান payments
-- টেবিলই "payment transaction" রেকর্ড — নতুন কোনো ডুপ্লিকেট টেবিল লাগেনি। প্রতিটা
-- সাবমিশন একটা নতুন রো (correction/resubmit হলে পুরনো রো অপরিবর্তিত থাকে, audit
-- history রক্ষিত) — payments.status ভেরিফিকেশন সাব-স্টেট ট্র্যাক করে, invoices.status
-- রিকোয়েস্ট-লেভেল lifecycle ট্র্যাক করে (spec-এর "Request vs Transaction" আলাদা
-- রাখার নীতি অনুযায়ী)।
--
-- Partial payment এই আর্কিটেকচারে সাপোর্টেড না (কোথাও partial-paid ট্র্যাকিং কলাম
-- নেই) — তাই ক্লায়েন্ট-সাইডে "Amount Paid" ইচ্ছাকৃতভাবে read-only থাকবে, amount
-- mismatch/partial-paid state ফ্যাব্রিকেট করা হয়নি (spec নিজেই এই ছাড় দিয়েছে)।
alter table payments add column if not exists status text not null default 'submitted';
-- submitted | correction_requested | unable_to_verify | confirmed
alter table payments add column if not exists proof_url text;
alter table payments add column if not exists sender_name text;
alter table payments add column if not exists correction_reason text;
alter table payments add column if not exists correction_requested_at timestamptz;
alter table payments add column if not exists correction_requested_by uuid references profiles(id);

-- ফেজ ১৫-এর আগে confirm করা পুরনো payments রো-গুলো default 'submitted' পেয়ে
-- যেত — সেগুলোকে ঠিক করে 'confirmed'-এ আনা হলো।
update payments set status = 'confirmed' where confirmed_at is not null and status = 'submitted';

-- submit_payment()-এ proof_url/sender_name যোগ + real duplicate-submission guard
-- (আগে শুধু invoices UPDATE-এ status='pending' চেক হতো, payments INSERT
-- unconditionally হয়ে যেত — এখন insert-এর আগেই invoice-এর বর্তমান status চেক হয়)।
drop function if exists public.submit_payment(uuid, numeric, text, text, date, text);

create or replace function public.submit_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text,
  p_transaction_id text,
  p_payment_date date,
  p_notes text,
  p_proof_url text default null,
  p_sender_name text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_project_id uuid;
  v_client_id uuid;
  v_client_user_id uuid;
  v_status text;
  v_payment_id uuid;
begin
  select invoices.project_id, invoices.client_id, invoices.status into v_project_id, v_client_id, v_status from invoices where invoices.id = p_invoice_id;
  if v_client_id is null then
    raise exception 'Invoice not found';
  end if;

  select clients.user_id into v_client_user_id from clients where clients.id = v_client_id;
  if v_client_user_id is null or v_client_user_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  if v_status != 'pending' then
    raise exception 'This payment request is not currently accepting confirmation.';
  end if;

  insert into payments (invoice_id, project_id, client_id, amount, payment_method, transaction_id, payment_date, notes, submitted_by, status, proof_url, sender_name)
  values (p_invoice_id, v_project_id, v_client_id, p_amount, p_method, p_transaction_id, p_payment_date, p_notes, 'client', 'submitted', p_proof_url, p_sender_name)
  returning id into v_payment_id;

  update invoices set status = 'processing' where id = p_invoice_id;

  return v_payment_id;
end;
$$;
grant execute on function public.submit_payment(uuid, numeric, text, text, date, text, text, text) to authenticated;

-- CLIENT PORTAL — ফেজ ১৭: Screen 19 (Files) রিডিজাইন। client_files-এই real
-- uploaded_by_id যোগ হলো (Messages-এ sender_id-এর ঠিক same প্যাটার্ন) — এখন
-- "Shared By" কলামে real আপলোডকারী টিম মেম্বারের নাম/role/avatar দেখানো যাবে,
-- আগের মতো জেনেরিক "Team" না। "Folders" real category কলাম থেকেই আসে (নতুন
-- কোনো folders টেবিল বানানো হয়নি) — শুধু যে category-তে আসলেই ফাইল আছে সেটাই
-- একটা "folder" হিসেবে দেখায়।
alter table client_files add column if not exists uploaded_by_id uuid references profiles(id);

-- ক্লায়েন্ট এখন যেকোনো real uploader-এর প্রোফাইল (নাম/role/avatar) দেখতে পারবে
-- যে তাকে অন্তত একটা ফাইল শেয়ার করেছে (Messages-এর sender-profile পলিসির
-- সাথে সামঞ্জস্যপূর্ণ)।
drop policy if exists "client can read file uploader profiles" on profiles;
create policy "client can read file uploader profiles" on profiles for select using (
  exists (
    select 1 from client_files join clients on clients.id = client_files.client_id
    where client_files.uploaded_by_id = profiles.id and clients.user_id = auth.uid()
  )
);

-- SOW Module rebuild — ফেজ ১৮: Agency (agency-side) সিগনেচার। আগে "Agency"
-- sig-block-এ একটা হার্ডকোডেড "Confirmed" ব্যাজ দেখাত (SOW sent হলেই, কোনো
-- real signature action ছাড়াই) — যেটা client-এর real সিগনেচার ব্লকের পাশে
-- বসে থাকায় বিভ্রান্তিকর ছিল। এখন client-এর মতোই real capture (Type/Draw/
-- Upload) — admin টিম মেম্বার "Sign as Agency" চাপলে এই কলামগুলো real ডেটা
-- দিয়ে ভরে। কোনো নতুন RLS পলিসি লাগেনি — sows-এ team-এর আগে থেকেই পূর্ণ
-- read/write আছে ("team can update sows"), আর client-এর "client can read own
-- project sows" পলিসি পুরো রো (select *) রিটার্ন করে বলে নতুন কলামগুলোও এমনিতেই
-- দেখা যাবে।
alter table sows add column if not exists agency_signed_by uuid references profiles(id);
alter table sows add column if not exists agency_signed_at timestamptz;
alter table sows add column if not exists agency_signer_name text;
alter table sows add column if not exists agency_signature_method text; -- typed | drawn | uploaded
alter table sows add column if not exists agency_signature_image_url text;

-- SOW Module rebuild — ফেজ ১৯: Documents/Attachments (SOW-11)। sows.document_url
-- একটাই ফাইল ধরে রাখতে পারত (MSA)। এখন multi-file real সাপোর্টের জন্য আলাদা
-- sow_documents টেবিল — প্রতিটা SOW ভার্সনে একাধিক real Drive ফাইল অ্যাটাচ করা
-- যাবে (reference material, additional contracts, ইত্যাদি), sows.document_url
-- আগের মতোই MSA-এর জন্য থেকে যায়।
create table if not exists sow_documents (
  id uuid default gen_random_uuid() primary key,
  sow_id uuid not null references sows(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now()
);
create index if not exists idx_sow_documents_sow on sow_documents(sow_id);

alter table sow_documents enable row level security;
drop policy if exists "team can read sow_documents" on sow_documents;
drop policy if exists "team can write sow_documents" on sow_documents;
drop policy if exists "team can delete sow_documents" on sow_documents;
drop policy if exists "client can read own project sow_documents" on sow_documents;
create policy "team can read sow_documents" on sow_documents for select using (public.is_team_member());
create policy "team can write sow_documents" on sow_documents for insert with check (public.is_team_member());
create policy "team can delete sow_documents" on sow_documents for delete using (public.is_team_member());
create policy "client can read own project sow_documents" on sow_documents for select using (
  exists (
    select 1 from sows join projects on projects.id = sows.project_id join clients on clients.id = projects.client_id
    where sows.id = sow_documents.sow_id and sows.status != 'draft' and clients.user_id = auth.uid()
  )
);
