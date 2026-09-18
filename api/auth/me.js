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
    const rows = await query(
      "SELECT id, name, email, avatar FROM plantel_users WHERE id = $1 LIMIT 1",
      [session.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ authenticated: false, error: "Usuário não encontrado." });
    }

    return res.status(200).json({
      authenticated: true,
      user: rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao verificar autenticação." });
  }
}
