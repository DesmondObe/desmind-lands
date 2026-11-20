-- DesMind Lands: land sold directly between its owner and a buyer, with witnesses, a signed
-- agreement and every payment on record. No agents, no commission.
--
-- As in DesMind Homes, isolation is enforced here, by row-level security, not by the API
-- remembering to filter. The API connects as a member of `lands_app`, which owns nothing and
-- so is always subject to the policies below. It says who is asking by setting `app.user_id`
-- at the start of each transaction (transaction-local, so it is safe behind PgBouncer).
--
-- The few operations that must look across that line (signing in, a witness signing through
-- the link they were sent, a listing's status following its deals) are SECURITY DEFINER
-- functions in the `app` schema. Each checks its own conditions and does one thing.

create extension if not exists citext;
create extension if not exists pg_trgm;

do $$
begin
  if not exists (select from pg_roles where rolname = 'lands_app') then
    create role lands_app nologin;
  end if;
end $$;

create schema app;

-- ---------------------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------------------

create type platform_role as enum ('admin');

create table users (
  id uuid primary key default uuidv7(),
  email citext not null unique,
  password_hash text not null,
  full_name text not null,
  phone text not null default '',
  -- DesMind staff who review listings. Granted by hand (npm run admin:grant).
  platform_role platform_role,
  created_at timestamptz not null default now()
);

create table sessions (
  -- SHA-256 of the cookie value. The cookie itself is never stored.
  id text primary key,
  user_id uuid not null references users on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ip text not null default '',
  user_agent text not null default ''
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expiry_idx on sessions (expires_at);

create table password_resets (
  token_hash text primary key,
  user_id uuid not null references users on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------
-- Land for sale
-- ---------------------------------------------------------------------------------------

create type land_use as enum ('residential', 'commercial', 'agricultural', 'industrial', 'mixed');
create type title_kind as enum (
  'c_of_o',             -- Certificate of Occupancy
  'governors_consent',  -- Governor's Consent
  'deed_of_assignment', -- Registered Deed of Assignment
  'registered_survey',  -- Registered survey plan
  'gazette',            -- Gazetted land
  'excision',           -- Excision
  'customary_right',    -- Customary Right of Occupancy
  'family_receipt',     -- Family / community receipt and agreement
  'other'
);
create type size_unit as enum ('plot', 'sqm', 'acre', 'hectare');
create type listing_status as enum ('draft', 'in_review', 'published', 'under_offer', 'sold', 'withdrawn', 'rejected');

create table listings (
  id uuid primary key default uuidv7(),
  seller_id uuid not null references users on delete cascade,
  title text not null,
  description text not null default '',
  state text not null,
  lga text not null default '',
  town text not null,
  -- Shown to buyers only once they open a deal; the town and area are public.
  address_line text not null default '',
  size_value numeric(12, 2) not null check (size_value > 0),
  size_unit size_unit not null default 'plot',
  -- Money is whole kobo. Never a float.
  price_kobo bigint not null check (price_kobo > 0),
  negotiable boolean not null default true,
  land_use land_use not null default 'residential',
  title_kind title_kind not null,
  -- e.g. the C of O or survey plan number. Shown to buyers with a deal.
  title_reference text not null default '',
  features text[] not null default '{}',
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  status listing_status not null default 'draft',
  review_note text not null default '',
  reviewed_by uuid references users on delete set null,
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    to_tsvector('simple', title || ' ' || town || ' ' || lga || ' ' || state)
  ) stored
);
create index listings_seller_idx on listings (seller_id, created_at desc);
create index listings_search_idx on listings using gin (search);
create index listings_title_trgm_idx on listings using gin (title gin_trgm_ops);
create index listings_public_idx on listings (state, town, id) where status in ('published', 'under_offer', 'sold');
create index listings_review_idx on listings (status, updated_at) where status = 'in_review';

create table saved_listings (
  user_id uuid not null references users on delete cascade,
  listing_id uuid not null references listings on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------------------------------------------------------------------------------------
-- Deals: one buyer and the seller, from first offer to handover
-- ---------------------------------------------------------------------------------------

-- negotiating: offers and counter-offers until one is accepted.
-- checks:      inspection and the buyer's own checks; terms and the seller's bank details.
-- agreement:   the agreement is fixed; seller, buyer and their witnesses sign it.
-- payment:     the buyer pays the seller directly; the seller confirms; then handover.
create type deal_stage as enum ('negotiating', 'checks', 'agreement', 'payment', 'completed', 'cancelled');
create type deal_side as enum ('seller', 'buyer');

create table deals (
  id uuid primary key default uuidv7(),
  listing_id uuid not null references listings on delete cascade,
  seller_id uuid not null references users on delete cascade,
  buyer_id uuid not null references users on delete cascade,
  stage deal_stage not null default 'negotiating',
  agreed_kobo bigint check (agreed_kobo > 0),
  agreed_at timestamptz,
  inspection_at timestamptz,
  inspection_note text not null default '',
  -- The buyer's own checks, by key: { "visited": true, "registry_search": true, ... }.
  checklist jsonb not null default '{}',
  -- What the parties settle in the checks stage, written into the agreement.
  bank_name text not null default '',
  bank_account_number text not null default '',
  bank_account_name text not null default '',
  completion_date date,
  special_terms text not null default '',
  -- Fixed when the agreement is prepared; everyone signs this text, identified by its hash.
  agreement_text text,
  agreement_hash text,
  agreement_ready_at timestamptz,
  signed_at timestamptz,
  paid_at timestamptz,
  seller_handover_at timestamptz,
  buyer_received_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references users on delete set null,
  cancel_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
create index deals_listing_idx on deals (listing_id, stage);
create index deals_seller_idx on deals (seller_id, updated_at desc);
create index deals_buyer_idx on deals (buyer_id, updated_at desc);
-- One live deal per buyer per piece of land.
create unique index deals_one_open_idx on deals (listing_id, buyer_id) where stage not in ('completed', 'cancelled');

create type offer_status as enum ('open', 'accepted', 'declined', 'withdrawn', 'superseded');

create table deal_offers (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  author_id uuid not null references users on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  note text not null default '',
  status offer_status not null default 'open',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index deal_offers_deal_idx on deal_offers (deal_id, created_at);
create unique index deal_offers_one_open_idx on deal_offers (deal_id) where status = 'open';

create table deal_messages (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  author_id uuid not null references users on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index deal_messages_deal_idx on deal_messages (deal_id, created_at);

-- A witness to one side's signature. Usually not a member: they sign through a link that
-- carries a secret token (only its hash is kept).
create table deal_witnesses (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  side deal_side not null,
  invited_by uuid references users on delete set null,
  full_name text not null,
  email citext not null default '',
  phone text not null default '',
  token_hash text not null unique,
  -- What they wrote when signing.
  address text not null default '',
  occupation text not null default '',
  signed_name text,
  signed_hash text,
  signed_at timestamptz,
  ip text not null default '',
  user_agent text not null default '',
  removed_at timestamptz,
  created_at timestamptz not null default now()
);
create index deal_witnesses_deal_idx on deal_witnesses (deal_id, side);

-- The seller's and buyer's own signatures, each over one agreement text (by its hash).
create table deal_signatures (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  party deal_side not null,
  user_id uuid not null references users on delete cascade,
  signed_name text not null,
  agreement_hash text not null,
  ip text not null default '',
  user_agent text not null default '',
  signed_at timestamptz not null default now(),
  unique (deal_id, party)
);

create type file_kind as enum ('photo', 'title_document', 'survey_plan', 'payment_proof', 'identity', 'other');

-- Every uploaded file: listing photos and title papers, and a deal's receipts and papers.
-- The bytes live in object storage under storage_key; browsers upload and download directly.
create table files (
  id uuid primary key default uuidv7(),
  listing_id uuid references listings on delete cascade,
  deal_id uuid references deals on delete cascade,
  kind file_kind not null,
  storage_key text not null unique,
  filename text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  ready boolean not null default false,
  position integer not null default 0,
  uploaded_by uuid references users on delete set null,
  created_at timestamptz not null default now(),
  check ((listing_id is null) <> (deal_id is null))
);
create index files_listing_idx on files (listing_id, kind, position) where listing_id is not null;
create index files_deal_idx on files (deal_id, created_at) where deal_id is not null;

create type payment_status as enum ('submitted', 'confirmed', 'disputed');

-- Money goes straight from buyer to seller; this is the record of it. The buyer declares a
-- payment (with a receipt); the seller confirms it arrived, or says it did not.
create table deal_payments (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  method text not null check (method in ('transfer', 'cash', 'cheque', 'other')),
  reference text not null default '',
  paid_on date not null,
  note text not null default '',
  proof_file_id uuid references files on delete set null,
  declared_by uuid not null references users on delete cascade,
  signed_name text not null,
  status payment_status not null default 'submitted',
  response_note text not null default '',
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index deal_payments_deal_idx on deal_payments (deal_id, created_at);

-- The deal's timeline: everything that happened, who did it, and when.
create table deal_events (
  id uuid primary key default uuidv7(),
  deal_id uuid not null references deals on delete cascade,
  actor_id uuid references users on delete set null,
  actor_label text not null default '',
  kind text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index deal_events_deal_idx on deal_events (deal_id, created_at);

-- Work to do after a transaction commits (emails). Written in the same transaction as the
-- change that causes it, so nothing is sent for a change that rolled back.
create table outbox (
  id bigint generated always as identity primary key,
  kind text not null,
  payload jsonb not null,
  run_after timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index outbox_pending_idx on outbox (run_after) where processed_at is null;

create function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger listings_touch before update on listings for each row execute function app.touch_updated_at();
create trigger deals_touch before update on deals for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------------------
-- Who is asking
-- ---------------------------------------------------------------------------------------

create function app.current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

create function app.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from users where id = app.current_user_id() and platform_role = 'admin')
$$;

create function app.is_deal_party(p_deal uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from deals d
    where d.id = p_deal and app.current_user_id() in (d.seller_id, d.buyer_id)
  )
$$;

-- Two people may see each other's contact details once they share a deal.
create function app.shares_deal_with(p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from deals d
    where (d.seller_id = app.current_user_id() and d.buyer_id = p_user)
       or (d.buyer_id = app.current_user_id() and d.seller_id = p_user)
  )
$$;

-- A seller's public face: name and when they joined. Never their email or phone. A view
-- runs as its owner, so it reads past the users policy, and shows only these columns.
create view public_profiles as select id, full_name, created_at from users;

-- ---------------------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------------------

alter table users enable row level security;
alter table sessions enable row level security;
alter table password_resets enable row level security;
alter table listings enable row level security;
alter table saved_listings enable row level security;
alter table deals enable row level security;
alter table deal_offers enable row level security;
alter table deal_messages enable row level security;
alter table deal_witnesses enable row level security;
alter table deal_signatures enable row level security;
alter table files enable row level security;
alter table deal_payments enable row level security;
alter table deal_events enable row level security;
alter table outbox enable row level security;

create policy users_read on users for select
  using (id = app.current_user_id() or app.is_admin() or app.shares_deal_with(id));
create policy users_edit_self on users for update
  using (id = app.current_user_id()) with check (id = app.current_user_id());

create policy sessions_own on sessions for all
  using (user_id = app.current_user_id()) with check (user_id = app.current_user_id());

-- Land on the market (or under offer, or sold) is public. A draft is its seller's; a buyer
-- with a deal keeps seeing the land whatever happens to the listing.
create policy listings_read on listings for select
  using (
    status in ('published', 'under_offer', 'sold')
    or seller_id = app.current_user_id()
    or app.is_admin()
    or exists (select 1 from deals d where d.listing_id = listings.id and d.buyer_id = app.current_user_id())
  );
create policy listings_create on listings for insert
  with check (seller_id = app.current_user_id() and status = 'draft');
create policy listings_edit on listings for update
  using (seller_id = app.current_user_id()) with check (seller_id = app.current_user_id());
create policy listings_remove on listings for delete
  using (seller_id = app.current_user_id() and status in ('draft', 'rejected', 'withdrawn')
         and not exists (select 1 from deals d where d.listing_id = listings.id));

create policy saved_own on saved_listings for all
  using (user_id = app.current_user_id()) with check (user_id = app.current_user_id());

create policy deals_read on deals for select
  using (app.current_user_id() in (seller_id, buyer_id) or app.is_admin());
-- A buyer opens a deal on land that is for sale, with its own seller, never their own land.
create policy deals_open on deals for insert
  with check (
    buyer_id = app.current_user_id()
    and stage = 'negotiating'
    and exists (
      select 1 from listings l
      where l.id = listing_id and l.seller_id = deals.seller_id and l.status = 'published'
    )
  );
create policy deals_edit on deals for update
  using (app.current_user_id() in (seller_id, buyer_id))
  with check (app.current_user_id() in (seller_id, buyer_id));

create policy offers_read on deal_offers for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy offers_make on deal_offers for insert
  with check (author_id = app.current_user_id() and app.is_deal_party(deal_id));
create policy offers_answer on deal_offers for update
  using (app.is_deal_party(deal_id)) with check (app.is_deal_party(deal_id));

create policy messages_read on deal_messages for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy messages_write on deal_messages for insert
  with check (author_id = app.current_user_id() and app.is_deal_party(deal_id));

-- Each side names its own witnesses.
create policy witnesses_read on deal_witnesses for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy witnesses_add on deal_witnesses for insert
  with check (
    invited_by = app.current_user_id()
    and exists (
      select 1 from deals d where d.id = deal_id
        and ((side = 'seller' and d.seller_id = app.current_user_id())
          or (side = 'buyer' and d.buyer_id = app.current_user_id()))
    )
  );
create policy witnesses_edit on deal_witnesses for update
  using (app.is_deal_party(deal_id)) with check (app.is_deal_party(deal_id));

create policy signatures_read on deal_signatures for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy signatures_sign on deal_signatures for insert
  with check (
    user_id = app.current_user_id()
    and exists (
      select 1 from deals d where d.id = deal_id and d.stage = 'agreement'
        and d.agreement_hash = deal_signatures.agreement_hash
        and ((party = 'seller' and d.seller_id = app.current_user_id())
          or (party = 'buyer' and d.buyer_id = app.current_user_id()))
    )
  );
-- Revising the agreement clears every signature over the old text.
create policy signatures_clear on deal_signatures for delete using (app.is_deal_party(deal_id));

-- Photos of land anyone can see are public. Title papers are for the seller, staff, and a
-- buyer who has opened a deal on the land. A deal's files are for its two parties.
create policy files_read on files for select
  using (
    uploaded_by = app.current_user_id()
    or app.is_admin()
    or (deal_id is not null and app.is_deal_party(deal_id))
    or (listing_id is not null and kind = 'photo'
        and exists (select 1 from listings l where l.id = files.listing_id))
    or (listing_id is not null
        and exists (select 1 from listings l where l.id = files.listing_id and l.seller_id = app.current_user_id()))
    or (listing_id is not null
        and exists (select 1 from deals d where d.listing_id = files.listing_id
                    and d.buyer_id = app.current_user_id() and d.stage <> 'cancelled'))
  );
create policy files_add on files for insert
  with check (
    uploaded_by = app.current_user_id()
    and (
      (listing_id is not null
        and exists (select 1 from listings l where l.id = listing_id and l.seller_id = app.current_user_id()))
      or (deal_id is not null and app.is_deal_party(deal_id))
    )
  );
create policy files_edit on files for update
  using (uploaded_by = app.current_user_id()) with check (uploaded_by = app.current_user_id());
create policy files_remove on files for delete using (uploaded_by = app.current_user_id());

create policy payments_read on deal_payments for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy payments_declare on deal_payments for insert
  with check (
    declared_by = app.current_user_id()
    and exists (select 1 from deals d where d.id = deal_id and d.buyer_id = app.current_user_id() and d.stage = 'payment')
  );
-- Only the seller answers a payment: they are the one who knows whether it arrived.
create policy payments_answer on deal_payments for update
  using (exists (select 1 from deals d where d.id = deal_id and d.seller_id = app.current_user_id()))
  with check (exists (select 1 from deals d where d.id = deal_id and d.seller_id = app.current_user_id()));

create policy events_read on deal_events for select using (app.is_deal_party(deal_id) or app.is_admin());
create policy events_write on deal_events for insert
  with check (actor_id = app.current_user_id() and app.is_deal_party(deal_id));

create policy outbox_enqueue on outbox for insert with check (true);

-- ---------------------------------------------------------------------------------------
-- Operations that cross the lines above
-- ---------------------------------------------------------------------------------------

create function app.register_user(p_email citext, p_hash text, p_name text, p_phone text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if exists (select 1 from users where email = p_email) then
    raise exception 'An account with this email already exists. Sign in instead.' using errcode = 'LP409';
  end if;
  insert into users (email, password_hash, full_name, phone)
  values (p_email, p_hash, p_name, p_phone) returning id into v_id;
  return v_id;
end $$;

create function app.login_lookup(p_email citext) returns table (id uuid, password_hash text)
language sql stable security definer set search_path = public, pg_temp as $$
  select id, password_hash from users where email = p_email
$$;

create function app.session_user(p_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
begin
  update sessions set last_seen_at = now()
  where id = p_hash and expires_at > now()
  returning user_id into v_user;
  return v_user;
end $$;

create function app.request_password_reset(p_email citext, p_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
begin
  select id into v_user from users where email = p_email;
  if v_user is null then return null; end if;
  insert into password_resets (token_hash, user_id, expires_at) values (p_hash, v_user, now() + interval '1 hour');
  return v_user;
end $$;

create function app.password_reset_valid(p_hash text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from password_resets where token_hash = p_hash and used_at is null and expires_at > now())
$$;

create function app.reset_password(p_hash text, p_password_hash text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
begin
  update password_resets set used_at = now()
  where token_hash = p_hash and used_at is null and expires_at > now()
  returning user_id into v_user;
  if v_user is null then
    raise exception 'This reset link has expired or was already used. Ask for a new one.' using errcode = 'LP410';
  end if;
  update users set password_hash = p_password_hash where id = v_user;
  delete from sessions where user_id = v_user;
  return v_user;
end $$;

-- A listing's status, moved by its seller or by DesMind staff. Statuses that follow a deal
-- (under offer, sold) are not set here: app.sync_listing derives them from the deals.
create function app.set_listing_status(p_listing uuid, p_status listing_status, p_note text default '')
returns listing_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l listings;
  v_admin boolean := app.is_admin();
  v_seller boolean;
begin
  select * into l from listings where id = p_listing for update;
  if l.id is null then raise exception 'Listing not found.' using errcode = 'LP404'; end if;
  v_seller := l.seller_id = app.current_user_id();
  if not v_seller and not v_admin then
    raise exception 'Only the seller can change this listing.' using errcode = 'LP403';
  end if;

  if p_status = 'in_review' and v_seller and l.status in ('draft', 'rejected', 'withdrawn') then
    if not exists (select 1 from files where listing_id = l.id and kind = 'photo' and ready) then
      raise exception 'Add at least one photo of the land before sending it for review.' using errcode = 'LP422';
    end if;
    update listings set status = 'in_review', review_note = '' where id = l.id;
  elsif p_status = 'draft' and v_seller and l.status = 'in_review' then
    update listings set status = 'draft' where id = l.id;
  elsif p_status = 'withdrawn' and (v_seller or v_admin) and l.status in ('published', 'in_review', 'draft') then
    update listings set status = 'withdrawn', review_note = coalesce(nullif(p_note, ''), review_note) where id = l.id;
  elsif p_status in ('published', 'rejected') and v_admin and l.status = 'in_review' then
    if l.seller_id = app.current_user_id() then
      raise exception 'Another admin must review your own listing.' using errcode = 'LP409';
    end if;
    update listings
       set status = p_status, review_note = p_note, reviewed_by = app.current_user_id(),
           published_at = case when p_status = 'published' then now() else published_at end
     where id = l.id;
  else
    raise exception 'A listing that is % cannot become %.', replace(l.status::text, '_', ' '), replace(p_status::text, '_', ' ')
      using errcode = 'LP409';
  end if;
  return p_status;
end $$;

-- Under offer while a deal is past negotiation, sold once one completes, back on the market
-- when such a deal is cancelled. Derived from the deals, so it is safe for any party to call.
create function app.sync_listing(p_listing uuid) returns listing_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status listing_status;
  v_next listing_status;
begin
  select status into v_status from listings where id = p_listing for update;
  if exists (select 1 from deals where listing_id = p_listing and stage = 'completed') then
    v_next := 'sold';
  elsif exists (select 1 from deals where listing_id = p_listing and stage in ('checks', 'agreement', 'payment')) then
    v_next := case when v_status in ('published', 'under_offer') then 'under_offer' else v_status end;
  elsif v_status = 'under_offer' then
    v_next := 'published';
  else
    v_next := v_status;
  end if;
  if v_next is distinct from v_status then
    update listings set status = v_next, sold_at = case when v_next = 'sold' then now() else sold_at end
    where id = p_listing;
  end if;
  -- Sold: every other conversation about this land ends.
  if v_next = 'sold' then
    update deals set stage = 'cancelled', cancelled_at = now(), cancel_reason = 'The land was sold to another buyer.'
    where listing_id = p_listing and stage not in ('completed', 'cancelled');
  end if;
  return v_next;
end $$;

-- When the seller, the buyer and at least one witness for each have signed the same text,
-- the agreement is complete and the deal moves to payment.
create function app.advance_if_signed(p_deal uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d deals;
begin
  select * into d from deals where id = p_deal for update;
  if d.stage <> 'agreement' then return false; end if;
  if (select count(*) from deal_signatures where deal_id = d.id and agreement_hash = d.agreement_hash) = 2
     and exists (select 1 from deal_witnesses where deal_id = d.id and side = 'seller' and removed_at is null
                 and signed_hash = d.agreement_hash)
     and exists (select 1 from deal_witnesses where deal_id = d.id and side = 'buyer' and removed_at is null
                 and signed_hash = d.agreement_hash)
  then
    update deals set stage = 'payment', signed_at = now() where id = d.id;
    insert into deal_events (deal_id, kind, summary, actor_label)
    values (d.id, 'agreement.signed', 'Everyone has signed. The agreement is complete; the buyer can now pay the seller directly.', 'DesMind Lands');
    insert into outbox (kind, payload) values ('deal.stage', jsonb_build_object('dealId', d.id, 'stage', 'payment'));
    return true;
  end if;
  return false;
end $$;

-- What a witness sees through their link: the deal in brief and the agreement text.
create function app.witness_view(p_hash text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'witness', jsonb_build_object('id', w.id, 'side', w.side, 'fullName', w.full_name, 'signedAt', w.signed_at,
                                  'signedName', w.signed_name, 'current', w.signed_hash = d.agreement_hash),
    'deal', jsonb_build_object('id', d.id, 'stage', d.stage, 'agreedKobo', d.agreed_kobo,
                               'agreementText', d.agreement_text, 'agreementHash', d.agreement_hash),
    'listing', jsonb_build_object('title', l.title, 'town', l.town, 'state', l.state),
    'seller', s.full_name,
    'buyer', b.full_name
  )
  from deal_witnesses w
  join deals d on d.id = w.deal_id
  join listings l on l.id = d.listing_id
  join users s on s.id = d.seller_id
  join users b on b.id = d.buyer_id
  where w.token_hash = p_hash and w.removed_at is null
$$;

create function app.witness_sign(
  p_hash text, p_name text, p_address text, p_occupation text, p_agreement_hash text, p_ip text, p_ua text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  w deal_witnesses;
  d deals;
begin
  select * into w from deal_witnesses where token_hash = p_hash and removed_at is null for update;
  if w.id is null then
    raise exception 'This witness link is no longer valid. Ask the person who sent it for a new one.' using errcode = 'LP404';
  end if;
  select * into d from deals where id = w.deal_id;
  if d.stage <> 'agreement' then
    raise exception 'This agreement is not open for signing right now.' using errcode = 'LP409';
  end if;
  if d.agreement_hash is distinct from p_agreement_hash then
    raise exception 'The agreement has changed since you opened it. Reload the page and read it again.' using errcode = 'LP409';
  end if;
  if w.signed_hash = d.agreement_hash then
    raise exception 'You have already signed as a witness to this agreement.' using errcode = 'LP409';
  end if;
  if lower(regexp_replace(trim(p_name), '\s+', ' ', 'g')) <> lower(regexp_replace(trim(w.full_name), '\s+', ' ', 'g')) then
    raise exception 'Type your full name exactly as it is shown: %.', w.full_name using errcode = 'LP422';
  end if;
  update deal_witnesses
     set signed_name = trim(p_name), signed_hash = d.agreement_hash, signed_at = now(),
         address = p_address, occupation = p_occupation, ip = p_ip, user_agent = left(p_ua, 300)
   where id = w.id;
  insert into deal_events (deal_id, kind, summary, actor_label)
  values (d.id, 'witness.signed', w.full_name || ' signed as the ' || w.side || '''s witness.', w.full_name);
  insert into outbox (kind, payload) values ('witness.signed', jsonb_build_object('witnessId', w.id));
  perform app.advance_if_signed(d.id);
  return d.id;
end $$;

-- ---------------------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------------------

grant usage on schema public, app to lands_app;
grant select, insert, update, delete on all tables in schema public to lands_app;
grant usage on all sequences in schema public to lands_app;
grant execute on all functions in schema app to lands_app;

-- A listing's status only moves through app.set_listing_status and app.sync_listing, and
-- who reviewed it is not the seller's to write.
revoke update on listings from lands_app;
grant update (title, description, state, lga, town, address_line, size_value, size_unit, price_kobo, negotiable,
              land_use, title_kind, title_reference, features, latitude, longitude)
  on listings to lands_app;
-- Nobody makes themselves staff.
revoke update on users from lands_app;
grant update (full_name, phone, password_hash) on users to lands_app;
-- The outbox is written, never read, by the API.
revoke select, update, delete on outbox from lands_app;
