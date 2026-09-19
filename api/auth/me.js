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
    const cleanId = rawId ? rawId.replace(/^(usr_|user_)/i, "").slice(0, 8).toUpperCase() : "";
    const formattedId = "User_" + cleanId;

    const rows = await query(
      "SELECT id, name, email, avatar FROM plantel_users WHERE id = $1 OR id = $2 OR id = $3 OR email = $4 LIMIT 1",
      [rawId, cleanId, formattedId, session.email || ""]
    );

    if (rows.length === 0) {
      return res.status(401).json({ authenticated: false, error: "Usuário não encontrado." });
    }

    let user = rows[0];
    let userClean = user.id ? user.id.replace(/^(usr_|user_)/i, "").slice(0, 8).toUpperCase() : "";
    let finalId = "User_" + userClean;
    if (user.id !== finalId) {
      try {
        await query("UPDATE plantel_users SET id = $1 WHERE id = $2", [finalId, user.id]);
      } catch (e) {}
      user.id = finalId;
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
