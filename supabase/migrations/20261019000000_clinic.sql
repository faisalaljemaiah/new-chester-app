-- New Chester Clinic schema.
--
-- Access model:
--   * Every table has row level security on. Policies decide which rows a user sees.
--   * Column grants decide which fields a user may change, so e.g. a patient can edit their
--     phone number but never their care team.
--   * Anything that must be checked across tables (booking, transfers, schedule approval,
--     scoring) is a security definer function that the apps call with supabase.rpc().

-- ---------------------------------------------------------------------------
-- Profiles and roles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'patient' check (role in ('patient', 'practitioner', 'admin')),
  display_name text not null default '',
  email text not null default '',
  locale text not null default 'en' check (locale in ('en', 'ar')),
  photo_url text,
  created_at timestamptz not null default now()
);

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

-- Admins are practitioners too (the clinic owner may also see patients).
create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('practitioner', 'admin'), false)
$$;

-- ---------------------------------------------------------------------------
-- Practitioners

create table public.practitioners (
  id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  display_name_ar text,
  discipline text not null check (discipline in ('psychiatry', 'psychology')),
  title text not null,
  title_ar text,
  bio text,
  bio_ar text,
  photo_url text,
  languages text[] not null default '{en,ar}',
  session_minutes int not null default 50 check (session_minutes between 15 and 180),
  time_zone text not null default 'Asia/Riyadh',
  -- {"0": [{"start": "09:00", "end": "17:00"}], ...} keyed by weekday, 0 = Sunday
  weekly_hours jsonb not null default '{}',
  -- [{"from": "2026-11-01", "to": "2026-11-07"}], set only by approved requests
  blocked_ranges jsonb not null default '[]',
  -- [{"date": "2026-11-10", "start": "18:00", "end": "21:00"}], set only by approved requests
  extra_days jsonb not null default '[]',
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Patients and their care team

create table public.patients (
  id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  email text not null default '',
  phone text,
  date_of_birth date,
  primary_practitioner_id uuid references public.practitioners (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'on_hold', 'discharged')),
  completed_sessions int not null default 0,
  last_session_at timestamptz,
  created_at timestamptz not null default now()
);

-- Practitioners allowed to open a patient's file. Every patient-data policy checks this.
create table public.care_team (
  patient_id uuid not null references public.patients (id) on delete cascade,
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (patient_id, practitioner_id)
);
create index care_team_practitioner on public.care_team (practitioner_id);

create function public.on_care_team(p_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.care_team where patient_id = p_patient and practitioner_id = auth.uid()
  )
$$;

-- Clinical notes. Never visible to the patient.
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 20000),
  appointment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index notes_patient on public.notes (patient_id, created_at desc);

-- Practitioner to-do items about a patient.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id),
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);
create index tasks_patient on public.tasks (patient_id);

-- ---------------------------------------------------------------------------
-- Appointments

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_name text not null,
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  practitioner_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode text not null default 'video' check (mode in ('video', 'audio', 'chat')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  meeting_url text check (meeting_url is null or meeting_url ~ '^https://'),
  cancel_reason text,
  created_at timestamptz not null default now()
);
-- No two live bookings for the same practitioner at the same time.
create unique index appointments_no_double_booking
  on public.appointments (practitioner_id, start_at) where status = 'scheduled';
create index appointments_patient on public.appointments (patient_id, start_at desc);
create index appointments_practitioner on public.appointments (practitioner_id, start_at);

-- ---------------------------------------------------------------------------
-- Transfers and availability requests

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_name text not null default '',
  from_practitioner_id uuid not null default auth.uid() references public.practitioners (id),
  from_practitioner_name text not null default '',
  to_practitioner_id uuid not null references public.practitioners (id),
  to_practitioner_name text not null default '',
  reason text not null check (char_length(reason) between 1 and 2000),
  -- Keep the sending practitioner on the care team after the handover.
  keep_access boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_practitioner_id <> to_practitioner_id)
);

