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
-- SmileBook: availability engine, search and booking functions.
-- Business timezone: Asia/Tbilisi (no DST, UTC+4).

-- ───────────── helpers (also used by RLS) ─────────────
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function is_clinic_staff(p_clinic uuid, p_roles staff_role[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from clinic_staff
    where clinic_id = p_clinic and user_id = auth.uid()
      and (p_roles is null or role = any (p_roles))
  );
$$;

-- ───────────── availability ─────────────
-- Bookable start times for a service on a date. Honors: weekly hours, date overrides,
-- service duration + buffers, existing appointments, chair capacity, min notice, max horizon.
create function available_slots(p_service_id uuid, p_date date, p_dentist_id uuid default null)
returns table (dentist_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  s public.clinic_services%rowtype;
  c public.clinics%rowtype;
  chairs_total int;
  v_earliest timestamptz;
  v_latest timestamptz;
begin
  select * into s from clinic_services where id = p_service_id and active;
  if not found then return; end if;
  select * into c from clinics where id = s.clinic_id and status = 'active';
  if not found then return; end if;

  select count(*) into chairs_total from chairs where clinic_id = c.id and active;
  v_earliest := now() + make_interval(hours => c.min_notice_hours);
  v_latest   := now() + make_interval(days => c.max_future_days);

  return query
  with devs as (
    select d.id from dentists d
    join dentist_services ds on ds.dentist_id = d.id and ds.service_id = s.id
    where d.clinic_id = c.id and d.active and (p_dentist_id is null or d.id = p_dentist_id)
  ),
  wins as (
    select dv.id as did, w.start_time, w.end_time
    from devs dv
    join (
      select o.dentist_id, o.start_time, o.end_time
        from schedule_overrides o where o.on_date = p_date and not o.is_off
      union all
      select wh.dentist_id, wh.start_time, wh.end_time
        from working_hours wh
       where wh.weekday = extract(isodow from p_date)::int
         and not exists (select 1 from schedule_overrides o2
                          where o2.dentist_id = wh.dentist_id and o2.on_date = p_date)
    ) w on w.dentist_id = dv.id
  ),
  cand as (
    select wn.did, t as st, t + make_interval(mins => s.duration_min) as en
    from wins wn,
    lateral generate_series(
      ((p_date + wn.start_time) at time zone 'Asia/Tbilisi'),
      ((p_date + wn.end_time) at time zone 'Asia/Tbilisi') - make_interval(mins => s.duration_min),
      make_interval(mins => c.slot_step_min)) as t
  )
  select ca.did, ca.st, ca.en
  from cand ca
  where ca.st >= v_earliest and ca.st <= v_latest
    and not exists (
      select 1 from appointments a
       where a.dentist_id = ca.did and a.status not in ('cancelled', 'no_show')
         and tstzrange(a.block_start, a.block_end) &&
             tstzrange(ca.st - make_interval(mins => s.buffer_before_min),
                       ca.en + make_interval(mins => s.buffer_after_min)))
    and (chairs_total = 0 or (
      select count(distinct a.chair_id) from appointments a
       where a.clinic_id = c.id and a.chair_id is not null
         and a.status not in ('cancelled', 'no_show')
         and tstzrange(a.block_start, a.block_end) &&
             tstzrange(ca.st - make_interval(mins => s.buffer_before_min),
                       ca.en + make_interval(mins => s.buffer_after_min))
      ) < chairs_total)
  order by ca.st, ca.did;
end $$;

-- All bookable slots over a range of days in one round trip (day picker + slot grid).
create function available_slots_range(p_service_id uuid, p_from date, p_days int default 14, p_dentist_id uuid default null)
returns table (dentist_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.dentist_id, a.starts_at, a.ends_at
  from generate_series(p_from, p_from + (least(p_days, 60) - 1), interval '1 day') as g(d),
  lateral available_slots(p_service_id, g.d::date, p_dentist_id) a
  order by a.starts_at, a.dentist_id;
$$;

-- Earliest bookable slot for a clinic (optionally within a category / day part / time window).
create function clinic_next_slot(
  p_clinic_id uuid, p_category_id int default null, p_from date default null,
  p_part text default null, p_within_hours int default null, p_days int default 21)
returns table (service_id uuid, dentist_id uuid, starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_start date := coalesce(p_from, (now() at time zone 'Asia/Tbilisi')::date);
  v_cat int := coalesce(p_category_id, (select id from service_categories where slug = 'consultation'));
  v_day date;
  r record;
begin
  for i in 0 .. p_days - 1 loop
    v_day := v_start + i;
    select s.id as sid, a.dentist_id as did, a.starts_at as st into r
    from clinic_services s
    cross join lateral available_slots(s.id, v_day) a
    where s.clinic_id = p_clinic_id and s.active and s.category_id = v_cat
      and (p_part is null or case p_part
             when 'morning'   then extract(hour from a.starts_at at time zone 'Asia/Tbilisi') < 12
             when 'afternoon' then extract(hour from a.starts_at at time zone 'Asia/Tbilisi') between 12 and 16
             else extract(hour from a.starts_at at time zone 'Asia/Tbilisi') >= 17 end)
      and (p_within_hours is null or a.starts_at <= now() + make_interval(hours => p_within_hours))
    order by a.starts_at limit 1;
    if found then
      service_id := r.sid; dentist_id := r.did; starts_at := r.st;
      return next; return;
    end if;
  end loop;
end $$;

-- ───────────── search ─────────────
-- p keys (all optional): city_id, district_id, category_id, q, date, part (morning|afternoon|evening),
-- within_hours, open_now, open_weekends, emergency, languages[], min_price, max_price, min_rating,
-- min_reviews, patient_type (adult|child), wheelchair, parking, near_metro, card, cash, installments,
-- dentist_gender, min_experience, lat, lng, max_km, sort
-- (recommended|earliest|nearest|rating|reviews|price_low|price_high).
-- NOTE: `sponsored` is only a label; it never influences ranking.
create function search_clinics(p jsonb default '{}')
returns table (
  id uuid, slug text, name text, address text, city_id int, city_name text, district_name text,
  lat double precision, lng double precision, verified boolean, sponsored boolean, emergency boolean,
  cover_url text, rating numeric, review_count int, open_now boolean,
  service_id uuid, service_name text, price_kind price_kind, price_gel numeric,
  next_slot timestamptz, next_dentist_id uuid, next_dentist_name text, distance_km double precision)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_city int := nullif(p->>'city_id', '')::int;
  v_district int := nullif(p->>'district_id', '')::int;
  v_cat int := nullif(p->>'category_id', '')::int;
  v_cat_eff int := coalesce(nullif(p->>'category_id', '')::int, (select sc.id from service_categories sc where sc.slug = 'consultation'));
  v_q text := nullif(trim(p->>'q'), '');
  v_date date := nullif(p->>'date', '')::date;
  v_part text := nullif(p->>'part', '');
  v_within int := nullif(p->>'within_hours', '')::int;
  v_ptype text := nullif(p->>'patient_type', '');
  v_min_price numeric := nullif(p->>'min_price', '')::numeric;
  v_max_price numeric := nullif(p->>'max_price', '')::numeric;
  v_min_rating numeric := nullif(p->>'min_rating', '')::numeric;
  v_min_reviews int := nullif(p->>'min_reviews', '')::int;
  v_gender text := nullif(p->>'dentist_gender', '');
  v_min_exp int := nullif(p->>'min_experience', '')::int;
  v_langs text[] := array(select jsonb_array_elements_text(coalesce(p->'languages', '[]'::jsonb)));
  v_lat double precision := nullif(p->>'lat', '')::double precision;
  v_lng double precision := nullif(p->>'lng', '')::double precision;
  v_max_km double precision := nullif(p->>'max_km', '')::double precision;
  v_sort text := coalesce(nullif(p->>'sort', ''), 'recommended');
  v_need_slot boolean := (v_date is not null or v_part is not null or v_within is not null);
begin
  return query
  with base as (
    select c.id, c.slug, c.name, c.address, c.city_id, ci.name as city_name, di.name as district_name,
           c.lat, c.lng, c.verified, c.sponsored, c.emergency, c.cover_url,
           st.rating, coalesce(st.review_count, 0) as review_count,
           exists (select 1 from clinic_hours h
                    where h.clinic_id = c.id
                      and h.weekday = extract(isodow from (now() at time zone 'Asia/Tbilisi'))::int
                      and (now() at time zone 'Asia/Tbilisi')::time between h.open_time and h.close_time) as open_now,
           case when v_lat is not null and v_lng is not null then
             6371 * 2 * asin(sqrt(power(sin(radians(c.lat - v_lat) / 2), 2)
               + cos(radians(v_lat)) * cos(radians(c.lat)) * power(sin(radians(c.lng - v_lng) / 2), 2)))
           end as dist
    from clinics c
    join cities ci on ci.id = c.city_id
    left join districts di on di.id = c.district_id
    left join clinic_stats st on st.clinic_id = c.id
    where c.status = 'active'
      and (v_city is null or c.city_id = v_city)
      and (v_district is null or c.district_id = v_district)
      and (p->>'open_weekends' is distinct from 'true' or c.open_weekends)
      and (p->>'emergency' is distinct from 'true' or c.emergency)
      and (p->>'wheelchair' is distinct from 'true' or c.wheelchair)
      and (p->>'parking' is distinct from 'true' or c.parking)
      and (p->>'near_metro' is distinct from 'true' or c.near_metro)
      and (p->>'card' is distinct from 'true' or c.accepts_card)
      and (p->>'cash' is distinct from 'true' or c.accepts_cash)
      and (p->>'installments' is distinct from 'true' or c.installments)
      and (cardinality(v_langs) = 0 or c.languages && v_langs)
      and (v_min_rating is null or coalesce(st.rating, 0) >= v_min_rating)
      and (v_min_reviews is null or coalesce(st.review_count, 0) >= v_min_reviews)
      and (v_q is null
           or c.name ilike '%' || v_q || '%' or c.address ilike '%' || v_q || '%'
           or exists (select 1 from dentists d where d.clinic_id = c.id and d.active and d.full_name ilike '%' || v_q || '%')
           or exists (select 1 from clinic_services s where s.clinic_id = c.id and s.active and s.name ilike '%' || v_q || '%'))
      and (v_gender is null and v_min_exp is null or exists (
            select 1 from dentists d where d.clinic_id = c.id and d.active
              and (v_gender is null or d.gender = v_gender)
              and (v_min_exp is null or d.years_experience >= v_min_exp)))
  ),
  withsvc as (
    select b.*, ms.id as ms_id, ms.name as ms_name, ms.price_kind as ms_kind, ms.price_gel as ms_price
    from base b
    left join lateral (
      select s.id, s.name, s.price_kind, s.price_gel from clinic_services s
       where s.clinic_id = b.id and s.active and s.category_id = v_cat_eff
         and (v_ptype is null or s.patient_type in ('all', v_ptype))
       order by s.price_gel nulls last limit 1) ms on true
    where (v_cat is null or ms.id is not null)
      and (v_ptype is null or ms.id is not null)
      and ((v_min_price is null and v_max_price is null)
           or (ms.price_kind <> 'on_consultation'
               and (v_min_price is null or ms.price_gel >= v_min_price)
               and (v_max_price is null or ms.price_gel <= v_max_price)))
      and (p->>'open_now' is distinct from 'true' or b.open_now)
      and (v_max_km is null or b.dist <= v_max_km)
  ),
  res as (
    select w.id, w.slug, w.name, w.address, w.city_id, w.city_name, w.district_name, w.lat, w.lng,
           w.verified, w.sponsored, w.emergency, w.cover_url, w.rating, w.review_count, w.open_now,
           coalesce(nss.id, w.ms_id) as service_id,
           coalesce(nss.name, w.ms_name) as service_name,
           coalesce(nss.price_kind, w.ms_kind) as price_kind,
           coalesce(nss.price_gel, w.ms_price) as price_gel,
           ns.starts_at as next_slot, ns.dentist_id as next_dentist_id, dn.full_name as next_dentist_name,
           w.dist as distance_km
    from withsvc w
    left join lateral clinic_next_slot(
        w.id, v_cat, v_date, v_part, v_within, case when v_date is not null then 1 else 21 end) ns on true
    left join clinic_services nss on nss.id = ns.service_id
    left join dentists dn on dn.id = ns.dentist_id
    where (not v_need_slot or ns.starts_at is not null)
  )
  select r.* from res r
  order by
    case v_sort when 'earliest' then extract(epoch from coalesce(r.next_slot, 'infinity'::timestamptz)) end asc nulls last,
    case v_sort when 'nearest' then r.distance_km end asc nulls last,
    case v_sort when 'rating' then r.rating end desc nulls last,
    case v_sort when 'reviews' then r.review_count end desc nulls last,
    case v_sort when 'price_low' then r.price_gel end asc nulls last,
    case v_sort when 'price_high' then r.price_gel end desc nulls last,
    case v_sort when 'recommended' then
      coalesce(r.rating, 3) * 20 + least(r.review_count, 200) / 10.0
      - coalesce(r.distance_km, 0) * 1.5
      - case when r.next_slot is null then 40 else least(extract(epoch from r.next_slot - now()) / 3600.0, 72) * 0.5 end
    end desc nulls last,
    r.name
  limit 100;
end $$;

-- ───────────── booking ─────────────
create function _create_appointment(
  p_service_id uuid, p_dentist_id uuid, p_starts_at timestamptz,
  p_patient_id uuid, p_family_member_id uuid, p_patient_name text, p_patient_phone text,
  p_notes text, p_rescheduled_from uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s clinic_services; c clinics;
  v_dentist uuid; v_chair uuid; v_id uuid;
  v_block tstzrange;
begin
  select * into s from clinic_services where id = p_service_id and active;
  if not found then raise exception 'service_not_found'; end if;
  select * into c from clinics where id = s.clinic_id and status = 'active';
  if not found then raise exception 'clinic_not_found'; end if;

  -- pick a dentist that truly has this slot ("any dentist" balances by daily load)
  select a.dentist_id into v_dentist
  from available_slots(p_service_id, (p_starts_at at time zone 'Asia/Tbilisi')::date, p_dentist_id) a
  where a.starts_at = p_starts_at
  order by (select count(*) from appointments x
             where x.dentist_id = a.dentist_id and x.status not in ('cancelled', 'no_show')
               and (x.starts_at at time zone 'Asia/Tbilisi')::date = (p_starts_at at time zone 'Asia/Tbilisi')::date),
           a.dentist_id
  limit 1;
  if v_dentist is null then raise exception 'slot_unavailable'; end if;

  v_block := tstzrange(p_starts_at - make_interval(mins => s.buffer_before_min),
                       p_starts_at + make_interval(mins => s.duration_min + s.buffer_after_min));
  select ch.id into v_chair from chairs ch
   where ch.clinic_id = c.id and ch.active
     and not exists (select 1 from appointments x
                      where x.chair_id = ch.id and x.status not in ('cancelled', 'no_show')
                        and tstzrange(x.block_start, x.block_end) && v_block)
   order by ch.name limit 1;

  insert into appointments (clinic_id, dentist_id, chair_id, service_id, patient_id, family_member_id,
                            patient_name, patient_phone, starts_at, ends_at, block_start, block_end,
                            status, price_kind, price_gel, notes, rescheduled_from)
  values (c.id, v_dentist, v_chair, s.id, p_patient_id, p_family_member_id,
          p_patient_name, p_patient_phone, p_starts_at, p_starts_at, p_starts_at, p_starts_at,
          case c.booking_mode when 'instant' then 'confirmed'::appt_status else 'pending'::appt_status end,
          s.price_kind, s.price_gel, p_notes, p_rescheduled_from)
  returning id into v_id;
  return v_id;
exception when exclusion_violation then
  raise exception 'slot_unavailable';
end $$;

create function book_appointment(
  p_service_id uuid, p_starts_at timestamptz, p_dentist_id uuid default null,
  p_family_member_id uuid default null, p_notes text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); pr profiles; fm family_members;
  v_name text; v_phone text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into pr from profiles where id = v_uid;
  v_name := coalesce(pr.full_name, 'პაციენტი'); v_phone := pr.phone;
  if p_family_member_id is not null then
    select * into fm from family_members where id = p_family_member_id and owner_id = v_uid;
    if not found then raise exception 'family_member_not_found'; end if;
    v_name := fm.full_name;
  end if;
  return _create_appointment(p_service_id, p_dentist_id, p_starts_at, v_uid,
                             p_family_member_id, v_name, v_phone, p_notes);
end $$;

create function cancel_appointment(p_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a appointments; c clinics; v_staff boolean;
begin
  select * into a from appointments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  select * into c from clinics where id = a.clinic_id;
  v_staff := is_admin() or is_clinic_staff(a.clinic_id);
  if not v_staff and a.patient_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if a.status in ('cancelled', 'completed', 'no_show') then raise exception 'not_cancellable'; end if;
  if not v_staff and a.starts_at - now() < make_interval(hours => c.free_cancel_hours) then
    raise exception 'late_cancellation';
  end if;
  update appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_id;
end $$;

-- Reschedule = free the old slot and take the new one in a single transaction.
create function reschedule_appointment(p_id uuid, p_new_start timestamptz, p_dentist_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a appointments; c clinics; v_new uuid; v_staff boolean;
begin
  select * into a from appointments where id = p_id;
  if not found then raise exception 'not_found'; end if;
  select * into c from clinics where id = a.clinic_id;
  v_staff := is_admin() or is_clinic_staff(a.clinic_id);
  if not v_staff and a.patient_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'not_reschedulable'; end if;
  if not v_staff and a.starts_at - now() < make_interval(hours => c.free_cancel_hours) then
    raise exception 'late_cancellation';
  end if;
  update appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = 'rescheduled' where id = p_id;
  v_new := _create_appointment(a.service_id, coalesce(p_dentist_id, a.dentist_id), p_new_start, a.patient_id,
                               a.family_member_id, a.patient_name, a.patient_phone, a.notes, a.id);
  return v_new;
end $$;

-- ───────────── notifications queue (email sender comes later) ─────────────
create function queue_appointment_notifications() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.patient_id is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into notifications_outbox (user_id, kind, payload)
    values (new.patient_id, case new.status when 'confirmed' then 'booking_confirmed' else 'booking_pending' end,
            jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at));
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      insert into notifications_outbox (user_id, kind, payload)
      values (new.patient_id, 'booking_confirmed', jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at));
    elsif new.status = 'cancelled' and new.cancel_reason is distinct from 'rescheduled' then
      insert into notifications_outbox (user_id, kind, payload)
      values (new.patient_id, 'booking_cancelled', jsonb_build_object('appointment_id', new.id, 'starts_at', new.starts_at));
    end if;
  end if;
  return new;
end $$;
create trigger trg_appointment_notify
  after insert or update of status on appointments
  for each row execute function queue_appointment_notifications();

-- A cancelled future slot pings matching waitlist entries.
create function notify_waitlist() returns trigger language plpgsql security definer set search_path = public as $$
declare v_day date := (new.starts_at at time zone 'Asia/Tbilisi')::date;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.starts_at > now() then
    with hit as (
      update waitlist w set notified_at = now()
       where w.notified_at is null and w.clinic_id = new.clinic_id
         and (w.dentist_id is null or w.dentist_id = new.dentist_id)
         and v_day between w.date_from and w.date_to
       returning w.user_id, w.service_id)
    insert into notifications_outbox (user_id, kind, payload)
    select user_id, 'waitlist_slot_opened',
           jsonb_build_object('clinic_id', new.clinic_id, 'service_id', service_id, 'starts_at', new.starts_at)
    from hit;
  end if;
  return new;
end $$;
create trigger trg_notify_waitlist
  after update of status on appointments
  for each row execute function notify_waitlist();

-- ───────────── reviews (verified visits only) ─────────────
create function create_review(
  p_appointment_id uuid, p_overall int, p_staff int default null, p_cleanliness int default null,
  p_waiting int default null, p_body text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare a appointments; pr profiles; v_id uuid;
begin
  select * into a from appointments where id = p_appointment_id;
  if not found or a.patient_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if a.status <> 'completed' then raise exception 'visit_not_completed'; end if;
  select * into pr from profiles where id = auth.uid();
  insert into reviews (appointment_id, clinic_id, dentist_id, patient_id, author_name,
                       overall, staff, cleanliness, waiting, body)
  values (a.id, a.clinic_id, a.dentist_id, a.patient_id,
          coalesce(split_part(pr.full_name, ' ', 1), 'პაციენტი'),
          p_overall, p_staff, p_cleanliness, p_waiting, nullif(trim(p_body), ''))
  returning id into v_id;
  return v_id;
end $$;

create function reply_to_review(p_id uuid, p_reply text) returns void
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  select * into r from reviews where id = p_id;
  if not found or not is_clinic_staff(r.clinic_id, array['owner', 'administrator']::staff_role[]) then
    raise exception 'forbidden';
  end if;
  update reviews set clinic_reply = nullif(trim(p_reply), ''), replied_at = now() where id = p_id;
end $$;

create function report_review(p_id uuid) returns void   -- clinics cannot delete; they report for moderation
language plpgsql security definer set search_path = public as $$
declare r reviews;
begin
  select * into r from reviews where id = p_id;
  if not found or not is_clinic_staff(r.clinic_id, array['owner', 'administrator']::staff_role[]) then
    raise exception 'forbidden';
  end if;
  update reviews set status = 'reported' where id = p_id and status = 'published';
end $$;

-- Public API surface
revoke all on function _create_appointment from public, anon, authenticated;
grant execute on function available_slots, available_slots_range, clinic_next_slot, search_clinics to anon, authenticated;
grant execute on function book_appointment, cancel_appointment, reschedule_appointment,
  create_review, reply_to_review, report_review to authenticated;
-- Row Level Security. Default deny; policies below open exactly what each role needs.

alter table cities               enable row level security;
alter table districts            enable row level security;
alter table profiles             enable row level security;
alter table family_members       enable row level security;
alter table clinics              enable row level security;
alter table clinic_hours         enable row level security;
alter table clinic_staff         enable row level security;
alter table chairs               enable row level security;
alter table dentists             enable row level security;
alter table working_hours        enable row level security;
alter table schedule_overrides   enable row level security;
alter table service_categories   enable row level security;
alter table search_intents       enable row level security;
alter table clinic_services      enable row level security;
alter table dentist_services     enable row level security;
alter table appointments         enable row level security;
alter table favorites            enable row level security;
alter table waitlist             enable row level security;
alter table reviews              enable row level security;
alter table notifications_outbox enable row level security;
alter table audit_log            enable row level security;

-- Public catalogue (read-only)
create policy "public read" on cities             for select using (true);
create policy "public read" on districts          for select using (true);
create policy "public read" on service_categories for select using (true);
create policy "public read" on search_intents     for select using (true);
create policy "public read" on clinic_hours       for select using (true);
create policy "public read" on dentist_services   for select using (true);
create policy "public read active" on clinics         for select using (status = 'active' or is_admin() or is_clinic_staff(id));
create policy "public read active" on dentists        for select using (active or is_admin() or is_clinic_staff(clinic_id));
create policy "public read active" on clinic_services for select using (active or is_admin() or is_clinic_staff(clinic_id));
create policy "public read published" on reviews      for select using (status = 'published' or is_admin() or is_clinic_staff(clinic_id) or patient_id = auth.uid());

-- Clinic management (owner/administrator edit the catalogue; receptionists only run the calendar)
create policy "manage clinic" on clinics for update
  using (is_admin() or is_clinic_staff(id, array['owner', 'administrator']::staff_role[]))
  with check (is_admin() or is_clinic_staff(id, array['owner', 'administrator']::staff_role[]));
create policy "admin all clinics" on clinics for all using (is_admin()) with check (is_admin());

create policy "manage dentists" on dentists for all
  using (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]))
  with check (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]));
create policy "manage services" on clinic_services for all
  using (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]))
  with check (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]));
