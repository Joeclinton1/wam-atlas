import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const modelsPath = path.join(root, "data", "wam-models.json");
const curationPath = path.join(root, "data", "method-curation.json");
const overridesPath = path.join(root, "data", "metric-overrides.json");
const modelsData = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
const curation = JSON.parse(fs.readFileSync(curationPath, "utf8"));
const metricOverrides = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
  : { models: {} };

const benchmarkPatterns = [
  ["robotwinAllData", /\brobo\s*twin\b|\brobotwin\b/i, -3],
  ["robotwinTaskSpecific", /\brobo\s*twin\b|\brobotwin\b/i, 1],
  ["liberoPro", /\blibero[- ]?pro\b/i, 3],
  ["liberoPlus", /\blibero[- ]?plus\b/i, 2],
  ["libero", /\blibero\b/i, 1],
  ["simpler", /\bsimpler(?:env)?\b/i, 0],
  ["robocasa", /\brobo\s*casa\b|\brobocasa\b/i, -1]
];
const targetBenchmarkKeys = new Set(benchmarkPatterns.map(([id]) => id));
const defaultAccuracyBenchmarkKeys = new Set(["simpler", "robocasa", "liberoPlus", "liberoPro", "robotwinAllData", "robotwinTaskSpecific"]);
const strictUnseenTaskPattern = /\b(?:real[- ]?world|real robot|hardware|robot)\b(?=[\s\S]{0,140}\b(?:unseen|novel|new|ood|out[- ]?of[- ]?distribution|zero[- ]?shot|transfer)\b)|\b(?:unseen|novel|new|ood|out[- ]?of[- ]?distribution|zero[- ]?shot|transfer)\b(?=[\s\S]{0,140}\b(?:task|tasks|object|objects|environment|environments|scenario|scenarios|scene|scenes|category|quantity|real[- ]?world|real robot|hardware)\b)|category generalization|quantity generalization/i;
const excludedLiberoVariantPattern = /\blibero[- ]?(?:long|10)\b|\blibero10\b/i;

const contextSignals = {
  generalization: /real[- ]?world|real robot|hardware|unseen|novel|ood|out[- ]?of[- ]?distribution|distractor|new task|new object|generalization|generalisation/i,
  broadEvidence: /calvin|metaworld|bridge(?:data|v2)?|droid|language table|open x[- ]embodiment|oxe|real[- ]?world|real robot|on hardware/i
};

const familyAccuracyAdjust = {
  pixel_idm: -4,
  latent_idm: -1,
  encoder_only: 4,
  joint_latent: 3,
  unified: 2,
  multi_stream: 4,
  implicit_future: 1,
  latent_action: 4,
  alignment: 1,
  multimodal: 3,
  online_adaptation: 2,
  speedup: 2
};

const familyInferenceAdjust = {
  pixel_idm: 0.42,
  latent_idm: 0.78,
  encoder_only: 2.4,
  joint_latent: 1.05,
  unified: 0.72,
  multi_stream: 0.9,
  implicit_future: 1.45,
  latent_action: 1.8,
  alignment: 1.2,
  multimodal: 0.9,
  online_adaptation: 1.25,
  speedup: 2.1
};

const computeBase = [0, 90, 320, 1400, 7600, 36000];
const finetuneBase = [0, 10, 28, 75, 210, 520];
const runtimeBaseFps = [0, 64, 28, 11, 3.8, 1.1];
const numberWords = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  sixteen: 16,
  thirtytwo: 32,
  "thirty-two": 32,
  sixtyfour: 64,
  "sixty-four": 64,
  eighty: 80
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roundFps(value) {
  if (!Number.isFinite(value)) return value;
  return round(value, value < 1 ? 2 : 1);
}

function parseCount(value) {
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, "");
  if (numberWords[normalized] != null) return numberWords[normalized];
  const numeric = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function arraysFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value).flatMap(arraysFrom);
  return [String(value)];
}

function methodText(model) {
  const curated = curation.models?.[model.id] || {};
  const parts = [
    model.title,
    model.name,
    model.category,
    model.problem,
    model.oneLine,
    model.insights,
    model.diagram,
    model.literalArchitecture,
    curated
  ].flatMap(arraysFrom);
  for (const candidate of [model.literalArchitecture?.sourceExtract, curated.sourceExtract]) {
    if (!candidate) continue;
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) parts.push(fs.readFileSync(full, "utf8"));
  }
  return parts.join("\n");
}

function shortExcerpt(text, limit = 24) {
  const words = text.replace(/^\s*\d+:\s*/, "").replace(/\s+/g, " ").trim().split(/\s+/);
  return words.slice(0, limit).join(" ");
}

function sourceFilesFor(model) {
  const files = new Set();
  const curated = curation.models?.[model.id] || {};
  [model.literalArchitecture?.sourceExtract, curated.sourceExtract].forEach((candidate) => {
    if (!candidate) return;
    const full = path.join(root, candidate);
    if (fs.existsSync(full)) files.add(candidate);
  });
  return [...files];
}

function categoryEvidence(model) {
  const patterns = {
    accuracy: /success rate|accuracy|benchmark|robotwin|robocasa|libero|simpler|real[- ]?world|unseen|novel|ood|outperform/i,
    compute: /gpu[- ]?hours?|a100|h100|4090|training step|train(?:ed|ing)? for|batch size|parameters|billion|pretrain/i,
    inference: /inference|fps|hz|denoising steps?|sampling steps?|action-level|action chunk|throughput|parameters|tokens/i,
    generalization: /generalization|generalisation|unseen|novel|out[- ]?of[- ]?distribution|improvement|improves|outperform|transfer/i
  };
  const evidence = Object.fromEntries(Object.keys(patterns).map((key) => [key, []]));
  for (const source of sourceFilesFor(model)) {
    const lines = fs.readFileSync(path.join(root, source), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const clean = line.replace(/\s+/g, " ").trim();
      if (clean.length < 28) return;
      if (excludedLiberoVariantPattern.test(clean)) return;
      for (const [key, pattern] of Object.entries(patterns)) {
        if (evidence[key].length >= 3) continue;
        if (!pattern.test(clean)) continue;
        evidence[key].push({
          source,
          line: index + 1,
          excerpt: shortExcerpt(clean)
        });
      }
    });
  }
  return evidence;
}

