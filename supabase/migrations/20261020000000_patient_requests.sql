-- Patients stay with one practitioner, and ask instead of acting directly.
--
--   * Once a patient has a main practitioner, they can only book with that practitioner.
--   * A patient asks to change practitioner; an admin approves and picks who takes over.
--   * A patient asks to postpone a session to another free time; their practitioner accepts or
--     declines. Cancelling a session is still immediate (cancel_appointment).
--   * New practitioners start with evening hours, since the clinic opens after 4 pm.

-- ---------------------------------------------------------------------------
-- Requests to change practitioner

create table public.practitioner_change_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_name text not null,
  from_practitioner_id uuid references public.practitioners (id) on delete set null,
  from_practitioner_name text,
  -- Empty when the patient leaves the choice to the clinic.
  to_practitioner_id uuid references public.practitioners (id) on delete set null,
  to_practitioner_name text,
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);
-- One open request per patient.
create unique index practitioner_change_one_pending
  on public.practitioner_change_requests (patient_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Requests to postpone a session

create table public.reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_name text not null,
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  practitioner_name text not null,
  old_start_at timestamptz not null,
  new_start_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index reschedule_one_pending
  on public.reschedule_requests (appointment_id) where status = 'pending';

alter table public.practitioner_change_requests enable row level security;
alter table public.reschedule_requests enable row level security;

-- Both tables are written only through the functions below.
grant select on public.practitioner_change_requests to authenticated;
create policy "patient, the practitioners involved, or admin" on public.practitioner_change_requests
  for select to authenticated
  using (patient_id = auth.uid() or from_practitioner_id = auth.uid() or to_practitioner_id = auth.uid()
         or public.is_admin());

grant select on public.reschedule_requests to authenticated;
create policy "patient, practitioner, or admin" on public.reschedule_requests for select to authenticated
  using (patient_id = auth.uid() or practitioner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Booking: only with the patient's own practitioner once they have one

create or replace function public.book_appointment(p_practitioner uuid, p_date date, p_time text, p_mode text default 'video')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_patient public.patients;
  v_pract public.practitioners;
  v_start timestamptz;
  v_id uuid;
begin
  if public.my_role() is distinct from 'patient' then raise exception 'Only patients can book sessions'; end if;
  if p_time !~ '^\d{2}:\d{2}$' then raise exception 'Invalid time'; end if;
  if p_mode not in ('video', 'audio', 'chat') then raise exception 'Invalid session type'; end if;

  select * into v_patient from public.patients where id = auth.uid();
  select * into v_pract from public.practitioners where id = p_practitioner and active;
  if v_patient.id is null then raise exception 'Finish creating your account first'; end if;
  if v_pract.id is null then raise exception 'This specialist is not taking bookings'; end if;
  if v_patient.primary_practitioner_id is not null and v_patient.primary_practitioner_id <> v_pract.id then
    raise exception 'You can book only with your own practitioner. To see someone else, request a change of practitioner.';
  end if;
  if not public.is_offered_slot(v_pract, p_date, p_time) then raise exception 'That time is not available'; end if;

  v_start := (p_date + p_time::time) at time zone v_pract.time_zone;
  if v_start <= now() then raise exception 'That time has passed'; end if;

  begin
    insert into public.appointments (patient_id, patient_name, practitioner_id, practitioner_name, start_at, end_at, mode)
    values (v_patient.id, v_patient.display_name, v_pract.id, v_pract.display_name, v_start,
            v_start + make_interval(mins => v_pract.session_minutes), p_mode)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'That time was just taken. Please pick another.';
  end;

  -- The first booking makes this the patient's practitioner.
  insert into public.care_team (patient_id, practitioner_id) values (v_patient.id, v_pract.id) on conflict do nothing;
  update public.patients set primary_practitioner_id = v_pract.id
    where id = v_patient.id and primary_practitioner_id is null;
  insert into public.conversations (patient_id, practitioner_id) values (v_patient.id, v_pract.id) on conflict do nothing;
  return v_id;
end $$;

-- Cancelling a session also closes any open request to postpone it.
create or replace function public.cancel_appointment(p_appointment uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
begin
  select * into a from public.appointments where id = p_appointment;
  if a.id is null then raise exception 'Session not found'; end if;
  if not (a.patient_id = auth.uid() or a.practitioner_id = auth.uid() or public.is_admin()) then
    raise exception 'Not your session';
  end if;
  if a.status <> 'scheduled' then raise exception 'This session can''t be cancelled'; end if;
  if a.patient_id = auth.uid() and a.start_at <= now() then raise exception 'This session has already started'; end if;
  update public.appointments set status = 'cancelled', cancel_reason = left(p_reason, 500) where id = p_appointment;
  update public.reschedule_requests set status = 'cancelled', responded_at = now()
    where appointment_id = p_appointment and status = 'pending';
end $$;

-- ---------------------------------------------------------------------------
-- Changing practitioner

-- Patient asks. p_to may be null to let the clinic choose.
create function public.request_practitioner_change(p_to uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_patient public.patients;
  v_id uuid;
begin
  if public.my_role() is distinct from 'patient' then raise exception 'Only patients can ask for this'; end if;
  select * into v_patient from public.patients where id = auth.uid();
  if v_patient.primary_practitioner_id is null then
    raise exception 'You don''t have a practitioner yet. Book with anyone you like.';
  end if;
  if p_to = v_patient.primary_practitioner_id then raise exception 'That is already your practitioner'; end if;
  if p_to is not null and not exists (select 1 from public.practitioners where id = p_to and active) then
    raise exception 'That practitioner is not taking patients';
  end if;
  begin
    insert into public.practitioner_change_requests
      (patient_id, patient_name, from_practitioner_id, from_practitioner_name, to_practitioner_id, to_practitioner_name, reason)
    values (v_patient.id, v_patient.display_name, v_patient.primary_practitioner_id,
            (select display_name from public.practitioners where id = v_patient.primary_practitioner_id),
            p_to, (select display_name from public.practitioners where id = p_to), left(trim(p_reason), 2000))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a request waiting. We''ll get back to you soon.';
  end;
  return v_id;
end $$;

-- Admin approves (choosing the new practitioner if the patient left it open) or declines.
-- Approving moves the patient's file and cancels their upcoming sessions with the old practitioner.
create function public.review_practitioner_change(p_request uuid, p_approve boolean, p_to uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.practitioner_change_requests;
  v_to uuid;
  v_cancelled int := 0;
begin
  if not public.is_admin() then raise exception 'Only admins can review these requests'; end if;
  select * into r from public.practitioner_change_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled'; end if;

  if not p_approve then
    update public.practitioner_change_requests set status = 'declined', reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_request;
    return 0;
  end if;

  v_to := coalesce(p_to, r.to_practitioner_id);
  if v_to is null then raise exception 'Choose the new practitioner'; end if;
  if not exists (select 1 from public.practitioners where id = v_to and active) then
    raise exception 'That practitioner is not taking patients';
  end if;
  if v_to = r.from_practitioner_id then raise exception 'That is already their practitioner'; end if;

  update public.practitioner_change_requests
    set status = 'approved', to_practitioner_id = v_to,
        to_practitioner_name = (select display_name from public.practitioners where id = v_to),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request;

  insert into public.care_team (patient_id, practitioner_id) values (r.patient_id, v_to) on conflict do nothing;
  delete from public.care_team where patient_id = r.patient_id and practitioner_id = r.from_practitioner_id;
  update public.patients set primary_practitioner_id = v_to where id = r.patient_id;
  insert into public.conversations (patient_id, practitioner_id) values (r.patient_id, v_to) on conflict do nothing;

  update public.appointments set status = 'cancelled', cancel_reason = 'Moved to a new practitioner'
    where patient_id = r.patient_id and practitioner_id = r.from_practitioner_id
      and status = 'scheduled' and start_at > now();
  get diagnostics v_cancelled = row_count;
  update public.reschedule_requests set status = 'cancelled', responded_at = now()
    where patient_id = r.patient_id and practitioner_id = r.from_practitioner_id and status = 'pending';
  return v_cancelled;
end $$;

-- ---------------------------------------------------------------------------
-- Postponing a session

-- Patient asks to move a session to another free time with the same practitioner.
create function public.request_reschedule(p_appointment uuid, p_date date, p_time text, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  a public.appointments;
  v_pract public.practitioners;
  v_start timestamptz;
  v_id uuid;
begin
  select * into a from public.appointments where id = p_appointment;
  if a.id is null or a.patient_id <> auth.uid() then raise exception 'Session not found'; end if;
  if a.status <> 'scheduled' or a.start_at <= now() then raise exception 'Only upcoming sessions can be postponed'; end if;
  if p_time !~ '^\d{2}:\d{2}$' then raise exception 'Invalid time'; end if;

  select * into v_pract from public.practitioners where id = a.practitioner_id;
  if not public.is_offered_slot(v_pract, p_date, p_time) then raise exception 'That time is not available'; end if;
  v_start := (p_date + p_time::time) at time zone v_pract.time_zone;
  if v_start <= now() then raise exception 'That time has passed'; end if;
  if v_start = a.start_at then raise exception 'Pick a different time'; end if;
  if exists (select 1 from public.appointments
             where practitioner_id = a.practitioner_id and status = 'scheduled' and start_at = v_start) then
    raise exception 'That time was just taken. Please pick another.';
  end if;

  begin
    insert into public.reschedule_requests
      (appointment_id, patient_id, patient_name, practitioner_id, practitioner_name, old_start_at, new_start_at, reason)
    values (a.id, a.patient_id, a.patient_name, a.practitioner_id, a.practitioner_name, a.start_at, v_start,
            nullif(left(trim(p_reason), 2000), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already asked to postpone this session. Your practitioner will reply soon.';
  end;
  return v_id;
end $$;

-- The session's practitioner (or an admin) accepts, which moves the session, or declines.
create function public.respond_to_reschedule(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.reschedule_requests;
  v_minutes int;
begin
  select * into r from public.reschedule_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if not (r.practitioner_id = auth.uid() or public.is_admin()) then raise exception 'This request isn''t for you'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled'; end if;

  if p_accept then
    if r.new_start_at <= now() then raise exception 'The requested time has passed'; end if;
    select session_minutes into v_minutes from public.practitioners where id = r.practitioner_id;
    begin
      update public.appointments
        set start_at = r.new_start_at, end_at = r.new_start_at + make_interval(mins => v_minutes)
        where id = r.appointment_id and status = 'scheduled';
    exception when unique_violation then
      raise exception 'That time has been booked since. Decline and ask the patient for another time.';
    end;
    if not found then raise exception 'This session is no longer scheduled'; end if;
  end if;

  update public.reschedule_requests
    set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_request;
end $$;

-- A patient withdraws their own open request (either kind).
create function public.withdraw_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.practitioner_change_requests set status = 'cancelled'
    where id = p_request and patient_id = auth.uid() and status = 'pending';
  if found then return; end if;
  update public.reschedule_requests set status = 'cancelled', responded_at = now()
    where id = p_request and patient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Evening hours for new practitioners (the clinic opens after 4 pm)

create or replace function public.promote_to_practitioner(
  p_email text, p_display_name text, p_title text, p_discipline text, p_make_admin boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  -- No signed-in user means the SQL editor or another trusted connection (that's how the
  -- first admin is set up). Apps always call this as a signed-in user.
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can add practitioners';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'No account with that email yet. Invite them first from Supabase (Authentication > Users > Invite).';
  end if;
  update public.profiles
    set role = case when p_make_admin then 'admin' else 'practitioner' end, display_name = p_display_name
    where id = v_id;
  insert into public.practitioners (id, display_name, discipline, title, weekly_hours)
  values (v_id, p_display_name, p_discipline, p_title,
          -- Sunday to Thursday, 16:00 to 22:00. Practitioners adjust this in the dashboard.
          '{"0":[{"start":"16:00","end":"22:00"}],"1":[{"start":"16:00","end":"22:00"}],"2":[{"start":"16:00","end":"22:00"}],"3":[{"start":"16:00","end":"22:00"}],"4":[{"start":"16:00","end":"22:00"}]}')
  on conflict (id) do update set display_name = excluded.display_name, discipline = excluded.discipline,
    title = excluded.title, active = true;
  -- Staff don't need a patient file unless they already have sessions as a patient.
  delete from public.patients p where p.id = v_id
    and not exists (select 1 from public.appointments where patient_id = v_id);
  return v_id;
end $$;

-- Practitioners still on the old 9-to-5 default move to the evening hours.
update public.practitioners
  set weekly_hours = '{"0":[{"start":"16:00","end":"22:00"}],"1":[{"start":"16:00","end":"22:00"}],"2":[{"start":"16:00","end":"22:00"}],"3":[{"start":"16:00","end":"22:00"}],"4":[{"start":"16:00","end":"22:00"}]}'
  where weekly_hours = '{"0":[{"start":"09:00","end":"17:00"}],"1":[{"start":"09:00","end":"17:00"}],"2":[{"start":"09:00","end":"17:00"}],"3":[{"start":"09:00","end":"17:00"}],"4":[{"start":"09:00","end":"17:00"}]}';

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.request_practitioner_change(uuid, text), public.review_practitioner_change(uuid, boolean, uuid),
  public.request_reschedule(uuid, date, text, text), public.respond_to_reschedule(uuid, boolean),
  public.withdraw_request(uuid)
to authenticated;

alter publication supabase_realtime add table public.practitioner_change_requests, public.reschedule_requests;