create policy "manage hours" on clinic_hours for all
  using (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]))
  with check (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]));
create policy "manage chairs" on chairs for all
  using (is_admin() or is_clinic_staff(clinic_id))
  with check (is_admin() or is_clinic_staff(clinic_id, array['owner', 'administrator']::staff_role[]));
create policy "manage dentist services" on dentist_services for all
  using (is_admin() or exists (select 1 from dentists d where d.id = dentist_id
         and is_clinic_staff(d.clinic_id, array['owner', 'administrator']::staff_role[])))
  with check (is_admin() or exists (select 1 from dentists d where d.id = dentist_id
         and is_clinic_staff(d.clinic_id, array['owner', 'administrator']::staff_role[])));
create policy "manage working hours" on working_hours for all
  using (is_admin() or exists (select 1 from dentists d where d.id = dentist_id and is_clinic_staff(d.clinic_id)))
  with check (is_admin() or exists (select 1 from dentists d where d.id = dentist_id
         and is_clinic_staff(d.clinic_id, array['owner', 'administrator']::staff_role[])));
create policy "manage overrides" on schedule_overrides for all
  using (is_admin() or exists (select 1 from dentists d where d.id = dentist_id and is_clinic_staff(d.clinic_id)))
  with check (is_admin() or exists (select 1 from dentists d where d.id = dentist_id and is_clinic_staff(d.clinic_id)));

