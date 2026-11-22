\set ON_ERROR_STOP on

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'digiman_runtime') then
    create role digiman_runtime nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'digiman_retention') then
    create role digiman_retention nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'digiman_readonly') then
    create role digiman_readonly nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'digiman_integration_test') then
    create role digiman_integration_test nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end
$$;

revoke create on schema public from public;

grant usage on schema public
  to digiman_runtime, digiman_retention, digiman_readonly, digiman_integration_test;

grant select, insert, update, delete on all tables in schema public
  to digiman_runtime;
revoke update, delete on table audit_logs from digiman_runtime;
revoke update on table analytics_events from digiman_runtime;
revoke insert, update, delete on table quest_search_origins, quest_start_points from digiman_runtime;

grant select, delete on table visitor_sessions, analytics_events, audit_logs
  to digiman_retention;

grant select on all tables in schema public to digiman_readonly;

grant select, insert, update, delete on all tables in schema public
  to digiman_integration_test;

comment on role digiman_runtime is
  'NOLOGIN capability role for application requests; login mapping is external';
comment on role digiman_retention is
  'NOLOGIN capability role for bounded retention deletes';
comment on role digiman_readonly is
  'NOLOGIN capability role for restricted diagnostics';
comment on role digiman_integration_test is
  'NOLOGIN capability role for isolated marker databases only';
