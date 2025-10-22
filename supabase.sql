create table if not exists reservations (
  id bigint generated always as identity primary key,
  date date not null,
  hour int not null check (hour between 0 and 23),
  "user" text not null,
  created_at timestamptz default now()
);

alter table reservations enable row level security;

create policy "Public read" on reservations for select using (true);
create policy "Anon insert" on reservations for insert with check (true);
create policy "Anon update" on reservations for update using (true);
create policy "Anon delete" on reservations for delete using (true);


