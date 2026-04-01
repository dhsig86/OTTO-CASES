-- OTTO CASES Supabase Schema Initialization

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create cases table
create table public.cases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  patient_age text,
  patient_gender text,
  complaint text,
  history text,
  physical_exam text,
  diagnostics text,
  intervention text,
  outcome text,
  keywords text,
  author_name text,
  institution text,
  status text default 'draft', -- draft, generated
  -- AI Outputs
  ai_title text,
  ai_advisor_feedback text,
  ai_submission_summary text,
  ai_draft_article text,
  ai_poster_content text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.cases enable row level security;

create policy "Users can insert their own cases."
  on public.cases for insert
  with check ( auth.uid() = user_id );

create policy "Users can view their own cases."
  on public.cases for select
  using ( auth.uid() = user_id );

create policy "Users can update their own cases."
  on public.cases for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own cases."
  on public.cases for delete
  using ( auth.uid() = user_id );

-- Create storage bucket for clinical images (limit 4MB per image enforced in app)
insert into storage.buckets (id, name, public) 
values ('clinical-images', 'clinical-images', true);

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'clinical-images' );

create policy "Users can upload their own images"
  on storage.objects for insert
  with check ( bucket_id = 'clinical-images' and auth.uid() = owner );
