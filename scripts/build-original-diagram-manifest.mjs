import fs from "node:fs";
import path from "node:path";

const atlas = JSON.parse(fs.readFileSync("data/wam-models.json", "utf8"));
const dir = "assets/original-diagrams";
const files = new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".png")));

const models = {};
const missing = [];
for (const model of atlas.models) {
  const fname = `${model.id}.png`;
  if (!files.has(fname)) {
    missing.push(model.id);
    continue;
  }
  models[model.id] = {
    file: `${dir}/${fname}`.replace(/\\/g, "/"),
    caption: `${model.name} — as published in the original paper`
  };
}

fs.writeFileSync(
  "data/original-diagrams.json",
  `${JSON.stringify({ version: "1.0.0", models }, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote manifest for ${Object.keys(models).length}/${atlas.models.length} models.`);
if (missing.length) console.log("Missing images for:", missing.join(", "));
