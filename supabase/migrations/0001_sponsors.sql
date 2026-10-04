create extension if not exists pg_trgm;

create table crawl_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  is_bootstrap boolean not null default false,
  rows_read integer,
  sponsors_inserted integer,
  sponsors_unlisted integer,
  sponsors_renamed integer,
  renames_ambiguous integer,
  error_count integer not null default 0,
  error_message text
);

create index crawl_runs_kind_started_at on crawl_runs (kind, started_at desc);

create table sponsors (
  id bigint generated always as identity primary key,
  identity_key text not null unique,
  name text not null,
  norm_name text not null,
  slug text not null unique,
  town text not null,
  town_norm text not null,
  county text not null default '',
  first_seen date not null,
  last_seen date not null,
  unlisted_at date
);

create index sponsors_town_norm on sponsors (town_norm);
create index sponsors_unlisted_at on sponsors (unlisted_at);
create index sponsors_norm_name_trgm on sponsors using gin (norm_name gin_trgm_ops);

create table sponsor_names (
  sponsor_id bigint not null references sponsors (id) on delete cascade,
  name text not null,
  first_seen date not null,
  last_seen date not null,
  primary key (sponsor_id, name)
);

create table sponsor_routes (
  sponsor_id bigint not null references sponsors (id) on delete cascade,
  route text not null,
  rating text not null,
  primary key (sponsor_id, route, rating)
);
