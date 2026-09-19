import { query } from "../lib/db.js";
import { getUserFromRequest } from "../lib/auth.js";

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  const session = getUserFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Acesso não autorizado. Faça login para continuar." });
  }

  const rawId = session.id || "";
  const cleanId = rawId.replace(/^(usr_|user_)/i, "").slice(0, 8).toUpperCase();
  const formattedId = "User_" + cleanId;

  let canonicalUserId = rawId;
  try {
    const uRows = await query(
      "SELECT id FROM plantel_users WHERE id = $1 OR id = $2 OR id = $3 OR email = $4 LIMIT 1",
      [rawId, cleanId, formattedId, session.email || ""]
    );
    if (uRows.length > 0) {
      canonicalUserId = uRows[0].id;
    }
  } catch (e) {}

  if (req.method === "GET") {
    try {
      const rows = await query(
        `SELECT animais, areas, theme, version, updated_at FROM plantel_workspaces 
         WHERE user_id = $1 OR user_id = $2 OR user_id = $3 OR user_id = $4 LIMIT 1`,
        [canonicalUserId, rawId, cleanId, formattedId]
      );

      if (rows.length === 0) {
        await query(
          "INSERT INTO plantel_workspaces (user_id, animais, areas, theme, version, updated_at) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO NOTHING",
          [canonicalUserId, "[]", '["Todos"]', "light"]
        );
        return res.status(200).json({
          animais: [],
          areas: ["Todos"],
          theme: "light",
          version: 1,
          updated_at: new Date().toISOString(),
        });
      }

      const row = rows[0];
      return res.status(200).json({
        animais: Array.isArray(row.animais) ? row.animais : [],
        areas: Array.isArray(row.areas) ? row.areas : ["Todos"],
        theme: row.theme || "light",
        version: Number(row.version || 1),
        updated_at: row.updated_at,
      });
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar dados do plantel." });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { animais, areas, theme } = body;

      const safeAnimais = Array.isArray(animais) ? JSON.stringify(animais) : "[]";
      const safeAreas = Array.isArray(areas) ? JSON.stringify(areas) : '["Todos"]';
      const safeTheme = typeof theme === "string" && ["light", "dark"].includes(theme) ? theme : "light";

      const updated = await query(
        `INSERT INTO plantel_workspaces (user_id, animais, areas, theme, version, updated_at)
         VALUES ($1, $2::jsonb, $3::jsonb, $4, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE
         SET animais = EXCLUDED.animais,
             areas = EXCLUDED.areas,
             theme = EXCLUDED.theme,
             version = plantel_workspaces.version + 1,
             updated_at = CURRENT_TIMESTAMP
         RETURNING version, updated_at`,
        [canonicalUserId, safeAnimais, safeAreas, safeTheme]
      );

      return res.status(200).json({
        success: true,
        version: Number(updated[0]?.version || 1),
        updated_at: updated[0]?.updated_at,
      });
    } catch (error) {
      return res.status(500).json({ error: "Erro ao sincronizar dados do plantel." });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Método não permitido." });
}
