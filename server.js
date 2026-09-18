import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import registerHandler from "./api/auth/register.js";
import loginHandler from "./api/auth/login.js";
import meHandler from "./api/auth/me.js";
import logoutHandler from "./api/auth/logout.js";
import dataHandler from "./api/plantel/data.js";
import profileHandler from "./api/plantel/profile.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.all("/api/auth/register", (req, res) => registerHandler(req, res));
app.all("/api/auth/login", (req, res) => loginHandler(req, res));
app.all("/api/auth/me", (req, res) => meHandler(req, res));
app.all("/api/auth/logout", (req, res) => logoutHandler(req, res));
app.all("/api/plantel/data", (req, res) => dataHandler(req, res));
app.all("/api/plantel/profile", (req, res) => profileHandler(req, res));

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Servidor ativo na porta ${PORT}`);
});
