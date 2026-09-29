create table if not exists equipment (
  nopol text primary key,
  mobil text not null,
  vendor text not null,
  wa text
);

create table if not exists operating_hours (
  id serial primary key,
  process text not null,
  day_of_week int not null,
  open_time text,
  close_time text,
  is_24h boolean not null default false,
  is_active boolean not null default true
);

create table if not exists trips (
  id serial primary key,
  nopol text not null,
  no_fo text not null,
  mobil text not null,
  vendor text,
  wa text,
  created_at timestamptz not null default now(),
  security_in timestamptz,
  transport_queue timestamptz,
  transport_start timestamptz,
  transport_end timestamptz,
  transport_status text,
  fg_assignment text,
  fg_queue timestamptz,
  fg_start timestamptz,
  fg_end timestamptz,
  fg_status text,
  bs_assignment text,
  bs_queue timestamptz,
  bs_start timestamptz,
  bs_end timestamptz,
  bs_status text,
  kasir_assignment text,
  kasir_queue timestamptz,
  kasir_start timestamptz,
  kasir_end timestamptz,
  kasir_status text,
  kasir_lunas text,
  overall_status text not null default 'BERJALAN',
  notes text,
  unique (nopol, no_fo)
);

create index if not exists trips_status_idx on trips (overall_status);
create index if not exists trips_created_idx on trips (created_at desc);
create index if not exists trips_nopol_idx on trips (nopol);

create table if not exists queue_entries (
  id serial primary key,
  trip_id int not null references trips(id) on delete cascade,
  pos text not null,
  nopol text not null,
  no_fo text not null,
  mobil text not null,
  queued_at timestamptz not null default now(),
  status text not null default 'WAITING',
  skip_count int not null default 0,
  unique (trip_id, pos)
);

create index if not exists queue_pos_status_idx on queue_entries (pos, status, queued_at);