create table public.availability_requests (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null default auth.uid() references public.practitioners (id) on delete cascade,
  practitioner_name text not null default '',
  kind text not null check (kind in ('unavailable', 'available')),
  from_date date not null,
  to_date date not null,
  -- For kind "available": {"start": "18:00", "end": "21:00"} on each day in the range.
  hours jsonb,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_date <= to_date)
);

-- ---------------------------------------------------------------------------
-- Templates and assessments

create table public.assessment_forms (
  id text primary key, -- 'phq9'
  code text not null, -- 'PHQ-9'
  title text not null,
  title_ar text,
  instructions text not null,
  instructions_ar text,
  -- [{"id": "q1", "text": "...", "options": [{"label": "...", "value": 0}]}]
  questions jsonb not null,
  -- [{"min": 0, "max": 4, "label": "Minimal", "level": 0}]
  bands jsonb not null,
  -- Question ids that raise a safety flag when answered above 0 (PHQ-9 item 9).
  safety_items text[] not null default '{}',
  active boolean not null default true
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  -- Empty for the clinic's starter templates.
  owner_id uuid default auth.uid() references public.profiles (id) on delete cascade,
  -- Clinic templates are visible to every practitioner. Only admins create them.
  shared boolean not null default false,
  kind text not null default 'message' check (kind in ('message', 'assessment')),
  title text not null,
  body text not null,
  locale text not null default 'en' check (locale in ('en', 'ar')),
  form_id text references public.assessment_forms (id),
  created_at timestamptz not null default now(),
  check (kind = 'message' or form_id is not null)
);

create table public.assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  patient_name text not null default '',
  practitioner_id uuid not null default auth.uid() references public.practitioners (id),
  form_id text not null references public.assessment_forms (id),
  form_code text not null default '',
  form_title text not null default '',
  status text not null default 'sent' check (status in ('sent', 'completed')),
  answers jsonb,
  sent_at timestamptz not null default now(),
  completed_at timestamptz
);
create index assignments_patient on public.assessment_assignments (patient_id, sent_at desc);

