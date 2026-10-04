-- SmileBook schema (Georgian dental marketplace + scheduling)
-- All timestamps are timestamptz; business timezone is Asia/Tbilisi.

create extension if not exists btree_gist;

-- ───────────── enums ─────────────
create type user_role    as enum ('patient', 'clinic_staff', 'admin');
create type staff_role   as enum ('owner', 'administrator', 'receptionist', 'dentist');
create type price_kind   as enum ('fixed', 'from', 'on_consultation');
create type appt_status  as enum ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show');
create type booking_mode as enum ('instant', 'approval');
create type clinic_status as enum ('pending', 'active', 'suspended');
create type review_status as enum ('published', 'reported', 'hidden');

-- ───────────── geography ─────────────
create table cities (
  id    serial primary key,
  slug  text unique not null,
  name  text not null,
  lat   double precision not null,
  lng   double precision not null,
  zoom  int not null default 12,
  sort  int not null default 100
);

create table districts (
  id      serial primary key,
  city_id int not null references cities(id) on delete cascade,
  name    text not null,
  unique (city_id, name)
);

-- ───────────── users ─────────────
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  role       user_role not null default 'patient',
  created_at timestamptz not null default now()
);

create table family_members (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  full_name  text not null,
  relation   text not null default 'other',   -- child | parent | partner | other
  birth_date date,
  created_at timestamptz not null default now()
);

-- ───────────── clinics ─────────────
create table clinics (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null,
  description      text,
  city_id          int not null references cities(id),
  district_id      int references districts(id),
  address          text not null,
  lat              double precision not null,
  lng              double precision not null,
  phone            text,
  email            text,
  cover_url        text,
  verified         boolean not null default false,
  sponsored        boolean not null default false,
  emergency        boolean not null default false,   -- accepts emergency patients / 24-7
  open_weekends    boolean not null default false,
  wheelchair       boolean not null default false,
  parking          boolean not null default false,
  near_metro       boolean not null default false,
  accepts_card     boolean not null default true,
  accepts_cash     boolean not null default true,
  installments     boolean not null default false,
  languages        text[] not null default '{ka}',
  booking_mode     booking_mode not null default 'instant',
  min_notice_hours int not null default 2,
  max_future_days  int not null default 90,
  free_cancel_hours int not null default 12,
  slot_step_min    int not null default 30,
  status           clinic_status not null default 'active',
  created_at       timestamptz not null default now()
);
create index on clinics (city_id, district_id) where status = 'active';

create table clinic_hours (          -- public opening hours (for "open now")
  id        serial primary key,
  clinic_id uuid not null references clinics(id) on delete cascade,
  weekday   smallint not null check (weekday between 1 and 7),  -- ISO: 1 = Monday
  open_time time not null,
  close_time time not null
);
create index on clinic_hours (clinic_id, weekday);

create table clinic_staff (
  clinic_id uuid not null references clinics(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  role      staff_role not null default 'receptionist',
  primary key (clinic_id, user_id)
);

create table chairs (
  id        uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name      text not null,
  active    boolean not null default true
);

-- ───────────── dentists ─────────────
create table dentists (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id) on delete cascade,
  user_id          uuid references profiles(id) on delete set null,
  full_name        text not null,
  gender           text check (gender in ('female', 'male')),
  specialty        text,
  bio              text,
  years_experience int,
  languages        text[] not null default '{ka}',
  photo_url        text,
  verified         boolean not null default false,
  active           boolean not null default true
);
create index on dentists (clinic_id) where active;

