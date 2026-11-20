-- Resetting a password ends every other reset link for that account, not only the one used.
-- Before, a second link asked for in the same hour (sitting, say, in a mailbox someone else
-- can read) still worked after the owner had set a new password.

create or replace function app.reset_password(p_hash text, p_password_hash text) returns uuid
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
  update password_resets set used_at = now() where user_id = v_user and used_at is null;
  update users set password_hash = p_password_hash where id = v_user;
  delete from sessions where user_id = v_user;
  return v_user;
end $$;
