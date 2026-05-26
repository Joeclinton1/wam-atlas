const state = {
  models: [],
  schema: null,
  arch: {},
  mode: "problem",
  query: "",
  selectedId: null,
  hoveredId: null,
  zoom: { k: 0.68, x: 250, y: 78 },
  zoomBase: 0.68,
  dragging: null,
  lastAtlasPositions: new Map(),
  lastRenderedMode: null
};

const familyColors = {
  pixel_idm: "#c85c45",
  latent_idm: "#3569b7",
  encoder_only: "#117c78",
  joint_latent: "#7656a6",
  unified: "#ad7b16",
  multi_stream: "#4e7f36",
  implicit_future: "#2f7f91",
  latent_action: "#8d5f2a",
  alignment: "#6b7280",
  multimodal: "#b24d7a",
  online_adaptation: "#a4493f",
  speedup: "#2d7c59"
};

const familyLabels = {
  pixel_idm: "Pixel future + IDM",
  latent_idm: "Latent predictive state",
  encoder_only: "Encoder-only runtime",
  joint_latent: "Joint latent space",
  unified: "Unified action-observation",
  multi_stream: "Multi-stream",
  implicit_future: "Implicit future",
  latent_action: "Latent action",
  alignment: "Alignment",
  multimodal: "Multimodal state",
  online_adaptation: "Online adaptation",
  speedup: "Speedup"
};

const modeDescriptions = {
  problem: "Problem tree: from the central field question to the exact paper-level bottleneck.",
  taxonomy: "Architecture families arranged as a readable category map.",
  speed: "Runtime cost against training/model scale.",
  timeline: "Field evolution by publication date."
};

const rootProblemQuestion = "How can video models best serve as VLA backbones?";

const problemBranches = [
  {
    id: "futures",
    question: "How can imagined futures become action signals?",
    color: "#a8d8ef",
    angle: -150,
    families: ["pixel_idm", "latent_idm", "implicit_future"]
  },
  {
    id: "coupling",
    question: "How should world and action learning stay coupled?",
    color: "#cdb8e6",
    angle: -64,
    families: ["unified", "joint_latent", "multi_stream"]
  },
  {
    id: "speed",
    question: "How do we keep foresight fast enough for control?",
    color: "#b6dfc2",
    angle: 8,
    families: ["encoder_only", "speedup"]
  },
  {
    id: "grounding",
    question: "How do unlabeled videos become executable skills?",
    color: "#f2cf93",
    angle: 82,
    families: ["latent_action", "alignment"]
  },
  {
    id: "physics",
    question: "How do models handle contact, geometry, and drift?",
    color: "#efb8b1",
    angle: 156,
    families: ["multimodal", "online_adaptation"]
  }
];

const familyProblemQuestions = {
  pixel_idm: "Can predicted pixels expose the needed action?",
  latent_idm: "Can hidden future state replace full rollout?",
  encoder_only: "Can training-time video pressure survive in a fast policy?",
  joint_latent: "Can actions and observations share one geometry?",
  unified: "Can one temporal model predict observations and controls?",
  multi_stream: "Can experts share state without fighting each other?",
  implicit_future: "Can a future be useful without being rendered?",
  latent_action: "Can video transitions define robot action codes?",
  alignment: "Can world features be aligned to physics and executability?",
  multimodal: "Can RGB futures include geometry, touch, and force?",
  online_adaptation: "Can prediction error repair deployment drift?",
  speedup: "Can foresight be cached, distilled, or skipped?"
};

const familyProblemSplits = {
  unified: [
    "Can one temporal policy model both observe and act?",
    "Can action-observation tokens scale to general VLA policies?"
  ],
  implicit_future: [
    "Can hidden future features guide policy without pixels?",
    "Can world representations improve action without decoding video?"
  ],
  latent_action: [
    "Can video transitions discover reusable action codes?",
    "Can discovered action codes transfer into robot control?"
  ],
  latent_idm: [
    "Can latent future state replace full visual rollout?",
    "Can predictive latents expose the action that caused change?"
  ],
  alignment: [
    "Can world features align to executable robot behavior?",
    "Can physics-aware video objectives improve action learning?"
  ],
  multi_stream: [
    "Can multiple experts share one state space?",
    "Can specialized streams cooperate without interference?"
  ]
};

const institutionMeta = {
  "gr-1": ["ByteDance", "bytedance.com"],
  "gr-2": ["ByteDance", "bytedance.com"],
  lapa: ["KAIST", "kaist.ac.kr"],
  vpp: ["Tsinghua", "tsinghua.edu.cn"],
  uva: ["UVA", "virginia.edu"],
  uwm: ["University of Washington", "washington.edu"],
  dreamgen: ["NVIDIA", "nvidia.com"],
  flare: ["NVIDIA", "nvidia.com"],
  clam: ["USC", "usc.edu"],
  videorepa: ["Shanghai Jiao Tong", "sjtu.edu.cn"],
  univla: ["HKU", "hku.hk"],
  "geometry-forcing": ["Microsoft Research", "microsoft.com"],
  trivla: ["Fudan", "fudan.edu.cn"],
  "video-generators-robot-policies": ["Columbia", "columbia.edu"],
  "villa-x": ["Microsoft Research", "microsoft.com"],
  mowm: ["Tsinghua", "tsinghua.edu.cn"],
  dust: ["KAIST", "kaist.ac.kr"],
  "ud-vla": ["Monash", "monash.edu"],
  "rynnvla-002": ["Alibaba DAMO", "alibabagroup.com"],
  motus: ["Tsinghua", "tsinghua.edu.cn"],
  videovla: ["Microsoft Research Asia", "microsoft.com"],
  act2goal: ["AgiBot", "agibot.com"],
  "mimic-video": ["mimic robotics", "mimicrobotics.com"],
  clap: ["Tsinghua", "tsinghua.edu.cn"],
  "cosmos-policy": ["NVIDIA", "nvidia.com"],
  wog: ["ByteDance Seed", "seed.bytedance.com"],
  "vla-jepa": ["USTC", "ustc.edu.cn"],
  frappe: ["Zhejiang University", "zju.edu.cn"],
  ldamodel: ["Peking University", "pku.edu.cn"],
  adaworldpolicy: ["HKU", "hku.hk"],
  "say-dream-act": ["Fudan", "fudan.edu.cn"],
  cowvla: ["Peking University", "pku.edu.cn"],
  "fast-wam": ["Tsinghua", "tsinghua.edu.cn"],
  svam: ["HKUST(GZ)", "hkust-gz.edu.cn"],
  "sim-distill": ["SimDist", "github.io"],
  vampo: ["Zhejiang University", "zju.edu.cn"],
  eva: ["CUHK-Shenzhen", "cuhk.edu.cn"],
  vtam: ["UIUC", "illinois.edu"],
  "gigaworld-policy": ["GigaWorld", "github.io"],
  aim: ["HKU", "hku.hk"],
  wav: ["Westlake", "westlake.edu.cn"],
  dexworldmodel: ["DexWorldModel", "github.io"],
  "x-wam": ["Tsinghua", "tsinghua.edu.cn"],
  motubrain: ["MotuBrain", "shengshu.com"]
};

