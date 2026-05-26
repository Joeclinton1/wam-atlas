import fs from "node:fs";

const modelPath = "data/wam-models.json";
const curationPath = "data/method-curation.json";

const atlas = JSON.parse(fs.readFileSync(modelPath, "utf8"));
const curation = JSON.parse(fs.readFileSync(curationPath, "utf8"));

const curated = curation.models || {};
let applied = 0;

for (const model of atlas.models) {
  const literalArchitecture = curated[model.id];
  if (!literalArchitecture) continue;
  model.literalArchitecture = literalArchitecture;
  if (model.uncertainty?.includes("local extracted paper text not present")) {
    model.uncertainty = "Low to medium; local method text was inspected and normalized into literalArchitecture.";
  }
  applied += 1;
}

fs.writeFileSync(modelPath, `${JSON.stringify(atlas, null, 2)}\n`, "utf8");
console.log(`Applied literalArchitecture curation to ${applied} model entries.`);