function fallbackExcerpts(model, preferred = []) {
  if (preferred.length) return preferred;
  const files = sourceFilesFor(model);
  for (const source of files) {
    const lines = fs.readFileSync(path.join(root, source), "utf8").split(/\r?\n/);
    const picked = [];
    lines.forEach((line, index) => {
      if (picked.length >= 2) return;
      const clean = line.replace(/\s+/g, " ").trim();
      if (clean.length < 40 || clean.length > 240) return;
      if (excludedLiberoVariantPattern.test(clean)) return;
      if (/method|experiment|evaluation|benchmark|training|inference|result|general/i.test(clean)) {
        picked.push({ source, line: index + 1, excerpt: shortExcerpt(clean) });
      }
    });
    if (picked.length) return picked;
  }
  return [{
    source: model.literalArchitecture?.sourceExtract || model.localText || "survey-json",
    line: null,
    excerpt: "No metric-specific sentence was found; estimate falls back to architecture metadata and atlas normalization priors."
  }];
}

function evidenceSnippets(text) {
  const lines = text.split(/\r?\n/);
  const patterns = [
    /success rate|accuracy|benchmark|robotwin|robocasa|libero|simpler|gpu hours?|gpu-hours?|a100|h100|4090|fps|hz|denoising steps?|sampling steps?|parameters/i,
    /outperform|improvement|improves|generalization|generalisation|novel task|unseen/i
  ];
  const snippets = [];
  lines.forEach((line, index) => {
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean.length < 28 || clean.length > 260) return;
    if (excludedLiberoVariantPattern.test(clean)) return;
    if (patterns.some((pattern) => pattern.test(clean))) {
      snippets.push({ sourceLine: index + 1, text: clean });
    }
  });
  return snippets.slice(0, 8);
}

function extractNumbers(text) {
  const gpuHours = [];
  const fps = [];
  const paramsB = [];
  const denoisingSteps = [];
  const actionTokens = [];
  const push = (target, regex, transform = Number) => {
    for (const match of text.matchAll(regex)) {
      const raw = String(match[1]).replace(/,/g, "");
      const value = transform(raw, match);
      if (Number.isFinite(value)) target.push(value);
    }
  };
  push(gpuHours, /(?:roughly|about|around|approximately|~|∼|≈)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*GPU[- ]?hours?/gi);
  for (const match of text.matchAll(/(.{0,80})(?:about|around|close to|near|~|∼|≈)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:fps|frames per second|Hz)\b(.{0,80})/gi)) {
    const context = `${match[1]} ${match[3]}`;
    const value = Number(match[2]);
    if (
      Number.isFinite(value) &&
      /inference|policy|model|control|action-level|action chunk|frequency|throughput/i.test(context) &&
      !/low-level|wbc|controller|servo|simulation step/i.test(context)
    ) {
      fps.push(value);
    }
  }
  push(paramsB, /([0-9]+(?:\.[0-9]+)?)\s*(?:B|billion)\s*(?:trainable\s*)?parameters/gi);
  push(paramsB, /([0-9]+(?:\.[0-9]+)?)\s*B\b/gi);
  for (const match of text.matchAll(/([0-9]+)\s+(?:denoising|sampling)\s+steps?/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) denoisingSteps.push(value);
  }
  for (const match of text.matchAll(/(?:denoising|sampling)\s+steps?\s*(?:=|:|set to|uses|use)?\s*([0-9]+)/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) denoisingSteps.push(value);
  }
  for (const match of text.matchAll(/(?:use|uses|used|with)\s+([0-9]+)\s+steps?\s+(?:for\s+)?(?:denoising|sampling)/gi)) {
    const value = Number(match[1]);
    if (Number.isFinite(value)) denoisingSteps.push(value);
  }
  push(actionTokens, /(?:N|M|h|chunk|tokens?)\s*=?\s*([0-9]+)\s*(?:latent action|action tokens?|actions?)/gi);
  return {
    gpuHours: [...new Set(gpuHours)].filter((value) => value > 0).slice(0, 8),
    fps: [...new Set(fps)].filter((value) => value > 0 && value <= 300).slice(0, 8),
    paramsB: [...new Set(paramsB)].filter((value) => value > 0 && value <= 100).slice(0, 8),
    denoisingSteps: [...new Set(denoisingSteps)].filter((value) => value > 0 && value <= 200).slice(0, 8),
    actionTokens: [...new Set(actionTokens)].filter((value) => value > 0 && value <= 256).slice(0, 8)
  };
}

function detectedBenchmarks(text) {
  const keys = [];
  for (const [id, pattern] of benchmarkPatterns) {
    if (!pattern.test(text)) continue;
    if (id === "robotwinAllData") {
      if (/multi[- ]task|all models are trained|trained on (?:the )?robo\s*twin|randomized multi[- ]task|all data|50\+ tasks/i.test(text)) keys.push(id);
      continue;
    }
    if (id === "robotwinTaskSpecific") {
      if (/single[- ]task|task[- ]specific|per[- ]task|for each task/i.test(text)) keys.push(id);
      continue;
    }
    keys.push(id);
  }
  if ((/\brobo\s*twin\b|\brobotwin\b/i).test(text) && !keys.includes("robotwinAllData") && !keys.includes("robotwinTaskSpecific")) {
    keys.push("robotwinAllData");
  }
  return [...new Set(keys)];
}

function estimateAccuracy(model, benchmarks, snippets) {
  const evidence = Number(model.metrics?.evidence || 3);
  const compute = Number(model.metrics?.computeScale || 3);
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const year = Number(model.year || 2024);
  const recent = clamp((year - 2023) * 3.2, 0, 10);
  const benchBoost = Math.min(6, benchmarks.length * 1.5);
  const keywordBoost = snippets.some((s) => /outperform|state-of-the-art|improves|improvement/i.test(s.text)) ? 3 : 0;
  const score = clamp(
    42 + evidence * 6.4 + compute * 1.7 - runtime * 0.8 + recent + (familyAccuracyAdjust[model.family] || 0) + benchBoost + keywordBoost,
    34,
    92
  );
  return round(score, 1);
}