const typeColors = {
  input: { fill: "#eef4f1", stroke: "#97b8ad" },
  tokenizer: { fill: "#edf2fb", stroke: "#9eb6df" },
  backbone: { fill: "#fff4df", stroke: "#d8ad58" },
  branch: { fill: "#f3edf8", stroke: "#b8a1d0" },
  attention: { fill: "#f8eeee", stroke: "#cf978f" },
  head: { fill: "#eef6ee", stroke: "#93b78d" },
  objective: { fill: "#f4f5f6", stroke: "#aeb6bc" },
  runtime: { fill: "#edf7f7", stroke: "#86bfc0" },
  output: { fill: "#172024", stroke: "#172024", text: "#ffffff" },
  training: { fill: "#fff7ed", stroke: "#d2a460" }
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slugDate(model) {
  const month = Number(model.month || 6);
  return model.year + (Math.max(1, Math.min(12, month)) - 1) / 12;
}

function scoreLabel(value) {
  const labels = ["", "low", "modest", "medium", "high", "very high"];
  return labels[Math.max(1, Math.min(5, Number(value) || 1))];
}

function filteredModels() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.models;
  return state.models.filter((model) => {
    const haystack = [
      model.name,
      model.title,
      model.family,
      model.category,
      model.problem,
      model.oneLine,
      model.insights?.method,
      model.insights?.novelty
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

async function loadData() {
  const [modelsRes, schemaRes, archRes] = await Promise.all([
    fetch("data/wam-models.json"),
    fetch("data/schema.json"),
    fetch("data/architecture-specs.json")
  ]);
  const modelsData = await modelsRes.json();
  state.schema = await schemaRes.json();
  const archData = await archRes.json();
  state.models = modelsData.models;
  state.methodology = modelsData.methodology;
  state.arch = archData.models || {};

  $("#modelCount").textContent = state.models.length;
  $("#familyCount").textContent = new Set(state.models.map((m) => m.family)).size;
  $("#sourceCount").textContent = state.models.filter((m) => m.localText).length;
  setDefaultZoomForMode(state.mode);
  renderLearn();
  renderSources();
  routeFromHash();
}

function familyOrder() {
  return [...new Set(state.models.map((model) => model.family))];
}

function modelIndexInFamily(model) {
  return state.models.filter((item) => item.family === model.family).findIndex((item) => item.id === model.id);
}

function positionModel(model, index, models, bounds) {
  if (state.mode === "problem") {
    return problemGeometry(models, bounds).positions.get(model.id);
  }
  const families = familyOrder();
  const familyIndex = families.indexOf(model.family);
  const jitter = ((index * 37) % 23) - 11;
  const w = bounds.width;
  const h = bounds.height;

  if (state.mode === "speed") {
    const x = 90 + ((Number(model.metrics?.runtimeCost) || 1) - 1) * ((w - 180) / 4);
    const y = h - 90 - ((Number(model.metrics?.computeScale) || 1) - 1) * ((h - 180) / 4);
    return { x: x + jitter, y: y - jitter };
  }

  if (state.mode === "timeline") {
    return timelineGeometry(models, bounds).positions.get(model.id);
  }

  if (state.mode === "taxonomy") {
    const columns = Math.ceil(Math.sqrt(families.length));
    const col = familyIndex % columns;
    const row = Math.floor(familyIndex / columns);
    const cx = 140 + col * ((w - 280) / Math.max(1, columns - 1));
    const cy = 135 + row * ((h - 270) / Math.max(1, Math.ceil(families.length / columns) - 1));
    const local = modelIndexInFamily(model);
    const angle = (local * 1.75) % (Math.PI * 2);
    const radius = 24 + local * 6;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  return { x: bounds.width / 2, y: bounds.height / 2 };
}

function drawAtlasBackdrop(group, defs, bounds, geometry = null) {
  if (state.mode === "problem") {
    drawProblemBackdrop(group, defs, geometry || problemGeometry(state.models, bounds));
    return;
  }
  if (state.mode === "timeline") {
    drawTimelineBackdrop(group, timelineGeometry(state.models, bounds));
    return;
  }
  if (state.mode === "speed") {
    drawSpeedBackdrop(group, bounds);
    return;
  }
  if (state.mode === "taxonomy") {
    drawTaxonomyBackdrop(group, bounds);
  }
}

function problemGeometry(models, bounds) {
  const root = { id: "root", x: bounds.width / 2, y: bounds.height * 0.46 + 36, fixed: true };
  const branchRx = clamp(bounds.width * 0.29, 360, 520);
  const branchRy = clamp(bounds.height * 0.28, 228, 340);
  const familyRx = clamp(bounds.width * 0.165, 210, 310);
  const familyRy = clamp(bounds.height * 0.175, 142, 220);
  const positions = new Map();
  const branchNodes = [];
  const familyNodes = [];
  const edges = [];
  const leafByModelId = new Map();

  problemBranches.forEach((branch) => {
    const angle = degToRad(branch.angle);
    const branchPos = {
      x: root.x + Math.cos(angle) * branchRx,
      y: root.y + Math.sin(angle) * branchRy
    };
    const branchNode = { ...branch, groupId: branch.id, x: branchPos.x, y: branchPos.y, startX: branchPos.x, startY: branchPos.y };
    branchNodes.push(branchNode);
    edges.push({ from: root, to: branchNode, color: branch.color, id: `${branch.id}-root` });

    branch.families.forEach((family, familyIndex) => {
      const papers = models.filter((model) => model.family === family);
      const problemGroups = splitProblemLeafGroups(family, papers);
      const fan = degToRad((familyIndex - (branch.families.length - 1) / 2) * 18);
      problemGroups.forEach((group, groupIndex) => {
        const groupFan = degToRad((groupIndex - (problemGroups.length - 1) / 2) * 12);
        const familyAngle = angle + fan + groupFan;
        const radialBump = problemGroups.length > 1 ? (groupIndex - (problemGroups.length - 1) / 2) * 12 : 0;
        const familyVector = {
          x: Math.cos(familyAngle) * (familyRx + Math.abs(radialBump)),
          y: Math.sin(familyAngle) * (familyRy + Math.abs(radialBump) * 0.55)
        };
        const familyPos = {
          x: branchPos.x + familyVector.x,
          y: branchPos.y + familyVector.y
        };
        const familyNode = {
          id: group.id,
          family,
          question: group.question,
          label: group.label,
          x: familyPos.x,
          y: familyPos.y,
          baseX: familyPos.x,
          baseY: familyPos.y,
          startX: familyPos.x,
          startY: familyPos.y,
          groupId: branch.id,
          color: branch.color
        };
        familyNodes.push(familyNode);
        edges.push({ from: branchNode, to: familyNode, color: branch.color, id: `${branch.id}-${group.id}` });

        group.papers.forEach((model, index) => {
          positions.set(model.id, { x: familyPos.x, y: familyPos.y + 52 + index * 4 });
          leafByModelId.set(model.id, familyNode);
        });
      });
    });
  });

  relaxProblemQuestions({ root, branchNodes, familyNodes }, bounds);
  separateLeafQuestionsFromBranches({ branchNodes, familyNodes }, bounds);
  layoutProblemPapers(positions, models, leafByModelId, { root, branchNodes, familyNodes });
  separateProblemGroups({ root, branchNodes, familyNodes }, positions, models, leafByModelId, bounds);
  return { root, branchNodes, familyNodes, edges, positions, leafAssignments: leafByModelId };
}

function splitProblemLeafGroups(family, papers) {
  const maxPapers = 3;
  if (papers.length <= maxPapers) {
    return [{
      id: family,
      family,
      label: familyLabels[family] || family,
      question: familyProblemQuestions[family] || familyLabels[family] || family,
      papers
    }];
  }
  const questions = familyProblemSplits[family] || [];
  const groupCount = Math.ceil(papers.length / maxPapers);
  return Array.from({ length: groupCount }, (_, index) => {
    const groupPapers = papers.slice(index * maxPapers, (index + 1) * maxPapers);
    return {
      id: `${family}-${index + 1}`,
      family,
      label: `${familyLabels[family] || family} ${index + 1}`,
      question: questions[index] || `${familyProblemQuestions[family] || familyLabels[family] || family} (${index + 1})`,
      papers: groupPapers
    };
  });
}

function relaxProblemQuestions(geometry, bounds) {
  const leafWidth = problemQuestionWidth("leaf");
  const branchWidth = problemQuestionWidth("branch");
  const rootWidth = problemQuestionWidth("root");
  const rootLayout = questionTextLayout(rootProblemQuestion, rootWidth, "root");
  const nodes = [
    { ...geometry.root, ref: geometry.root, fixed: true, w: 760, h: rootLayout.h + 120 },
    ...geometry.branchNodes.map((node) => ({
      ...node,
      ref: node,
      anchorX: node.x,
      anchorY: node.y,
      w: problemQuestionCollision("branch", branchWidth, measureQuestionHeight(node.question, branchWidth, "branch")).w,
      h: measureQuestionHeight(node.question, branchWidth, "branch") + 58
    })),
    ...geometry.familyNodes.map((node) => ({
      ...node,
      ref: node,
      anchorX: node.x,
      anchorY: node.y,
      w: questionTextLayout(node.question, leafWidth, "leaf", node.label).boxWidth + 18,
      h: measureQuestionHeight(node.question, leafWidth, "leaf", node.label) + 12
    }))
  ];
  const pad = { left: 58, right: 58, top: 158, bottom: 132 };

  for (let tick = 0; tick < 180; tick += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const minX = (a.w + b.w) / 2 + 34;
        const minY = (a.h + b.h) / 2 + 28;
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const ox = minX - Math.abs(dx);
        const oy = minY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const pushX = Math.sign(dx) * ox * 0.72;
        const pushY = Math.sign(dy) * oy * 0.72;
        if (!a.fixed && ox < oy) a.x -= pushX;
        if (!b.fixed && ox < oy) b.x += pushX;
        if (!a.fixed && ox >= oy) a.y -= pushY;
        if (!b.fixed && ox >= oy) b.y += pushY;
      }
    }

    nodes.forEach((node) => {
      if (node.fixed) return;
      node.x += (node.anchorX - node.x) * 0.014;
      node.y += (node.anchorY - node.y) * 0.014;
      node.x = clamp(node.x, pad.left + node.w / 2, bounds.width - pad.right - node.w / 2);
      node.y = clamp(node.y, pad.top + node.h / 2, bounds.height - pad.bottom - node.h / 2);
    });
  }

  nodes.forEach((node) => {
    node.ref.startX = node.anchorX ?? node.x;
    node.ref.startY = node.anchorY ?? node.y;
    node.ref.x = node.x;
    node.ref.y = node.y;
  });
}

function separateLeafQuestionsFromBranches(geometry, bounds) {
  const pad = { left: -760, right: -760, top: 120, bottom: -620 };
  geometry.branchNodes.forEach((branch) => {
    const leaves = geometry.familyNodes.filter((leaf) => leaf.groupId === branch.groupId);
    const outward = directionalVector(problemBranchAngle(branch.groupId));
    const tangent = { x: -outward.y, y: outward.x };
    const branchBox = problemNodeBox(branch, "branch");
    leaves.forEach((leaf, index) => {
      const leafBox = problemNodeBox(leaf, "leaf");
      const offset = (index - (leaves.length - 1) / 2) * Math.max(82, leafBox.w + 24);
      const radial = Math.max(190, branchBox.w * 0.5 + leafBox.w * 0.5 + 76);
      leaf.x = branch.x + outward.x * radial + tangent.x * offset;
      leaf.y = branch.y + outward.y * radial + tangent.y * offset;
    });

    for (let tick = 0; tick < 180; tick += 1) {
      leaves.forEach((leaf) => {
        const liveBranchBox = { ...problemNodeBox(branch, "branch"), x: branch.x, y: branch.y };
        const leafBox = { ...problemNodeBox(leaf, "leaf"), x: leaf.x, y: leaf.y };
        const overlap = boxOverlap(liveBranchBox, leafBox, 40, 28);
        if (!overlap) {
          leaf.x += (leaf.startX - leaf.x) * 0.006;
          leaf.y += (leaf.startY - leaf.y) * 0.006;
          return;
        }
        const dx = leaf.x - branch.x;
        const dy = leaf.y - branch.y;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 1.05;
        leaf.x += (dx / length) * push;
        leaf.y += (dy / length) * push;
      });

      for (let i = 0; i < leaves.length; i += 1) {
        for (let j = i + 1; j < leaves.length; j += 1) {
          const a = leaves[i];
          const b = leaves[j];
          const boxA = { ...problemNodeBox(a, "leaf"), x: a.x, y: a.y };
          const boxB = { ...problemNodeBox(b, "leaf"), x: b.x, y: b.y };
          const overlap = boxOverlap(boxA, boxB, 34, 24);
          if (!overlap) continue;
          const dx = b.x - a.x || tangent.x || 0.01;
          const dy = b.y - a.y || tangent.y || 0.01;
          const length = Math.hypot(dx, dy) || 1;
          const push = overlap.push * 0.62;
          a.x -= (dx / length) * push;
          a.y -= (dy / length) * push;
          b.x += (dx / length) * push;
          b.y += (dy / length) * push;
        }
      }

      leaves.forEach((leaf) => {
        const leafBox = problemNodeBox(leaf, "leaf");
        leaf.x = clamp(leaf.x, pad.left + leafBox.w / 2, bounds.width - pad.right - leafBox.w / 2);
        leaf.y = clamp(leaf.y, pad.top + leafBox.h / 2, bounds.height - pad.bottom - leafBox.h / 2);
      });
    }
  });
}

function measureQuestionHeight(text, width, level, eyebrow = "") {
  const layout = questionTextLayout(text, width, level, eyebrow);
  return layout.h;
}

function layoutProblemPapers(positions, models, leafByModelId, geometry) {
  const leafWidth = problemQuestionWidth("leaf");
  const papersByLeaf = new Map();
  const placedByGroup = new Map();
  const obstacles = [
    { ref: geometry.root, ...rootProblemBox() },
    ...geometry.branchNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "branch") })),
    ...geometry.familyNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "leaf") }))
  ];
  models.forEach((model) => {
    const leaf = leafByModelId.get(model.id);
    const point = positions.get(model.id);
    if (!leaf || !point) return;
    if (!papersByLeaf.has(leaf.id)) papersByLeaf.set(leaf.id, { leaf, papers: [] });
    papersByLeaf.get(leaf.id).papers.push({ model, point, box: problemPaperBox(model, point) });
  });

  papersByLeaf.forEach(({ leaf, papers }) => {
    const leafLayout = questionTextLayout(leaf.question, leafWidth, "leaf", leaf.label);
    const leafBox = problemQuestionCollision("leaf", leafLayout.boxWidth, leafLayout.h);
    const outward = radialVectorFromRoot(leaf, geometry.root);
    const tangent = { x: -outward.y, y: outward.x };
    const edgeDistance = rectEdgeDistance(leafBox, outward);
    const groupPlaced = placedByGroup.get(leaf.groupId) || [];
    const groupObstacles = obstacles.filter((item) => !item.ref.groupId || item.ref.groupId === leaf.groupId);

    papers
      .slice()
      .sort((a, b) => b.box.w - a.box.w)
      .forEach((paper, index) => {
        const candidate = bestPaperSlot({
          paper,
          leaf,
          outward,
          tangent,
          edgeDistance,
          obstacles: groupObstacles,
          placed: groupPlaced,
          index
        });
        paper.point.x = candidate.x;
        paper.point.y = candidate.y;
        groupPlaced.push({ ref: paper.point, w: paper.box.w, h: paper.box.h });
        placedByGroup.set(leaf.groupId, groupPlaced);
      });
  });
}

function bestPaperSlot({ paper, leaf, outward, tangent, edgeDistance, obstacles, placed, index }) {
  const tangentSteps = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const radialSteps = [0, 1, 2, 3, 4];
  const tangentGap = Math.max(46, paper.box.w * 0.46);
  const radialGap = 26;
  let fallback = null;

  for (const radialIndex of radialSteps) {
    for (const tangentIndex of tangentSteps) {
      const localX = tangentIndex * tangentGap + (index % 2 ? tangentGap * 0.12 : 0);
      const radialPush = edgeDistance + 10 + radialIndex * radialGap + Math.abs(localX) * 0.025;
      const candidate = {
        x: leaf.x + outward.x * radialPush + tangent.x * localX,
        y: leaf.y + outward.y * radialPush + tangent.y * localX,
        w: paper.box.w,
        h: paper.box.h
      };
      const score = paperSlotOverlapScore(candidate, obstacles, placed);
      const distance = radialIndex * 1000 + Math.abs(tangentIndex) * 70 + Math.abs(localX) * 0.02;
      const ranked = { ...candidate, score, distance };
      if (!fallback || score < fallback.score || (score === fallback.score && distance < fallback.distance)) fallback = ranked;
      if (score === 0) return candidate;
    }
  }
  return fallback || {
    x: leaf.x + outward.x * (edgeDistance + 24),
    y: leaf.y + outward.y * (edgeDistance + 24)
  };
}

function paperSlotOverlapScore(candidate, obstacles, placed) {
  let score = 0;
  [...obstacles, ...placed].forEach((item) => {
    const box = {
      x: item.ref.x,
      y: item.ref.y,
      w: item.w,
      h: item.h
    };
    const overlap = boxOverlap(candidate, box, 5, 4);
    if (overlap) score += overlap.x * overlap.y;
  });
  return score;
}

function radialVectorFromRoot(point, root) {
  const dx = point.x - root.x;
  const dy = point.y - root.y;
  const length = Math.hypot(dx, dy);
  if (length > 0.001) return { x: dx / length, y: dy / length };
  return directionalVector(problemBranchAngle(point.groupId));
}

function separateProblemGroups(geometry, positions, models, leafByModelId, bounds) {
  const groups = new Map(problemBranches.map((branch) => [branch.id, {
    id: branch.id,
    angle: degToRad(branch.angle),
    branch,
    items: []
  }]));
  geometry.branchNodes.forEach((node) => {
    groups.get(node.groupId)?.items.push({ ref: node, ...problemNodeBox(node, "branch") });
  });
  geometry.familyNodes.forEach((node) => {
    groups.get(node.groupId)?.items.push({ ref: node, ...problemNodeBox(node, "leaf") });
  });
  models.forEach((model) => {
    const point = positions.get(model.id);
    const leaf = leafByModelId.get(model.id);
    if (!point || !leaf) return;
    groups.get(leaf.groupId)?.items.push({ ref: point, ...problemPaperBox(model, point) });
  });

  packProblemGroups(Array.from(groups.values()).filter((group) => group.items.length), geometry.root, bounds);
}

