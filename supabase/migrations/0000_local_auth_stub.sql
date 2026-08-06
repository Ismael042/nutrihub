-- Stub do schema `auth` do Supabase, só para o Postgres local do Docker Compose
-- ter paridade de schema com o Supabase cloud (que já provê isso de verdade).
-- Nunca roda em produção — lá quem aplica as migrations é o projeto Supabase real.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