-- Scores and safety flags. Written only by submit_assessment(); patients can't read them.
create table public.assessment_results (
  assignment_id uuid primary key references public.assessment_assignments (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  practitioner_id uuid not null references public.practitioners (id),
  form_id text not null references public.assessment_forms (id),
  form_code text not null,
  score int not null,
  max_score int not null,
  severity text not null,
  severity_level int not null,
  safety_flag boolean not null default false,
  incomplete boolean not null default false,
  reviewed boolean not null default false,
  completed_at timestamptz not null default now()
);
create index results_patient on public.assessment_results (patient_id, completed_at);
create index results_practitioner on public.assessment_results (practitioner_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Messaging

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unique (patient_id, practitioner_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id),
  text text not null check (char_length(text) between 1 and 4000),
  template_id uuid references public.templates (id) on delete set null,
  assessment_assignment_id uuid references public.assessment_assignments (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation on public.messages (conversation_id, created_at);

create function public.in_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations
    where id = p_conversation and (patient_id = auth.uid() or practitioner_id = auth.uid())
  )
$$;

-- ===========================================================================
-- Row level security

alter table public.profiles enable row level security;
alter table public.practitioners enable row level security;
alter table public.patients enable row level security;
alter table public.care_team enable row level security;
alter table public.notes enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.transfers enable row level security;
alter table public.availability_requests enable row level security;
alter table public.assessment_forms enable row level security;
alter table public.templates enable row level security;
alter table public.assessment_assignments enable row level security;
alter table public.assessment_results enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Start from nothing and grant back only what each table needs.
revoke all on all tables in schema public from anon, authenticated;

-- profiles
grant select on public.profiles to authenticated;
grant update (display_name, locale, photo_url) on public.profiles to authenticated;
create policy "own profile or admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- practitioners: public directory for signed-in users. Blocked and extra days change only
-- through review_availability_request().
grant select on public.practitioners to authenticated;
grant update (display_name, display_name_ar, title, title_ar, bio, bio_ar, photo_url,
              languages, session_minutes, time_zone, weekly_hours) on public.practitioners to authenticated;
create policy "directory" on public.practitioners for select to authenticated using (true);
create policy "edit own practitioner profile" on public.practitioners for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- patients
grant select on public.patients to authenticated;
grant update (phone, status) on public.patients to authenticated;
create policy "patient, care team or admin" on public.patients for select to authenticated
  using (id = auth.uid() or public.on_care_team(id) or public.is_admin());
create policy "care team updates status" on public.patients for update to authenticated
  using (public.on_care_team(id) or public.is_admin() or id = auth.uid())
  with check (public.on_care_team(id) or public.is_admin() or id = auth.uid());
-- Patients may change only their phone; the column grant allows status too, so stop it here.
create function public.patients_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and not (public.on_care_team(old.id) or public.is_admin()) then
    raise exception 'Only the care team can change a patient''s status';
  end if;
  if new.phone is distinct from old.phone and old.id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the patient can change their phone number';
  end if;
  return new;
end $$;
create trigger patients_guard before update on public.patients
  for each row when (auth.uid() is not null) execute function public.patients_guard();

-- care_team: read-only for clients; changed by booking and transfers.
grant select on public.care_team to authenticated;
create policy "see own care teams" on public.care_team for select to authenticated
  using (practitioner_id = auth.uid() or patient_id = auth.uid() or public.is_admin());

-- notes: care team only
grant select, insert, delete on public.notes to authenticated;
grant update (body, updated_at) on public.notes to authenticated;
create policy "care team reads notes" on public.notes for select to authenticated
  using (public.on_care_team(patient_id) or public.is_admin());
create policy "care team writes notes as themselves" on public.notes for insert to authenticated
  with check (public.on_care_team(patient_id) and author_id = auth.uid());
create policy "authors edit their notes" on public.notes for update to authenticated
  using (author_id = auth.uid() and public.on_care_team(patient_id));
create policy "authors delete their notes" on public.notes for delete to authenticated
  using (author_id = auth.uid() and public.on_care_team(patient_id));

-- tasks: care team only
grant select, insert, delete on public.tasks to authenticated;
grant update (title, done, due_date) on public.tasks to authenticated;
create policy "care team reads tasks" on public.tasks for select to authenticated
  using (public.on_care_team(patient_id) or public.is_admin());
create policy "care team adds tasks" on public.tasks for insert to authenticated
  with check (public.on_care_team(patient_id) and author_id = auth.uid() and done = false);
create policy "care team updates tasks" on public.tasks for update to authenticated
  using (public.on_care_team(patient_id));
create policy "care team deletes tasks" on public.tasks for delete to authenticated
  using (public.on_care_team(patient_id));

-- appointments: created only by book_appointment(). The practitioner records the outcome.
grant select on public.appointments to authenticated;
grant update (status, meeting_url, cancel_reason) on public.appointments to authenticated;
create policy "people in the session or care team" on public.appointments for select to authenticated
  using (patient_id = auth.uid() or practitioner_id = auth.uid()
         or public.on_care_team(patient_id) or public.is_admin());
create policy "practitioner records outcome" on public.appointments for update to authenticated
  using ((practitioner_id = auth.uid() and public.is_staff()) or public.is_admin())
  with check ((practitioner_id = auth.uid() and public.is_staff()) or public.is_admin());

-- transfers
grant select, insert on public.transfers to authenticated;
grant update (status) on public.transfers to authenticated;
create policy "the two practitioners" on public.transfers for select to authenticated
  using (from_practitioner_id = auth.uid() or to_practitioner_id = auth.uid() or public.is_admin());
create policy "care team starts a transfer" on public.transfers for insert to authenticated
  with check (public.is_staff() and from_practitioner_id = auth.uid()
              and status = 'pending' and public.on_care_team(patient_id));
-- The sender may withdraw while pending. Accepting goes through respond_to_transfer().
create policy "sender withdraws" on public.transfers for update to authenticated
  using (from_practitioner_id = auth.uid() and status = 'pending')
  with check (status = 'cancelled');

-- availability requests
grant select, insert, delete on public.availability_requests to authenticated;
create policy "own requests or admin" on public.availability_requests for select to authenticated
  using (practitioner_id = auth.uid() or public.is_admin());
create policy "practitioner requests" on public.availability_requests for insert to authenticated
  with check (public.is_staff() and practitioner_id = auth.uid() and status = 'pending'
              and reviewed_by is null);
create policy "withdraw pending" on public.availability_requests for delete to authenticated
  using (practitioner_id = auth.uid() and status = 'pending');

-- assessment forms: readable by everyone signed in, changed by admins
grant select, insert, update, delete on public.assessment_forms to authenticated;
create policy "read forms" on public.assessment_forms for select to authenticated using (true);
create policy "admins manage forms" on public.assessment_forms for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- templates
grant select, insert, delete on public.templates to authenticated;
grant update (title, body, kind, locale, form_id, shared) on public.templates to authenticated;
create policy "staff read shared and own" on public.templates for select to authenticated
  using (public.is_staff() and (shared or owner_id = auth.uid()));
create policy "staff create own" on public.templates for insert to authenticated
  with check (public.is_staff() and owner_id = auth.uid() and (not shared or public.is_admin()));
create policy "owner or admin edits" on public.templates for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check ((owner_id = auth.uid() and not shared) or public.is_admin());
create policy "owner or admin deletes" on public.templates for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- assessment assignments. Patients submit through submit_assessment().
grant select, insert on public.assessment_assignments to authenticated;
create policy "patient and care team" on public.assessment_assignments for select to authenticated
  using (patient_id = auth.uid() or practitioner_id = auth.uid()
         or public.on_care_team(patient_id) or public.is_admin());
create policy "care team sends forms" on public.assessment_assignments for insert to authenticated
  with check (public.on_care_team(patient_id) and practitioner_id = auth.uid()
              and status = 'sent' and answers is null);

-- assessment results: care team only, and they may only mark them reviewed
grant select on public.assessment_results to authenticated;
grant update (reviewed) on public.assessment_results to authenticated;
create policy "care team reads results" on public.assessment_results for select to authenticated
  using (practitioner_id = auth.uid() or public.on_care_team(patient_id) or public.is_admin());
create policy "care team marks reviewed" on public.assessment_results for update to authenticated
  using (public.on_care_team(patient_id) or public.is_admin());

-- conversations: created by booking and transfers
grant select on public.conversations to authenticated;
create policy "participants" on public.conversations for select to authenticated
  using (patient_id = auth.uid() or practitioner_id = auth.uid());

-- messages
grant select, insert on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
create policy "participants read" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "participants send as themselves" on public.messages for insert to authenticated
  with check (
    public.in_conversation(conversation_id) and sender_id = auth.uid()
    -- Only practitioners send templates and check-in forms.
    and (public.is_staff() or (template_id is null and assessment_assignment_id is null))
  );
create policy "recipient marks read" on public.messages for update to authenticated
  using (public.in_conversation(conversation_id) and sender_id <> auth.uid());

-- ===========================================================================
-- Triggers

-- New sign-ups become patients. Staff are promoted later by an admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, role, display_name, email) values (new.id, 'patient', v_name, coalesce(new.email, ''));
  insert into public.patients (id, display_name, email, phone)
    values (new.id, v_name, coalesce(new.email, ''), nullif(new.raw_user_meta_data ->> 'phone', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep session counts right when a session's outcome is recorded, and corrected.
create function public.appointment_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'completed' then
    update public.patients
      set completed_sessions = completed_sessions + 1,
          last_session_at = greatest(coalesce(last_session_at, new.start_at), new.start_at)
      where id = new.patient_id;
  elsif old.status = 'completed' then
    update public.patients set completed_sessions = greatest(completed_sessions - 1, 0) where id = new.patient_id;
  end if;
  return new;
end $$;
create trigger appointment_status_changed after update of status on public.appointments
  for each row execute function public.appointment_status_changed();

-- Conversation preview (last message and time).
create function public.message_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message = left(new.text, 140), last_message_at = new.created_at, last_sender_id = new.sender_id
    where id = new.conversation_id;
  return new;
end $$;
create trigger message_created after insert on public.messages
  for each row execute function public.message_created();

-- Authors' display names on notes come from their profile, not from the client.
create function public.note_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce((select display_name from public.profiles where id = new.author_id), '');
  return new;
end $$;
create trigger note_author before insert on public.notes
  for each row execute function public.note_author();

-- Names copied onto rows for display come from the database, not from the client.
create function public.fill_names() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'transfers' then
    new.patient_name := (select display_name from public.patients where id = new.patient_id);
    new.from_practitioner_name := (select display_name from public.practitioners where id = new.from_practitioner_id);
    new.to_practitioner_name := (select display_name from public.practitioners where id = new.to_practitioner_id);
  elsif tg_table_name = 'availability_requests' then
    new.practitioner_name := (select display_name from public.practitioners where id = new.practitioner_id);
  elsif tg_table_name = 'assessment_assignments' then
    new.patient_name := (select display_name from public.patients where id = new.patient_id);
    select code, title into new.form_code, new.form_title from public.assessment_forms where id = new.form_id;
  end if;
  return new;
end $$;
create trigger fill_names before insert on public.transfers
  for each row execute function public.fill_names();
create trigger fill_names before insert on public.availability_requests
  for each row execute function public.fill_names();
create trigger fill_names before insert on public.assessment_assignments
  for each row execute function public.fill_names();

-- ===========================================================================
-- Functions the apps call (supabase.rpc)

create function public.hhmm_to_minutes(t text) returns int
language sql immutable as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

-- True when `p_time` on `p_date` is a bookable start time for this practitioner,
-- ignoring existing bookings. Mirrors slotsForDate() in packages/shared/src/slots.ts.
create function public.is_offered_slot(p public.practitioners, p_date date, p_time text) returns boolean
language plpgsql stable as $$
declare
  w jsonb;
  t int := public.hhmm_to_minutes(p_time);
  s int;
  e int;
begin
  if exists (
    select 1 from jsonb_array_elements(p.blocked_ranges) r
    where p_date between (r ->> 'from')::date and (r ->> 'to')::date
  ) then
    return false;
  end if;
  for w in
    select x from jsonb_array_elements(coalesce(p.weekly_hours -> extract(dow from p_date)::int::text, '[]')) x
    union all
    select jsonb_build_object('start', d ->> 'start', 'end', d ->> 'end')
      from jsonb_array_elements(p.extra_days) d where (d ->> 'date')::date = p_date
  loop
    s := public.hhmm_to_minutes(w ->> 'start');
    e := public.hhmm_to_minutes(w ->> 'end');
    if t >= s and t + p.session_minutes <= e and (t - s) % p.session_minutes = 0 then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- Start times already booked for a practitioner on a day, with no patient details.
create function public.booked_times(p_practitioner uuid, p_date date) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(to_char(a.start_at at time zone p.time_zone, 'HH24:MI')), '{}')
  from public.appointments a join public.practitioners p on p.id = a.practitioner_id
  where a.practitioner_id = p_practitioner and a.status = 'scheduled'
    and (a.start_at at time zone p.time_zone)::date = p_date
$$;

create function public.book_appointment(p_practitioner uuid, p_date date, p_time text, p_mode text default 'video')
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

  -- Booking someone new adds them to the care team and opens a conversation.
  insert into public.care_team (patient_id, practitioner_id) values (v_patient.id, v_pract.id) on conflict do nothing;
  update public.patients set primary_practitioner_id = v_pract.id
    where id = v_patient.id and primary_practitioner_id is null;
  insert into public.conversations (patient_id, practitioner_id) values (v_patient.id, v_pract.id) on conflict do nothing;
  return v_id;
end $$;

-- Patients cancel future sessions here. Practitioners can also update status directly.
create function public.cancel_appointment(p_appointment uuid, p_reason text default null) returns void
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
end $$;

-- The receiving practitioner accepts or declines. Accepting moves the patient's file.
create function public.respond_to_transfer(p_transfer uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.transfers;
begin
  select * into t from public.transfers where id = p_transfer for update;
  if t.id is null then raise exception 'Transfer not found'; end if;
  if t.to_practitioner_id <> auth.uid() then raise exception 'This transfer isn''t addressed to you'; end if;
  if t.status <> 'pending' then raise exception 'This transfer was already handled'; end if;

  update public.transfers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
    where id = p_transfer;
  if not p_accept then return; end if;

  insert into public.care_team (patient_id, practitioner_id) values (t.patient_id, t.to_practitioner_id)
    on conflict do nothing;
  if not t.keep_access then
    delete from public.care_team where patient_id = t.patient_id and practitioner_id = t.from_practitioner_id;
  end if;
  update public.patients set primary_practitioner_id = t.to_practitioner_id where id = t.patient_id;
  insert into public.conversations (patient_id, practitioner_id) values (t.patient_id, t.to_practitioner_id)
    on conflict do nothing;
end $$;

-- Admin approves or rejects a schedule change. Returns how many booked sessions clash
-- with a newly blocked range, so they can be moved.
create function public.review_availability_request(p_request uuid, p_approve boolean) returns int
language plpgsql security definer set search_path = public as $$
declare
  r public.availability_requests;
  v_tz text;
  v_clash int := 0;
begin
  if not public.is_admin() then raise exception 'Only admins can review requests'; end if;
  select * into r from public.availability_requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Already reviewed'; end if;

  update public.availability_requests
    set status = case when p_approve then 'approved' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request;
  if not p_approve then return 0; end if;

  if r.kind = 'unavailable' then
    update public.practitioners
      set blocked_ranges = blocked_ranges || jsonb_build_array(jsonb_build_object('from', r.from_date, 'to', r.to_date))
      where id = r.practitioner_id
      returning time_zone into v_tz;
    select count(*) into v_clash from public.appointments
      where practitioner_id = r.practitioner_id and status = 'scheduled'
        and (start_at at time zone v_tz)::date between r.from_date and r.to_date;
  elsif r.hours is not null then
    update public.practitioners
      set extra_days = extra_days || (
        select jsonb_agg(jsonb_build_object('date', d::date, 'start', r.hours ->> 'start', 'end', r.hours ->> 'end'))
        from generate_series(r.from_date, r.to_date, interval '1 day') d)
      where id = r.practitioner_id;
  end if;
  return v_clash;
end $$;

-- Patient submits answers once. Scores are computed here and stored where only the care team
-- can read them.
create function public.submit_assessment(p_assignment uuid, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.assessment_assignments;
  f public.assessment_forms;
  q jsonb;
  v_val int;
  v_score int := 0;
  v_max int := 0;
  v_missing int := 0;
  v_band jsonb;
  v_flag boolean;
begin
  select * into a from public.assessment_assignments where id = p_assignment for update;
  if a.id is null or a.patient_id <> auth.uid() then raise exception 'Check-in not found'; end if;
  if a.status <> 'sent' then raise exception 'This check-in was already submitted'; end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Invalid answers'; end if;
  select * into f from public.assessment_forms where id = a.form_id;

  for q in select * from jsonb_array_elements(f.questions) loop
    v_max := v_max + (select max((o ->> 'value')::int) from jsonb_array_elements(q -> 'options') o);
    v_val := case when jsonb_typeof(p_answers -> (q ->> 'id')) = 'number' then (p_answers ->> (q ->> 'id'))::int end;
    if v_val is null or not exists (
      select 1 from jsonb_array_elements(q -> 'options') o where (o ->> 'value')::int = v_val
    ) then
      v_missing := v_missing + 1;
    else
      v_score := v_score + v_val;
    end if;
  end loop;

  select b into v_band from jsonb_array_elements(f.bands) b
    where v_score between (b ->> 'min')::int and (b ->> 'max')::int limit 1;
  select coalesce(bool_or(coalesce((p_answers ->> s)::int, 0) > 0), false) into v_flag
    from unnest(f.safety_items) s;

  update public.assessment_assignments
    set answers = p_answers, status = 'completed', completed_at = now()
    where id = p_assignment;
  insert into public.assessment_results
    (assignment_id, patient_id, practitioner_id, form_id, form_code, score, max_score, severity, severity_level,
     safety_flag, incomplete)
  values
    (a.id, a.patient_id, a.practitioner_id, f.id, f.code, v_score, v_max, coalesce(v_band ->> 'label', 'Unknown'),
     coalesce((v_band ->> 'level')::int, 0), v_flag, v_missing > 0);
end $$;

-- Practitioner sends a check-in form: creates the assignment and posts it in the chat together.
create function public.send_assessment(p_patient uuid, p_form text, p_text text, p_template uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_conversation uuid;
  v_id uuid;
begin
  if not (public.is_staff() and public.on_care_team(p_patient)) then
    raise exception 'Only the patient''s care team can send forms';
  end if;
  select id into v_conversation from public.conversations
    where patient_id = p_patient and practitioner_id = auth.uid();
  if v_conversation is null then raise exception 'No conversation with this patient yet'; end if;
  insert into public.assessment_assignments (patient_id, practitioner_id, form_id)
    values (p_patient, auth.uid(), p_form) returning id into v_id;
  insert into public.messages (conversation_id, sender_id, text, template_id, assessment_assignment_id)
    values (v_conversation, auth.uid(), p_text, p_template, v_id);
  return v_id;
end $$;

-- Admin turns an existing account (signed up with this email) into a practitioner.
create function public.promote_to_practitioner(
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
          -- Sunday to Thursday, 9:00 to 17:00. Practitioners adjust this in the dashboard.
          '{"0":[{"start":"09:00","end":"17:00"}],"1":[{"start":"09:00","end":"17:00"}],"2":[{"start":"09:00","end":"17:00"}],"3":[{"start":"09:00","end":"17:00"}],"4":[{"start":"09:00","end":"17:00"}]}')
  on conflict (id) do update set display_name = excluded.display_name, discipline = excluded.discipline,
    title = excluded.title, active = true;
  -- Staff don't need a patient file unless they already have sessions as a patient.
  delete from public.patients p where p.id = v_id
    and not exists (select 1 from public.appointments where patient_id = v_id);
  return v_id;
end $$;

-- Only signed-in users may call the RPCs.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.my_role(), public.is_admin(), public.is_staff(), public.on_care_team(uuid), public.in_conversation(uuid),
  public.booked_times(uuid, date), public.book_appointment(uuid, date, text, text),
  public.cancel_appointment(uuid, text), public.respond_to_transfer(uuid, boolean),
  public.review_availability_request(uuid, boolean), public.submit_assessment(uuid, jsonb),
  public.send_assessment(uuid, text, text, uuid),
  public.promote_to_practitioner(text, text, text, text, boolean),
  public.hhmm_to_minutes(text), public.is_offered_slot(public.practitioners, date, text)
to authenticated;

-- Live updates for the screens that show changing data.
alter publication supabase_realtime add table
  public.appointments, public.messages, public.conversations, public.transfers,
  public.assessment_assignments, public.assessment_results, public.availability_requests,
  public.notes, public.tasks, public.patients, public.care_team, public.templates, public.practitioners,
  public.profiles;