function accuracyTerms(model, benchmarks, snippets) {
  const evidence = Number(model.metrics?.evidence || 3);
  const compute = Number(model.metrics?.computeScale || 3);
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const year = Number(model.year || 2024);
  const recent = clamp((year - 2023) * 3.2, 0, 10);
  const benchBoost = Math.min(6, benchmarks.length * 1.5);
  const keywordBoost = snippets.some((s) => /outperform|state-of-the-art|improves|improvement/i.test(s.text)) ? 3 : 0;
  const familyAdjust = familyAccuracyAdjust[model.family] || 0;
  const raw = 42 + evidence * 6.4 + compute * 1.7 - runtime * 0.8 + recent + familyAdjust + benchBoost + keywordBoost;
  return { evidence, compute, runtime, recent: round(recent, 1), familyAdjust, benchBoost: round(benchBoost, 1), keywordBoost, raw: round(raw, 1) };
}

function estimateCompute(model, numbers, text) {
  const computeScale = Number(model.metrics?.computeScale || 3);
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const params = numbers.paramsB.length ? Math.max(...numbers.paramsB) : 0;
  const largeGpuHours = numbers.gpuHours.filter((value) => value >= 1000);
  const reportedPretrain = largeGpuHours.length ? largeGpuHours.reduce((sum, value) => sum + value, 0) : null;
  const explicitFinetune = numbers.gpuHours.filter((value) => value > 0 && value < 1000);
  const paramMultiplier = params >= 7 ? 2.2 : params >= 3 ? 1.45 : params >= 1 ? 1.16 : 1;
  const fromScratch = /from scratch|train(?:ed)? .*scratch|pretrain(?:ed|ing)? .*large-scale|foundation/i.test(text);
  const pretrainingGpuHours = reportedPretrain ?? computeBase[computeScale] * paramMultiplier * (fromScratch ? 1.35 : 0.78);
  const finetuningGpuHours5h = explicitFinetune.length
    ? Math.min(...explicitFinetune) * (/20 downstream tasks|20 tasks|across 20/i.test(text) ? 0.05 : 0.28)
    : finetuneBase[computeScale] * (runtime >= 4 ? 1.25 : 1);
  return {
    pretrainingGpuHours: Math.round(clamp(pretrainingGpuHours, 8, 120000)),
    finetuningGpuHours5h: round(clamp(finetuningGpuHours5h, 1, 1800), 1)
  };
}

function computeTerms(model, numbers, text) {
  const computeScale = Number(model.metrics?.computeScale || 3);
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const params = numbers.paramsB.length ? Math.max(...numbers.paramsB) : 0;
  const largeGpuHours = numbers.gpuHours.filter((value) => value >= 1000);
  const explicitFinetune = numbers.gpuHours.filter((value) => value > 0 && value < 1000);
  const paramMultiplier = params >= 7 ? 2.2 : params >= 3 ? 1.45 : params >= 1 ? 1.16 : 1;
  const fromScratch = /from scratch|train(?:ed)? .*scratch|pretrain(?:ed|ing)? .*large-scale|foundation/i.test(text);
  const scratchMultiplier = fromScratch ? 1.35 : 0.78;
  const finetuneMultiplier = runtime >= 4 ? 1.25 : 1;
  return {
    computeScale,
    runtime,
    paramsB: params || null,
    reportedLargeGpuHours: largeGpuHours,
    reportedFinetuneGpuHours: explicitFinetune,
    paramMultiplier,
    scratchMultiplier,
    finetuneMultiplier
  };
}

function estimateInference(model, numbers, text) {
  if (numbers.fps.length) {
    const explicit = Math.max(...numbers.fps);
    return round(clamp(explicit, 0.2, 220), 1);
  }
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const compute = Number(model.metrics?.computeScale || 3);
  const steps = numbers.denoisingSteps.length ? Math.max(...numbers.denoisingSteps) : 0;
  const params = numbers.paramsB.length ? Math.max(...numbers.paramsB) : 0;
  const diffusionPenalty = /diffusion|denois|flow matching/i.test(text) ? (steps ? Math.sqrt(steps / 8) : 1.28) : 1;
  const paramPenalty = params >= 7 ? 1.7 : params >= 3 ? 1.35 : params >= 1 ? 1.15 : 1;
  const fps = runtimeBaseFps[runtime] * (familyInferenceAdjust[model.family] || 1) / diffusionPenalty / paramPenalty / (compute >= 5 ? 1.12 : 1);
  return round(clamp(fps, 0.15, 220), 1);
}

function inferenceTerms(model, numbers, text) {
  const runtime = Number(model.metrics?.runtimeCost || 3);
  const compute = Number(model.metrics?.computeScale || 3);
  const steps = numbers.denoisingSteps.length ? Math.max(...numbers.denoisingSteps) : 0;
  const params = numbers.paramsB.length ? Math.max(...numbers.paramsB) : 0;
  const diffusionPenalty = /diffusion|denois|flow matching/i.test(text) ? (steps ? Math.sqrt(steps / 8) : 1.28) : 1;
  const paramPenalty = params >= 7 ? 1.7 : params >= 3 ? 1.35 : params >= 1 ? 1.15 : 1;
  const computePenalty = compute >= 5 ? 1.12 : 1;
  const familyMultiplier = familyInferenceAdjust[model.family] || 1;
  return {
    runtime,
    compute,
    reportedFps: numbers.fps,
    baseFps: runtimeBaseFps[runtime],
    familyMultiplier,
    denoisingSteps: steps || null,
    diffusionPenalty: round(diffusionPenalty, 2),
    paramsB: params || null,
    paramPenalty,
    computePenalty
  };
}

function estimateGeneralization(model, accuracy, snippets, benchmarks) {
  const evidence = Number(model.metrics?.evidence || 3);
  const keywordBoost = snippets.filter((s) => /real[- ]?world|real robot|unseen|novel|ood|out[- ]?of[- ]?distribution|generalization|generalisation|improvement|improves/i.test(s.text)).length;
  const realWorldTransfer = contextSignals.generalization.test(snippets.map((s) => s.text).join(" ")) ? 1 : 0;
  const benchmarkBoost = Math.min(10, benchmarks.length * 1.2);
  const value = (accuracy - 50) * 0.42 + evidence * 2.4 + keywordBoost * 2.2 + benchmarkBoost + realWorldTransfer * 10;
  return round(clamp(value, 3, 72), 1);
}

