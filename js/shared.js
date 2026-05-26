export const state = {
  models: [],
  schema: null,
  arch: {},
  mode: "problem",
  query: "",
  selectedId: null,
  hoveredId: null,
  taxonomyHoveredFamily: null,
  zoom: { k: 0.68, x: 250, y: 78 },
  zoomBase: 0.68,
  dragging: null,
  lastAtlasPositions: new Map(),
  lastRenderedMode: null
};

export const familyColors = {
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

export const familyLabels = {
  pixel_idm: "Pixel-space IDM",
  latent_idm: "Latent-space IDM",
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

export const modeDescriptions = {
  problem: "Problem tree: from the central field question to the exact paper-level bottleneck.",
  taxonomy: "Architecture families arranged as a readable category map.",
  speed: "Runtime cost against training/model scale.",
  timeline: "Field evolution by publication date."
};

export const rootProblemQuestion = "How can video models best serve as VLA backbones?";

export const problemBranches = [
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

export const taxonomyGroups = [
  {
    id: "architecture",
    label: "Architecture",
    families: ["pixel_idm", "latent_idm", "implicit_future", "unified", "joint_latent", "multi_stream", "encoder_only", "multimodal"]
  },
  {
    id: "enhancement",
    label: "Enhancement",
    families: ["latent_action", "alignment", "online_adaptation", "speedup"]
  }
];

export const familyProblemQuestions = {
  pixel_idm: "Can inverse dynamics infer actions from predicted pixels?",
  latent_idm: "Can inverse dynamics infer actions from latent future state?",
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

export const familyProblemSplits = {
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

export const institutionMeta = {
  "gr-1": ["ByteDance Research", "bytedance.com", { logoUrl: "https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico" }],
  "gr-2": ["ByteDance Research", "bytedance.com", { logoUrl: "https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico" }],
  lapa: ["KAIST", "kaist.ac.kr"],
  vpp: ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  uva: ["UVA", "virginia.edu"],
  uwm: ["University of Washington", "washington.edu"],
  dreamgen: ["NVIDIA", "nvidia.com"],
  flare: ["NVIDIA", "nvidia.com"],
  clam: ["USC", "usc.edu"],
  videorepa: ["Shanghai Jiao Tong", "sjtu.edu.cn", { logoUrl: "https://en.sjtu.edu.cn/favicon.ico" }],
  univla: ["HKU", "hku.hk"],
  "geometry-forcing": ["Microsoft Research", "microsoft.com"],
  trivla: ["Fudan", "fudan.edu.cn"],
  "video-generators-robot-policies": ["Columbia", "columbia.edu"],
  "villa-x": ["Microsoft Research", "microsoft.com"],
  mowm: ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  dust: ["KAIST", "kaist.ac.kr"],
  "ud-vla": ["Monash", "monash.edu"],
  "rynnvla-002": ["Alibaba DAMO", "damo.alibaba.com", { logoUrl: "https://damo.alibaba.com/favicon.ico" }],
  motus: ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  videovla: ["Microsoft Research Asia", "microsoft.com"],
  act2goal: ["AgiBot", "agibot.com"],
  "mimic-video": ["mimic robotics", "mimicrobotics.com"],
  clap: ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  "cosmos-policy": ["NVIDIA", "nvidia.com"],
  wog: ["ByteDance Seed", "seed.bytedance.com", { logoUrl: "https://lf3-static.bytednsdoc.com/obj/eden-cn/lapzild-tss/ljhwZthlaukjlkulzlp/favicon_1/favicon.ico" }],
  "vla-jepa": ["USTC", "ustc.edu.cn"],
  frappe: ["Zhejiang University", "zju.edu.cn", { logoUrl: "https://www.zju.edu.cn/_upload/tpl/0b/bf/3007/template3007/favicon.ico" }],
  ldamodel: ["Peking University", "pku.edu.cn"],
  adaworldpolicy: ["HKU", "hku.hk"],
  "say-dream-act": ["Fudan", "fudan.edu.cn"],
  cowvla: ["Peking University", "pku.edu.cn"],
  "fast-wam": ["Galaxea AI", "galaxea.ai", { logoUrl: "https://galaxea.ai/favicon.ico" }],
  svam: ["HKUST(GZ)", "hkust-gz.edu.cn"],
  "sim-distill": ["UT Austin", "utexas.edu"],
  vampo: ["Zhejiang University", "zju.edu.cn", { logoUrl: "https://www.zju.edu.cn/_upload/tpl/0b/bf/3007/template3007/favicon.ico" }],
  eva: ["CUHK-Shenzhen", "cuhk.edu.cn"],
  vtam: ["UIUC", "illinois.edu"],
  "gigaworld-policy": ["GigaAI", "gigaai.cc", { logoUrl: "https://gigaai.cc/assets/favicon-hKtW4-r9.ico" }],
  aim: ["HKU", "hku.hk"],
  wav: ["Westlake", "westlake.edu.cn", { logoUrl: "https://www.westlake.edu.cn/favicon.ico" }],
  dexworldmodel: ["DexForce AI", "dexforce.com", { logoUrl: "https://www.dexforce.com/kuawei/2025/11/07/5mvfHqPBS7Ccu.ico" }],
  "x-wam": ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  motubrain: ["MotuBrain", "shengshu.com"],
  vidar: ["Tsinghua", "tsinghua.edu.cn", { logoUrl: "https://www.tsinghua.edu.cn/favicon.ico" }],
  "genie-envisioner": ["AgiBot", "agibot.com"],
  "xr-1": ["Peking University", "pku.edu.cn"],
  vipra: ["Carnegie Mellon", "cmu.edu"],
  "lingbot-va": ["Robbyant", "technology.robbyant.com", { logoUrl: "https://mdn.alipayobjects.com/huamei_u94ywh/afts/img/xEyrTpmj4LUAAAAAQEAAAAgADkxfAQFr/original" }],
  dreamzero: ["NVIDIA", "nvidia.com"],
  "rhoda-dva": ["Rhoda AI", "rhoda.ai", { logoUrl: "https://www.rhoda.ai/assets/images/logo/rhoda-logo-light.svg" }],
  dit4dit: ["Mondo Robotics", "mondorobotics.com"]
};

export const typeColors = {
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

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function slugDate(model) {
  const year = Number(model.year);
  const month = Math.max(1, Math.min(12, Number(model.month || 6)));
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.max(1, Math.min(maxDay, Number(model.day || Math.ceil(maxDay / 2))));
  return year + ((month - 1) + (day - 1) / maxDay) / 12;
}

export function scoreLabel(value) {
  const labels = ["", "low", "modest", "medium", "high", "very high"];
  return labels[Math.max(1, Math.min(5, Number(value) || 1))];
}

export function wrapText(text, max) {
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

export function shortText(value, maxChars) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}


