-- Server-only functions for account activation and rate limiting.
-- EXECUTE is granted to service_role only; browsers can never call these.

/* Revokes older open links and stores a new token hash, atomically. */
create function public.issue_activation_token(
  p_employee_id uuid,
  p_token_hash text,
  p_expires_at timestamptz,
  p_requested_ip_hash text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.account_activation_tokens
  set revoked_at = now()
  where employee_id = p_employee_id
    and used_at is null
    and revoked_at is null;

  insert into public.account_activation_tokens (employee_id, token_hash, expires_at, requested_ip_hash)
  values (p_employee_id, p_token_hash, p_expires_at, p_requested_ip_hash);
end;
$$;

/*
 * Single-use claim. Returns the employee only if the token is unused, not
 * revoked, not expired, and the account still awaits activation.
 */
create function public.consume_activation_token(p_token_hash text)
returns table (employee_id uuid, auth_user_id uuid, username text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.account_activation_tokens t
    set used_at = now()
    from public.employees e
    where t.token_hash = p_token_hash
      and t.used_at is null
      and t.revoked_at is null
      and t.expires_at > now()
      and e.id = t.employee_id
      and e.activation_status = 'pending_activation'
    returning t.employee_id
  )
  select e.id, e.auth_user_id, e.username::text
  from claimed c
  join public.employees e on e.id = c.employee_id;
end;
$$;

/* Undo a claim when a later activation step fails (only while still valid). */
create function public.release_activation_token(p_token_hash text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.account_activation_tokens
  set used_at = null
  where token_hash = p_token_hash
    and revoked_at is null
    and expires_at > now();
$$;

/* Final step: new username, active status. Raises unique_violation if taken. */
create function public.complete_activation(p_employee_id uuid, p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.employees
  set username = lower(p_username),
      activation_status = 'active',
      activated_at = now()
  where id = p_employee_id
    and activation_status = 'pending_activation'
    and auth_user_id is not null;

  if not found then
    raise exception 'employee % is not awaiting activation', p_employee_id;
  end if;

  -- An account can only be activated once, so close any other open links.
  update public.account_activation_tokens
  set revoked_at = now()
  where employee_id = p_employee_id
    and used_at is null
    and revoked_at is null;
end;
$$;

/* Sliding-window limiter. Returns true when the attempt is allowed (and records it). */
create function public.check_rate_limit(
  p_action text,
  p_key_hash text,
  p_max integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  delete from public.rate_limit_events
  where action = p_action
    and key_hash = p_key_hash
    and created_at < now() - p_window;

  select count(*) into recent
  from public.rate_limit_events
  where action = p_action
    and key_hash = p_key_hash;

  if recent >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events (action, key_hash) values (p_action, p_key_hash);
  return true;
end;
$$;

revoke all on function
  public.issue_activation_token(uuid, text, timestamptz, text),
  public.consume_activation_token(text),
  public.release_activation_token(text),
  public.complete_activation(uuid, text),
  public.check_rate_limit(text, text, integer, interval)
from public, anon, authenticated;

grant execute on function
  public.issue_activation_token(uuid, text, timestamptz, text),
  public.consume_activation_token(text),
  public.release_activation_token(text),
  public.complete_activation(uuid, text),
  public.check_rate_limit(text, text, integer, interval)
to service_role;
