import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Food photo analysis, proxied.
 *
 * The app used to call api.openai.com directly with EXPO_PUBLIC_OPENAI_API_KEY.
 * Anything prefixed EXPO_PUBLIC_ is inlined into the JS bundle at build time,
 * so the key ships inside the APK and IPA and can be read out of either in a
 * couple of minutes. Whoever finds it spends your credit, not theirs.
 *
 * The key now lives only here, as a project secret. verify_jwt is on, so the
 * function is callable by signed-in users of this project and nobody else.
 *
 * Each signed-in user gets DAILY_SCANS analyses per UTC day, counted in the
 * database by claim_scan (20260910_scan_rate_limit.sql). An Edge Function has
 * no memory between invocations, so a counter held here would reset on every
 * cold start and would not be shared between instances.
 *
 * The client sends { base64, mode, prompt }. It never sees a key, and swapping
 * models or providers no longer needs an app release.
 */

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

/** Generous for a real person (three or four meals a day), cheap for a runaway loop. */
const DAILY_SCANS = 20;

/** Kept identical to what the app used to send, so results do not change. */
const SYSTEM = {
  single:
    "You are a nutrition expert. Analyse the food in the image. " +
    "Return strictly a JSON object with keys: name (string), calories (number), protein (number), carbs (number), fats (number), emoji (string), match (number), ingredients (array of strings).",
  multi:
    "You are a nutrition expert. Analyse the food in the image. " +
    "Return strictly a JSON object with a 'meals' array containing exactly 3 objects. Keys for each object: name (string), calories (number), protein (number), carbs (number), fats (number), emoji (string), match (number), ingredients (array of strings).",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  if (!OPENAI_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // A missing secret is a deployment mistake, not a user error. Say so
    // plainly rather than returning an empty analysis that looks like the
    // photo failed.
    return json({ error: "Analysis is not configured on the server." }, 503);
  }

  let payload: { base64?: string; mode?: string; prompt?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Malformed request." }, 400);
  }

  const { base64, mode } = payload;
  if (!base64) return json({ error: "No image supplied." }, 400);

  // A guard on size, not on content. A 20MB body would be billed as tokens
  // before anything rejected it.
  if (base64.length > 8_000_000) {
    return json({ error: "Image is too large. Try again." }, 413);
  }

  // Claimed after the request is known to be usable, so a malformed upload
  // does not cost anyone a scan, and before OpenAI is paid for anything.
  //
  // The client carries the CALLER's Authorization header, not the service
  // role: claim_scan reads auth.uid(), and a service-role client has none.
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return json({ error: "Sign in to scan a meal." }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: remaining, error: limitError } = await supabase.rpc("claim_scan", {
    p_limit: DAILY_SCANS,
  });

  if (limitError) {
    console.error(`claim_scan failed: ${limitError.message}`);
    return json({ error: "Could not check your scan allowance. Try again." }, 503);
  }

  if (remaining === -1) {
    return json(
      {
        error: "That is all the scans for today. The allowance resets at midnight UTC.",
        code: "rate_limited",
      },
      429,
    );
  }

  const system = mode === "multi" ? SYSTEM.multi : SYSTEM.single;
  const userText = payload.prompt ?? "What is in this image?";

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 800,
      }),
    });

    if (!upstream.ok) {
      // Upstream text can carry account details, so it is logged rather than
      // returned to the device.
      const detail = await upstream.text();
      console.error(`OpenAI ${upstream.status}: ${detail.slice(0, 300)}`);
      return json({ error: "Could not analyse this photo. Try again." }, 502);
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "Empty response from the model." }, 502);

    // Parsed here so a malformed model reply fails on the server, where it can
    // be logged, rather than throwing inside the camera screen.
    try {
      return json({ result: JSON.parse(content) });
    } catch {
      console.error(`Unparseable model content: ${String(content).slice(0, 300)}`);
      return json({ error: "Could not read the analysis. Try again." }, 502);
    }
  } catch (e) {
    console.error(`Proxy failure: ${e instanceof Error ? e.message : String(e)}`);
    return json({ error: "Analysis is unavailable right now." }, 502);
  }
});