create policy "see team" on clinic_staff for select using (user_id = auth.uid() or is_admin() or is_clinic_staff(clinic_id));
create policy "owner manages team" on clinic_staff for all
  using (is_admin() or is_clinic_staff(clinic_id, array['owner']::staff_role[]))
  with check (is_admin() or is_clinic_staff(clinic_id, array['owner']::staff_role[]));

-- Profiles
create policy "own profile read"   on profiles for select using (id = auth.uid() or is_admin());
create policy "own profile update" on profiles for update using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- Patient data
create policy "own family" on family_members for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own favorites" on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own waitlist" on waitlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Appointments: patients create/cancel through RPCs only; staff run their clinic's calendar.
create policy "see own or clinic appointments" on appointments for select
  using (patient_id = auth.uid() or is_clinic_staff(clinic_id) or is_admin());
create policy "staff update appointments" on appointments for update
  using (is_clinic_staff(clinic_id) or is_admin())
  with check (is_clinic_staff(clinic_id) or is_admin());

-- Admin-only
create policy "admin read outbox" on notifications_outbox for select using (is_admin() or user_id = auth.uid());
create policy "admin read audit"  on audit_log            for select using (is_admin());
create policy "admin moderate reviews" on reviews for update using (is_admin()) with check (is_admin());