function packProblemGroups(groups, root, bounds) {
  const pad = { left: -900, right: -900, top: 90, bottom: -720 };
  const rootLayout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
  const rootBox = {
    x: root.x,
    y: root.y,
    w: Math.min(bounds.width * 0.48, 730),
    h: rootLayout.h + 150
  };
  groups.forEach((group) => {
    const anchor = problemGroupAnchor(group.id, root, bounds);
    const box = groupBounds(group.items);
    translateProblemGroup(group, anchor.x - box.x, anchor.y - box.y);
    Object.assign(group, {
      x: anchor.x,
      y: anchor.y,
      vx: 0,
      vy: 0,
      anchorX: anchor.x,
      anchorY: anchor.y
    });
  });

  for (let tick = 0; tick < 420; tick += 1) {
    groups.forEach((group) => {
      const box = groupBounds(group.items);
      group.x = box.x;
      group.y = box.y;
      group.w = box.w;
      group.h = box.h;
      group.vx += (group.anchorX - group.x) * 0.018;
      group.vy += (group.anchorY - group.y) * 0.018;

      const rootOverlap = boxOverlap(box, rootBox, 50, 36);
      if (rootOverlap) {
        const dir = directionalVector(group.angle);
        group.vx += dir.x * rootOverlap.push * 0.18;
        group.vy += dir.y * rootOverlap.push * 0.18;
      }
    });

    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        const boxA = groupBounds(a.items);
        const boxB = groupBounds(b.items);
        const overlap = boxOverlap(boxA, boxB, 66, 48);
        if (!overlap) continue;
        const dx = boxB.x - boxA.x || Math.cos(b.angle) - Math.cos(a.angle) || 0.01;
        const dy = boxB.y - boxA.y || Math.sin(b.angle) - Math.sin(a.angle) || 0.01;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 0.26;
        a.vx -= (dx / length) * push;
        a.vy -= (dy / length) * push;
        b.vx += (dx / length) * push;
        b.vy += (dy / length) * push;
      }
    }

    groups.forEach((group) => {
      group.vx *= 0.54;
      group.vy *= 0.54;
      translateProblemGroup(group, group.vx, group.vy);
      const box = groupBounds(group.items);
      let dx = 0;
      let dy = 0;
      if (box.left < pad.left) dx = pad.left - box.left;
      if (box.right > bounds.width - pad.right) dx = bounds.width - pad.right - box.right;
      if (box.top < pad.top) dy = pad.top - box.top;
      if (box.bottom > bounds.height - pad.bottom) dy = bounds.height - pad.bottom - box.bottom;
      if (dx || dy) {
        translateProblemGroup(group, dx, dy);
        group.vx *= 0.2;
        group.vy *= 0.2;
      }
    });
  }

  for (let pass = 0; pass < 12; pass += 1) {
    groups.forEach((group) => {
      const box = groupBounds(group.items);
      const rootOverlap = boxOverlap(box, rootBox, 58, 42);
      if (!rootOverlap) return;
      const dir = directionalVector(group.angle);
      translateProblemGroup(group, dir.x * rootOverlap.push * 0.8, dir.y * rootOverlap.push * 0.8);
    });
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        const boxA = groupBounds(a.items);
        const boxB = groupBounds(b.items);
        const overlap = boxOverlap(boxA, boxB, 78, 58);
        if (!overlap) continue;
        const dx = boxB.x - boxA.x || 0.01;
        const dy = boxB.y - boxA.y || 0.01;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 0.55;
        translateProblemGroup(a, (-dx / length) * push, (-dy / length) * push);
        translateProblemGroup(b, (dx / length) * push, (dy / length) * push);
      }
    }
  }
}

function problemGroupAnchor(groupId, root, bounds) {
  const w = bounds.width;
  const h = bounds.height;
  const anchors = {
    futures: { x: root.x - w * 0.2, y: root.y - h * 0.16 },
    coupling: { x: root.x + w * 0.2, y: root.y - h * 0.17 },
    speed: { x: root.x + w * 0.24, y: root.y + h * 0.12 },
    grounding: { x: root.x + w * 0.035, y: root.y + h * 0.22 },
    physics: { x: root.x - w * 0.22, y: root.y + h * 0.16 }
  };
  return anchors[groupId] || {
    x: root.x + Math.cos(problemBranchAngle(groupId)) * w * 0.3,
    y: root.y + Math.sin(problemBranchAngle(groupId)) * h * 0.28
  };
}

function problemNodeBox(node, level) {
  const width = problemQuestionWidth(level);
  const layout = questionTextLayout(node.question, width, level, node.label);
  const collision = problemQuestionCollision(level, layout.boxWidth, layout.h);
  return { x: node.x, y: node.y, w: collision.w, h: collision.h };
}

function problemGeometryBounds(geometry, models) {
  const items = [
    { ref: geometry.root, ...rootProblemBox() },
    ...geometry.branchNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "branch") })),
    ...geometry.familyNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "leaf") }))
  ];
  models.forEach((model) => {
    const point = geometry.positions.get(model.id);
    if (!point) return;
    items.push({ ref: point, ...problemPaperBox(model, point) });
  });
  return groupBounds(items);
}

function rootProblemBox() {
  const layout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
  return problemQuestionCollision("root", layout.boxWidth, layout.h);
}

function problemPaperBox(model, point) {
  return {
    x: point.x,
    y: point.y,
    w: Math.min(132, Math.max(82, shortPaperName(model.name).length * 6.2 + 38)),
    h: 42
  };
}

function groupBounds(items) {
  const bounds = items.reduce((acc, item) => {
    const x = item.ref.x;
    const y = item.ref.y;
    const left = x - item.w / 2;
    const right = x + item.w / 2;
    const top = y - item.h / 2;
    const bottom = y + item.h / 2;
    return {
      left: Math.min(acc.left, left),
      right: Math.max(acc.right, right),
      top: Math.min(acc.top, top),
      bottom: Math.max(acc.bottom, bottom)
    };
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  return {
    ...bounds,
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    w: bounds.right - bounds.left,
    h: bounds.bottom - bounds.top
  };
}

function boxOverlap(a, b, gapX, gapY) {
  const ox = (a.w + b.w) / 2 + gapX - Math.abs(b.x - a.x);
  const oy = (a.h + b.h) / 2 + gapY - Math.abs(b.y - a.y);
  if (ox <= 0 || oy <= 0) return null;
  return { x: ox, y: oy, push: Math.min(ox, oy) + 6 };
}

function directionalVector(angle) {
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function translateProblemGroup(group, dx, dy) {
  group.items.forEach((item) => {
    item.ref.x += dx;
    item.ref.y += dy;
  });
}

function timelineGeometry(models, bounds) {
  const sorted = models.slice().sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name));
  const dates = sorted.map(slugDate);
  const min = Math.floor(Math.min(...dates));
  const max = Math.ceil(Math.max(...dates));
  const span = Math.max(0.1, max - min);
  const left = 92;
  const right = bounds.width - 84;
  const centerY = bounds.height / 2 + 8;
  const positions = new Map();
  const connectors = [];

  sorted.forEach((model, index) => {
    const x = left + ((slugDate(model) - min) / span) * (right - left);
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor(index / 2) % 5;
    const y = centerY + side * (72 + lane * 46);
    const nodeX = clamp(x + (((index % 4) - 1.5) * 18), 60, bounds.width - 60);
    const nodeY = clamp(y, 56, bounds.height - 56);
    positions.set(model.id, { x: nodeX, y: nodeY });
    connectors.push({
      id: model.id,
      x,
      y: nodeY,
      nodeX,
      centerY,
      color: familyColors[model.family] || "#8aa0a7"
    });
  });

  return { min, max, left, right, centerY, positions, connectors };
}

function drawProblemBackdrop(group, defs, geometry) {
  const layer = atlasAnnotationLayer("problem-tree");
  geometry.edges.forEach((edge, index) => {
    drawFadingConnector(layer, defs, `problem-${index}-${edge.id}`, edge.from, edge.to, edge.color, true);
  });
  geometry.positions.forEach((point, modelId) => {
    const leaf = geometry.leafAssignments.get(modelId);
    if (!leaf) return;
    drawPaperTether(layer, leaf, point, modelId);
  });
  layer.insertAdjacentHTML("beforeend", drawQuestionNode(geometry.root, rootProblemQuestion, "problem-root", "#172024", problemQuestionWidth("root"), "root"));
  geometry.branchNodes.forEach((branch) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(branch, branch.question, "problem-branch", branch.color, problemQuestionWidth("branch"), "branch"));
  });
  geometry.familyNodes.forEach((family) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(family, family.question, "problem-leaf-question", family.color, problemQuestionWidth("leaf"), "leaf"));
  });
  group.appendChild(layer);
}

function drawPaperTether(layer, leaf, point, modelId = "") {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "paper-tether");
  path.dataset.leafId = leaf.id || "";
  path.dataset.paperId = modelId;
  path.setAttribute("stroke", leaf.color || "#9aa6aa");
  path.setAttribute("d", paperTetherPath(leaf, point));
  layer.appendChild(path);
}

function paperTetherPath(leaf, point) {
  const dx = point.x - leaf.x;
  const dy = point.y - leaf.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const leafLayout = questionTextLayout(leaf.question, problemQuestionWidth("leaf"), "leaf", leaf.label);
  const leafBox = problemQuestionCollision("leaf", leafLayout.boxWidth, leafLayout.h);
  const startDistance = rectEdgeDistance(leafBox, unit) + 5;
  const start = {
    x: leaf.x + unit.x * startDistance,
    y: leaf.y + unit.y * startDistance
  };
  const end = {
    x: point.x - unit.x * 14,
    y: point.y - unit.y * 14
  };
  return `M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`;
}

function drawTimelineBackdrop(group, geometry) {
  const layer = atlasAnnotationLayer("timeline-map");
  const ticks = [];
  for (let year = geometry.min; year <= geometry.max; year += 1) {
    const x = geometry.left + ((year - geometry.min) / Math.max(0.1, geometry.max - geometry.min)) * (geometry.right - geometry.left);
    ticks.push(`
      <line class="timeline-tick" x1="${x}" y1="${geometry.centerY - 8}" x2="${x}" y2="${geometry.centerY + 8}"></line>
      <text class="timeline-date" x="${x}" y="${geometry.centerY + 31}" text-anchor="middle">${year}</text>
    `);
  }
  const lines = geometry.connectors.map((item, index) => {
    const midY = item.y < item.centerY ? item.y + 22 : item.y - 22;
    return `<path class="timeline-branch" stroke="${item.color}" d="M ${item.x} ${item.centerY} V ${midY} H ${item.nodeX} V ${item.y}"></path>`;
  }).join("");
  layer.innerHTML = `
    <path class="timeline-spine" d="M ${geometry.left} ${geometry.centerY} H ${geometry.right}"></path>
    ${ticks.join("")}
    ${lines}
  `;
  group.appendChild(layer);
}

function drawSpeedBackdrop(group, bounds) {
  const layer = atlasAnnotationLayer("speed-map");
  const left = 78;
  const bottom = bounds.height - 75;
  const right = bounds.width - 64;
  const top = 56;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const x = left + index * ((right - left) / 4);
    const y = bottom - index * ((bottom - top) / 4);
    return `
      <line class="speed-grid" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"></line>
      <line class="speed-grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line>
    `;
  }).join("");
  layer.innerHTML = `
    ${grid}
    <line class="speed-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" marker-end="url(#atlasArrow)"></line>
    <line class="speed-axis" x1="${left}" y1="${bottom}" x2="${left}" y2="${top}" marker-end="url(#atlasArrow)"></line>
    <text class="axis-label" x="${right - 138}" y="${bottom + 38}">runtime cost</text>
    <text class="axis-label" x="${left - 55}" y="${top + 18}" transform="rotate(-90 ${left - 55} ${top + 18})">compute scale</text>
  `;
  group.appendChild(layer);
}

function drawTaxonomyBackdrop(group, bounds) {
  const layer = atlasAnnotationLayer("taxonomy-map");
  const centers = taxonomyFamilyCenters(bounds);
  familyOrder().forEach((family) => {
    const center = centers.get(family);
    if (!center) return;
    const color = familyColors[family] || "#8aa0a7";
    layer.insertAdjacentHTML("beforeend", `
      <g class="taxonomy-family">
        <circle cx="${center.x}" cy="${center.y}" r="54" fill="${color}" opacity="0.08"></circle>
        <text class="layout-label" x="${center.x}" y="${center.y - 66}" text-anchor="middle">${escapeHtml(familyLabels[family] || family)}</text>
      </g>
    `);
  });
  group.appendChild(layer);
}

function taxonomyFamilyCenters(bounds) {
  const families = familyOrder();
  const columns = Math.ceil(Math.sqrt(families.length));
  const rows = Math.ceil(families.length / columns);
  const centers = new Map();
  families.forEach((family, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    centers.set(family, {
      x: 140 + col * ((bounds.width - 280) / Math.max(1, columns - 1)),
      y: 135 + row * ((bounds.height - 270) / Math.max(1, rows - 1))
    });
  });
  return centers;
}

function drawQuestionNode(point, text, cls, color, width, level, eyebrow = "") {
  const layout = questionTextLayout(text, width, level, eyebrow);
  const { lines, h, fontSize, lineHeight, top, weight, boxWidth } = layout;
  const startX = Number.isFinite(point.startX) ? point.startX : point.x;
  const startY = Number.isFinite(point.startY) ? point.startY : point.y;
  const boxed = level === "leaf";
  const fill = problemQuestionTextColor(level, color);
  const collision = problemQuestionCollision(level, boxWidth, h);
  const groupId = level === "root" ? "root" : point.groupId || point.id || "";
  return `
    <g class="${cls} problem-pop" transform="translate(${point.x} ${point.y})" data-node-id="${escapeHtml(point.id || "")}" data-group-id="${escapeHtml(groupId)}" data-level="${level}" data-width="${collision.w}" data-height="${collision.h}" data-start-x="${startX}" data-start-y="${startY}" data-final-x="${point.x}" data-final-y="${point.y}">
      ${boxed ? `<rect x="${-boxWidth / 2}" y="${-h / 2}" width="${boxWidth}" height="${h}" fill="${color}"></rect>` : ""}
      ${boxed && eyebrow ? `<text class="problem-eyebrow" x="0" y="${-h / 2 + 13}" text-anchor="middle">${escapeHtml(eyebrow)}</text>` : ""}
      <text class="problem-question" x="0" y="${boxed ? -h / 2 + top : top}" text-anchor="middle" style="fill:${escapeHtml(fill)};font-size:${fontSize}px;font-weight:${weight}">
        ${lines.map((line, index) => `<tspan x="0" dy="${index ? lineHeight : 0}">${escapeHtml(line)}</tspan>`).join("")}
      </text>
    </g>
  `;
}

