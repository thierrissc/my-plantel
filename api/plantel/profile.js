import { query } from "../lib/db.js";
import { getUserFromRequest } from "../lib/auth.js";
import { sanitizeText, validateImagePayload } from "../lib/security.js";

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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Método não permitido." });
  }

  const session = getUserFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Acesso não autorizado." });
  }

  try {
    const body = await parseBody(req);
    const { name, avatar } = body;

    const cleanName = name ? sanitizeText(name, 100) : null;
    if (avatar) {
      const imgCheck = validateImagePayload(avatar);
      if (!imgCheck.valid) {
        return res.status(400).json({ error: imgCheck.error });
      }
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (cleanName) {
      updates.push(`name = $${idx++}`);
      values.push(cleanName);
    }
    if (avatar !== undefined) {
      updates.push(`avatar = $${idx++}`);
      values.push(avatar);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "Nenhuma alteração informada." });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(session.id);

    const rows = await query(
      `UPDATE plantel_users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, name, email, avatar`,
      values
    );

    return res.status(200).json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar perfil." });
  }
}