-- Grants (Supabase default roles)
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on family_members, favorites, waitlist to authenticated;
grant update on profiles, appointments, clinics, reviews to authenticated;
grant insert, update, delete on dentists, clinic_services, dentist_services, working_hours,
  schedule_overrides, clinic_hours, chairs, clinic_staff to authenticated;
revoke select on notifications_outbox, audit_log from anon;
-- Supabase advisor: "Security Definer View". Make the stats views run with the caller's permissions.
-- Safe: they only aggregate published reviews, which anyone may read under RLS anyway.
-- (Fresh installs already get this from 0001; this patch fixes databases created earlier.)
alter view public.clinic_stats  set (security_invoker = true);
alter view public.dentist_stats set (security_invoker = true);
-- SmileBook TEST DATA. Fictional clinics, dentists and reviews — safe to re-run on an empty DB.
-- Run after the migrations. (Test *users* are created in the Supabase dashboard; see dev_roles.sql.)

select setseed(0.42);

-- ───────────── geography ─────────────
insert into cities (slug, name, lat, lng, zoom, sort) values
  ('tbilisi', 'თბილისი', 41.7151, 44.8271, 12, 1),
  ('batumi',  'ბათუმი',  41.6168, 41.6367, 13, 2),
  ('kutaisi', 'ქუთაისი', 42.2679, 42.6946, 13, 3),
  ('rustavi', 'რუსთავი', 41.5495, 45.0050, 13, 4),
  ('gori',    'გორი',    41.9842, 44.1100, 13, 5),
  ('zugdidi', 'ზუგდიდი', 42.5088, 41.8709, 13, 6);