function generalizationTerms(model, accuracy, snippets, benchmarks) {
  const evidence = Number(model.metrics?.evidence || 3);
  const keywordBoost = snippets.filter((s) => /real[- ]?world|real robot|unseen|novel|ood|out[- ]?of[- ]?distribution|generalization|generalisation|improvement|improves/i.test(s.text)).length;
  const realWorldTransfer = contextSignals.generalization.test(snippets.map((s) => s.text).join(" ")) ? 1 : 0;
  const benchmarkBoost = Math.min(10, benchmarks.length * 1.2);
  const raw = (accuracy - 50) * 0.42 + evidence * 2.4 + keywordBoost * 2.2 + benchmarkBoost + realWorldTransfer * 10;
  return { accuracy, evidence, keywordBoost, benchmarkBoost: round(benchmarkBoost, 1), realWorldTransfer, raw: round(raw, 1) };
}

function metricAudit(model, text, snippets, numbers, benchmarks, values) {
  const excerpts = categoryEvidence(model);
  const accuracyEvidence = fallbackExcerpts(model, excerpts.accuracy);
  const computeEvidence = fallbackExcerpts(model, excerpts.compute);
  const inferenceEvidence = fallbackExcerpts(model, excerpts.inference);
  const generalizationEvidence = fallbackExcerpts(model, excerpts.generalization);
  const accuracy = accuracyTerms(model, benchmarks, snippets);
  const compute = computeTerms(model, numbers, text);
  const inference = inferenceTerms(model, numbers, text);
  const generalization = generalizationTerms(model, values.accuracy, snippets, benchmarks);
  const scoreFormula = "clamp(42 + 6.4*evidence + 1.7*computeScale - 0.8*runtimeCost + recency + familyAdjust + benchmarkBoost + claimBoost, 34, 92)";
  const pretrainingFormula = compute.reportedLargeGpuHours.length
    ? "sum(reported GPU-hours >= 1000)"
    : "baseGpuHours[computeScale] * parameterMultiplier * scratchOrPretrainMultiplier";
  const finetuneFormula = compute.reportedFinetuneGpuHours.length
    ? "min(reported fine-tune GPU-hours) * task-count/data normalization"
    : "fineTuneBase[computeScale] * runtimeMultiplier, standardized to 5h task data";
  const inferenceFormula = inference.reportedFps.length
    ? "max(reported model/policy inference FPS or Hz)"
    : "runtimeBaseFps[runtimeCost] * familyMultiplier / diffusionPenalty / parameterPenalty / computePenalty";
  const generalizationFormula = "clamp((accuracy - 50)*0.42 + evidence*2.4 + realWorldUnseenClaim*10 + keywordClaimCount*2.2 + benchmarkCount*1.2, 3, 72)";
  return {
    accuracy: {
      displayedValue: values.accuracy,
      unit: "normalized success score",
      assumptions: {
        evidence: accuracy.evidence,
        computeScale: accuracy.compute,
        runtimeCost: accuracy.runtime,
        recency: accuracy.recent,
        familyAdjust: accuracy.familyAdjust,
        benchmarkBoost: accuracy.benchBoost,
        claimBoost: accuracy.keywordBoost,
        benchmarkKeys: benchmarks
      },
      formula: scoreFormula,
      calculation: `${scoreFormula} = ${values.accuracy}`,
      sourceExcerpts: accuracyEvidence
    },
    computePretraining: {
      displayedValue: values.pretrainingGpuHours,
      unit: "GPU-hours",
      assumptions: {
        computeScale: compute.computeScale,
        parameterB: compute.paramsB,
        reportedLargeGpuHours: compute.reportedLargeGpuHours,
        parameterMultiplier: compute.paramMultiplier,
        scratchOrPretrainMultiplier: compute.scratchMultiplier
      },
      formula: pretrainingFormula,
      calculation: `${pretrainingFormula} = ${values.pretrainingGpuHours} GPUh`,
      sourceExcerpts: computeEvidence
    },
    computeFinetuning: {
      displayedValue: values.finetuningGpuHours5h,
      unit: "GPU-hours for 300 one-minute episodes",
      assumptions: {
        computeScale: compute.computeScale,
        runtimeCost: compute.runtime,
        reportedFineTuneGpuHours: compute.reportedFinetuneGpuHours,
        runtimeMultiplier: compute.finetuneMultiplier
      },
      formula: finetuneFormula,
      calculation: `${finetuneFormula} = ${values.finetuningGpuHours5h} GPUh`,
      sourceExcerpts: computeEvidence
    },
    inference: {
      displayedValue: values.fps4090,
      unit: "RTX 4090 action-level FPS",
      assumptions: {
        runtimeCost: inference.runtime,
        computeScale: inference.compute,
        reportedFps: inference.reportedFps,
        runtimeBaseFps: inference.baseFps,
        familyMultiplier: inference.familyMultiplier,
        denoisingSteps: inference.denoisingSteps,
        diffusionPenalty: inference.diffusionPenalty,
        parameterB: inference.paramsB,
        parameterPenalty: inference.paramPenalty,
        computePenalty: inference.computePenalty
      },
      formula: inferenceFormula,
      calculation: `${inferenceFormula} = ${values.fps4090} FPS`,
      sourceExcerpts: inferenceEvidence
    },
    generalization: {
      displayedValue: values.generalization,
      unit: "normalized percent improvement",
      assumptions: {
        accuracy: generalization.accuracy,
        evidence: generalization.evidence,
        keywordClaimCount: generalization.keywordBoost,
        benchmarkBoost: generalization.benchmarkBoost,
        realWorldUnseenClaim: generalization.realWorldTransfer
      },
      formula: generalizationFormula,
      calculation: `${generalizationFormula} = ${values.generalization}%`,
      sourceExcerpts: generalizationEvidence
    }
  };
}