insert into equipment (nopol, mobil, vendor, wa) values
  ('B9284SXX', '6D JPM', 'JPM', '6285860458619'),
  ('B9150UCY', 'BINTARO-TRAC003', 'DKS', '6285693229085'),
  ('B9335UCZ', 'BINTARO-TRAC008', 'DKS', '6285716298360'),
  ('B9827VCD', 'BINTARO-TTP003', 'DKS', '6282124761952'),
  ('B9385VCE', 'BINTARO-TTP004', 'DKS', '62895342098739'),
  ('B9313VCE', 'BINTARO-TTP005', 'DKS', '6285882116798'),
  ('F3850FIM', 'MM013R001', 'JPM', '62895415185642'),
  ('B9410CRX', 'ON CALL 4A BARU', 'JPM', '6285819180564'),
  ('B9230PM', 'ON CALL 4A LAMA', 'JPM', '6281953594609'),
  ('H8611QW', 'ON CALL 4R BARU', 'JPM', '6285220192159'),
  ('F8121ME', 'ON CALL 4R LAMA', 'JPM', '6289685311556'),
  ('B9373SXS', 'SAL-MAJR001', 'MAJR', '6283129217890'),
  ('B9369SXS', 'SAL-MAJR002', 'MAJR', '6289655898055'),
  ('B9384SXS', 'SAL-MAJR005', 'MAJR', '6281314085657'),
  ('B9367SXS', 'SAL-MAJR006', 'MAJR', '6281946230453'),
  ('B9363SXS', 'SAL-MAJR007', 'MAJR', '6289650240379'),
  ('B9376SXS', 'SAL-MAJR008', 'MAJR', '6288213199747'),
  ('B9380SXS', 'SAL-MAJR009', 'MAJR', '6285794591251'),
  ('B9378SXS', 'SAL-MAJR010', 'MAJR', '6288295435621'),
  ('B9365SXS', 'SAL-MAJR012', 'MAJR', '6283840950063'),
  ('B9372SXS', 'SAL-MAJR013', 'MAJR', '62895400996847'),
  ('B9361SXS', 'SAL-MAJR014', 'MAJR', '62895320984294'),
  ('B9382SXS', 'SAL-MAJR015', 'MAJR', '6281399106311'),
  ('B9180SXU', 'SAL-MAJR016', 'MAJR', '62881025370166'),
  ('B9211SXU', 'SAL-MAJR018', 'MAJR', '6283853059021'),
  ('B9213SXU', 'SAL-MAJR019', 'MAJR', '62881012129564'),
  ('B9930SXU', 'SAL-MAJR022', 'MAJR', '6281314522528'),
  ('B9931SXU', 'SAL-MAJR023', 'MAJR', '6289531933694'),
  ('B9932SXU', 'SAL-MAJR024', 'MAJR', '6285888246134'),
  ('B9933SXU', 'SAL-MAJR025', 'MAJR', '6289508447758'),
  ('B9958SXU', 'SAL-MAJR030', 'MAJR', '6285846435862'),
  ('B9959SXU', 'SAL-MAJR031', 'MAJR', '6285660473229'),
  ('B9415SXT', 'SAL-MAJR040', 'MAJR', '6285351279599'),
  ('B9462SXT', 'SAL-MAJR041', 'MAJR', '628568224226'),
  ('B9729SXR', 'SAL-MAJR046', 'MAJR', '62895382138420'),
  ('B9919SXR', 'SAL-MAJR047', 'MAJR', '62881011455716'),
  ('B9200SXU', 'SAL-MAJR048', 'MAJR', '6283139911237'),
  ('B9202SXU', 'SAL-MAJR049', 'MAJR', '628588261550'),
  ('B9095UCY', 'SAL-TRAC003', 'JPM', '6285811160395'),
  ('B9964UXC', 'SAL-TRAC011', 'JPM', '6289685191327'),
  ('B9311UXD', 'SAL-TRAC012', 'JPM', '62895321785003'),
  ('B9214VCD', 'SAL-TTP001', 'TTP', '6281400792756'),
  ('B9212VCD', 'SAL-TTP002', 'TTP', '6288213964173'),
  ('B9209VCD', 'SAL-TTP003', 'TTP', '6285810658270'),
  ('B9226VCD', 'SAL-TTP008', 'TTP', '6289677140181'),
  ('B9563VCD', 'SAW-TTP003', 'TTP', '6283815813057')
on conflict (nopol) do nothing;

insert into operating_hours (process, day_of_week, open_time, close_time, is_24h) values
  ('KASIR', 1, '00:00', '23:00', false),
  ('KASIR', 2, '06:30', '22:00', false),
  ('KASIR', 3, '06:30', '22:00', false),
  ('KASIR', 4, '06:30', '22:00', false),
  ('KASIR', 5, '06:30', '22:00', false),
  ('KASIR', 6, '06:30', '20:00', false),
  ('KASIR', 0, '06:00', '23:00', false),
  ('FG', 1, '00:00', '23:00', false),
  ('FG', 2, '06:00', '23:00', false),
  ('FG', 3, '06:00', '23:00', false),
  ('FG', 4, '06:00', '23:00', false),
  ('FG', 5, '06:00', '23:00', false),
  ('FG', 6, '06:00', '20:00', false),
  ('FG', 0, '06:00', '23:00', false),
  ('BS', 1, '00:00', '23:00', false),
  ('BS', 2, '07:00', '23:00', false),
  ('BS', 3, '07:00', '23:00', false),
  ('BS', 4, '07:00', '23:00', false),
  ('BS', 5, '07:00', '23:00', false),
  ('BS', 6, '07:00', '20:00', false),
  ('BS', 0, '06:00', '23:00', false),
  ('SECURITY', 1, null, null, true),
  ('SECURITY', 2, null, null, true),
  ('SECURITY', 3, null, null, true),
  ('SECURITY', 4, null, null, true),
  ('SECURITY', 5, null, null, true),
  ('SECURITY', 6, null, null, true),
  ('SECURITY', 0, '06:00', '23:00', false),
  ('TRANSPORT', 1, null, null, true),
  ('TRANSPORT', 2, null, null, true),
  ('TRANSPORT', 3, null, null, true),
  ('TRANSPORT', 4, null, null, true),
  ('TRANSPORT', 5, null, null, true),
  ('TRANSPORT', 6, null, null, true),
  ('TRANSPORT', 0, '06:00', '23:00', false);

