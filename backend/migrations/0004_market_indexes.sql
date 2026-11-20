-- The market's search matches a word in the title, the town or the local government area
-- (routes/listings.ts). Only the title had a trigram index, so every search read the whole
-- table; and the default order, newest first, had no index at all.

create index listings_town_trgm_idx on listings using gin (town gin_trgm_ops);
create index listings_lga_trgm_idx on listings using gin (lga gin_trgm_ops);

create index listings_newest_idx on listings ((coalesce(published_at, created_at)) desc, id desc)
  where status in ('published', 'under_offer', 'sold');
