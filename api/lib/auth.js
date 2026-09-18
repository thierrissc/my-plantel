import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "plantel-secure-session-key-4f9b2d8e-2026";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const testHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(
    Buffer.from(testHash, "utf-8"),
    Buffer.from(originalHash, "utf-8")
  );
}

export function createSessionToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(body);
  const signature = hmac.digest("base64url");
  return `${body}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(body);
  const expectedSignature = hmac.digest("base64url");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(signature, "utf-8"),
      Buffer.from(expectedSignature, "utf-8")
    )
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req) {
  let token = null;

  if (req.cookies && req.cookies.plantel_token) {
    token = req.cookies.plantel_token;
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").map((c) => c.trim());
    const found = cookies.find((c) => c.startsWith("plantel_token="));
    if (found) token = decodeURIComponent(found.split("=")[1]);
  }

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") token = parts[1];
  }

  if (!token) return null;
  return verifySessionToken(token);
}