function problemQuestionWidth(level) {
  if (level === "root") return 780;
  if (level === "branch") return 420;
  return 142;
}

function problemQuestionTextColor(level, color) {
  if (level === "root") return "#172024";
  if (level === "leaf") return "#263238";
  return {
    "#a8d8ef": "#2f7f91",
    "#cdb8e6": "#7656a6",
    "#b6dfc2": "#2d7c59",
    "#f2cf93": "#9a690f",
    "#efb8b1": "#a4493f"
  }[color] || "#3f4a50";
}

function problemQuestionCollision(level, boxWidth, h) {
  if (level === "root") return { w: 980, h: h + 260 };
  if (level === "branch") return { w: boxWidth + 42, h: h + 58 };
  return { w: boxWidth + 12, h: h + 8 };
}

function questionTextLayout(text, width, level, eyebrow = "") {
  const configs = {
    root: { font: 62, minFont: 56, line: 68, minH: 216, maxLines: 3, top: -74, weight: 950 },
    branch: { font: 28, minFont: 24, line: 32, minH: 104, maxLines: 3, top: -34, weight: 900 },
    leaf: { font: 10, minFont: 8.2, line: 10.7, minH: 34, maxLines: 6, top: 11, weight: 820 }
  };
  const cfg = configs[level] || configs.leaf;
  let fontSize = cfg.font;
  let lines = [];
  while (fontSize >= cfg.minFont) {
    const chars = Math.max(8, Math.floor((width - 32) / (fontSize * 0.68)));
    lines = wrapText(text, chars);
    if (lines.length <= cfg.maxLines) break;
    fontSize -= 0.7;
  }
  const lineHeight = Math.max(cfg.line - (cfg.font - fontSize) * 0.3, fontSize + 2);
  const top = cfg.top;
  const bottom = level === "leaf" ? 4 : 0;
  const h = level === "leaf"
    ? Math.max(cfg.minH, top + lines.length * lineHeight + bottom)
    : Math.max(cfg.minH, lines.length * lineHeight);
  const contentWidth = Math.max(
    ...lines.map((line) => line.length * fontSize * 0.6),
    eyebrow ? eyebrow.length * 4.6 : 0
  );
  const boxWidth = level === "leaf" ? Math.round(clamp(contentWidth + 14, 88, width)) : width;
  return { lines, h, boxWidth, fontSize: Number(fontSize.toFixed(1)), lineHeight: Number(lineHeight.toFixed(1)), top, weight: cfg.weight };
}

function drawFadingConnector(layer, defs, id, from, to, color, curved = true) {
  const safeId = id.replace(/[^a-z0-9_-]/gi, "-");
  const style = connectorStyle(from, to);
  const endpoints = connectorEndpoints(from, to, 6, style.arrow);
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", `${safeId}-fade`);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", endpoints.from.x);
  gradient.setAttribute("y1", endpoints.from.y);
  gradient.setAttribute("x2", endpoints.to.x);
  gradient.setAttribute("y2", endpoints.to.y);
  gradient.innerHTML = `
    <stop offset="0%" stop-color="${color}" stop-opacity="0"></stop>
    <stop offset="3%" stop-color="${color}" stop-opacity=".02"></stop>
    <stop offset="7%" stop-color="${color}" stop-opacity=".08"></stop>
    <stop offset="13%" stop-color="${color}" stop-opacity=".2"></stop>
    <stop offset="22%" stop-color="${color}" stop-opacity=".38"></stop>
    <stop offset="36%" stop-color="${color}" stop-opacity=".58"></stop>
    <stop offset="70%" stop-color="${color}" stop-opacity=".72"></stop>
    <stop offset="100%" stop-color="${color}" stop-opacity=".82"></stop>
  `;
  defs.appendChild(gradient);

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", `${safeId}-arrow`);
  marker.setAttribute("viewBox", "0 0 14 14");
  marker.setAttribute("refX", "0");
  marker.setAttribute("refY", "7");
  marker.setAttribute("markerWidth", style.arrow);
  marker.setAttribute("markerHeight", style.arrow);
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("orient", "auto-start-reverse");
  marker.innerHTML = `<path d="M0,0 L14,7 L0,14 z" fill="${color}" opacity=".86"></path>`;
  defs.appendChild(marker);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "problem-link");
  path.dataset.from = from.id || "";
  path.dataset.to = to.id || "";
  path.setAttribute("d", curved ? curvedPath(endpoints.from, endpoints.to) : `M ${endpoints.from.x} ${endpoints.from.y} L ${endpoints.to.x} ${endpoints.to.y}`);
  path.setAttribute("stroke", `url(#${safeId}-fade)`);
  path.style.strokeWidth = `${style.stroke}px`;
  path.style.strokeLinecap = "butt";
  path.setAttribute("marker-end", `url(#${safeId}-arrow)`);
  layer.appendChild(path);
}

function connectorStyle(from, to) {
  if (from.id === "root") return { stroke: 14, arrow: 27 };
  if (to.family) return { stroke: 7, arrow: 18 };
  return { stroke: 10, arrow: 21 };
}

function connectorEndpoints(from, to, gap = 12, arrowLength = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const fromBox = connectorBox(from);
  const toBox = connectorBox(to);
  const fromDistance = rectEdgeDistance(fromBox, unit) + gap;
  const toDistance = rectEdgeDistance(toBox, { x: -unit.x, y: -unit.y }) + gap + arrowLength;
  return {
    from: {
      x: from.x + unit.x * fromDistance,
      y: from.y + unit.y * fromDistance
    },
    to: {
      x: to.x - unit.x * toDistance,
      y: to.y - unit.y * toDistance
    }
  };
}

function connectorBox(node) {
  if (node.id === "root") {
    const layout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
    return visualTextBox(layout, 18);
  }
  if (node.family) {
    const layout = questionTextLayout(node.question, problemQuestionWidth("leaf"), "leaf", node.label);
    return { w: layout.boxWidth, h: layout.h };
  }
  const layout = questionTextLayout(node.question, problemQuestionWidth("branch"), "branch");
  return visualTextBox(layout, 14);
}

function visualTextBox(layout, pad) {
  const textWidth = Math.max(...layout.lines.map((line) => line.length * layout.fontSize * 0.6));
  return {
    w: textWidth + pad * 2,
    h: layout.lines.length * layout.lineHeight + pad * 2
  };
}

function rectEdgeDistance(box, unit) {
  const xDistance = Math.abs(unit.x) > 0.001 ? box.w / 2 / Math.abs(unit.x) : Infinity;
  const yDistance = Math.abs(unit.y) > 0.001 ? box.h / 2 / Math.abs(unit.y) : Infinity;
  return Math.min(xDistance, yDistance);
}

function atlasAnnotationLayer(name) {
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.classList.add("atlas-annotation", "is-entering", name);
  return layer;
}

function drawPaperNode(model, radius, color, hasLiteral, labelSide = "right") {
  const inst = institutionFor(model);
  const logo = institutionLogoUrl(inst.domain);
  const labelX = labelSide === "left" ? -(radius + 9) : radius + 9;
  const labelAnchor = labelSide === "left" ? "end" : "start";
  return `
    <circle class="node-halo" r="${radius + 5}" fill="${color}" opacity=".16"></circle>
    <circle class="node-ring" r="${radius}" fill="${color}"></circle>
    <circle class="node-logo-bg" r="9.5" fill="#fff"></circle>
    <text class="logo-initials" x="0" y="3" text-anchor="middle">${escapeHtml(inst.initials)}</text>
    <image class="node-logo-image" href="${escapeHtml(logo)}" x="-8" y="-8" width="16" height="16"></image>
    ${hasLiteral ? `<circle class="node-literal-dot" cx="${radius - 2}" cy="${-radius + 2}" r="3.3"></circle>` : ""}
    <text class="node-name" x="${labelX}" y="4" text-anchor="${labelAnchor}">${escapeHtml(shortPaperName(model.name))}</text>
    <title>${escapeHtml(`${model.name} - ${inst.label}`)}</title>
  `;
}

function institutionFor(model) {
  const [label, domain] = institutionMeta[model.id] || ["Institution", "arxiv.org"];
  const words = label.replace(/\([^)]*\)/g, "").split(/\s+/).filter(Boolean);
  const initials = words.length === 1
    ? words[0].slice(0, 2)
    : words.slice(0, 2).map((word) => word[0]).join("");
  return { label, domain, initials: initials.toUpperCase() };
}

function shortPaperName(name) {
  return shortText(name, state.mode === "problem" ? 12 : 24);
}

function institutionLogoUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setAtlasTransform(group) {
  group.setAttribute("transform", `translate(${state.zoom.x} ${state.zoom.y}) scale(${state.zoom.k})`);
}

function renderAtlas() {
  const svg = $("#atlasSvg");
  const width = svg.clientWidth || 1000;
  const height = svg.clientHeight || 690;
  const bounds = { width, height };
  const previousPositions = new Map(state.lastAtlasPositions || []);
  const nextPositions = new Map();
  const animatedNodes = [];
  const problemGeo = state.mode === "problem" ? problemGeometry(state.models, bounds) : null;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="atlasArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="rgba(23,32,36,0.42)"></path>
    </marker>`;
  svg.appendChild(defs);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = "atlasGroup";
  setAtlasTransform(group);
  svg.appendChild(group);

  drawAtlasBackdrop(group, defs, bounds, problemGeo);

  const visible = new Set(filteredModels().map((model) => model.id));
  const useProblemIntro = state.mode === "problem" && state.lastRenderedMode !== "problem";
  const introCenter = problemGeo?.root || { x: bounds.width / 2, y: bounds.height * 0.48 + 36 };
  state.models.forEach((model, index) => {
    const target = problemGeo?.positions.get(model.id) || positionModel(model, index, state.models, bounds) || { x: width / 2, y: height / 2 };
    const leaf = problemGeo?.leafAssignments.get(model.id);
    nextPositions.set(model.id, target);
    const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hasLiteral = Boolean(model.literalArchitecture || state.arch[model.id]);
    node.classList.add("node");
    if (!visible.has(model.id)) node.classList.add("is-muted");
    if (state.selectedId === model.id || state.hoveredId === model.id) node.classList.add("is-active");
    node.dataset.id = model.id;
    node.style.transition = useProblemIntro ? "none" : "transform 720ms cubic-bezier(.22,.61,.36,1), opacity 360ms ease";
    const start = previousPositions.get(model.id);
    if (useProblemIntro) {
      node.setAttribute("transform", `translate(${introCenter.x} ${introCenter.y}) scale(.72)`);
      node.style.opacity = visible.has(model.id) ? "1" : "0.18";
    } else if (start) {
      node.setAttribute("transform", `translate(${start.x} ${start.y})`);
      node.style.opacity = visible.has(model.id) ? "1" : "0.18";
    } else {
      node.setAttribute("transform", `translate(${target.x} ${target.y}) scale(.78)`);
      node.style.opacity = "0";
    }

    const radius = hasLiteral ? 12 : 9;
    const color = familyColors[model.family] || "#61717a";
    node.innerHTML = `<g class="node-body">${drawPaperNode(model, radius, color, hasLiteral, target.x > width - 180 ? "left" : "right")}</g>`;
    node.addEventListener("mouseenter", (event) => showPreview(model.id, event));
    node.addEventListener("mousemove", positionPreview);
    node.addEventListener("mouseleave", hidePreview);
    node.addEventListener("focus", () => showPreview(model.id));
    node.addEventListener("blur", hidePreview);
    node.addEventListener("click", () => openModel(model.id));
    node.setAttribute("tabindex", "0");
    group.appendChild(node);
    animatedNodes.push({ node, target, visible: visible.has(model.id), leafId: leaf?.id || "", groupId: leaf?.groupId || "" });
  });

  $("#modeDescription").textContent = modeDescriptions[state.mode];
  bindZoom(svg, group);
  requestAnimationFrame(() => {
    group.querySelectorAll(".atlas-annotation.is-entering").forEach((item) => item.classList.remove("is-entering"));
    if (useProblemIntro) {
      animateProblemIntro(group, animatedNodes, bounds);
    } else {
      animatedNodes.forEach(({ node, target, visible: isVisible }) => {
        node.setAttribute("transform", `translate(${target.x} ${target.y})`);
        node.style.opacity = isVisible ? "1" : "0.18";
      });
    }
  });
  state.lastAtlasPositions = nextPositions;
  state.lastRenderedMode = state.mode;
}

function animateProblemIntro(group, animatedNodes, bounds) {
  if (state.mode !== "problem") return;
  const rootNode = group.querySelector(".problem-root.problem-pop");
  const center = rootNode
    ? { x: Number(rootNode.dataset.finalX), y: Number(rootNode.dataset.finalY) }
    : { x: bounds.width / 2, y: bounds.height * 0.48 + 36 };
  const problemItems = Array.from(group.querySelectorAll(".problem-pop")).map((node, index) => introItem({
    node,
    index,
    center,
    target: {
      x: Number(node.dataset.finalX),
      y: Number(node.dataset.finalY)
    },
    groupId: node.dataset.groupId || "",
    visible: true,
    scaleStart: node.dataset.level === "root" ? 0.96 : 0.72
  }));
  const paperItems = animatedNodes.map((item, index) => introItem({
    node: item.node,
    index: index + problemItems.length,
    center,
    target: item.target,
    groupId: item.groupId,
    leafId: item.leafId,
    visible: item.visible,
    scaleStart: 0.72
  }));
  const items = [...problemItems, ...paperItems];
  const links = Array.from(group.querySelectorAll(".problem-link"));
  const tethers = Array.from(group.querySelectorAll(".paper-tether"));

  links.forEach((link) => {
    link.style.opacity = "0";
  });
  tethers.forEach((tether) => {
    tether.style.opacity = "0";
    tether.setAttribute("d", `M ${center.x} ${center.y} C ${center.x} ${center.y}, ${center.x} ${center.y}, ${center.x} ${center.y}`);
  });
  items.forEach((item) => {
    item.node.style.transition = "none";
    item.node.setAttribute("transform", `translate(${center.x} ${center.y}) scale(${item.scaleStart})`);
    item.node.style.opacity = item.visible ? "0.16" : "0.06";
  });

  const start = performance.now();
  const duration = 1450;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    items.forEach((item) => {
      item.node.style.transition = "";
      item.node.setAttribute("transform", `translate(${item.target.x} ${item.target.y})`);
      item.node.style.opacity = item.visible ? "1" : "0.18";
      item.current = item.target;
    });
    links.forEach((link) => {
      link.style.opacity = "";
    });
    updatePaperTethers(tethers, problemItems, paperItems);
    tethers.forEach((tether) => {
      tether.style.opacity = "";
    });
  };

  const step = (now) => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = easeOutCubic(t);
    items.forEach((item) => {
      const point = quadraticPoint(center, item.control, item.target, eased);
      item.current = point;
      const scale = item.scaleStart + (1 - item.scaleStart) * eased;
      item.node.setAttribute("transform", `translate(${point.x} ${point.y}) scale(${scale})`);
      item.node.style.opacity = String((item.visible ? 0.16 : 0.06) + (item.visible ? 0.84 : 0.12) * eased);
    });
    links.forEach((link) => {
      link.style.opacity = String(0.72 * Math.max(0, (t - 0.22) / 0.78));
    });
    updatePaperTethers(tethers, problemItems, paperItems);
    tethers.forEach((tether) => {
      tether.style.opacity = String(0.28 * Math.max(0, (t - 0.28) / 0.72));
    });
    if (t < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
  window.setTimeout(finish, duration + 260);
}

function introItem({ node, index, center, target, groupId, leafId = "", visible, scaleStart }) {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const curve = ((problemBranchAngle(groupId) || index * 0.41) % Math.PI) > Math.PI / 2 ? -1 : 1;
  const arc = clamp(length * 0.22, 34, 118) * curve;
  return {
    id: node.dataset.nodeId || node.dataset.id || "",
    node,
    target,
    current: center,
    leafId,
    visible,
    scaleStart,
    control: {
      x: center.x + dx * 0.46 - (dy / length) * arc,
      y: center.y + dy * 0.46 + (dx / length) * arc
    }
  };
}

function updatePaperTethers(tethers, problemItems, paperItems) {
  const leaves = new Map(problemItems.map((item) => [item.id, item.current || item.target]));
  const papers = new Map(paperItems.map((item) => [item.id, item.current || item.target]));
  tethers.forEach((tether) => {
    const leafPoint = leaves.get(tether.dataset.leafId);
    const paperPoint = papers.get(tether.dataset.paperId);
    if (!leafPoint || !paperPoint) return;
    tether.setAttribute("d", simplePaperTetherPath(leafPoint, paperPoint));
  });
}

function simplePaperTetherPath(leaf, point) {
  const dx = point.x - leaf.x;
  const dy = point.y - leaf.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const start = {
    x: leaf.x + unit.x * 30,
    y: leaf.y + unit.y * 30
  };
  const end = {
    x: point.x - unit.x * 14,
    y: point.y - unit.y * 14
  };
  return `M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function quadraticPoint(a, b, c, t) {
  const one = 1 - t;
  return {
    x: one * one * a.x + 2 * one * t * b.x + t * t * c.x,
    y: one * one * a.y + 2 * one * t * b.y + t * t * c.y
  };
}

function curvedPath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };
  const startHandle = clamp(length * 0.38, 48, 190);
  const endHandle = clamp(length * 0.28, 40, 150);
  const bend = clamp(length * 0.22, 34, 132);
  const direction = dx * dy >= 0 ? 1 : -1;
  const c1 = {
    x: from.x + unit.x * startHandle + normal.x * bend * direction,
    y: from.y + unit.y * startHandle + normal.y * bend * direction
  };
  const c2 = {
    x: to.x - unit.x * endHandle,
    y: to.y - unit.y * endHandle
  };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function problemBranchAngle(groupId) {
  const branch = problemBranches.find((item) => item.id === groupId);
  return degToRad(branch?.angle ?? 0);
}

