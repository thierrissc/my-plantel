const rateLimitMap = new Map();

export function checkRateLimit(key, maxAttempts = 5, windowMs = 5 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  record.count += 1;
  return { allowed: true, remaining: maxAttempts - record.count };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) rateLimitMap.delete(key);
    }
  }, 10 * 60 * 1000);
}

export function sanitizeText(str, maxLength = 255) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim()) && email.length <= 120;
}

export function validateImagePayload(dataUrl) {
  if (!dataUrl) return { valid: true };
  if (typeof dataUrl !== "string") return { valid: false, error: "Formato inválido." };
  if (!dataUrl.startsWith("data:image/")) {
    return { valid: false, error: "Apenas imagens são permitidas." };
  }
  const allowed = [
    "data:image/png",
    "data:image/jpeg",
    "data:image/jpg",
    "data:image/webp",
  ];
  if (!allowed.some((t) => dataUrl.startsWith(t))) {
    return { valid: false, error: "Formato de imagem não suportado." };
  }
  const sizeInBytes = (dataUrl.length * 3) / 4;
  if (sizeInBytes > 2 * 1024 * 1024) {
    return { valid: false, error: "A imagem deve ter no máximo 2MB." };
  }
  return { valid: true };
}