insert into districts (city_id, name)
select c.id, d from cities c,
  unnest(case c.slug
    when 'tbilisi' then array['ვაკე','საბურთალო','ვერა','ძველი თბილისი','დიდუბე','ნაძალადევი','გლდანი','ისანი','სამგორი','ჩუღურეთი','მთაწმინდა','დიღომი']
    when 'batumi'  then array['ახალი ბულვარი','ძველი ბათუმი','ბარცხანა']
    else array[]::text[] end) as d;

-- ───────────── categories & intent search ─────────────
insert into service_categories (slug, name, icon, sort) values
  ('consultation', 'კონსულტაცია',            'stethoscope', 1),
  ('cleaning',     'კბილის წმენდა',          'sparkles',    2),
  ('filling',      'ბჟენი / პლომბა',         'shield',      3),
  ('root_canal',   'არხის მკურნალობა',       'activity',    4),
  ('extraction',   'კბილის ამოღება',         'scissors',    5),
  ('wisdom',       'სიბრძნის კბილი',         'brain',       6),
  ('implant',      'იმპლანტი',               'cog',         7),
  ('crown',        'გვირგვინი / პროთეზი',    'crown',       8),
  ('veneers',      'ვინირები',               'gem',         9),
  ('braces',       'ბრეკეტები',              'align-justify', 10),
  ('aligners',     'ალაინერები',             'smile',       11),
  ('pediatric',    'ბავშვთა სტომატოლოგია',   'baby',        12),
  ('whitening',    'გათეთრება',              'sun',         13),
  ('xray',         'რენტგენი',               'scan',        14);