function benchmarkAudit(model, benchmarks, accuracyValue) {
  const accuracyEvidence = fallbackExcerpts(model, categoryEvidence(model).accuracy);
  return Object.fromEntries(benchmarks.map((id) => {
    const offset = benchmarkPatterns.find(([key]) => key === id)?.[2] || 0;
    const value = round(clamp(accuracyValue + offset, 0, 100), 1);
    return [id, {
      displayedValue: value,
      unit: "normalized benchmark score",
      assumptions: { estimatedScore: accuracyValue, benchmarkOffset: offset },
      formula: "clamp(estimatedAccuracy + benchmarkDifficultyOffset, 0, 100)",
      calculation: `clamp(${accuracyValue} + ${offset}, 0, 100) = ${value}`,
      sourceExcerpts: accuracyEvidence
    }];
  }));
}

function confidenceFor(model, snippets, numbers, benchmarks) {
  const evidence = Number(model.metrics?.evidence || 3);
  const factCount = snippets.length + numbers.gpuHours.length + numbers.fps.length + benchmarks.length;
  if (evidence >= 5 && factCount >= 6) return "medium-high";
  if (evidence >= 4 && factCount >= 4) return "medium";
  if (factCount >= 3) return "medium-low";
  return "low";
}

function extractionWarnings(model, numbers, benchmarks, audit) {
  const warnings = [];
  if (!benchmarks.length) warnings.push("no benchmark key detected; estimated accuracy uses atlas priors");
  if (!numbers.gpuHours.length) warnings.push("no explicit GPU-hour value detected; compute uses scale/parameter estimate");
  if (!numbers.fps.length) warnings.push("no explicit model inference FPS/Hz detected; inference uses architecture estimate");
  if (!numbers.denoisingSteps.length && /diffusion|denois|flow matching/i.test(methodText(model))) warnings.push("diffusion-like method without detected denoising-step count");
  for (const [key, value] of Object.entries(audit || {})) {
    if (value?.sourceExcerpts?.some((item) => item.line == null)) warnings.push(`${key} uses fallback evidence excerpt`);
  }
  return [...new Set(warnings)];
}

function extractionQuality(confidence, warnings) {
  if (confidence === "medium-high" && warnings.length <= 1) return "strong-auto";
  if ((confidence === "medium-high" || confidence === "medium") && warnings.length <= 2) return "usable-auto";
  if (warnings.length <= 3) return "needs-review";
  return "weak-auto";
}

function scoreFromReported(value) {
  if (value == null) return null;
  if (typeof value === "number") return value <= 1 ? round(value * 100, 1) : round(value, 1);
  if (Array.isArray(value)) {
    const values = value.map(scoreFromReported).filter(Number.isFinite);
    return values.length ? round(values.reduce((sum, item) => sum + item, 0) / values.length, 1) : null;
  }
  if (typeof value === "object") {
    const values = Object.values(value).flatMap((item) => {
      const score = scoreFromReported(item);
      return Number.isFinite(score) ? [score] : [];
    });
    return values.length ? round(values.reduce((sum, item) => sum + item, 0) / values.length, 1) : null;
  }
  return null;
}

function anchorNormalizedBenchmarkScore(key, rawScore) {
  const score = Number(rawScore);
  if (!Number.isFinite(score)) return null;
  const configs = {
    simpler: { weight: 1, score, note: "direct SimplerEnv anchor" },
    robocasa: { weight: 1, score, note: "direct RoboCasa anchor" },
    robotwinAllData: { weight: 0.45, score: score * 0.85 + 2, note: "RoboTwin all-data compressed onto SimplerEnv/RoboCasa scale" },
    robotwinTaskSpecific: { weight: 0.38, score: score * 0.8 + 3, note: "RoboTwin task-specific compressed more strongly because it is more saturated" },
    liberoPlus: { weight: 0.6, score: score * 0.82 + 1, note: "LIBERO-Plus compressed onto SimplerEnv/RoboCasa scale" },
    liberoPro: { weight: 0.75, score: score * 0.9, note: "LIBERO-Pro lightly compressed onto SimplerEnv/RoboCasa scale" }
  };
  const config = configs[key] || { weight: 0.35, score, note: "fallback direct score" };
  return {
    benchmark: key,
    reportedScore: round(score, 1),
    normalizedScore: round(clamp(config.score, 0, 100), 1),
    weight: config.weight,
    note: config.note
  };
}

function estimatedAccuracyFromBenchmarkScores(benchmarkScores, scoreKeys) {
  const contributions = scoreKeys
    .map((key) => anchorNormalizedBenchmarkScore(key, benchmarkScores[key]?.reportedScore))
    .filter(Boolean);
  if (!contributions.length) return { score: null, contributions: [] };
  const totalWeight = contributions.reduce((sum, item) => sum + item.weight, 0);
  const score = contributions.reduce((sum, item) => sum + item.normalizedScore * item.weight, 0) / totalWeight;
  return { score: round(score, 1), contributions };
}

function sourceExcerptsFromOverride(items = []) {
  return items.map((item) => ({
    source: item.source || item.file || item.sourceFile || "agent-audit",
    line: item.line ?? null,
    excerpt: item.excerpt || item.text || "Agent-extracted metric evidence."
  }));
}

function overrideAuditEntry(displayedValue, unit, formula, evidence, assumptions = {}) {
  return {
    displayedValue,
    unit,
    assumptions,
    formula,
    calculation: `${formula} = ${displayedValue}`,
    sourceExcerpts: sourceExcerptsFromOverride(evidence)
  };
}

function overrideSuppressesAccuracy(override) {
  return Boolean(
    override?.excludeAccuracy ||
    override?.warnings?.some((warning) => /no (?:target|allowed).*benchmark|no libero|no .*target accuracy|target robot benchmark scores are absent|not found in extracted/i.test(warning))
  );
}

function clearAccuracyMetrics(comparative) {
  comparative.accuracy.estimatedScore = null;
  comparative.accuracy.benchmarkScores = {};
  comparative.accuracy.reportedBenchmarkKeys = [];
  comparative.accuracy.note = "Excluded from Metrics accuracy because no requested target benchmark result was found.";
  comparative.metricAudit.accuracy = null;
  comparative.metricAudit.benchmarkAccuracy = {};
}

