import { query } from "../lib/db.js";
import { getUserFromRequest } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Método não permitido." });
  }

  const session = getUserFromRequest(req);
  if (!session) {
    return res.status(401).json({ authenticated: false, error: "Não autenticado." });
  }

  try {
    const rawId = session.id;
    const shortId =
      rawId && rawId.length > 8
        ? (rawId.toLowerCase().startsWith("usr_") ? rawId.slice(4, 12) : rawId.slice(0, 8)).toUpperCase()
        : rawId;

    const rows = await query(
      "SELECT id, name, email, avatar FROM plantel_users WHERE id = $1 OR id = $2 LIMIT 1",
      [rawId, shortId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ authenticated: false, error: "Usuário não encontrado." });
    }

    let user = rows[0];
    if (user.id && user.id.length > 8) {
      const fixedId = (user.id.toLowerCase().startsWith("usr_") ? user.id.slice(4, 12) : user.id.slice(0, 8)).toUpperCase();
      try {
        await query("UPDATE plantel_users SET id = $1 WHERE id = $2", [fixedId, user.id]);
        await query("UPDATE plantel_workspaces SET user_id = $1 WHERE user_id = $2", [fixedId, user.id]);
      } catch (e) {}
      user.id = fixedId;
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao verificar autenticação." });
  }
}
