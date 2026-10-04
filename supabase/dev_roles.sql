-- Run AFTER creating test users in Supabase (Authentication → Users → Add user, tick "Auto confirm").
-- Suggested test accounts:
--   patient@smilebook.test   (any password)  -> stays a normal patient
--   clinic@smilebook.test                    -> owner of "სმაილ ცენტრი ვაკე"
--   admin@smilebook.test                     -> platform admin
-- Edit the emails below if you used different ones.

update profiles set role = 'admin' where id = (select id from auth.users where email = 'admin@smilebook.test');

update profiles set role = 'clinic_staff' where id = (select id from auth.users where email = 'clinic@smilebook.test');
insert into clinic_staff (clinic_id, user_id, role)
select c.id, u.id, 'owner'
from clinics c, auth.users u
where c.slug = 'smile-center-vake' and u.email = 'clinic@smilebook.test'
on conflict do nothing;
