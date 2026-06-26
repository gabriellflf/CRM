-- Add CPF and description fields to contacts table
alter table contacts
  add column if not exists cpf text,
  add column if not exists description text;
