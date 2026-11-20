\set ON_ERROR_STOP on

\if :{?runtime_password}
\else
  \echo 'runtime_password is required'
  \quit 1
\endif

select format(
  'create role digiman_runtime_test login password %L',
  :'runtime_password'
)
where not exists (
  select 1 from pg_roles where rolname = 'digiman_runtime_test'
)
\gexec

alter role digiman_runtime_test password :'runtime_password';
grant digiman_runtime to digiman_runtime_test;

comment on role digiman_runtime_test is
  'LOGIN role for isolated DigiMan integration databases only';
