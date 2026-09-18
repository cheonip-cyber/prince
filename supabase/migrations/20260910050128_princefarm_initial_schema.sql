create schema if not exists private;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  monthly_budget_krw integer not null default 30000 check (monthly_budget_krw >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_name text not null default '프린스팜',
  producer_name text,
  seller_name text,
  customer_service text,
  origin_address text,
  shipping_policy jsonb not null default '{}'::jsonb,
  return_policy jsonb not null default '{}'::jsonb,
  brand_tokens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seller_profile_id uuid references public.seller_profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'fruit' check (category in ('fruit', 'vegetable')),
  status text not null default 'draft' check (status in ('draft', 'generating', 'review', 'ready', 'archived')),
  theme_key text not null default 'seasonal' check (theme_key in ('seasonal', 'premium', 'natural')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_owner_updated_idx on public.products (owner_id, updated_at desc);
create index products_organization_idx on public.products (organization_id);

create table public.product_facts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  fact_key text not null check (char_length(fact_key) between 1 and 80),
  value jsonb not null,
  source_type text not null default 'user' check (source_type in ('user', 'ocr', 'image', 'seller_profile', 'general')),
  verification_status text not null default 'verified' check (verification_status in ('verified', 'extracted', 'general', 'inferred', 'blocked')),
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, fact_key)
);

create index product_facts_product_idx on public.product_facts (product_id);

create table public.page_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  page_plan jsonb not null default '{}'::jsonb,
  theme_tokens jsonb not null default '{}'::jsonb,
  channel_profile text not null default 'naver_860_image',
  created_at timestamptz not null default now(),
  unique (product_id, version_number)
);

create index page_versions_product_idx on public.page_versions (product_id, version_number desc);

create table public.page_parts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  page_version_id uuid not null references public.page_versions(id) on delete cascade,
  part_type text not null,
  order_index integer not null check (order_index >= 0),
  layout_key text not null default 'default',
  content jsonb not null default '{}'::jsonb,
  asset_refs jsonb not null default '[]'::jsonb,
  fact_refs jsonb not null default '[]'::jsonb,
  visibility boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_version_id, part_type)
);

create index page_parts_version_order_idx on public.page_parts (page_version_id, order_index);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  storage_key text not null,
  sha256 text,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  role text not null default 'detail',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_id, storage_key)
);

create index assets_product_idx on public.assets (product_id);

create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  operation text not null,
  model text not null,
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'blocked')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  actual_cost_krw numeric(12,3) not null default 0 check (actual_cost_krw >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_generations_owner_created_idx on public.ai_generations (owner_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function private.set_updated_at();
create trigger seller_profiles_set_updated_at before update on public.seller_profiles for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger product_facts_set_updated_at before update on public.product_facts for each row execute function private.set_updated_at();
create trigger page_parts_set_updated_at before update on public.page_parts for each row execute function private.set_updated_at();

alter table public.organizations enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_facts enable row level security;
alter table public.page_versions enable row level security;
alter table public.page_parts enable row level security;
alter table public.assets enable row level security;
alter table public.ai_generations enable row level security;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.seller_profiles to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_facts to authenticated;
grant select, insert, update, delete on public.page_versions to authenticated;
grant select, insert, update, delete on public.page_parts to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.ai_generations to authenticated;

create policy "owners_manage_organizations" on public.organizations for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_seller_profiles" on public.seller_profiles for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_products" on public.products for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_product_facts" on public.product_facts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_page_versions" on public.page_versions for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_page_parts" on public.page_parts for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_assets" on public.assets for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "owners_manage_ai_generations" on public.ai_generations for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('princefarm-assets', 'princefarm-assets', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "users_read_own_princefarm_assets" on storage.objects for select to authenticated
using (bucket_id = 'princefarm-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users_insert_own_princefarm_assets" on storage.objects for insert to authenticated
with check (bucket_id = 'princefarm-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users_update_own_princefarm_assets" on storage.objects for update to authenticated
using (bucket_id = 'princefarm-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'princefarm-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users_delete_own_princefarm_assets" on storage.objects for delete to authenticated
using (bucket_id = 'princefarm-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