create table working_hours (          -- recurring weekly availability
  id         serial primary key,
  dentist_id uuid not null references dentists(id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time   time not null check (end_time > start_time)
);
create index on working_hours (dentist_id, weekday);

create table schedule_overrides (     -- one-off exceptions; replace weekly hours for that date
  id         serial primary key,
  dentist_id uuid not null references dentists(id) on delete cascade,
  on_date    date not null,
  is_off     boolean not null default false,
  start_time time,
  end_time   time,
  check (is_off or (start_time is not null and end_time > start_time))
);
create index on schedule_overrides (dentist_id, on_date);

-- ───────────── services ─────────────
create table service_categories (
  id    serial primary key,
  slug  text unique not null,
  name  text not null,
  icon  text not null default 'sparkles',
  sort  int not null default 100
);

create table search_intents (         -- "My tooth hurts" -> suggested appointment types (no diagnosis)
  id             serial primary key,
  phrase         text not null,
  category_slugs text[] not null,
  emergency      boolean not null default false
);

create table clinic_services (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null references clinics(id) on delete cascade,
  category_id       int not null references service_categories(id),
  name              text not null,
  description       text,
  duration_min      int not null check (duration_min > 0),
  buffer_before_min int not null default 0,
  buffer_after_min  int not null default 0,
  price_kind        price_kind not null default 'fixed',
  price_gel         numeric(10,2),
  patient_type      text not null default 'all' check (patient_type in ('all', 'adult', 'child')),
  active            boolean not null default true
);
create index on clinic_services (clinic_id) where active;
create index on clinic_services (category_id);

create table dentist_services (
  dentist_id uuid not null references dentists(id) on delete cascade,
  service_id uuid not null references clinic_services(id) on delete cascade,
  primary key (dentist_id, service_id)
);

-- ───────────── appointments ─────────────
create table appointments (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references clinics(id),
  dentist_id       uuid not null references dentists(id),
  chair_id         uuid references chairs(id),
  service_id       uuid not null references clinic_services(id),
  patient_id       uuid references profiles(id) on delete set null,
  family_member_id uuid references family_members(id) on delete set null,
  patient_name     text not null,               -- snapshot, so clinic staff can see it
  patient_phone    text,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,        -- set by trigger from service duration
  block_start      timestamptz not null,        -- starts_at - buffer_before
  block_end        timestamptz not null,        -- ends_at + buffer_after
  status           appt_status not null default 'confirmed',
  price_kind       price_kind,
  price_gel        numeric(10,2),
  notes            text,
  rescheduled_from uuid references appointments(id),
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_at       timestamptz not null default now()
);
create index on appointments (clinic_id, starts_at);
create index on appointments (dentist_id, starts_at);
create index on appointments (patient_id, starts_at desc);

-- Slot locking: the database itself refuses overlapping bookings (buffers included).
alter table appointments add constraint appt_no_dentist_overlap
  exclude using gist (dentist_id with =, tstzrange(block_start, block_end) with &&)
  where (status not in ('cancelled', 'no_show'));
alter table appointments add constraint appt_no_chair_overlap
  exclude using gist (chair_id with =, tstzrange(block_start, block_end) with &&)
  where (chair_id is not null and status not in ('cancelled', 'no_show'));

-- ───────────── patient extras ─────────────
create table favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  clinic_id  uuid references clinics(id) on delete cascade,
  dentist_id uuid references dentists(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(clinic_id, dentist_id) = 1)
);
create unique index on favorites (user_id, clinic_id)  where clinic_id  is not null;
create unique index on favorites (user_id, dentist_id) where dentist_id is not null;

create table waitlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  clinic_id   uuid not null references clinics(id) on delete cascade,
  dentist_id  uuid references dentists(id) on delete cascade,
  service_id  uuid not null references clinic_services(id) on delete cascade,
  date_from   date not null,
  date_to     date not null,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table reviews (
  id           uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  clinic_id    uuid not null references clinics(id) on delete cascade,
  dentist_id   uuid references dentists(id) on delete set null,
  patient_id   uuid references profiles(id) on delete set null,
  author_name  text not null,
  overall      smallint not null check (overall between 1 and 5),
  staff        smallint check (staff between 1 and 5),
  cleanliness  smallint check (cleanliness between 1 and 5),
  waiting      smallint check (waiting between 1 and 5),
  body         text,
  clinic_reply text,
  replied_at   timestamptz,
  status       review_status not null default 'published',
  created_at   timestamptz not null default now()
);
create index on reviews (clinic_id) where status = 'published';
create index on reviews (dentist_id) where status = 'published';

-- ───────────── platform ─────────────
create table notifications_outbox (   -- picked up by an email sender (edge function) later
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  kind       text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create table audit_log (
  id         bigserial primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb,
  created_at timestamptz not null default now()
);

-- ───────────── views ─────────────
create view clinic_stats with (security_invoker = true) as
  select clinic_id,
         round(avg(overall)::numeric, 1) as rating,
         count(*)::int                   as review_count
  from reviews where status = 'published' group by clinic_id;

create view dentist_stats with (security_invoker = true) as
  select dentist_id,
         round(avg(overall)::numeric, 1) as rating,
         count(*)::int                   as review_count
  from reviews where status = 'published' and dentist_id is not null group by dentist_id;

-- ───────────── triggers ─────────────
create function set_appointment_block() returns trigger language plpgsql as $$
declare s clinic_services;
begin
  select * into s from clinic_services where id = new.service_id;
  new.ends_at     := new.starts_at + make_interval(mins => s.duration_min);
  new.block_start := new.starts_at - make_interval(mins => s.buffer_before_min);
  new.block_end   := new.ends_at   + make_interval(mins => s.buffer_after_min);
  return new;
end $$;
create trigger trg_appointment_block
  before insert or update of starts_at, service_id on appointments
  for each row execute function set_appointment_block();

create function audit_appointment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), tg_op, 'appointment', new.id,
          jsonb_build_object('status', new.status, 'starts_at', new.starts_at, 'dentist_id', new.dentist_id));
  return new;
end $$;
create trigger trg_audit_appointment
  after insert or update of status, starts_at, dentist_id on appointments
  for each row execute function audit_appointment();

-- new auth user -> profile
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- users may never promote themselves
create function protect_profile_role() returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and coalesce(auth.role(), '') <> 'service_role'
     and not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    new.role := old.role;
  end if;
  return new;
end $$;
create trigger trg_protect_profile_role
  before update on profiles for each row execute function protect_profile_role();