insert into trips (
  nopol, no_fo, mobil, vendor, wa,
  created_at, security_in, transport_queue, transport_status, overall_status
) values (
  'B9284SXX', '3200123456', '6D JPM', 'JPM', '6285860458619',
  now() - interval '45 minutes',
  now() - interval '40 minutes',
  now() - interval '18 minutes',
  'ANTRI',
  'BERJALAN'
);

insert into queue_entries (trip_id, pos, nopol, no_fo, mobil, queued_at, status)
select id, 'TRANSPORT', nopol, no_fo, mobil, transport_queue, 'WAITING'
from trips where no_fo = '3200123456';

insert into trips (
  nopol, no_fo, mobil, vendor, wa,
  created_at, security_in,
  transport_queue, transport_start, transport_end, transport_status,
  fg_assignment, bs_assignment, kasir_assignment,
  fg_queue, fg_start, fg_status, overall_status
) values (
  'B9373SXS', '3200123457', 'SAL-MAJR001', 'MAJR', '6283129217890',
  now() - interval '90 minutes',
  now() - interval '85 minutes',
  now() - interval '80 minutes',
  now() - interval '72 minutes',
  now() - interval '58 minutes',
  'SELESAI',
  'ADA', 'TIDAK_ADA', 'ADA',
  now() - interval '50 minutes',
  now() - interval '12 minutes',
  'MULAI',
  'BERJALAN'
);

insert into queue_entries (trip_id, pos, nopol, no_fo, mobil, queued_at, status)
select id, 'FG', nopol, no_fo, mobil, fg_queue, 'SERVING'
from trips where no_fo = '3200123457';

insert into trips (
  nopol, no_fo, mobil, vendor, wa, created_at, overall_status
) values (
  'B9214VCD', '3200123458', 'SAL-TTP001', 'TTP', '6281400792756',
  now() - interval '8 minutes',
  'BERJALAN'
);

insert into trips (
  nopol, no_fo, mobil, vendor, wa,
  created_at, security_in,
  transport_queue, transport_start, transport_end, transport_status,
  fg_assignment, bs_assignment, kasir_assignment,
  fg_status, bs_status,
  kasir_queue, kasir_start, kasir_end, kasir_status, kasir_lunas,
  overall_status
) values (
  'B9095UCY', '3200123459', 'SAL-TRAC003', 'JPM', '6285811160395',
  now() - interval '3 hours',
  now() - interval '170 minutes',
  now() - interval '165 minutes',
  now() - interval '160 minutes',
  now() - interval '148 minutes',
  'SELESAI',
  'TIDAK_ADA', 'TIDAK_ADA', 'ADA',
  'TIDAK_ADA', 'TIDAK_ADA',
  now() - interval '140 minutes',
  now() - interval '132 minutes',
  now() - interval '125 minutes',
  'SELESAI', 'LUNAS',
  'SELESAI'
);

insert into trips (
  nopol, no_fo, mobil, vendor, wa,
  created_at, security_in,
  transport_queue, transport_start, transport_end, transport_status,
  fg_assignment, bs_assignment, kasir_assignment,
  fg_queue, fg_status, overall_status
) values (
  'B9369SXS', '3200123460', 'SAL-MAJR002', 'MAJR', '6289655898055',
  now() - interval '25 minutes',
  now() - interval '22 minutes',
  now() - interval '20 minutes',
  now() - interval '14 minutes',
  now() - interval '6 minutes',
  'SELESAI',
  'ADA', 'ADA', 'TIDAK_ADA',
  now() - interval '4 minutes',
  'ANTRI',
  'BERJALAN'
);

insert into queue_entries (trip_id, pos, nopol, no_fo, mobil, queued_at, status)
select id, 'FG', nopol, no_fo, mobil, fg_queue, 'WAITING'
from trips where no_fo = '3200123460';
