import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

const LANG_NAMES: Record<string, string> = {
  ru: "Russian",
  en: "English",
  es: "Spanish",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Require an authenticated user — this function consumes the owner's AI quota.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${jwt}` } } },
    );
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { text, sourceLang, targetLangs } = await req.json();

    if (!text || !sourceLang || !targetLangs?.length) {
      return new Response(JSON.stringify({ error: "Missing text, sourceLang or targetLangs" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const targetDescriptions = targetLangs
      .map((l: string) => `"name_${l}": translation in ${LANG_NAMES[l] || l}`)
      .join(", ");

    const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator specializing in business/service names. Return ONLY valid JSON with no extra text. Translate the service/product name preserving its business meaning. Keep proper nouns unchanged.",
          },
          {
            role: "user",
            content: `Translate the following service name from ${LANG_NAMES[sourceLang] || sourceLang} to the target languages. Return a JSON object with keys: ${targetDescriptions}.\n\nService name: "${text}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "Translation failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse translation", raw: content }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const translations = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(translations), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error("translate-service error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