insert into search_intents (phrase, category_slugs, emergency) values
  ('კბილი მტკივა',               array['consultation','root_canal','extraction'], true),
  ('კბილის ტკივილი',             array['consultation','root_canal','extraction'], true),
  ('ძლიერი ტკივილი',             array['consultation','root_canal'], true),
  ('დასივებული ღრძილი',          array['consultation','cleaning'], true),
  ('ღრძილიდან სისხლი მდის',       array['consultation','cleaning'], false),
  ('კბილი გამიტყდა',             array['consultation','crown','filling'], true),
  ('კბილი ამომივარდა',           array['consultation','implant','crown'], true),
  ('კბილი გამიშავდა',            array['filling','consultation'], false),
  ('ცხელზე და ცივზე მეტკინება',  array['consultation','filling'], false),
  ('პირიდან ცუდი სუნი',          array['cleaning','consultation'], false),
  ('ყვითელი ნადები კბილებზე',    array['cleaning','whitening'], false),
  ('მინდა თეთრი კბილები',        array['whitening','cleaning'], false),
  ('კბილების გასწორება',         array['braces','aligners','consultation'], false),
  ('მრუდე კბილები',              array['braces','aligners','consultation'], false),
  ('ბავშვს კბილი სტკივა',        array['pediatric','consultation'], true),
  ('ბავშვის პირველი ვიზიტი',     array['pediatric'], false),
  ('გასაკეთებელი მაქვს კბილი',   array['consultation','filling'], false),
  ('სიბრძნის კბილი მტკივა',      array['wisdom','consultation'], true),
  ('კბილის ჩასმა',               array['implant','crown'], false),
  ('პროფილაქტიკური შემოწმება',   array['consultation','cleaning','xray'], false);

-- ───────────── clinics, dentists, services, schedules ─────────────
do $$
declare
  c record; d record; t record; cl uuid; dn uuid; sv uuid;
  clinics_def jsonb := $json$[
   {"slug":"smile-center-vake","name":"სმაილ ცენტრი ვაკე","city":"tbilisi","district":"ვაკე","address":"ჭავჭავაძის გამზ. 41","lat":41.7102,"lng":44.7701,"verified":true,"parking":true,"wheelchair":true,"installments":true,"langs":["ka","en","ru"],"hours":[9,20],"sat":false,"desc":"თანამედროვე კლინიკა ვაკეში, ციფრული რენტგენით და გამჭვირვალე ფასებით.","price":1.2},
   {"slug":"denta-plus","name":"დენტა პლუსი","city":"tbilisi","district":"საბურთალო","address":"ვაჟა-ფშაველას გამზ. 33","lat":41.7250,"lng":44.7545,"verified":true,"metro":true,"installments":true,"langs":["ka","en"],"hours":[9,19],"sat":true,"desc":"ოჯახური სტომატოლოგია მეტროსთან ახლოს. შაბათსაც ვმუშაობთ.","price":1.0},
   {"slug":"white-smile-vera","name":"თეთრი ღიმილი","city":"tbilisi","district":"ვერა","address":"ბარნოვის ქ. 12","lat":41.7052,"lng":44.7915,"verified":true,"wheelchair":true,"langs":["ka","en","ru"],"hours":[10,20],"sat":true,"desc":"ესთეტიკური სტომატოლოგია: გათეთრება, ვინირები, ალაინერები.","price":1.4},
   {"slug":"emergency-dent","name":"ემერჯენსი დენტი 24/7","city":"tbilisi","district":"დიდუბე","address":"წერეთლის გამზ. 112","lat":41.7405,"lng":44.7855,"verified":true,"metro":true,"emergency":true,"langs":["ka","en","ru"],"hours":[0,24],"sat":true,"desc":"გადაუდებელი სტომატოლოგიური დახმარება მთელი სადღეღამისო.","price":1.1},
   {"slug":"happy-tooth","name":"ბედნიერი კბილი","city":"tbilisi","district":"გლდანი","address":"გლდანის III მკრ.","lat":41.7985,"lng":44.8120,"verified":true,"wheelchair":true,"langs":["ka","ru"],"hours":[10,19],"sat":true,"pediatric":true,"desc":"ბავშვთა სტომატოლოგია — მეგობრული გარემო და მშვიდი ვიზიტი.","price":0.9},
   {"slug":"implant-hub","name":"იმპლანტ ჰაბი","city":"tbilisi","district":"საბურთალო","address":"პეკინის ქ. 14","lat":41.7205,"lng":44.7520,"verified":true,"sponsored":true,"parking":true,"installments":true,"langs":["ka","en"],"hours":[10,18],"sat":false,"desc":"იმპლანტაცია და პროთეზირება გამოცდილი ქირურგების გუნდით.","price":1.3},
   {"slug":"old-tbilisi-dental","name":"ძველი თბილისის სტომატოლოგია","city":"tbilisi","district":"ძველი თბილისი","address":"ლესელიძის ქ. 9","lat":41.6925,"lng":44.8085,"verified":false,"langs":["ka","en"],"hours":[11,19],"sat":true,"desc":"პატარა კამერული კლინიკა ძველ ქალაქში.","price":0.95},
   {"slug":"dent-isani","name":"დენტ ისანი","city":"tbilisi","district":"ისანი","address":"მეტალურგების გამზ. 25","lat":41.6870,"lng":44.8450,"verified":true,"metro":true,"langs":["ka"],"hours":[9,18],"sat":false,"desc":"ხელმისაწვდომი ფასები ისანში.","price":0.8},
   {"slug":"batumi-smile","name":"ბათუმი სმაილი","city":"batumi","district":"ახალი ბულვარი","address":"ჭავჭავაძის ქ. 55","lat":41.6500,"lng":41.6330,"verified":true,"parking":true,"wheelchair":true,"installments":true,"langs":["ka","en","ru"],"hours":[9,21],"sat":true,"emergency":true,"desc":"ბათუმის ცენტრში, უცხოენოვანი პერსონალით.","price":1.15},
   {"slug":"sea-dent","name":"ზღვის ნაპირის დენტი","city":"batumi","district":"ძველი ბათუმი","address":"გორგილაძის ქ. 20","lat":41.6420,"lng":41.6410,"verified":false,"langs":["ka","ru"],"hours":[10,19],"sat":true,"desc":"სწრაფი და უმტკივნეულო მკურნალობა.","price":0.9},
   {"slug":"kutaisi-center","name":"ქუთაისის სტომატოლოგიური ცენტრი","city":"kutaisi","address":"რუსთაველის გამზ. 17","lat":42.2700,"lng":42.7020,"verified":true,"parking":true,"installments":true,"langs":["ka","en"],"hours":[9,19],"sat":true,"desc":"ქუთაისის წამყვანი სტომატოლოგიური ცენტრი.","price":0.85},
   {"slug":"rustavi-dent","name":"რუსთავი დენტ","city":"rustavi","address":"მშვიდობის გამზ. 8","lat":41.5520,"lng":45.0030,"verified":true,"langs":["ka","ru"],"hours":[10,18],"sat":false,"desc":"სრული სტომატოლოგიური მომსახურება რუსთავში.","price":0.8},
   {"slug":"gori-dental","name":"გორის დენტალ კლინიკა","city":"gori","address":"სტალინის ქ. 3","lat":41.9830,"lng":44.1100,"verified":false,"langs":["ka"],"hours":[10,18],"sat":false,"desc":"გორში, ცენტრთან ახლოს.","price":0.8}
  ]$json$::jsonb;
  tpl jsonb := $json$[
   ["consultation","კონსულტაცია",20,0,"fixed",50,"all"],
   ["cleaning","პროფესიული წმენდა",45,15,"fixed",100,"adult"],
   ["filling","კბილის ბჟენი",60,10,"from",120,"all"],
   ["root_canal","არხის მკურნალობა",90,15,"from",250,"adult"],
   ["extraction","კბილის ამოღება",30,10,"from",80,"all"],
   ["wisdom","სიბრძნის კბილის ამოღება",45,10,"from",200,"adult"],
   ["implant","იმპლანტაცია",60,15,"from",1200,"adult"],
   ["crown","გვირგვინი",60,10,"from",350,"adult"],
   ["veneers","ვინირები",90,10,"from",500,"adult"],
   ["braces","ბრეკეტები — კონსულტაცია",45,0,"on_consultation",null,"all"],
   ["aligners","ალაინერები — კონსულტაცია",45,0,"on_consultation",null,"adult"],
   ["pediatric","ბავშვის პირველი ვიზიტი",30,0,"fixed",60,"child"],
   ["whitening","კბილის გათეთრება",90,15,"fixed",400,"adult"],
   ["xray","რენტგენი",15,0,"fixed",20,"all"]
  ]$json$::jsonb;
  f_names text[] := array['ნინო','მარიამ','თამარ','ეკა','ნათია','ლიკა','სოფო','მაია'];
  m_names text[] := array['გიორგი','დავით','ლევან','ნიკა','ალექსანდრე','გიგა','თორნიკე','ზურაბ'];
  l_names text[] := array['ბერიძე','ქავთარაძე','ლომიძე','ჯანელიძე','მამულაშვილი','გელაშვილი','წიქარიშვილი','კვარაცხელია','ხარაიშვილი','ტაბატაძე','ჩხეიძე','გოგიაშვილი'];
  specs text[] := array['თერაპევტი','ქირურგი','ორთოდონტი','ორთოპედი','პედიატრი','პაროდონტოლოგი','ესთეტიკური სტომატოლოგი'];
  cat_id int; ndent int; gender text; i int; j int; hrs int[]; open_h int; close_h int;
  tpl_row jsonb; wd int; mult numeric; pr numeric;