function bindZoom(svg, group) {
  svg.onwheel = (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scale = event.deltaY < 0 ? 1.1 : 0.9;
    const base = state.zoomBase || state.zoom.k || 1;
    const nextK = Math.max(base * 0.42, Math.min(base * 4.2, state.zoom.k * scale));
    state.zoom.x = mx - ((mx - state.zoom.x) / state.zoom.k) * nextK;
    state.zoom.y = my - ((my - state.zoom.y) / state.zoom.k) * nextK;
    state.zoom.k = nextK;
    setAtlasTransform(group);
  };

  svg.onpointerdown = (event) => {
    if (event.target.closest?.(".node")) return;
    state.dragging = { x: event.clientX, y: event.clientY, ox: state.zoom.x, oy: state.zoom.y };
    svg.setPointerCapture(event.pointerId);
  };
  svg.onpointermove = (event) => {
    if (!state.dragging) return;
    state.zoom.x = state.dragging.ox + event.clientX - state.dragging.x;
    state.zoom.y = state.dragging.oy + event.clientY - state.dragging.y;
    setAtlasTransform(group);
  };
  svg.onpointerup = () => {
    state.dragging = null;
  };
}

function showPreview(id, event) {
  const model = state.models.find((item) => item.id === id);
  if (!model) return;
  const spec = getArchitectureSpec(model);
  state.hoveredId = id;
  $("#previewPanel").hidden = false;
  $("#previewEmpty").hidden = true;
  $("#previewContent").hidden = false;
  $("#previewFamily").textContent = `${model.category}${spec ? " / source-backed diagram" : " / survey-level diagram"}`;
  $("#previewTitle").textContent = model.name;
  $("#previewInsight").textContent = model.insights?.novelty || model.oneLine;
  $("#previewOpen").onclick = () => openModel(id);
  renderDiagram($("#previewDiagram"), model, { mini: true });
  positionPreview(event);
  updateActiveNodes();
}

function hidePreview() {
  state.hoveredId = null;
  $("#previewPanel").hidden = true;
  updateActiveNodes();
}

function positionPreview(event) {
  if (!event) return;
  const panel = $("#previewPanel");
  if (!panel || panel.hidden) return;
  const rect = panel.getBoundingClientRect();
  const gap = 18;
  let left = event.clientX + gap;
  let top = event.clientY + gap;
  if (left + rect.width > window.innerWidth - 12) left = event.clientX - rect.width - gap;
  if (top + rect.height > window.innerHeight - 12) top = event.clientY - rect.height - gap;
  panel.style.left = `${Math.max(12, left)}px`;
  panel.style.top = `${Math.max(82, top)}px`;
}

function updateActiveNodes() {
  $$("#atlasSvg .node").forEach((node) => {
    const id = node.dataset.id;
    node.classList.toggle("is-active", id === state.hoveredId || id === state.selectedId);
  });
}

function openModel(id) {
  state.selectedId = id;
  location.hash = `model/${id}`;
  routeFromHash();
}

function showPage(name) {
  $("#atlasPage").hidden = name !== "atlas";
  $("#modelPage").hidden = name !== "model";
  $("#learnPage").hidden = name !== "learn";
  $("#sourcesPage").hidden = name !== "sources";
  $$(".nav-tab").forEach((tab) => {
    const route = tab.dataset.route;
    tab.classList.toggle("is-active", route === name || (name === "model" && route === "atlas"));
  });
}

function syncModeButtons() {
  $$(".mode-button").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === state.mode));
}

function setAtlasMode(mode, render = true) {
  state.mode = modeDescriptions[mode] ? mode : "problem";
  setDefaultZoomForMode(state.mode);
  syncModeButtons();
  if (render) renderAtlas();
}

function setDefaultZoomForMode(mode) {
  state.zoom = defaultZoomForMode(mode);
  state.zoomBase = state.zoom.k;
}

function defaultZoomForMode(mode) {
  const svg = $("#atlasSvg");
  const width = svg?.clientWidth || 1440;
  const height = svg?.clientHeight || 900;
  if (mode === "problem") {
    if (!state.models.length) return { k: 0.5, x: width * 0.25, y: 86 };
    const geometry = problemGeometry(state.models, { width, height });
    return zoomToFitBox(problemGeometryBounds(geometry, state.models), { width, height }, {
      left: 0,
      right: 0,
      top: 102,
      bottom: 18
    });
  }
  const k = width < 760 ? 0.72 : 0.8;
  return { k, x: (width * (1 - k)) / 2, y: (height * (1 - k)) / 2 };
}

function zoomToFitBox(box, bounds, padding) {
  const availableWidth = Math.max(1, bounds.width - padding.left - padding.right);
  const availableHeight = Math.max(1, bounds.height - padding.top - padding.bottom);
  const k = clamp(Math.min(availableWidth / Math.max(1, box.w), availableHeight / Math.max(1, box.h)), 0.25, 1.35);
  const targetCenter = {
    x: padding.left + availableWidth / 2,
    y: padding.top + availableHeight / 2
  };
  return {
    k,
    x: targetCenter.x - box.x * k,
    y: targetCenter.y - box.y * k
  };
}

