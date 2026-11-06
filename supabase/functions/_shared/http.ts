// CORS and JSON helpers shared by every Edge Function.
// shortcut: allows any origin; restrict to the deployed domains once they are known (spec §12).
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Thai message for the UI; status says what kind of failure it was.
export const fail = (message: string, status = 400) => json({ error: message }, status)