begin
  for c in select * from jsonb_array_elements(clinics_def) as x(j) loop
    mult := (c.j->>'price')::numeric;
    insert into clinics (slug, name, description, city_id, district_id, address, lat, lng, phone, verified, sponsored,
                         emergency, open_weekends, wheelchair, parking, near_metro, installments, languages, accepts_cash, accepts_card)
    values (c.j->>'slug', c.j->>'name', c.j->>'desc',
            (select id from cities where slug = c.j->>'city'),
            (select di.id from districts di join cities ci on ci.id = di.city_id
              where ci.slug = c.j->>'city' and di.name = c.j->>'district'),
            c.j->>'address', (c.j->>'lat')::float, (c.j->>'lng')::float,
            '+995 32 2' || lpad((floor(random() * 900000 + 100000))::int::text, 6, '0'),
            coalesce((c.j->>'verified')::boolean, false), coalesce((c.j->>'sponsored')::boolean, false),
            coalesce((c.j->>'emergency')::boolean, false), coalesce((c.j->>'sat')::boolean, false),
            coalesce((c.j->>'wheelchair')::boolean, false), coalesce((c.j->>'parking')::boolean, false),
            coalesce((c.j->>'metro')::boolean, false), coalesce((c.j->>'installments')::boolean, false),
            array(select jsonb_array_elements_text(c.j->'langs')), true, true)
    returning id into cl;

    open_h := (c.j->'hours'->>0)::int; close_h := (c.j->'hours'->>1)::int;
    for wd in 1..7 loop
      if wd <= 5 or (wd = 6 and coalesce((c.j->>'sat')::boolean, false))
         or (wd = 7 and coalesce((c.j->>'emergency')::boolean, false) and close_h = 24) then
        insert into clinic_hours (clinic_id, weekday, open_time, close_time)
        values (cl, wd, make_time(open_h, 0, 0), case when close_h = 24 then time '23:59:59' else make_time(close_h, 0, 0) end);
      end if;
    end loop;

    insert into chairs (clinic_id, name) select cl, 'სავარძელი ' || g from generate_series(1, 2 + floor(random() * 2)::int) g;

    -- services
    for tpl_row in select * from jsonb_array_elements(tpl) loop
      continue when tpl_row->>0 <> 'consultation'
        and ((tpl_row->>0 = 'pediatric' and not coalesce((c.j->>'pediatric')::boolean, false) and random() < 0.6)
          or (tpl_row->>0 in ('implant','veneers','aligners') and random() < 0.45)
          or random() < 0.12);
      pr := case when tpl_row->>5 is null then null else round((tpl_row->>5)::numeric * mult / 5) * 5 end;
      insert into clinic_services (clinic_id, category_id, name, duration_min, buffer_after_min, price_kind, price_gel, patient_type)
      values (cl, (select id from service_categories where slug = tpl_row->>0), tpl_row->>1,
              (tpl_row->>2)::int, (tpl_row->>3)::int, (tpl_row->>4)::price_kind, pr, tpl_row->>6);
    end loop;

    -- dentists
    ndent := 2 + floor(random() * 3)::int;
    for i in 1..ndent loop
      gender := case when random() < 0.55 then 'female' else 'male' end;
      insert into dentists (clinic_id, full_name, gender, specialty, years_experience, languages, verified, bio)
      values (cl,
              (case gender when 'female' then f_names[1 + floor(random() * 8)::int] else m_names[1 + floor(random() * 8)::int] end)
                || ' ' || l_names[1 + floor(random() * 12)::int],
              gender, specs[1 + floor(random() * 7)::int], 3 + floor(random() * 22)::int,
              (select languages from clinics where id = cl), random() < 0.8,
              'სტომატოლოგი მდიდარი გამოცდილებით. ზრუნავს პაციენტის კომფორტსა და შედეგზე.')
      returning id into dn;

      -- offers: first dentist offers everything, others ~70%
      insert into dentist_services (dentist_id, service_id)
      select dn, s.id from clinic_services s where s.clinic_id = cl and (i = 1 or random() < 0.7 or s.name = 'კონსულტაცია');

      -- weekly schedule: most work Mon–Fri with a lunch break; some work alternate days
      for wd in 1..(case when close_h = 24 then 7 when coalesce((c.j->>'sat')::boolean, false) then 6 else 5 end) loop
        continue when i > 1 and random() < 0.3;
        if close_h = 24 then   -- emergency clinic: two shifts
          insert into working_hours (dentist_id, weekday, start_time, end_time)
          values (dn, wd, case when i % 2 = 1 then time '08:00' else time '16:00' end,
                          case when i % 2 = 1 then time '16:00' else time '23:30' end);
        elsif wd = 6 then
          insert into working_hours (dentist_id, weekday, start_time, end_time) values (dn, wd, make_time(open_h, 0, 0), make_time(least(close_h, 16), 0, 0));
        else
          insert into working_hours (dentist_id, weekday, start_time, end_time) values
            (dn, wd, make_time(open_h, 0, 0), make_time(13 + (close_h - open_h) / 9, 0, 0)),
            (dn, wd, make_time(14 + (close_h - open_h) / 9, 0, 0), make_time(close_h, 0, 0));
        end if;
      end loop;
      -- one-off exception: day off next week
      if random() < 0.35 then
        insert into schedule_overrides (dentist_id, on_date, is_off) values (dn, current_date + 3 + floor(random() * 6)::int, true);
      end if;
    end loop;
  end loop;
