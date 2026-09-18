import { query } from "../lib/db.js";
import { verifyPassword, createSessionToken } from "../lib/auth.js";
import { checkRateLimit, isValidEmail } from "../lib/security.js";

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
  const { email, senha } = body || {};
  const cleanEmail = (email || "").trim().toLowerCase();

  const rateKey = `login:${ip}:${cleanEmail}`;
  const rate = checkRateLimit(rateKey, 5, 5 * 60 * 1000);
  if (!rate.allowed) {
    return res.status(429).json({
      error: `Muitas tentativas incorretas. Tente novamente em ${rate.retryAfterSeconds} segundos.`,
    });
  }

  if (!cleanEmail || !isValidEmail(cleanEmail) || !senha) {
    return res.status(400).json({ error: "E-mail ou senha incorretos." });
  }

  try {
    const rows = await query(
      "SELECT id, name, email, password_hash, avatar FROM plantel_users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const user = rows[0];
    const passwordValid = verifyPassword(senha, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: "E-mail ou senha incorretos." });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || null,
    };

    const token = createSessionToken(userPayload);
    const isProduction = process.env.NODE_ENV === "production";
    const cookieHeader = `plantel_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}${isProduction ? "; Secure" : ""}`;

    res.setHeader("Set-Cookie", cookieHeader);
    return res.status(200).json({
      success: true,
      user: userPayload,
      token,
    });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao processar login. Tente novamente." });
  }
}
