import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JavaScriptObfuscator from "javascript-obfuscator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcFile = path.join(__dirname, "js", "app.src.js");
const targetFile = path.join(__dirname, "js", "app.js");

if (fs.existsSync(srcFile)) {
  const jsSrc = fs.readFileSync(srcFile, "utf8");
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
