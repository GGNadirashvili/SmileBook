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