end $$;

-- ───────────── past visits + verified reviews, plus upcoming bookings ─────────────
do $$
declare
  cl record; d record; s record; ap uuid; k int; day date; h int;
  authors text[] := array['ნინო','გიორგი','მარიამ','დავით','თამარ','ლევან','ეკა','ნიკა','სოფო','ირაკლი'];
  texts text[] := array['ძალიან კმაყოფილი ვარ, სუფთა გარემო და თბილი მიღება.','ექიმმა ყველაფერი დეტალურად ამიხსნა. გირჩევთ!','დროულად მიმიღეს, ტკივილი არ მქონია.','ფასი გამჭვირვალე იყო, დამატებით არაფერი დამიმატეს.','კარგი სერვისი, მხოლოდ ცოტა დავიცადე რიგში.','პროფესიონალები არიან. ბავშვიც მშვიდად იყო.','ონლაინ დაჯავშნა ძალიან მოსახერხებელი იყო.','ყველაფერი სწრაფად და ხარისხიანად გააკეთეს.'];
  ov int; k2 int;
begin
  for cl in select id from clinics loop
    k := 0;
    for d in select dn.id from dentists dn where dn.clinic_id = cl.id loop
      for k2 in 1..(4 + floor(random() * 6)::int) loop
        k := k + 1;
        select * into s from clinic_services cs
          join dentist_services ds on ds.service_id = cs.id and ds.dentist_id = d.id
          where cs.clinic_id = cl.id order by random() limit 1;
        day := current_date - (k * 3 + 1);
        h := 10 + (k % 7);
        insert into appointments (clinic_id, dentist_id, service_id, patient_name, status, price_kind, price_gel,
                                  starts_at, ends_at, block_start, block_end)
        select cl.id, d.id, s.id, authors[1 + (k % 10)] || ' ტესტი', 'completed', s.price_kind, s.price_gel,
               (day + make_time(h, 0, 0)) at time zone 'Asia/Tbilisi', now(), now(), now()
        returning id into ap;
        if random() < 0.75 then
          ov := case when random() < 0.65 then 5 when random() < 0.7 then 4 else 3 end;
          insert into reviews (appointment_id, clinic_id, dentist_id, author_name, overall, staff, cleanliness, waiting, body, created_at)
          values (ap, cl.id, d.id, authors[1 + ((k + 3) % 10)], ov, least(5, ov + (random() < 0.3)::int), least(5, ov + (random() < 0.4)::int),
                  greatest(3, ov - (random() < 0.4)::int), texts[1 + floor(random() * 8)::int], now() - (k * 2 || ' days')::interval);
        end if;
      end loop;

      -- a few upcoming appointments so the calendar and availability look real
      for k2 in 0..6 loop
        day := current_date + k2;
        continue when random() > 0.5;
        continue when not exists (select 1 from working_hours w where w.dentist_id = d.id and w.weekday = extract(isodow from day)::int
                                    and time '11:00' >= w.start_time and time '12:30' <= w.end_time);
        select * into s from clinic_services cs
          join dentist_services ds on ds.service_id = cs.id and ds.dentist_id = d.id
          where cs.clinic_id = cl.id and cs.duration_min <= 60 order by random() limit 1;
        continue when s.id is null;
        begin
          insert into appointments (clinic_id, dentist_id, service_id, patient_name, patient_phone, status, price_kind, price_gel,
                                    starts_at, ends_at, block_start, block_end)
          values (cl.id, d.id, s.id, authors[1 + floor(random() * 10)::int] || ' ' || 'ტესტიშვილი', '+995 555 00 00 0' || (k2 % 10),
                  (case when random() < 0.7 then 'confirmed' else 'pending' end)::appt_status, s.price_kind, s.price_gel,
                  (day + time '11:00') at time zone 'Asia/Tbilisi', now(), now(), now());
        exception when exclusion_violation then null;
        end;
      end loop;
    end loop;
  end loop;
end $$;
