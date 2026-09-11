# Rate limiting `analyse-food`

The function is not in this repo yet. Pull it down first:

```bash
supabase functions download analyse-food
```

Then add this as the first thing the handler does, after it has the caller's JWT
and before it calls OpenAI:

```ts
// One scan claimed per request, counted in the database. An Edge Function has
// no memory between invocations, so an in-process counter would reset on every
// cold start and would not be shared across instances.
const { data: remaining, error: limitError } = await supabase.rpc('claim_scan', {
  p_limit: 20,
});

if (limitError) {
  return new Response(
    JSON.stringify({ error: 'Could not check your scan allowance.' }),
    { status: 503, headers: { 'Content-Type': 'application/json' } },
  );
}

if (remaining === -1) {
  return new Response(
    JSON.stringify({
      error: 'That is all the scans for today. The allowance resets at midnight UTC.',
      code: 'rate_limited',
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } },
  );
}
```

The `supabase` client inside the function must be created with the CALLER's
Authorization header, not the service role key — `claim_scan` reads `auth.uid()`
and a service-role client has none, so every request would be refused.

Apply the migration first:

```bash
supabase db push
```

`20` is a starting point. A person eats three or four times a day; twenty is
generous for a real user and cheap enough that a runaway loop stops costing
money within a minute.
