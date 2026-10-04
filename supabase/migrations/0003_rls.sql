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
