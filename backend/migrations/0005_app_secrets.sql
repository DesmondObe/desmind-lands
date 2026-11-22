-- Secrets the application itself must keep between restarts. The first is OneDrive's refresh
-- token: Microsoft issues a new one at every sign-in and the old one expires, so the newest is
-- kept here, encrypted with ONEDRIVE_TOKEN_KEY (lib/storage.ts). `source_hash` names the
-- configured token it descends from, so setting a new one in the environment replaces it.

create table app_secrets (
  name text primary key,
  value text not null,
  source_hash text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on app_secrets to lands_app;