function routeFromHash() {
  const hash = location.hash.replace(/^#/, "");
  if (hash.startsWith("model/")) {
    const id = hash.split("/")[1];
    renderModelCard(id);
    showPage("model");
    return;
  }
  if (hash === "learn") {
    showPage("learn");
    return;
  }
  if (hash === "sources") {
    showPage("sources");
    return;
  }
  if (hash.startsWith("atlas/")) {
    showPage("atlas");
    setAtlasMode(hash.split("/")[1] || "problem");
    return;
  }
  showPage("atlas");
  syncModeButtons();
  renderAtlas();
}

function renderModelCard(id) {
  const model = state.models.find((item) => item.id === id) || state.models[0];
  const spec = getArchitectureSpec(model);
  state.selectedId = model.id;
  $("#modelFamily").textContent = `${model.category}${spec ? " / source-backed literal architecture" : " / survey-level placeholder"}`;
  $("#modelName").textContent = `${model.name}: ${model.title}`;
  $("#modelOneLine").textContent = model.oneLine;
  $("#modelPaperLink").href = model.paperUrl;
  $("#modelYear").textContent = `${model.month ? `${model.month}/` : ""}${model.year}`;
  $("#modelRuntime").textContent = scoreLabel(model.metrics?.runtimeCost);
  $("#modelCompute").textContent = scoreLabel(model.metrics?.computeScale);
  $("#modelEvidence").textContent = scoreLabel(model.metrics?.evidence);
  renderDiagram($("#modelDiagram"), model, { mini: false });

  const insightLabels = ["problem", "method", "novelty", "limitation", "related"];
  $("#modelInsights").innerHTML = insightLabels.map((key) => `
    <div>
      <dt>${key}</dt>
      <dd>${escapeHtml(model.insights?.[key] || "")}</dd>
    </div>
  `).join("");

  const stages = model.diagram?.trainingStages || [];
  $("#trainingStages").innerHTML = stages.map((stage) => `
    <li><strong>${escapeHtml(stage.name)}</strong><span>${escapeHtml(stage.objective)} ${stage.data ? `Data: ${stage.data}.` : ""}</span></li>
  `).join("");

  const runtime = spec?.inferenceRecipe || model.diagram?.runtimePath || [];
  $("#runtimePath").textContent = Array.isArray(runtime) ? `Runtime path: ${runtime.join(" -> ")}` : String(runtime);
  const data = model.diagram?.data || [];
  $("#dataSources").innerHTML = data.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  $("#modelUncertainty").textContent = spec
    ? `${model.uncertainty} Literal diagram source: ${spec.sourceExtract}; lines ${(spec.sourceLines || []).join(", ")}.`
    : `${model.uncertainty} Literal architecture curation is pending; current diagram is a survey-level scaffold.`;
  updateActiveNodes();
}

function renderDiagram(container, model, options = {}) {
  const spec = getArchitectureSpec(model);
  const view = { w: 1160, h: options.mini ? 452 : 720 };
  const diagram = buildArchitectureDiagram(model, spec, options);
  const ids = diagramIds(model, options);
  const title = spec ? "Literal method-section architecture" : "Survey-level scaffold";
  const header = options.mini ? "" : `
      <text x="34" y="32" class="diagram-kicker">${escapeHtml(title)}</text>
      <text x="34" y="56" class="diagram-title">${escapeHtml(model.name)}</text>
      <text x="34" y="78" class="diagram-subtitle">${escapeHtml(diagram.thesis)}</text>`;

  container.innerHTML = `
    <svg class="wam-diagram" viewBox="0 0 ${view.w} ${view.h}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${escapeHtml(model.name)} architecture diagram">
      ${diagramDefs(model, ids)}
      <rect class="diagram-bg" x="0" y="0" width="${view.w}" height="${view.h}"></rect>
      ${header}
      ${drawArchitectureDiagram(diagram, view, options, ids)}
    </svg>
  `;
}

function diagramIds(model, options = {}) {
  const safeId = String(model.id || "model").replace(/[^a-z0-9_-]/gi, "-");
  const size = options.mini ? "mini" : "large";
  return {
    coreGrad: `${safeId}-${size}-coreGrad`,
    softShadow: `${safeId}-${size}-softShadow`,
    arrow: `${safeId}-${size}-diagramArrow`
  };
}

function buildArchitectureDiagram(model, spec, options = {}) {
  const arch = model.literalArchitecture || spec || {};
  const allText = [
    model.family,
    model.category,
    ...(arch.inputTokens || []),
    ...(arch.tokenization || []),
    ...(arch.backbone || []),
    ...(arch.branches || []),
    ...(arch.attention || []),
    ...(arch.heads || []),
    ...(arch.objectives || []),
    ...(arch.trainingRecipe || []),
    ...(arch.inferenceRecipe || [])
  ].join(" ").toLowerCase();

  return {
    thesis: model.oneLine || model.insights?.method || model.category,
    inputs: inferTokenGroups(model, arch, allText, options),
    encoders: inferEncoders(arch, allText, options),
    core: inferCore(model, arch, allText),
    streams: inferStreams(model, arch, allText, options),
    attention: inferAttentionBadges(allText, options),
    heads: inferHeads(model, arch, allText, options),
    outputs: inferOutputs(model, arch, allText, options),
    data: (model.diagram?.data || []).slice(0, options.mini ? 2 : 4),
    training: inferTraining(arch, allText, options),
    runtime: inferRuntime(arch, options),
    motifs: inferMotifs(allText)
  };
}

function drawArchitectureDiagram(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = mini ? 22 : 118;
  const coreBox = { x: 455, y: y0, w: 380, h: mini ? 270 : 330 };
  const inputBox = { x: 34, y: y0, w: 206, h: coreBox.h };
  const encoderBox = { x: 270, y: y0, w: 150, h: coreBox.h };
  const headBox = { x: 872, y: y0, w: 118, h: coreBox.h };
  const outputBox = { x: 1014, y: y0, w: 112, h: coreBox.h };
  const trainBox = { x: 34, y: y0 + coreBox.h + 36, w: 1092, h: mini ? 108 : 142 };

  return [
    drawColumnPanel(inputBox, "input token sequences", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "tokenizers / encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawCorePanel(diagram, coreBox, mini, ids),
    drawColumnPanel(headBox, "heads", drawHeadStack(diagram.heads, headBox, mini)),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawMainConnectors(inputBox, encoderBox, coreBox, headBox, outputBox, ids),
    drawTrainingBand(diagram, trainBox, coreBox, headBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
  ].join("");
}

function diagramDefs(model, ids) {
  const base = familyColors[model.family] || "#2f7f91";
  return `
    <defs>
      <linearGradient id="${ids.coreGrad}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${escapeHtml(base)}" stop-opacity="0.22"></stop>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.96"></stop>
      </linearGradient>
      <filter id="${ids.softShadow}" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#172024" flood-opacity="0.08"></feDropShadow>
      </filter>
      <marker id="${ids.arrow}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#526066"></path>
      </marker>
    </defs>
  `;
}

function inferTokenGroups(model, arch, allText, options = {}) {
  const maxGroups = options.mini ? 3 : 5;
  const tokens = arch.inputTokens || model.diagram?.inputs || [];
  const groups = [];
  const add = (kind, label, matcher, fallback = "") => {
    const hits = uniqueByText(tokens.filter((item) => matcher.test(item))).slice(0, 3);
    if (hits.length || fallback) {
      groups.push({
        kind,
        label,
        tokens: hits.length ? hits.map((item) => compactToken(item)) : [fallback]
      });
    }
  };

  add("visual", "visual / world", /rgb|image|camera|frame|video|observation|view|depth|tactile|gelsight/i, /rgb|image|camera|frame|video|observation|visual|world/.test(allText) ? "observation tokens" : "");
  add("language", "language", /language|instruction|text|t5|qwen|vlm/i, /language|instruction|text|t5|qwen|vlm/.test(allText) ? "instruction" : "");
  add("state", "state / context", /state|proprio|force|value|goal|history|memory|latent|dino/i);
  add("action", "action", /action|trajectory|chunk|control|gripper|end-effector/i, /action|trajectory|policy|control|chunk/.test(allText) ? "action chunk" : "");
  add("noise", "noise / targets", /noise|noisy|future|flow|diffusion|target/i, "");

  const unique = uniqueByText(groups, "label");
  if (!unique.length) {
    unique.push({ kind: "visual", label: "observation", tokens: ["raw sensor stream"] });
    unique.push({ kind: "action", label: "action", tokens: ["control output"] });
  }
  return unique.slice(0, maxGroups);
}

function inferEncoders(arch, allText, options = {}) {
  const candidates = [];
  (arch.tokenization || []).forEach((item) => {
    const lower = item.toLowerCase();
    if (/t5|text|language|instruction/.test(lower)) candidates.push({ label: "Text Encoder", detail: compactDetail(item), kind: "language" });
    if (/vae|vqgan|video vae|causal vae/.test(lower)) candidates.push({ label: "Video VAE", detail: compactDetail(item), kind: "visual" });
    if (/dino|siglip|clip|dpav3|v-jepa|vision encoder/.test(lower)) candidates.push({ label: "Vision Encoder", detail: compactDetail(item), kind: "visual" });
    if (/q-former|query/.test(lower)) candidates.push({ label: "Q-Former", detail: compactDetail(item), kind: "latent" });
    if (/fast|vq|codebook|quant/.test(lower)) candidates.push({ label: "Codebook / VQ", detail: compactDetail(item), kind: "action" });
    if (/mlp|project|proprio|state|action/.test(lower)) candidates.push({ label: "MLP Projector", detail: compactDetail(item), kind: "state" });
  });
  if (/vae/.test(allText)) candidates.push({ label: "VAE Latents", detail: "compressed video/state tokens", kind: "visual" });
  if (/dino|siglip|clip/.test(allText)) candidates.push({ label: "VFM Features", detail: "semantic/geometric targets", kind: "visual" });
  if (/t5|language|instruction/.test(allText)) candidates.push({ label: "Text Tokens", detail: "cross-attention condition", kind: "language" });
  if (/action/.test(allText)) candidates.push({ label: "Action Tokens", detail: "chunk or flow tokens", kind: "action" });
  return uniqueByText(candidates, "label").slice(0, options.mini ? 3 : 5);
}

function inferCore(model, arch, allText) {
  let label = "World-Action Core";
  if (/mixture-of-transformer|mot\b|multi-modal self-attention|mmsa/.test(allText)) label = "MoT / Shared-Attention Core";
  else if (/\bmm-dit\b|\bmmd[it]?\b/.test(allText)) label = "MM-DiT Core";
  else if (/\bdit\b|diffusion transformer|diffusion-transformer/.test(allText)) label = "Diffusion Transformer Core";
  else if (/gpt-style|causal transformer|transformer decoder|autoregressive/.test(allText)) label = "Autoregressive Transformer";
  else if (/vlm|qwen|paligemma|prismatic|llama/.test(allText)) label = "VLM Backbone + Action Expert";
  else if (/latent world|world model/.test(allText)) label = "Latent World Model";

  const details = (arch.backbone || model.diagram?.components || []).slice(0, 3).map(compactDetail);
  const layerBadges = [];
  if (/self-attention|self attention|shared attention|joint attention/.test(allText)) layerBadges.push("self-attn");
  if (/cross-attention|cross attention|cross-attn/.test(allText)) layerBadges.push("cross-attn");
  if (/mlp|ffn|feed-forward/.test(allText)) layerBadges.push("FFN");
  if (/adaln|adaptive layer norm/.test(allText)) layerBadges.push("AdaLN");
  if (/flow matching|diffusion|denois/.test(allText)) layerBadges.push("noise t");
  return { label, details, layerBadges: layerBadges.length ? layerBadges : ["attention", "MLP", "head"] };
}

function inferStreams(model, arch, allText, options = {}) {
  const streams = [];
  const add = (label, detail, color, test) => {
    if (test) streams.push({ label, detail, color });
  };
  add("Video / World", streamDetail(arch, /video|rgb|visual|world|future|dino|vae/i, "future/state latents"), "#4c78a8", /video|rgb|visual|world|future|dino|vae/.test(allText));
  add("Language", streamDetail(arch, /language|instruction|text|t5|vlm/i, "instruction condition"), "#8f6bb8", /language|instruction|text|t5|vlm/.test(allText));
  add("Action", streamDetail(arch, /action|chunk|policy|control/i, "action chunk"), "#d08a2e", /action|chunk|policy|control/.test(allText));
  add("State", streamDetail(arch, /state|proprio|memory|history/i, "proprio/history"), "#5a8f63", /state|proprio|memory|history/.test(allText));
  add("Value / Reward", streamDetail(arch, /value|reward|map|grpo|rl/i, "value or reward"), "#9f5f63", /value|reward|map|grpo|rl/.test(allText));
  add("Depth / Tactile / Force", streamDetail(arch, /depth|tactile|force|gelsight|rgb-d/i, "physical branch"), "#2f8793", /depth|tactile|force|gelsight|rgb-d/.test(allText));
  return uniqueByText(streams, "label").slice(0, options.mini ? 4 : 6);
}

function inferAttentionBadges(allText, options = {}) {
  const badges = [];
  const add = (label, test) => { if (test) badges.push(label); };
  add("causal mask", /causal|autoregressive|block-causal/.test(allText));
  add("cross-attn", /cross-attention|cross attention|cross-attn/.test(allText));
  add("joint/self-attn", /joint attention|shared attention|self-attention|self attention|mmsa/.test(allText));
  add("leakage mask", /cannot attend|no future|prevent.*leak|mask/.test(allText));
  add("unilateral", /unilateral/.test(allText));
  add("cache / memory", /cache|ttt memory|memory/.test(allText));
  add("async denoise", /asynchronous|async|partial denois|few-step|shortcut/.test(allText));
  add("value route", /value map|value-map|spatial value/.test(allText));
  return badges.slice(0, options.mini ? 4 : 7);
}

function inferHeads(model, arch, allText, options = {}) {
  const heads = [];
  (arch.heads || []).forEach((item) => heads.push({ label: headLabel(item), detail: compactDetail(item) }));
  if (/action/.test(allText)) heads.push({ label: "Action Head", detail: "denoise/decode action chunk" });
  if (/future|video/.test(allText)) heads.push({ label: "Future Head", detail: "video or latent prediction" });
  if (/value|reward/.test(allText)) heads.push({ label: "Value Head", detail: "score future trajectory" });
  if (/depth/.test(allText)) heads.push({ label: "Depth Head", detail: "RGB-D / inverse depth" });
  if (/force|tactile/.test(allText)) heads.push({ label: "Force/Tactile Head", detail: "contact prediction" });
  return uniqueByText(heads, "label").slice(0, options.mini ? 3 : 5);
}

function inferOutputs(model, arch, allText, options = {}) {
  const outputs = [];
  const add = (label, detail, test) => { if (test) outputs.push({ label, detail }); };
  add("Action Chunk", "executable robot controls", /action|policy|control|chunk/.test(allText));
  add("Future Video", "decoded or latent rollout", /future video|rgb|video|frame/.test(allText));
  add("Latent Future", "DINO/VAE/value state", /latent|dino|jepa|condition/.test(allText));
  add("Value Map", "spatial intent/value", /value map|value-map|asvm/.test(allText));
  add("Depth / 4D", "RGB-D reconstruction", /depth|rgb-d|4d/.test(allText));
  add("Force / State", "tactile/force/proprio", /force|tactile|state|proprio/.test(allText));
  (model.diagram?.outputs || []).forEach((item) => outputs.push({ label: compactToken(item), detail: "paper output" }));
  return uniqueByText(outputs, "label").slice(0, options.mini ? 3 : 5);
}

function inferTraining(arch, allText, options = {}) {
  const items = [];
  (arch.objectives || []).forEach((item) => items.push({ label: objectiveLabel(item), detail: compactDetail(item), kind: "loss" }));
  (arch.trainingRecipe || []).forEach((item) => items.push({ label: trainingLabel(item), detail: compactDetail(item), kind: "stage" }));
  if (/flow matching/.test(allText)) items.push({ label: "Flow matching", detail: "velocity field supervision", kind: "loss" });
  if (/grpo|reward|rl/.test(allText)) items.push({ label: "Reward post-train", detail: "GRPO / value signal", kind: "stage" });
  return uniqueByText(items, "label").slice(0, options.mini ? 4 : 7);
}

function inferRuntime(arch, options = {}) {
  return (arch.inferenceRecipe || []).map(compactDetail).slice(0, options.mini ? 2 : 4);
}

function inferMotifs(allText) {
  return {
    diffusion: /diffusion|denois|flow matching|noise/.test(allText),
    multiStream: /mot|mixture|multi-stream|stream|branch|expert/.test(allText),
    trainingOnly: /training-only|during training|frozen|post-training|pretraining/.test(allText),
    online: /online|adaptive|test-time|ttt|memory/.test(allText)
  };
}

function drawColumnPanel(box, title, content) {
  return `
    <g>
      <rect class="diagram-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 23}">${escapeHtml(title)}</text>
      ${content}
    </g>
  `;
}

function drawTokenGroups(groups, box, mini) {
  const list = groups.length ? groups : [{ kind: "visual", label: "observation", tokens: ["sensor tokens"] }];
  const top = box.y + 44;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const rowH = Math.max(44, Math.min(mini ? 58 : 56, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((group, index) => drawTokenRail(group, box.x + 14, top + index * (rowH + gap), box.w - 28, rowH, mini)).join("");
}

function drawTokenRail(group, x, y, w, h, mini) {
  const colors = {
    visual: ["#e8f2ff", "#5d8fc5"],
    language: ["#f2eafa", "#9874b8"],
    state: ["#edf7ed", "#72a36e"],
    action: ["#fff2dc", "#d49a3d"],
    noise: ["#f4f5f7", "#a9b1b8"]
  };
  const [fill, stroke] = colors[group.kind] || colors.visual;
  const count = Math.max(3, Math.min(6, group.tokens.length + 1));
  const tokenW = Math.min(22, (w - 24) / count);
  const tokenStart = x + w - count * tokenW - (count - 1) * 3 - 10;
  const tokenY = y + h - 21;
  const tokenSvg = Array.from({ length: count }, (_, i) => `
    <rect class="token-cell" x="${tokenStart + i * (tokenW + 3)}" y="${tokenY}" width="${tokenW}" height="14" fill="${fill}" stroke="${stroke}"></rect>
  `).join("");
  const label = compactToken(group.label);
  const details = group.tokens.slice(0, mini ? 1 : 2).join(" / ");
  const detailChars = Math.max(12, Math.floor((tokenStart - x - 18) / 5.4));
  return `
    <g>
      <rect class="token-rail" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>
      <text class="rail-label" x="${x + 10}" y="${y + 18}">${escapeHtml(label)}</text>
      ${drawWrappedText(details, x + 10, y + 34, detailChars, mini ? 1 : 2, "rail-detail", 10.5)}
      ${tokenSvg}
    </g>
  `;
}

function drawEncoderStack(encoders, box, mini) {
  const top = box.y + 48;
  const itemH = mini ? 46 : 50;
  const gap = 9;
  return encoders.map((encoder, index) => {
    const y = top + index * (itemH + gap);
    return `
      <g>
        <rect class="encoder-block" x="${box.x + 14}" y="${y}" width="${box.w - 28}" height="${itemH}"></rect>
        <text class="block-label" x="${box.x + 25}" y="${y + 18}">${escapeHtml(encoder.label)}</text>
        ${drawWrappedText(encoder.detail, box.x + 25, y + 34, 18, 1, "block-detail", 10)}
      </g>
    `;
  }).join("");
}

function drawCorePanel(diagram, box, mini, ids) {
  const streamTop = box.y + 78;
  const streamH = mini ? 30 : 34;
  const streamGap = mini ? 8 : 10;
  const maxStreams = Math.min(diagram.streams.length, mini ? 4 : 6);
  const streamBox = { x: box.x + 22, y: streamTop - 12, w: box.w - 168, h: maxStreams * (streamH + streamGap) + 8 };
  const streamSvg = diagram.streams.slice(0, maxStreams).map((stream, index) => {
    const y = streamTop + index * (streamH + streamGap);
    return drawCoreStream(stream, streamBox.x + 6, y, streamBox.w - 12, streamH);
  }).join("");
  const layerX = box.x + box.w - 122;
  const layerY = box.y + 52;
  const layerSvg = diagram.core.layerBadges.slice(0, 5).map((label, index) => `
    <rect class="layer-chip" x="${layerX}" y="${layerY + index * 31}" width="90" height="22"></rect>
    <text class="layer-text" x="${layerX + 45}" y="${layerY + 15 + index * 31}" text-anchor="middle">${escapeHtml(label)}</text>
  `).join("");
  const attentionSvg = drawAttentionBadges(diagram.attention, box, mini);
  const noiseSvg = diagram.motifs.diffusion ? drawNoiseSchedule(box, mini, ids) : "";
  const memorySvg = diagram.motifs.online ? `<text class="core-note" x="${box.x + 24}" y="${box.y + box.h - 22}">online/cache path updates context without changing the main token grammar</text>` : "";

  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 24}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 24, box.y + 50, 36, 2, "core-detail", 11)}
      <rect class="shared-attn-band" x="${streamBox.x}" y="${streamBox.y}" width="${streamBox.w}" height="${streamBox.h}"></rect>
      ${streamSvg}
      <rect class="transformer-stack" x="${layerX - 10}" y="${layerY - 20}" width="112" height="${Math.min(188, diagram.core.layerBadges.length * 31 + 28)}"></rect>
      <text class="stack-title" x="${layerX + 45}" y="${layerY - 5}" text-anchor="middle">N x block</text>
      <g>${layerSvg}</g>
      ${attentionSvg}
      ${noiseSvg}
      ${memorySvg}
    </g>
  `;
}

function drawCoreStream(stream, x, y, w, h) {
  const tokenCount = 5;
  const tokenW = 13;
  const tokenGap = 4;
  const tokenStart = x + w - tokenCount * tokenW - (tokenCount - 1) * tokenGap - 10;
  const tokenSvg = Array.from({ length: tokenCount }, (_, index) => `
    <rect class="core-token" x="${tokenStart + index * (tokenW + tokenGap)}" y="${y + 9}" width="${tokenW}" height="12" fill="${stream.color}"></rect>
  `).join("");
  return `
    <g>
      <rect class="stream-row" x="${x}" y="${y}" width="${w}" height="${h}" style="--stream:${stream.color}"></rect>
      <text class="stream-label" x="${x + 12}" y="${y + 15}">${escapeHtml(stream.label)}</text>
      ${tokenSvg}
      ${drawWrappedText(stream.detail, x + 12, y + 28, 24, 1, "stream-detail", 9.5)}
    </g>
  `;
}

function drawAttentionBadges(badges, box, mini) {
  const startX = box.x + 24;
  const y = box.y + box.h - (mini ? 74 : 82);
  return badges.map((badge, index) => {
    const x = startX + (index % 3) * 84;
    const row = Math.floor(index / 3);
    return `
      <rect class="attention-badge" x="${x}" y="${y + row * 28}" width="74" height="20"></rect>
      <text class="attention-text" x="${x + 37}" y="${y + 14 + row * 28}" text-anchor="middle">${escapeHtml(badge)}</text>
    `;
  }).join("");
}

function drawNoiseSchedule(box, mini, ids) {
  const x = box.x + box.w - 128;
  const y = box.y + box.h - (mini ? 70 : 78);
  const steps = Array.from({ length: 4 }, (_, index) => {
    const cx = x + 14 + index * 24;
    const cy = y + 28 - index * 5;
    return `
      <circle class="noise-step" cx="${cx}" cy="${cy}" r="${7 - index}"></circle>
      ${index < 3 ? `<path class="dashed-flow" d="M ${cx + 8} ${cy - 2} L ${cx + 18} ${cy - 5}" marker-end="url(#${ids.arrow})"></path>` : ""}
    `;
  }).join("");
  return `
    <g>
      <text class="core-note" x="${x}" y="${y}">denoise / flow</text>
      ${steps}
    </g>
  `;
}

function drawHeadStack(heads, box, mini) {
  const list = heads.length ? heads : [{ label: "Policy Head", detail: "paper output decoder" }];
  const top = box.y + 48;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const itemH = Math.max(42, Math.min(mini ? 50 : 54, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((head, index) => {
    const y = top + index * (itemH + gap);
    return `
      <g class="diagram-node">
        <rect class="head-block" x="${box.x + 12}" y="${y}" width="${box.w - 24}" height="${itemH}"></rect>
        <text class="block-label" x="${box.x + 22}" y="${y + 18}">${escapeHtml(head.label)}</text>
        ${drawWrappedText(head.detail, box.x + 22, y + 34, 13, mini ? 1 : 2, "block-detail", 10)}
      </g>
    `;
  }).join("");
}

function drawOutputStack(outputs, box, mini) {
  const list = outputs.length ? outputs : [{ label: "Action", detail: "runtime output" }];
  const top = box.y + 48;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const itemH = Math.max(42, Math.min(mini ? 52 : 58, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((output, index) => {
    const y = top + index * (itemH + gap);
    const isAction = /action|control|policy|trajectory/i.test(output.label);
    const cellCount = isAction ? 4 : 3;
    const cellW = 14;
    const tokenStart = box.x + 22;
    const tokenY = y + itemH - 16;
    const labelChars = Math.max(12, Math.floor((box.w - 34) / 5.8));
    const showDetail = itemH >= 52;
    const tokenCells = Array.from({ length: isAction ? 4 : 3 }, (_, i) => `
      <rect class="${isAction ? "action-cell" : "output-cell"}" x="${tokenStart + i * (cellW + 4)}" y="${tokenY}" width="14" height="10"></rect>
    `).join("");
    return `
      <g class="diagram-node">
        <rect class="${isAction ? "action-output" : "output-block"}" x="${box.x + 12}" y="${y}" width="${box.w - 24}" height="${itemH}"></rect>
        <text class="output-label" x="${box.x + 22}" y="${y + 18}">${escapeHtml(shortText(output.label, labelChars))}</text>
        ${showDetail ? drawWrappedText(output.detail, box.x + 22, y + 35, Math.max(10, labelChars + 2), 1, "output-detail", 10) : ""}
        ${tokenCells}
      </g>
    `;
  }).join("");
}

function drawMainConnectors(inputBox, encoderBox, coreBox, headBox, outputBox, ids) {
  return `
    <g>
      ${drawConnector(inputBox.x + inputBox.w, inputBox.y + inputBox.h * 0.42, encoderBox.x, encoderBox.y + encoderBox.h * 0.42, "tokenize", false, ids)}
      ${drawConnector(encoderBox.x + encoderBox.w, encoderBox.y + encoderBox.h * 0.5, coreBox.x, coreBox.y + coreBox.h * 0.5, "embed", false, ids)}
      ${drawConnector(coreBox.x + coreBox.w, coreBox.y + coreBox.h * 0.42, headBox.x, headBox.y + headBox.h * 0.42, "decode", false, ids)}
      ${drawConnector(headBox.x + headBox.w, headBox.y + headBox.h * 0.5, outputBox.x, outputBox.y + outputBox.h * 0.5, "emit", false, ids)}
    </g>
  `;
}

function drawTrainingBand(diagram, box, coreBox, headBox, mini, ids) {
  const items = diagram.training.length ? diagram.training : [{ label: "Supervised objective", detail: "method-section training signal", kind: "loss" }];
  const itemLimit = mini ? 4 : 7;
  const visibleItems = items.slice(0, itemLimit);
  const chipW = Math.min(142, (box.w - 42) / Math.max(visibleItems.length, 1) - 8);
  const dataChips = (diagram.data || []).map((item, index) => `
    <g>
      <rect class="data-chip" x="${box.x + 18 + index * 150}" y="${box.y + 38}" width="136" height="22"></rect>
      <text class="data-text" x="${box.x + 86 + index * 150}" y="${box.y + 53}" text-anchor="middle">${escapeHtml(shortText(compactToken(item), 18))}</text>
    </g>
  `).join("");
  const stageChips = visibleItems.map((item, index) => {
    const x = box.x + 18 + index * (chipW + 8);
    const y = box.y + (mini ? 66 : 76);
    const h = mini ? 34 : 44;
    const labelChars = Math.max(10, Math.floor((chipW - 18) / 7));
    return `
      <g class="training-chip">
        <rect class="stage-chip ${item.kind === "loss" ? "is-loss" : "is-stage"}" x="${x}" y="${y}" width="${chipW}" height="${h}"></rect>
        <text class="training-label" x="${x + 9}" y="${y + 16}">${escapeHtml(shortText(item.label, labelChars))}</text>
        ${drawWrappedText(item.detail, x + 9, y + 31, Math.max(12, Math.floor((chipW - 18) / 5.5)), mini ? 1 : 2, "training-detail", 9.5)}
      </g>
    `;
  }).join("");

  return `
    <g>
      ${drawConnector(box.x + box.w * 0.44, box.y, coreBox.x + coreBox.w * 0.45, coreBox.y + coreBox.h, "trains", true, ids)}
      ${drawConnector(box.x + box.w * 0.74, box.y, headBox.x + headBox.w * 0.5, headBox.y + headBox.h, "supervises", true, ids)}
      <rect class="training-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">training data + objectives</text>
      ${dataChips}
      ${stageChips}
    </g>
  `;
}

function drawRuntimeStrip(runtime, coreBox, outputBox, trainBox) {
  const steps = runtime.length ? runtime : ["encode current observation", "run core", "decode action"];
  const x = coreBox.x;
  const y = trainBox.y + trainBox.h + 22;
  const w = outputBox.x + outputBox.w - coreBox.x;
  const stepW = Math.min(160, (w - 18) / Math.max(steps.length, 1) - 10);
  const chips = steps.slice(0, 4).map((step, index) => {
    const sx = x + 10 + index * (stepW + 10);
    return `
      <g>
        <rect class="runtime-step" x="${sx}" y="${y}" width="${stepW}" height="34"></rect>
        ${drawWrappedText(`${index + 1}. ${step}`, sx + 10, y + 15, Math.max(12, Math.floor((stepW - 20) / 5.6)), 2, "runtime-text", 9.5)}
      </g>
    `;
  }).join("");
  return `
    <g>
      <text class="panel-title" x="${x}" y="${y - 10}">runtime path</text>
      ${chips}
    </g>
  `;
}

function drawConnector(x1, y1, x2, y2, label = "", dashed = false, ids = { arrow: "diagramArrow" }) {
  const direction = x2 >= x1 ? 1 : -1;
  const c = Math.max(36, Math.abs(x2 - x1) * 0.45);
  const cls = dashed ? "dashed-flow" : "diagram-flow";
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 7;
  return `
    <path class="${cls}" d="M ${x1} ${y1} C ${x1 + direction * c} ${y1}, ${x2 - direction * c} ${y2}, ${x2} ${y2}" marker-end="url(#${ids.arrow})"></path>
    ${label ? `<text class="edge-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(label)}</text>` : ""}
  `;
}

function drawWrappedText(text, x, y, maxChars, maxLines, cls, lineHeight = 12) {
  return wrapText(text, maxChars)
    .slice(0, maxLines)
    .filter(Boolean)
    .map((line, index) => `<text class="${cls}" x="${x}" y="${y + index * lineHeight}">${escapeHtml(line)}</text>`)
    .join("");
}

function uniqueByText(items, key = "") {
  const seen = new Set();
  return items.filter((item) => {
    const value = typeof item === "string"
      ? item
      : item?.[key] || item?.label || item?.detail || JSON.stringify(item);
    const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function compactToken(value) {
  const text = String(value || "")
    .replace(/[{}[\]()`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/[.;:]/)[0].split(/\s+/).slice(0, 5).join(" ");
}

function compactDetail(value) {
  const text = String(value || "")
    .replace(/[{}[\]()`*_]/g, "")
    .replace(/\bFig(?:ure)?\.?\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/[.;]/)[0].split(/\s+/).slice(0, 13).join(" ");
}

function shortText(value, maxChars) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function streamDetail(arch, matcher, fallback) {
  const pools = [
    ...(arch.inputTokens || []),
    ...(arch.tokenization || []),
    ...(arch.branches || []),
    ...(arch.backbone || []),
    ...(arch.attention || []),
    ...(arch.heads || [])
  ];
  const hit = pools.find((item) => matcher.test(item));
  return hit ? compactDetail(hit) : fallback;
}

function headLabel(value) {
  const text = String(value || "");
  if (/action|trajectory|chunk|control|policy/i.test(text)) return "Action Head";
  if (/future|video|image|frame|observation/i.test(text)) return "Future Head";
  if (/value|reward|score/i.test(text)) return "Value Head";
  if (/depth|rgb-d|4d/i.test(text)) return "Depth Head";
  if (/force|tactile|gelsight/i.test(text)) return "Force/Tactile Head";
  if (/cvae|vae|decoder/i.test(text)) return "Decoder Head";
  return conciseLabel(text) || "Prediction Head";
}

function objectiveLabel(value) {
  const text = String(value || "");
  if (/flow matching/i.test(text)) return "Flow matching";
  if (/diffusion|denois|noise/i.test(text)) return "Diffusion loss";
  if (/smooth[- ]?l1|l1|l2|mse/i.test(text) && /action|control|arm|trajectory/i.test(text)) return "Action regression";
  if (/binary cross[- ]?entropy|bce/i.test(text) && /gripper|action/i.test(text)) return "Gripper BCE";
  if (/cross[- ]?entropy|ce loss/i.test(text)) return "Token CE";
  if (/behavior cloning|bc\b|imitation/i.test(text)) return "Behavior cloning";
  if (/future|video|frame|observation/i.test(text)) return "Future prediction";
  if (/value|reward|grpo|rl/i.test(text)) return "Reward/value loss";
  if (/reconstruct|reconstruction/i.test(text)) return "Reconstruction";
  if (/contrast|alignment|align/i.test(text)) return "Alignment";
  return conciseLabel(text) || "Training loss";
}

function trainingLabel(value) {
  const text = String(value || "");
  if (/pretrain|pre-training/i.test(text)) return "Pretraining";
  if (/fine[- ]?tun/i.test(text)) return "Finetuning";
  if (/preprocess|filter|relabel|annotat/i.test(text)) return "Preprocessing";
  if (/post[- ]?train|grpo|rl|reward/i.test(text)) return "Post-training";
  if (/freeze|frozen/i.test(text)) return "Frozen modules";
  if (/mask/i.test(text)) return "Masked training";
  if (/dataset|data|mixture/i.test(text)) return "Data mixture";
  return conciseLabel(text) || "Training stage";
}

function getArchitectureSpec(model) {
  const explicit = state.arch[model.id];
  if (explicit) return explicit;
  if (!model.literalArchitecture) return null;
  return literalArchitectureSpec(model);
}

function literalArchitectureSpec(model) {
  const arch = model.literalArchitecture;
  const modules = [];
  const add = (lane, type, items, count) => {
    (items || []).slice(0, count).forEach((item, index) => {
      const id = `${lane}${index}`;
      modules.push({
        id,
        lane,
        type,
        label: conciseLabel(item),
        details: conciseDetails(item)
      });
    });
  };

  add("inputs", "input", arch.inputTokens, 3);
  add("tokenization", "tokenizer", arch.tokenization, 2);
  add("backbone", "backbone", arch.backbone, 3);
  add("heads", "head", [...(arch.attention || []).slice(0, 1), ...(arch.heads || [])], 3);
  add("training", "objective", [...(arch.objectives || []).slice(0, 2), ...(arch.trainingRecipe || []).slice(0, 1)], 3);
  const outputs = model.diagram?.outputs?.length ? model.diagram.outputs : ["action chunk"];
  add("outputs", "output", outputs, 2);

  return {
    sourceExtract: arch.sourceExtract,
    sourceLines: arch.sourceLines,
    inferenceRecipe: arch.inferenceRecipe,
    diagramModules: modules,
    diagramEdges: literalEdges(modules)
  };
}

function conciseLabel(value) {
  return String(value || "")
    .replace(/^stage[- ]\d+[: ]*/i, "")
    .replace(/^the /i, "")
    .split(/[.;:]/)[0]
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
}

function conciseDetails(value) {
  return String(value || "")
    .split(/[.;]/)[0]
    .split(/\s+/)
    .slice(0, 14)
    .join(" ");
}

function literalEdges(modules) {
  const first = (lane) => modules.find((module) => module.lane === lane);
  const edges = [];
  const chain = ["inputs", "tokenization", "backbone", "heads", "outputs"].map(first).filter(Boolean);
  for (let i = 0; i < chain.length - 1; i += 1) {
    edges.push({ from: chain[i].id, to: chain[i + 1].id, label: i === 0 ? "encodes" : "conditions" });
  }
  const training = modules.filter((module) => module.lane === "training");
  const target = first("backbone") || first("heads");
  training.forEach((module) => {
    if (target) edges.push({ from: target.id, to: module.id, label: "trained by", kind: "training" });
  });
  return edges;
}

function fallbackModules(model) {
  const modules = [];
  (model.diagram?.inputs || []).slice(0, 4).forEach((label, i) => {
    modules.push({ id: `in${i}`, lane: "inputs", label, type: "input", details: "input" });
  });
  (model.diagram?.components || []).slice(0, 5).forEach((label, i) => {
    modules.push({ id: `comp${i}`, lane: i < 2 ? "backbone" : "heads", label, type: i < 2 ? "backbone" : "head", details: "survey component" });
  });
  (model.diagram?.trainingStages || []).slice(0, 2).forEach((stage, i) => {
    modules.push({ id: `train${i}`, lane: "training", label: stage.name, type: "objective", details: stage.objective });
  });
  (model.diagram?.outputs || []).slice(0, 3).forEach((label, i) => {
    modules.push({ id: `out${i}`, lane: "outputs", label, type: "output", details: "output" });
  });
  return modules;
}

function fallbackEdges(modules) {
  const byLane = Object.groupBy ? Object.groupBy(modules, (m) => m.lane) : modules.reduce((acc, item) => {
    (acc[item.lane] ||= []).push(item);
    return acc;
  }, {});
  const order = ["inputs", "tokenization", "backbone", "heads", "outputs"];
  const edges = [];
  for (let i = 0; i < order.length - 1; i += 1) {
    const left = byLane[order[i]] || [];
    const right = byLane[order[i + 1]] || [];
    if (left[0] && right[0]) edges.push({ from: left[0].id, to: right[0].id, label: "flows" });
  }
  (byLane.training || []).forEach((train) => {
    const target = (byLane.backbone || byLane.heads || [])[0];
    if (target) edges.push({ from: target.id, to: train.id, label: "supervises", kind: "training" });
  });
  return edges;
}

function layoutModules(modules, view) {
  const laneX = {
    inputs: 44,
    tokenization: 236,
    backbone: 458,
    heads: 700,
    training: 392,
    outputs: 922
  };
  const widths = {
    inputs: 150,
    tokenization: 165,
    backbone: 185,
    heads: 170,
    training: 185,
    outputs: 150
  };
  const groups = modules.reduce((acc, module) => {
    (acc[module.lane] ||= []).push(module);
    return acc;
  }, {});
  const result = [];
  Object.entries(groups).forEach(([lane, list]) => {
    list.forEach((module, i) => {
      const isTraining = lane === "training";
      const x = isTraining ? laneX.training + (i % 3) * 205 : laneX[lane] || 460;
      const y = isTraining ? view.h - 130 + Math.floor(i / 3) * 76 : 74 + i * 86;
      result.push({ ...module, x, y, w: widths[lane] || 170, h: 58 });
    });
  });
  return result;
}

function drawLaneLabels(view) {
  const labels = [
    ["inputs", 44],
    ["tokenization", 236],
    ["backbone", 458],
    ["heads", 700],
    ["outputs", 922]
  ];
  return labels.map(([label, x]) => `<text class="stage-label" x="${x}" y="58">${label}</text>`).join("") +
    `<text class="stage-label" x="392" y="${view.h - 146}">training / losses</text>`;
}

function drawModule(module) {
  const color = typeColors[module.type] || typeColors.backbone;
  const textColor = color.text || "#172024";
  const lines = wrapText(module.label, 18).slice(0, 2);
  const details = wrapText(module.details || "", 24).slice(0, 2);
  return `
    <g class="module" data-id="${escapeHtml(module.id)}">
      <rect x="${module.x}" y="${module.y}" width="${module.w}" height="${module.h}" fill="${color.fill}" stroke="${color.stroke}"></rect>
      ${lines.map((line, i) => `<text x="${module.x + 10}" y="${module.y + 20 + i * 13}" fill="${textColor}">${escapeHtml(line)}</text>`).join("")}
      ${details.map((line, i) => `<text class="detail" x="${module.x + 10}" y="${module.y + 43 + i * 11}" fill="${textColor}">${escapeHtml(line)}</text>`).join("")}
    </g>
  `;
}

function drawEdge(edge, moduleMap) {
  const from = moduleMap.get(edge.from);
  const to = moduleMap.get(edge.to);
  if (!from || !to) return "";
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const c = Math.max(45, Math.abs(x2 - x1) * 0.45);
  const dashed = edge.kind === "training" ? " stroke-dasharray=\"5 5\"" : "";
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 6;
  return `
    <path class="edge" d="M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}" marker-end="url(#diagramArrow)"${dashed}></path>
    ${edge.label ? `<text class="stage-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(edge.label)}</text>` : ""}
  `;
}

function wrapText(text, max) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function renderLearn() {
  const grammar = [
    ["Inputs", "Language, RGB, multiview RGB-D, proprioception, tactile images, force, goal images, or action history."],
    ["Tokenizers", "VAE/VQ encoders, DINO/SigLIP features, MLP action projections, FAST/action codebooks, and latent action quantizers."],
    ["Backbone", "The core temporal model: GPT, DiT, MMDiT, MoT, shared Transformer, video diffusion model, or VLA backbone."],
    ["Attention", "The part that determines leakage and coupling: causal masks, cross-attention, stream fusion, bidirectional blocks, and unilateral depth attention."],
    ["Heads", "Action denoisers, cVAE decoders, IDM heads, future latent heads, value heads, depth/tactile/force branches."],
    ["Objectives", "Flow matching, diffusion denoising, future latent alignment, VQ reconstruction, contrastive codebook alignment, depth MSE, or RL-style post-training rewards."]
  ];
  $("#grammarGrid").innerHTML = grammar.map(([title, body]) => `
    <div class="grammar-item"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>
  `).join("");

  const families = state.schema?.families || [];
  $("#familyGrid").innerHTML = families.map((family) => `
    <div class="family-item">
      <strong>${escapeHtml(family.label)}</strong>
      <p>${escapeHtml(family.diagramThesis)}</p>
    </div>
  `).join("");
}

function renderSources() {
  $("#methodologyList").innerHTML = (state.methodology || []).map((item) => `
    <div><p>${escapeHtml(item)}</p></div>
  `).join("");

  const rows = state.models
    .slice()
    .sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name))
    .map((model) => `
      <tr>
        <td>${escapeHtml(model.year)}</td>
        <td><a href="${escapeHtml(model.paperUrl)}" target="_blank" rel="noreferrer">${escapeHtml(model.name)}</a></td>
        <td>${escapeHtml(model.category)}</td>
        <td>${escapeHtml(model.localText || "downloaded/extraction pending or survey-only")}</td>
        <td>${model.literalArchitecture || state.arch[model.id] ? "literal spec" : "method extract pending curation"}</td>
      </tr>
    `).join("");
  $("#paperTable").innerHTML = `
    <table>
      <thead><tr><th>Year</th><th>Paper</th><th>Category</th><th>Local Text</th><th>Diagram Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function bindEvents() {
  $$(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const route = tab.dataset.route;
      location.hash = route === "atlas" ? "atlas" : route;
    });
  });
  $$(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      setAtlasMode(button.dataset.mode);
    });
  });
  $("#globalSearch").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderAtlas();
  });
  $("#resetZoom").addEventListener("click", () => {
    setDefaultZoomForMode(state.mode);
    renderAtlas();
  });
  $("#backToAtlas").addEventListener("click", () => {
    location.hash = "atlas";
  });
  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("resize", () => renderAtlas());
}

bindEvents();
loadData().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("afterbegin", `<pre style="padding:16px;color:#a00">${escapeHtml(error.stack || error.message)}</pre>`);
});