function hasStrictUnseenTaskEvidence(comparative) {
  const evidence = comparative?.metricAudit?.generalization?.sourceExcerpts || [];
  const text = evidence.map((item) => item.excerpt || "").join(" ");
  return strictUnseenTaskPattern.test(text);
}

function applyMetricEligibility(model) {
  const comparative = model.metrics?.comparative;
  if (!comparative) return;
  const benchmarkScores = comparative.accuracy?.benchmarkScores || {};
  const benchmarkKeys = Object.keys(benchmarkScores).filter((key) => targetBenchmarkKeys.has(key));
  const defaultBenchmarkKeys = benchmarkKeys.filter((key) => defaultAccuracyBenchmarkKeys.has(key));
  const hasTargetBenchmark = comparative.accuracy?.agentAuditedTargetBenchmark === true && benchmarkKeys.length > 0;
  const hasDefaultAccuracyBenchmark = comparative.accuracy?.agentAuditedTargetBenchmark === true && defaultBenchmarkKeys.length > 0;
  if (!hasTargetBenchmark) clearAccuracyMetrics(comparative);
  comparative.metricsEligible = hasDefaultAccuracyBenchmark;
  comparative.accuracy.includeInMetrics = hasDefaultAccuracyBenchmark;
  comparative.accuracy.defaultBenchmarkKeys = defaultBenchmarkKeys;
  comparative.computeCost.includeInMetrics = hasDefaultAccuracyBenchmark;
  comparative.inferenceCost.includeInMetrics = hasDefaultAccuracyBenchmark;

  const hasUnseenTaskEvidence = Boolean(comparative.generalization?.agentAuditedUnseenTaskEvidence === true);
  comparative.generalization.hasUnseenTaskEvidence = hasUnseenTaskEvidence;
  comparative.generalization.includeInMetrics = hasDefaultAccuracyBenchmark && hasUnseenTaskEvidence;
  if (!comparative.generalization.includeInMetrics) {
    comparative.generalization.improvementPct = null;
    comparative.generalization.note = hasDefaultAccuracyBenchmark
      ? "Excluded from the generalization metric because no real-world unseen-task/OOD transfer evidence was found."
      : "Excluded from Metrics because no hard target benchmark result was found.";
    comparative.metricAudit.generalization = null;
  }
}

function mergeMetricOverride(model, override) {
  if (!override || !model.metrics?.comparative) return;
  const comparative = model.metrics.comparative;
  comparative.overrideStatus = "agent-audited";
  comparative.confidence = override.confidence || comparative.confidence;
  comparative.extractionQuality = override.quality || "agent-audited";

  if (overrideSuppressesAccuracy(override)) {
    clearAccuracyMetrics(comparative);
  }

  if (override.accuracy?.benchmarks) {
    const benchmarkScores = {};
    const benchmarkAudit = {};
    for (const [key, item] of Object.entries(override.accuracy.benchmarks)) {
      const score = scoreFromReported(item.value);
      if (!Number.isFinite(score)) continue;
      benchmarkScores[key] = {
        estimatedScore: score,
        reportedScore: score,
        normalizedFrom: item.context || "agent-extracted direct benchmark score"
      };
      benchmarkAudit[key] = overrideAuditEntry(
        score,
        "reported success score",
        "direct reported benchmark score, converted to percent when needed",
        item.evidence,
        { benchmark: key, rawValue: item.value, context: item.context || null }
      );
    }
    const keys = Object.keys(benchmarkScores);
    if (keys.length) {
      comparative.accuracy.benchmarkScores = benchmarkScores;
      comparative.accuracy.reportedBenchmarkKeys = keys;
      const scoreKeys = keys.some((key) => defaultAccuracyBenchmarkKeys.has(key))
        ? keys.filter((key) => defaultAccuracyBenchmarkKeys.has(key))
        : keys;
      const normalizedAccuracy = estimatedAccuracyFromBenchmarkScores(benchmarkScores, scoreKeys);
      if (override.accuracy.estimatedScore != null) {
        comparative.accuracy.estimatedScore = round(override.accuracy.estimatedScore, 1);
      } else {
        comparative.accuracy.estimatedScore = normalizedAccuracy.score;
      }
      comparative.accuracy.note = "Agent-audited benchmark scores are calibrated onto a SimplerEnv/RoboCasa-anchored scale for the estimated accuracy view.";
      comparative.accuracy.agentAuditedTargetBenchmark = true;
      comparative.metricAudit.accuracy = overrideAuditEntry(
        comparative.accuracy.estimatedScore,
        "normalized success score",
        "weighted mean of SimplerEnv/RoboCasa-anchored benchmark scores; SimplerEnv and RoboCasa are direct anchors, RobotWin and LIBERO variants are compressed because they are more saturated",
        scoreKeys.map((key) => override.accuracy.benchmarks[key]).flatMap((item) => item?.evidence || []),
        {
          benchmarkKeys: scoreKeys,
          normalizedBenchmarkContributions: normalizedAccuracy.contributions
        }
      );
      comparative.metricAudit.benchmarkAccuracy = benchmarkAudit;
    }
  }

  if (override.computeCost) {
    if (Number.isFinite(override.computeCost.pretrainingGpuHours)) {
      comparative.computeCost.pretrainingGpuHours = round(override.computeCost.pretrainingGpuHours, 1);
      comparative.metricAudit.computePretraining = overrideAuditEntry(
        comparative.computeCost.pretrainingGpuHours,
        "GPU-hours",
        override.computeCost.pretrainingFormula || "agent-extracted GPU count * wall-clock hours, or reported GPU-hours",
        override.computeCost.evidence,
        override.computeCost.assumptions || {}
      );
    }
    if (Number.isFinite(override.computeCost.finetuningGpuHours5h)) {
      comparative.computeCost.finetuningGpuHours5h = round(override.computeCost.finetuningGpuHours5h, 1);
      comparative.metricAudit.computeFinetuning = overrideAuditEntry(
        comparative.computeCost.finetuningGpuHours5h,
        "GPU-hours for 300 one-minute episodes",
        override.computeCost.finetuningFormula || "agent-extracted fine-tuning cost normalized to 5h task data",
        override.computeCost.evidence,
        override.computeCost.assumptions || {}
      );
    }
    comparative.computeCost.note = "Agent-audited compute values override scale-only estimates where available.";
  }

  if (override.inferenceCost) {
    if (Number.isFinite(override.inferenceCost.fps4090)) {
      comparative.inferenceCost.fps4090 = roundFps(override.inferenceCost.fps4090);
    }
    if (override.inferenceCost.reported) {
      comparative.inferenceCost.reportedFpsOrHz = [override.inferenceCost.reported];
    }
    comparative.metricAudit.inference = overrideAuditEntry(
      comparative.inferenceCost.fps4090,
      "RTX 4090 action-level FPS",
      override.inferenceCost.formula || "reported FPS/latency converted to action-level FPS; otherwise architecture-based estimate",
      override.inferenceCost.evidence,
      override.inferenceCost.assumptions || {}
    );
    comparative.inferenceCost.note = "Agent-audited runtime facts override generic runtime estimates where available.";
  }

  if (override.generalization) {
    if (Number.isFinite(override.generalization.improvementPct)) {
      comparative.generalization.improvementPct = round(override.generalization.improvementPct, 1);
    }
    comparative.metricAudit.generalization = overrideAuditEntry(
      comparative.generalization.improvementPct,
      "normalized real-world unseen-task transfer score",
      override.generalization.formula || "direct reported unseen-task/OOD improvement where available; otherwise normalized transfer evidence",
      override.generalization.evidence,
      override.generalization.assumptions || {}
    );
    comparative.generalization.hasUnseenTaskEvidence = override.generalization.unseenTask === true ||
      strictUnseenTaskPattern.test([
        override.generalization.note,
        ...(override.generalization.evidence || []).map((item) => item.excerpt || item.text || "")
      ].join(" "));
    comparative.generalization.agentAuditedUnseenTaskEvidence = comparative.generalization.hasUnseenTaskEvidence;
    comparative.generalization.note = override.generalization.note || comparative.generalization.note;
  }

  if (override.warnings?.length) {
    comparative.agentWarnings = override.warnings;
  }
}

