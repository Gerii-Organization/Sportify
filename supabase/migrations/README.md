# Applying these

Neither the Supabase MCP tools nor the CLI could reach the project from the
session that wrote them: every MCP call returns
`"You do not have permission to perform this action"`, and the CLI is not
logged in. So they are written to be run by hand and to fail safely.

## Order

1. `20260910_scan_rate_limit.sql` — creates `scan_usage` and `claim_scan`.
   Creates only, drops nothing. Safe to run at any time.
2. `20260911_browse_by_author_and_saves.sql` — replaces `browse_workouts`.
   **Browse in the app is already calling the new signature**, so until this
   runs the screen shows an error rather than a list.

## How

Supabase Dashboard → SQL Editor → paste the whole file → Run.

Or, with the CLI:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## Before running the second one

It references `public.saved_workouts`. That name was inferred from the existing
`toggle_saved_workout` and `get_saved_workouts` functions, not read from the
schema. The migration checks for it first and aborts with a clear message if it
is wrong, inside a transaction, so nothing is dropped either way.

To check ahead of time:

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like '%save%';
```

If the real table is called something else, change every `saved_workouts` in
the migration to match before running it.

## Rolling back the second one

There is no down migration. If the new `browse_workouts` misbehaves, the old
three-argument version is in the project's migration history — restore it and
change `fetchPublicWorkouts` in `src/screens/TrainingScreen.js` to stop sending
`p_sort`.
