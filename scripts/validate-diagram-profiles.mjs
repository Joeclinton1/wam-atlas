import fs from "node:fs";

const atlas = JSON.parse(fs.readFileSync("data/wam-models.json", "utf8"));
const profileData = JSON.parse(fs.readFileSync("data/diagram-profiles.json", "utf8"));
const profiles = profileData.models || {};
const errors = [];
const allowedPatterns = new Set(["pixel_idm", "latent_idm", "encoder_only", "joint_latent", "unified", "multi_stream", "implicit_future", "latent_action", "alignment", "multimodal", "online_adaptation", "speedup"]);
const allowedKinds = new Set(["visual", "language", "state", "action", "noise", "future", "value"]);

const fail = (id, message) => errors.push(`${id}: ${message}`);

for (const model of atlas.models) {
  const profile = profiles[model.id];
  if (!profile) {
    fail(model.id, "missing paper-specific profile");
    continue;
  }
  if (profile.review?.status !== "paper-specific") fail(model.id, "profile is not marked paper-specific");
  if (!profile.review?.sourceExtract || !fs.existsSync(profile.review.sourceExtract)) fail(model.id, "missing local method source");
  if (!allowedPatterns.has(profile.pattern)) fail(model.id, `unknown pattern ${profile.pattern}`);
  if (!profile.core?.label || !profile.core?.kind || !profile.core?.details?.length) fail(model.id, "core identity is incomplete");
  if (/world-action core$/i.test(profile.core.label)) fail(model.id, "uses a generic family core label");
  if (!profile.inputs?.length) fail(model.id, "has no reviewed inputs");
  if (!profile.encoders?.length || profile.encoders.some((item) => !item.exact)) fail(model.id, "encoders are not locked to reviewed labels");
  if (!profile.heads?.length || profile.heads.some((item) => !item.exact)) fail(model.id, "heads are not locked to reviewed labels");
  if (!profile.outputs?.length) fail(model.id, "has no reviewed outputs");
  if (!profile.runtime?.length) fail(model.id, "has no reviewed runtime path");
  if (!profile.training?.length) fail(model.id, "has no reviewed training signal");
  for (const item of [...(profile.inputs || []), ...(profile.encoders || []), ...(profile.streams || [])]) {
    if (item.kind && !allowedKinds.has(item.kind)) fail(model.id, `unknown stream kind ${item.kind}`);
  }
  const serialized = JSON.stringify(profile);
  if (/undefined|\bNaN\b/.test(serialized)) fail(model.id, "contains invalid generated content");
}

for (const id of Object.keys(profiles)) {
  if (!atlas.models.some((model) => model.id === id)) fail(id, "profile has no matching atlas paper");
}

const diagramsSource = fs.readFileSync("js/diagrams.js", "utf8");
const cacheKey = diagramsSource.match(/shared\.js\?([^'\"]+)/)?.[1];
if (!cacheKey) throw new Error("Could not determine diagram shared-module cache key");
const [{ state }, { architectureDiagramMarkup }] = await Promise.all([
  import(`../js/shared.js?${cacheKey}`),
  import(`../js/diagrams.js?profile-validation=${cacheKey}`)
]);
state.diagramProfiles = profiles;

for (const model of atlas.models) {
  const profile = profiles[model.id];
  if (!profile) continue;
  for (const options of [{ mini: false }, { mini: true }, { mini: true, gallery: true }]) {
    const markup = architectureDiagramMarkup(model, options);
    if (/undefined|\bNaN\b/.test(markup)) fail(model.id, `invalid ${options.gallery ? "gallery" : options.mini ? "preview" : "full"} SVG markup`);
    if (!markup.includes(profile.core.label)) fail(model.id, `paper-specific core missing from ${options.gallery ? "gallery" : options.mini ? "preview" : "full"} render`);
    if (model.id === "dreamzero") {
      for (const required of ["joint video-action flow matching", "closed-loop real-world execution", "KV cache", "next real observation"]) {
        if (!markup.includes(required)) fail(model.id, `DreamZero ${options.gallery ? "gallery" : options.mini ? "preview" : "full"} render is missing ${required}`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Diagram profile validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`Validated ${atlas.models.length} paper-specific profiles in full, preview, and gallery render modes.`);