const reportRows = [];

for (const model of modelsData.models) {
  const text = methodText(model);
  const snippets = evidenceSnippets(text);
  const numbers = extractNumbers(text);
  const benchmarks = detectedBenchmarks(text);
  const accuracy = estimateAccuracy(model, benchmarks, snippets);
  const compute = estimateCompute(model, numbers, text);
  const inferenceFps = roundFps(estimateInference(model, numbers, text));
  const generalization = estimateGeneralization(model, accuracy, snippets, benchmarks);
  const confidence = confidenceFor(model, snippets, numbers, benchmarks);
  const auditValues = {
    accuracy,
    pretrainingGpuHours: compute.pretrainingGpuHours,
    finetuningGpuHours5h: compute.finetuningGpuHours5h,
    fps4090: inferenceFps,
    generalization
  };
  const benchmarkScores = Object.fromEntries(
    benchmarks.map((id) => {
      const offset = benchmarkPatterns.find(([key]) => key === id)?.[2] || 0;
      return [id, {
        estimatedScore: round(clamp(accuracy + offset, 0, 100), 1),
        normalizedFrom: "paper reports or discusses this benchmark; estimated accuracy is mapped onto the atlas SimplerEnv/RoboCasa-anchored 0-100 scale"
      }];
    })
  );
  const audit = {
    ...metricAudit(model, text, snippets, numbers, benchmarks, auditValues),
    benchmarkAccuracy: benchmarkAudit(model, benchmarks, accuracy)
  };
  const warnings = extractionWarnings(model, numbers, benchmarks, audit);
  const quality = extractionQuality(confidence, warnings);
  model.metrics = {
    ...model.metrics,
    comparative: {
      version: "metrics-normalization-2026-05-26",
      confidence,
      extractionQuality: quality,
      accuracy: {
        estimatedScore: accuracy,
        scale: "0-100 SimplerEnv/RoboCasa-anchored cross-benchmark success estimate",
        benchmarkScores,
        reportedBenchmarkKeys: benchmarks,
        agentAuditedTargetBenchmark: false,
        note: "Estimated from reported benchmark coverage, paper evidence strength, architecture family, release recency, and cross-benchmark difficulty offsets."
      },
      computeCost: {
        pretrainingGpuHours: compute.pretrainingGpuHours,
        finetuningGpuHours5h: compute.finetuningGpuHours5h,
        unit: "estimated GPU-hours",
        standardization: "finetuning normalized to 300 one-minute episodes, i.e. 5 hours of task data",
        reportedGpuHours: numbers.gpuHours,
        note: "Uses reported GPU-hours where present; otherwise estimates from model scale, pretraining scope, parameter count, and computeScale."
      },
      inferenceCost: {
        fps4090: inferenceFps,
        unit: "estimated action-level FPS on RTX 4090",
        reportedFpsOrHz: numbers.fps,
        assumptions: {
          parameterB: numbers.paramsB,
          denoisingSteps: numbers.denoisingSteps,
          actionTokenCounts: numbers.actionTokens
        },
        note: "Ignores engineering tricks unless the paper reports an end-to-end 4090 frequency; estimates transformer/diffusion cost from runtime path, denoising steps, and parameter scale."
      },
      generalization: {
        improvementPct: generalization,
        hasUnseenTaskEvidence: false,
        agentAuditedUnseenTaskEvidence: false,
        includeInMetrics: false,
        baseline: "paper-specific strongest comparable baseline where available; otherwise atlas estimate from benchmark breadth and claimed gains",
        note: "Normalized self-reported or inferred improvement over a nearby baseline; higher means broader transfer or stronger out-of-distribution gain."
      },
      metricAudit: audit,
      evidence: snippets
    }
  };
  mergeMetricOverride(model, metricOverrides.models?.[model.id]);
  applyMetricEligibility(model);
  reportRows.push({
    id: model.id,
    name: model.name,
    family: model.family,
    quality,
    confidence,
    benchmarks: model.metrics.comparative.accuracy.reportedBenchmarkKeys,
    extracted: {
      gpuHours: numbers.gpuHours,
      fpsOrHz: numbers.fps,
      parameterB: numbers.paramsB,
      denoisingSteps: numbers.denoisingSteps,
      actionTokenCounts: numbers.actionTokens
    },
    estimates: {
      accuracy: model.metrics.comparative.accuracy.estimatedScore,
      pretrainingGpuHours: model.metrics.comparative.computeCost.pretrainingGpuHours,
      finetuningGpuHours5h: model.metrics.comparative.computeCost.finetuningGpuHours5h,
      fps4090: model.metrics.comparative.inferenceCost.fps4090,
      generalization: model.metrics.comparative.generalization.improvementPct
    },
    metricsEligible: model.metrics.comparative.metricsEligible,
    generalizationEligible: model.metrics.comparative.generalization.includeInMetrics,
    warnings: [
      ...warnings,
      ...(model.metrics.comparative.metricsEligible ? [] : ["excluded from Metrics: no target benchmark result"]),
      ...(model.metrics.comparative.metricsEligible && !model.metrics.comparative.generalization.includeInMetrics ? ["excluded from generalization: no real-world unseen-task evidence"] : [])
    ]
  });
}

