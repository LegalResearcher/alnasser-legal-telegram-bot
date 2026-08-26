import app from "../../_telegram-webhook-bundle.mjs";

const ADMIN_PREFIX = "/api/telegram/admin/";

function jsonResponse(res, body, status) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default function dispatch(req, res) {
  try {
    const incoming = new URL(req.url || "/", "https://alnaseer.org");
    const rawTarget = incoming.searchParams.get("target") || "";
    const target = decodeURIComponent(rawTarget);
    if (!target.startsWith(ADMIN_PREFIX) || target.includes("?") || target.includes("#")) {
      jsonResponse(res, { ok: false, error: "invalid_admin_target" }, 400);
      return;
    }
    const query = new URLSearchParams(incoming.searchParams);
    query.delete("target");
    req.url = `${target}${query.size ? `?${query.toString()}` : ""}`;
    app(req, res);
  } catch {
    jsonResponse(res, { ok: false, error: "invalid_admin_target" }, 400);
  }
}
