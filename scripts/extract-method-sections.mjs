import fs from "node:fs";
import path from "node:path";

const defaultInput = "C:\\Users\\joecl\\OneDrive\\Documents\\PHD\\Lit Reviews\\wam papers\\txt";
const inputDir = process.env.WAM_TXT_DIR || defaultInput;
const outputDir = process.env.WAM_METHOD_DIR || path.resolve("methods");

const focusLabels = [
  "method",
  "methods",
  "methodology",
  "approach",
  "model architecture",
  "architecture",
  "training",
  "training objective",
  "training details",
  "dataset",
  "datasets",
  "implementation details",
  "implementation"
];

const stopLabels = [
  "abstract",
  "introduction",
  "related work",
  "background",
  "preliminaries",
  "method",
  "methods",
  "methodology",
  "approach",
  "model",
  "model architecture",
  "architecture",
  "training",
  "training objective",
  "training details",
  "dataset",
  "datasets",
  "implementation details",
  "implementation",
  "experiments",
  "experimental setup",
  "evaluation",
  "results",
  "discussion",
  "limitations",
  "conclusion",
  "references",
  "appendix"
];

const keywordRegex = /\b(architecture|DiT|diffusion transformer|transformer|encoder|decoder|tokenizer|token|VAE|VQ|latent|attention mask|cross-attention|self-attention|flow matching|denois|noise schedule|loss|objective|action head|policy head|world model|training stage|dataset|pretrain|finetun|inference|runtime|cache|CFG|LoRA|proprio|tactile|depth|RGB-D|value map)\b/i;

function sanitize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLine(line) {
  return line.replace(/\s+/g, " ").trim();
}

function classifyHeading(line) {
  const text = normalizeLine(line);
  if (!text || text.length > 120) return null;
  const withoutNumber = text
    .replace(/^(?:[0-9]+(?:\.[0-9]+)*\.?|[IVXLC]+\.?)\s+/i, "")
    .replace(/^([A-Z])\.\s+/, "")
    .replace(/[:.]$/, "")
    .trim();
  const lower = withoutNumber.toLowerCase();
  if (stopLabels.includes(lower)) return lower;
  for (const label of stopLabels) {
    if (lower === label || lower.startsWith(`${label} `)) return label;
  }
  return null;
}

function findHeadings(lines) {
  const headings = [];
  lines.forEach((line, index) => {
    const label = classifyHeading(line);
    if (label) headings.push({ line: index + 1, index, label, text: normalizeLine(line) });
  });
  return headings;
}

function mergeRanges(ranges) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 8) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
      last.labels = [...new Set([...(last.labels || []), ...(range.labels || [])])];
    }
  }
  return merged;
}

function extractSections(lines, headings) {
  const headingRanges = [];
  headings.forEach((heading, i) => {
    if (!focusLabels.includes(heading.label)) return;
    const next = headings.slice(i + 1).find((candidate) => candidate.index > heading.index + 8);
    const end = next ? next.index : lines.length;
    const maxEnd = Math.min(end, heading.index + 520);
    headingRanges.push({
      start: heading.index,
      end: maxEnd,
      labels: [heading.text],
      kind: "heading"
    });
  });

  const mergedHeadings = mergeRanges(headingRanges);
  const keywordRanges = [];
  const priorityKeywordRegex = /\b(Model Architecture|Architecture\.|Training objective|Training Details|Implementation Details|Dataset|Datasets|attention mask|flow matching objective|denoising schedule|action head|policy head|tokenizer|VAE|VQ|DiT|Mixture-of-Transformer|Mixture of Transformer|depth branch|tactile|value map)\b/i;
  let lastKeywordStart = -Infinity;
  lines.forEach((line, index) => {
    if (!keywordRegex.test(line) && !priorityKeywordRegex.test(line)) return;
    if (!priorityKeywordRegex.test(line) && index - lastKeywordStart < 90) return;
    const insideHeading = mergedHeadings.some((range) => index >= range.start && index <= range.end);
    if (insideHeading) return;
    keywordRanges.push({
      start: Math.max(0, index - 18),
      end: Math.min(lines.length, index + 22),
      labels: ["keyword window"],
      kind: "keyword"
    });
    lastKeywordStart = index;
  });

  return [
    ...mergedHeadings,
    ...mergeRanges(keywordRanges).slice(0, 8)
  ].sort((a, b) => a.start - b.start || a.end - b.end);
}

function takeTitle(lines, fallback) {
  const candidates = lines
    .slice(0, 80)
    .map(normalizeLine)
    .filter((line) => line.length > 12 && line.length < 180)
    .filter((line) => !/^(abstract|introduction|arxiv|figure|table|\d+)$/.test(line.toLowerCase()))
    .filter((line) => !/^[A-Z]\s*$/.test(line));
  return candidates[0] || fallback;
}

function renderMarkdown(fileName, title, sections, lines) {
  const parts = [
    `# ${title}`,
    "",
    `Source text: \`${fileName}\``,
    "",
    "This file is generated by `scripts/extract-method-sections.mjs`. It extracts method-like sections plus keyword windows for architecture, training, tokenizer, loss, data, and runtime details.",
    ""
  ];

  sections.forEach((section, index) => {
    const startLine = section.start + 1;
    const endLine = section.end;
    parts.push(`## Extract ${index + 1}: ${section.labels.join("; ")}`);
    parts.push("");
    parts.push(`Lines ${startLine}-${endLine}`);
    parts.push("");
    parts.push("```text");
    lines.slice(section.start, section.end).forEach((line, offset) => {
      const lineNo = String(section.start + offset + 1).padStart(5, " ");
      parts.push(`${lineNo}: ${line}`);
    });
    parts.push("```");
    parts.push("");
  });

  return `${parts.join("\n")}\n`;
}

if (!fs.existsSync(inputDir)) {
  throw new Error(`Input directory not found: ${inputDir}`);
}

fs.mkdirSync(outputDir, { recursive: true });

const txtFiles = fs
  .readdirSync(inputDir)
  .filter((name) => name.toLowerCase().endsWith(".txt"))
  .sort((a, b) => a.localeCompare(b));

const index = [];

for (const fileName of txtFiles) {
  const filePath = path.join(inputDir, fileName);
  const raw = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n");
  const base = path.basename(fileName, ".txt");
  const slug = sanitize(base);
  const headings = findHeadings(lines);
  const sections = extractSections(lines, headings);
  const title = takeTitle(lines, base);
  const outPath = path.join(outputDir, `${slug}.md`);
  fs.writeFileSync(outPath, renderMarkdown(fileName, title, sections, lines), "utf8");
  index.push({
    slug,
    fileName,
    title,
    lineCount: lines.length,
    headingCount: headings.length,
    extractCount: sections.length,
    output: path.relative(process.cwd(), outPath).replaceAll("\\", "/")
  });
}

fs.writeFileSync(path.join(outputDir, "_index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(`Extracted ${index.length} papers into ${outputDir}`);
for (const row of index) {
  console.log(`${row.slug}: ${row.extractCount} extracts`);
}