modelsData.methodology = [
  ...new Set([
    ...(modelsData.methodology || []),
    "Add comparative metrics with raw reported evidence, normalized accuracy estimates, standardized GPU-hour estimates, RTX 4090 inference estimates, and generalization-improvement estimates."
  ])
];

modelsData.metricNormalization = {
  version: "metrics-normalization-2026-05-26",
  accuracy: {
    defaultView: "estimatedScore",
    scale: "0-100 SimplerEnv/RoboCasa-anchored cross-benchmark success estimate",
    includedBenchmarks: ["simpler", "liberoPlus", "liberoPro", "robotwinAllData", "robotwinTaskSpecific", "robocasa"],
    defaultAccuracyBenchmarks: Array.from(defaultAccuracyBenchmarkKeys),
    anchorBenchmarks: ["simpler", "robocasa"],
    calibration: {
      simpler: "direct 1.0x anchor",
      robocasa: "direct 1.0x anchor",
      robotwinAllData: "0.45 weight, normalized as 0.85 * reported + 2",
      robotwinTaskSpecific: "0.38 weight, normalized as 0.80 * reported + 3",
      liberoPlus: "0.60 weight, normalized as 0.82 * reported + 1",
      liberoPro: "0.75 weight, normalized as 0.90 * reported"
    },
    ignoredForAccuracyFilters: "CALVIN, MetaWorld, Bridge, DROID, Language Table, Open X, and generic real-robot mentions are excluded from benchmark-specific accuracy filters, but can still support generalization evidence.",
    note: "Metrics accuracy includes only papers with an agent-audited hard target result. The estimated view is anchored to SimplerEnv and RoboCasa because they are less saturated; RobotWin is retained but compressed and downweighted. LIBERO results are excluded from Metrics benchmarks."
  },
  computeCost: {
    pretraining: "GPU-hours for training from scratch, broad pretraining, or generalist policy pretraining; reported GPU-hours are used where present, otherwise estimated from computeScale, parameter count, and training scope.",
    finetuning: "GPU-hours normalized to 300 one-minute task episodes, i.e. 5h task data; reported fine-tune GPU-hours are scaled when context gives task count, otherwise estimated from computeScale."
  },
  inferenceCost: {
    standardHardware: "RTX 4090 24GB",
    unit: "action-level FPS",
    note: "Engineering tricks are ignored unless the paper reports an end-to-end model/policy inference frequency on comparable hardware. Diffusion estimates penalize denoising steps; autoregressive estimates account for parameter scale and cached action-token generation."
  },
  generalization: {
    unit: "normalized real-world unseen-task transfer score",
    note: "Shown only when a Metrics-eligible paper has evidence of real-world unseen-task, OOD, novel-object/environment, zero-shot, or equivalent transfer evaluation."
  }
};

const sampleIds = [
  "gr-2",
  "vpp",
  "fast-wam",
  "xr-1",
  "videovla",
  "cosmos-policy",
  "vla-jepa",
  "gigaworld-policy",
  "rhoda-dva",
  "lingbot-va",
  "vtam",
  "lapa"
];
const report = {
  generatedOn: new Date().toISOString(),
  extractor: "scripts/enrich-comparative-metrics.mjs",
  modelCount: reportRows.length,
  qualityCounts: reportRows.reduce((acc, row) => {
    acc[row.quality] = (acc[row.quality] || 0) + 1;
    return acc;
  }, {}),
  sampleIds,
  sample: reportRows.filter((row) => sampleIds.includes(row.id)),
  allModels: reportRows
};
fs.writeFileSync(path.join(root, "data", "metrics-extraction-report.json"), JSON.stringify(report, null, 2) + "\n");
const markdown = [
  "# Metrics Extraction Report",
  "",
  `Generated: ${report.generatedOn}`,
  "",
  "This report validates the automated extraction pass on a representative sample of model families. It records raw detected quantities, normalized estimates, and warnings that identify values needing manual review.",
  "",
  "## Quality Counts",
  "",
  ...Object.entries(report.qualityCounts).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Sample Audit",
  "",
  ...report.sample.flatMap((row) => [
    `### ${row.name} (${row.id})`,
    `- quality: ${row.quality}; confidence: ${row.confidence}`,
    `- benchmarks: ${row.benchmarks.join(", ") || "none detected"}`,
    `- extracted: GPUh=${row.extracted.gpuHours.join(", ") || "none"}; FPS/Hz=${row.extracted.fpsOrHz.join(", ") || "none"}; paramsB=${row.extracted.parameterB.join(", ") || "none"}; denoising=${row.extracted.denoisingSteps.join(", ") || "none"}`,
    `- estimates: accuracy=${row.estimates.accuracy}; pretrainGPUh=${row.estimates.pretrainingGpuHours}; finetuneGPUh5h=${row.estimates.finetuningGpuHours5h}; fps4090=${row.estimates.fps4090}; generalization=${row.estimates.generalization}`,
    `- warnings: ${row.warnings.join("; ") || "none"}`,
    ""
  ])
].join("\n");
fs.writeFileSync(path.join(root, "data", "metrics-extraction-report.md"), markdown + "\n");
fs.writeFileSync(modelsPath, JSON.stringify(modelsData, null, 2) + "\n");
