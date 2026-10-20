-- Session fees, so practitioners can see what they've earned.
-- Admins set each practitioner's fee. Every new booking keeps the fee it was booked at,
-- so changing a fee later doesn't rewrite past income.

alter table public.practitioners
  add column session_fee numeric(10, 2) not null default 0 check (session_fee >= 0);

alter table public.appointments
  add column fee numeric(10, 2) not null default 0 check (fee >= 0);

create function public.appointments_set_fee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select session_fee into new.fee from public.practitioners where id = new.practitioner_id;
  new.fee := coalesce(new.fee, 0);
  return new;
end $$;

create trigger appointments_set_fee before insert on public.appointments
  for each row execute function public.appointments_set_fee();

create function public.set_session_fee(p_practitioner uuid, p_fee numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only admins can set session fees'; end if;
  if p_fee is null or p_fee < 0 or p_fee > 100000 then raise exception 'Enter a fee between 0 and 100,000'; end if;
  update public.practitioners set session_fee = round(p_fee, 2) where id = p_practitioner;
  if not found then raise exception 'Practitioner not found'; end if;
end $$;

revoke execute on function public.set_session_fee(uuid, numeric) from public, anon;
revoke execute on function public.appointments_set_fee() from public, anon, authenticated;
grant execute on function public.set_session_fee(uuid, numeric) to authenticated;
