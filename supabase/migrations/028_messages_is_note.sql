alter table messages
  add column if not exists is_note boolean not null default false;
