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
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.2,
    identifierNamesGenerator: "hexadecimal",
    numbersToExpressions: true,
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.8,
    splitStrings: true,
    splitStringsChunkLength: 8,
    sourceMap: false,
  });
  fs.writeFileSync(targetFile, obfResult.getObfuscatedCode(), "utf8");
  console.log("Ofuscacao concluida com sucesso!");
}
