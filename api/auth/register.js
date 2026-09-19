import crypto from "crypto";
import { query } from "../lib/db.js";
import { hashPassword, createSessionToken } from "../lib/auth.js";
import { checkRateLimit, isValidEmail, sanitizeText } from "../lib/security.js";

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

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1";
  const body = await parseBody(req);
  const { nome, email, senha } = body || {};

  const rateKey = `reg:${ip}`;
  const rate = checkRateLimit(rateKey, 5, 10 * 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Muitas tentativas de cadastro. Tente novamente em ${rate.retryAfterSeconds} segundos.`,
    });
  }

  const cleanNome = sanitizeText(nome, 100);
  const cleanEmail = (email || "").trim().toLowerCase();

  if (!cleanNome || cleanNome.length < 2) {
    return res.status(400).json({ error: "Nome inválido (mínimo 2 caracteres)." });
  }
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: "Formato de e-mail inválido." });
  }
  if (!senha || typeof senha !== "string" || senha.length < 6) {
    return res.status(400).json({ error: "A senha deve conter no mínimo 6 caracteres." });
  }

  try {
    const existing = await query("SELECT id FROM plantel_users WHERE email = $1 LIMIT 1", [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const userId = "User_" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const passwordHash = hashPassword(senha);

    await query(
      "INSERT INTO plantel_users (id, name, email, password_hash, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [userId, cleanNome, cleanEmail, passwordHash]
    );

    await query(
      "INSERT INTO plantel_workspaces (user_id, animais, areas, theme, version, updated_at) VALUES ($1, $2, $3, $4, 1, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO NOTHING",
      [userId, "[]", '["Todos"]', "light"]
    );

    const userPayload = {
      id: userId,
      name: cleanNome,
      email: cleanEmail,
      avatar: null,
    };

    const token = createSessionToken(userPayload);
    const isProduction = process.env.NODE_ENV === "production";
    const cookieHeader = `plantel_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${isProduction ? "; Secure" : ""}`;

    res.setHeader("Set-Cookie", cookieHeader);
    return res.status(201).json({
      success: true,
      user: userPayload,
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao criar conta. Tente novamente." });
  }
}
