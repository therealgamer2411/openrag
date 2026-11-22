export default function handler(req, res) {
  if (req.method === "GET") return res.status(200).json({ ok: true, service: "openrag-persistence-witness", storage: "vercel-runtime-logs-only" });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ ok: false, error: "invalid_body" });
  const clean = {
    eventId: String(body.eventId || "").slice(0, 100),
    nodeId: String(body.nodeId || "").slice(0, 100),
    source: String(body.source || "unknown").slice(0, 40),
    type: String(body.type || "unknown").slice(0, 80),
    at: String(body.at || "").slice(0, 50),
    detail: body.detail && typeof body.detail === "object" ? body.detail : {}
  };
  const serialized = JSON.stringify(clean);
  if (serialized.length > 3000) return res.status(413).json({ ok: false, error: "payload_too_large" });
  console.log("[OPENRAG_PERSISTENCE_WITNESS]", serialized);
  return res.status(202).json({ ok: true, acceptedAt: new Date().toISOString(), eventId: clean.eventId, storage: "runtime-logs-only" });
}