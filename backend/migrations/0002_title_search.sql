-- DesMind Lands searches every title at the State Ministry of Lands before the land goes on
-- the market. Staff record the search (the Ministry's search reference and what it showed);
-- a listing cannot be published without one, and a change to the title it was made against
-- clears it, so the land goes back for a new search.

alter table listings
  add column title_searched_at timestamptz,
  add column title_search_ref text not null default '',
  add column title_search_note text not null default '',
  add column title_searched_by uuid references users on delete set null;

-- Only staff record a search, through app.record_title_search.
revoke update (title_searched_at, title_search_ref, title_search_note, title_searched_by) on listings from lands_app;

create function app.record_title_search(p_listing uuid, p_ref text, p_note text default '')
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  l listings;
  v_at timestamptz := now();
begin
  if not app.is_admin() then
    raise exception 'Only DesMind staff record a title search.' using errcode = 'LP403';
  end if;
  select * into l from listings where id = p_listing for update;
  if l.id is null then raise exception 'Listing not found.' using errcode = 'LP404'; end if;
  if l.status <> 'in_review' then
    raise exception 'Record the title search while the listing is in review.' using errcode = 'LP409';
  end if;
  if l.seller_id = app.current_user_id() then
    raise exception 'Another admin must search the title of your own listing.' using errcode = 'LP409';
  end if;
  if coalesce(trim(p_ref), '') = '' then
    raise exception 'Give the Ministry of Lands search reference.' using errcode = 'LP422';
  end if;
  update listings
     set title_searched_at = v_at, title_search_ref = trim(p_ref), title_search_note = coalesce(trim(p_note), ''),
         title_searched_by = app.current_user_id()
   where id = l.id;
  return v_at;
end $$;

-- A search is of one title, in one place: change either and it no longer stands.
create function app.clear_title_search() returns trigger
language plpgsql as $$
begin
  if (new.title_kind, new.title_reference, new.state, new.lga, new.town)
     is distinct from (old.title_kind, old.title_reference, old.state, old.lga, old.town) then
    new.title_searched_at := null;
    new.title_search_ref := '';
    new.title_search_note := '';
    new.title_searched_by := null;
  end if;
  return new;
end $$;
create trigger listings_clear_title_search before update on listings
  for each row execute function app.clear_title_search();

-- Publishing now needs a recorded title search. Otherwise as in 0001.
create or replace function app.set_listing_status(p_listing uuid, p_status listing_status, p_note text default '')
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
    if p_status = 'published' and l.title_searched_at is null then
      raise exception 'Search the title at the Ministry of Lands, and record it, before publishing.'
        using errcode = 'LP422';
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

grant execute on function app.record_title_search(uuid, text, text) to lands_app;
