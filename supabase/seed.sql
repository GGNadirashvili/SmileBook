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
