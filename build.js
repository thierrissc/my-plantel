import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcFile = path.join(__dirname, "js", "app.src.js");
const targetFile = path.join(__dirname, "js", "app.js");
const srcHtmlFile = path.join(__dirname, "index.src.html");
const targetHtmlFile = path.join(__dirname, "index.html");

if (fs.existsSync(targetHtmlFile) && !fs.existsSync(srcHtmlFile)) {
  fs.copyFileSync(targetHtmlFile, srcHtmlFile);
}

let bodyHtmlPayload = "";
if (fs.existsSync(srcHtmlFile)) {
  const htmlRaw = fs.readFileSync(srcHtmlFile, "utf8");
  const bodyMatch = htmlRaw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    let innerBody = bodyMatch[1];
    innerBody = innerBody.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").trim();
    bodyHtmlPayload = encodeURIComponent(innerBody);
  }

  const securedHtml = `<!DOCTYPE html>
<html lang="pt-BR" data-theme="light">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Plantel - Gestão de Animais</title>
  <link rel="icon" type="image/png" href="img/favicon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Noto+Emoji:wght@400&display=swap"
    rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css?v=3.8" />
  <link rel="preload" as="image" href="img/loginicon.png" />
</head>

<body>
  <div id="app-root"></div>
  <script src="js/app.js?v=3.8"></script>
</body>

</html>`;

  fs.writeFileSync(targetHtmlFile, securedHtml, "utf8");
}

if (fs.existsSync(srcFile)) {
  let jsSrc = fs.readFileSync(srcFile, "utf8");
  if (bodyHtmlPayload) {
    jsSrc = `const _0x_app_tpl = "${bodyHtmlPayload}";\n` + jsSrc;
  }
  const obfResult = JavaScriptObfuscator.obfuscate(jsSrc, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: false,
    identifierNamesGenerator: "hexadecimal",
    numbersToExpressions: false,
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: [],
    stringArrayThreshold: 0.75,
    splitStrings: false,
    sourceMap: false,
    target: "browser-no-eval",
  });
  fs.writeFileSync(targetFile, obfResult.getObfuscatedCode(), "utf8");
  console.log("Ofuscacao concluida com sucesso!");
}
