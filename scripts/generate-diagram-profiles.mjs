import fs from "node:fs";

const atlas = JSON.parse(fs.readFileSync("data/wam-models.json", "utf8"));

// One reviewed architectural identity per paper. These names deliberately preserve
// distinctions that the family-level renderer used to flatten.
const cores = {
  "gr-1": ["GPT Causal Video-Action Transformer", "transformer"],
  "gr-2": ["GPT Video-Language-Action Transformer", "transformer"],
  "lapa": ["C-ViViT Latent-Action VQ Model", "transformer"],
  "vpp": ["SVD Predictor + Video Former Policy", "diffusion"],
  "uva": ["Joint Masked Video-Action Transformer", "transformer"],
  "uwm": ["Coupled Action-Observation Diffusion Transformer", "dit"],
  "dreamgen": ["Offline Wan2.1 + IDM Data Pipeline", "diffusion"],
  "flare": ["Future-Token Action DiT", "dit"],
  "clam": ["Continuous Latent IDM-FDM", "transformer"],
  "videorepa": ["CogVideoX + VideoREPA Alignment", "dit"],
  "univla": ["Two-Stage Latent Action Model + Prismatic VLM", "transformer"],
  "geometry-forcing": ["Flow Video DiT + VGGT Geometry Alignment", "dit"],
  "trivla": ["Tri-System VLA", "transformer"],
  "video-generators-robot-policies": ["SVD Feature Encoder + Diffusion Policy", "diffusion"],
  "villa-x": ["Latent-Plan and Action Expert VLA", "transformer"],
  "mowm": ["Pixel-Latent Motion World Model", "transformer"],
  "dust": ["Dual-Stream MMDiT", "dit"],
  "ud-vla": ["Joint Discrete Denoising Transformer", "transformer"],
  "rynnvla-002": ["VLA Encoder + Image-Space World Model", "transformer"],
  "motus": ["Tri-Expert Mixture-of-Transformers", "dit"],
  "videovla": ["Joint Video-Action DiT", "dit"],
  "act2goal": ["Goal-Conditioned Video World Model", "diffusion"],
  "mimic-video": ["Cosmos Video Backbone + Action DiT", "dit"],
  "clap": ["Cross-Embodiment Latent-Action Alignment", "transformer"],
  "cosmos-policy": ["Cosmos Latent-Denoising WAM", "dit"],
  "wog": ["Future-Condition VLA", "transformer"],
  "vla-jepa": ["JEPA Future Predictor + Action Policy", "transformer"],
  "frappe": ["Future-Representation Prefix Policy", "transformer"],
  "ldamodel": ["Multi-Expert Latent Dynamics Model", "transformer"],
  "adaworldpolicy": ["World/Action DiTs + AdaOL", "dit"],
  "say-dream-act": ["Distilled Video WM + Dream-Conditioned Policy", "diffusion"],
  "cowvla": ["Structure-Motion Latent World Model", "transformer"],
  "fast-wam": ["Video DiT + Cached Action Expert", "dit"],
  "svam": ["Shortcut Foresight VAM", "dit"],
  "sim-distill": ["Simulator-Distilled World Dynamics Adapter", "transformer"],
  "vampo": ["Reward-Aligned Video Action Model", "dit"],
  "eva": ["Aligned Video Generator + Frozen IDM", "diffusion"],
  "vtam": ["Visuo-Tactile-Action World Model", "transformer"],
  "gigaworld-policy": ["Shared Block-Causal World-Action Transformer", "dit"],
  "aim": ["RGB-Value-Action Mixture-of-Transformers", "dit"],
  "wav": ["Latent World Model + Trajectory Value Model", "diffusion"],
  "dexworldmodel": ["Causal Latent WM + Dual-State TTT", "transformer"],
  "x-wam": ["Wan2.2 Unified RGB-D World-Action DiT", "dit"],
  "motubrain": ["H-Bridge Video-Action Transformer", "transformer"],
  "vidar": ["Embodied Video Diffusion + Masked IDM", "diffusion"],
  "genie-envisioner": ["LTX Video DiT + GE-Act", "dit"],
  "xr-1": ["Dual-Branch VQ-VAE + Shared Motion Codebook", "transformer"],
  "vipra": ["LWM Latent-Action Autoregressive Policy", "transformer"],
  "lingbot-va": ["Narrow-Action / Video Mixture-of-Transformers", "dit"],
  "dreamzero": ["Autoregressive Joint Video-Action DiT", "dit"],
  "rhoda-dva": ["Causal Video Model + Inverse Dynamics", "transformer"],
  "dit4dit": ["Cosmos Video DiT + Action DiT", "dit"],
  "being-h07": ["Prior/Posterior Latent Action Policy", "transformer"],
  "vera": ["Wan Video Planner + Jacobian IDM", "diffusion"],
  "harmowam": ["Process-Adaptive Reactive/Predictive Experts", "dit"],
  "pelican-unify": ["Qwen3-VL Loop State + Wan2.2 Dual Heads", "dit"],
  "wall-wm": ["Wan Video DiT + One-Way Action DiT", "dit"],
  "next-forcing": ["Wan2.2 Video-Action MoT + MCP", "dit"],
  "feedback-wm": ["Latent Dynamics + Online Feedback Policy", "transformer"],
  "omnihumanoid": ["Streaming Cross-Embodiment Video Diffusion", "diffusion"],
  "mola": ["SVD Imagination + Mixture of IDMs", "diffusion"],
  "maskwam": ["RGB-Mask-Action Mixture-of-Transformers", "dit"],
  "abot-m05": ["Dual-Level Mobility/Manipulation MoT", "dit"],
  "lawam": ["Qwen/DINO LaWM + Alternate-DiT", "dit"],
  "aha-wam": ["Video Planner + Compact Action Executor", "dit"],
  "tau0-wm": ["Wan Video DiT + Action DiT Evaluator", "dit"],
  "rla-wm": ["Residual Latent-Action Autoencoder + Flow WM", "transformer"]
};

// Renderer topology overrides are used only where the atlas family name would
// otherwise invent a module the paper does not contain.
const patternOverrides = {
  "omnihumanoid": "multimodal"
};

const variantOverrides = {
  "dreamzero": "dreamzero_joint_flow"
};

const runtimeOverrides = {
  "dreamzero": [
    "encode past frames together with proprioception and the language instruction",
    "autoregressively flow-sample the next joint video/action chunk with the causal DiT and KV cache",
    "decode future frames and the continuous future action chunk",
    "execute actions asynchronously and update the cache with the next real observation"
  ]
};

const trainingOverrides = {
  "dreamzero": [
    { label: "Joint flow matching", detail: "add separate noise to future video latents and action tokens, then predict both velocity fields jointly", kind: "loss" },
    { label: "Teacher forcing", detail: "clean previous chunks condition current-chunk denoising", kind: "loss" },
    { label: "Causal masking", detail: "chunk-level causal attention and action-video masking prevent future leakage", kind: "loss" },
    { label: "WAM pretraining", detail: "about 500h of AgiBot G1 trajectories, plus DROID and cross-embodiment video mixtures", kind: "stage" },
    { label: "Flash distillation", detail: "post-training reduces denoising latency for closed-loop deployment", kind: "stage" }
  ]
};

const uncertaintyOverrides = {
  "omnihumanoid": "High; the available local source is abstract-level, so implementation details and normalized accuracy are not included."
};

const coreDetailOverrides = {
  "omnihumanoid": [
    "streaming video diffusion generator",
    "shared motion conditioning with embodiment-specific adaptation",
    "branch-isolated attention separates motion and appearance"
  ]
};

const encoderOverrides = {
  "gr-1": [
    ["CLIP Text Encoder", "frozen instruction encoder", "language"],
    ["MAE ViT Encoder", "frozen image-history encoder", "visual"],
    ["State Linear Projection", "6D end-effector pose + gripper", "state"]
  ],
  "gr-2": [
    ["Frozen Text Encoder", "instruction tokens", "language"],
    ["Frozen VQ-GAN", "multi-view frames -> discrete tokens", "visual"],
    ["State Linear Projection", "end-effector and gripper state", "state"]
  ],
  "lapa": [
    ["C-ViViT Frame-Pair Encoder", "inverse dynamics latent-action encoder", "visual"],
    ["NSVQ Action Codebook", "discrete latent-action bottleneck", "action"],
    ["LWM-Chat-1M VLM", "downstream latent VLA", "language"]
  ],
  "vpp": [
    ["SVD VAE", "current image + noised future latent", "visual"],
    ["CLIP Text Encoder", "cross-attention language condition", "language"]
  ],
  "act2goal": [
    ["Goal Visual Sequence", "current observation + goal hidden-state sequence", "visual"]
  ],
  "cosmos-policy": [
    ["Cosmos Video VAE", "video latent sequence", "visual"],
    ["Action/State Projection", "spatially replicated action and state tokens", "action"]
  ],
  "rhoda-dva": [
    ["Causal Video + KV Cache", "native video tokenizer and long-context causal backbone", "visual"]
  ],
  "omnihumanoid": [
    ["Video Diffusion Tokenizer", "tokenizer details are outside the available abstract-level source", "visual"],
    ["Embodiment Adapter", "target-embodiment conditioning", "state"]
  ],
  "genie-envisioner": [
    ["LTX-Video VAE", "synchronized multi-view latent video", "visual"],
    ["T5-XXL Encoder", "instruction condition", "language"],
    ["Action Projection", "noisy 54-step action tokens", "action"]
  ],
  "dreamzero": [
    ["Wan2.1 Video VAE", "visual context and future video latents", "visual"],
    ["Frozen Text Encoder", "instruction condition", "language"],
    ["State Encoder", "trainable proprioceptive token", "state"]
  ]
};

const colors = {
  visual: "#4c78a8",
  language: "#8f6bb8",
  action: "#d08a2e",
  state: "#5a8f63",
  future: "#2f8793",
  value: "#9f5f63"
};

const clean = (value, words = 22) => {
  const normalized = String(value || "")
    .replace(/[{}*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/;\s+|\.\s+(?=[A-Z])/)[0]
    .replace(/\.$/, "");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length > words
    ? `${tokens.slice(0, words).join(" ")}…`
    : tokens.join(" ");
};

function kindOf(value) {
  const text = String(value || "").toLowerCase();
  if (/\b(language|instruction|text|caption|goal)\b/.test(text)) return "language";
  if (/\b(action|control|trajectory|command|mobility|manipulation)\b/.test(text)) return "action";
  if (/\b(state|proprio|joint|force|tactile|gripper)\b/.test(text)) return "state";
  if (/\b(value|reward|score)\b/.test(text)) return "value";
  if (/\b(future|latent|subgoal|mask|depth)\b/.test(text)) return "future";
  return "visual";
}

function detailFor(label, pools) {
  const words = String(label).toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  const ranked = pools.map((item) => ({
    item,
    score: words.reduce((score, word) => score + (String(item).toLowerCase().includes(word) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);
  return clean(ranked[0]?.score ? ranked[0].item : label);
}

function inputGroups(model, arch) {
  const source = arch.inputTokens || [];
  return (model.diagram?.inputs || []).slice(0, 5).map((label) => ({
    kind: kindOf(label),
    label,
    tokens: [detailFor(label, source)]
  }));
}

function encoderLabel(value) {
  const text = String(value);
  const lower = text.toLowerCase();
  if (/continuous latent action replaces vq/.test(lower)) return "Continuous Latent-Action Bottleneck";
  if (/space-time attention encoder/.test(lower)) return "Space-Time IDM Encoder";
  if (/idm encoder.*spatial-temporal|spatial-temporal transformer.*idm/.test(lower)) return "Spatiotemporal IDM Encoder";
  if (/svd upsampling-layer features/.test(lower)) return "SVD Feature Taps";
  if (/pixel-space world model.*svd/.test(lower)) return "SVD Pixel-World Encoder";
  if (/multi-view video.*concatenating vae token/.test(lower)) return "Multi-View VAE Packing";
  if (/cosmos-predict2 encodes video/.test(lower)) return "Cosmos-Predict2 VAE";
  if (/multiple cameras.*concatenated/.test(lower)) return "Multi-Camera Latent Packing";
  if (/encoder e.*(?:theta|θ).*raw observation/.test(lower)) return "Observation Encoder Eθ";
  if (/history encoder c.*(?:theta|θ)/.test(lower)) return "History Encoder Cθ";
  if (/current and sparse future composite observations/.test(lower)) return "Composite Observation Encoder";
  if (/depth maps.*replicated to three/.test(lower)) return "Depth Channel Adapter";
  if (/multi-view inputs.*independently encoded/.test(lower)) return "Multi-View Video Encoder";
  if (/causal video vae compresses frames/.test(lower)) return "Causal Video VAE";
  if (/pretrained video vae encodes/.test(lower)) return "Video VAE";
  if (/task-specific latent encoder/.test(lower)) return "Task Latent Encoder";
  if (/inverse dynamics encoder.*discrete/.test(lower)) return "Latent IDM Encoder";
  if (/wan\s?2\.2/.test(lower) && /vae/.test(lower)) return "Wan2.2 Causal VAE";
  if (/wan\s?2\.1/.test(lower) && /vae/.test(lower)) return "Wan2.1 Video VAE";
  if (/wan/.test(lower) && /vae/.test(lower)) return "Wan Video VAE";
  if (/cogvideox/.test(lower) && /vae/.test(lower)) return "CogVideoX 3D VAE";
  if (/cosmos/.test(lower) && /vae/.test(lower)) return "Cosmos Video VAE";
  if (/stable video diffusion|\bsvd\b/.test(lower) && /vae|latent|encode/.test(lower)) return "SVD VAE";
  if (/sdxl/.test(lower) && /vae/.test(lower)) return "SDXL VAE";
  if (/3d vae/.test(lower)) return "3D Video VAE";
  if (/causal vae/.test(lower)) return "Causal Video VAE";
  if (/vq-?gan/.test(lower)) return "VQ-GAN Tokenizer";
  if (/vq-?vae/.test(lower) && /codebook|quant/.test(lower)) return "VQ-VAE Codebook";
  if (/vq-?vae/.test(lower)) return "VQ-VAE Tokenizer";
  if (/dinov3/.test(lower)) return "DINOv3 Encoder";
  if (/dinov2/.test(lower)) return "DINOv2 Encoder";
  if (/\bdino\b/.test(lower)) return "DINO Encoder";
  if (/siglip-?2/.test(lower)) return "SigLIP-2 Encoder";
  if (/siglip/.test(lower)) return "SigLIP Encoder";
  if (/videomae\s?v?2/.test(lower)) return "VideoMAEv2 Encoder";
  if (/v-jepa\s?2/.test(lower)) return "V-JEPA2 Encoder";
  if (/v-jepa/.test(lower)) return "V-JEPA Encoder";
  if (/vggt/.test(lower)) return "VGGT Geometry Encoder";
  if (/internvl3\.5/.test(lower)) return "InternVL3.5 Encoder";
  if (/qwen3-vl/.test(lower)) return "Qwen3-VL Encoder";
  if (/qwen/.test(lower)) return "Qwen VLM Encoder";
  if (/t5-xxl/.test(lower)) return "T5-XXL Encoder";
  if (/\bt5\b/.test(lower)) return "T5 Text Encoder";
  if (/\bclip\b/.test(lower) && /text|language/.test(lower)) return "CLIP Text Encoder";
  if (/\bclip\b/.test(lower)) return "CLIP Vision Encoder";
  if (/resnet-18/.test(lower)) return "ResNet-18 Encoder";
  if (/q-former/.test(lower)) return "Q-Former";
  if (/eagle-?2/.test(lower)) return "Eagle-2 VLM Encoder";
  if (/emu3/.test(lower)) return "Emu3 Tokenizer";
  if (/lwm/.test(lower)) return "LWM Visual Tokenizer";
  if (/uni-perceiver/.test(lower)) return "Uni-Perceiver";
  if (/motion.*encoder/.test(lower)) return "Motion Encoder";
  if (/tactile.*encoder/.test(lower)) return "Tactile Encoder";
  if (/rgb.*encoder/.test(lower)) return "RGB Encoder";
  if (/(?:video|visual|image|frame).*(?:encoded|encoder)/.test(lower)) return "Video Encoder";
  if (/(?:video|visual|image|frame).*tokeniz/.test(lower)) return "Visual Tokenizer";
  if (/(?:language|text).*tokeniz/.test(lower)) return "Text Tokenizer";
  if (/action.*(?:encoder|project|token)/.test(lower)) return "Action Encoder";
  if (/(?:state|proprio).*(?:encoder|project|mlp)/.test(lower)) return "State MLP";
  if (/vision.*encoder|image.*encoder/.test(lower)) return "Vision Encoder";
  if (/text.*encoder|language.*encoder/.test(lower)) return "Text Encoder";
  if (/codebook|quantiz/.test(lower)) return "Latent Codebook";
  if (/project|linear|mlp|embed/.test(lower)) return "Modality Projection";
  return clean(text, 6);
}

function encoders(model, arch) {
  if (encoderOverrides[model.id]) {
    return encoderOverrides[model.id].map(([label, detail, kind]) => ({ label, detail, kind, exact: true }));
  }
  const componentText = (model.diagram?.components || []).filter((item) => /encoder|tokenizer|vae|vq|codebook|embedder|projection/i.test(item));
  const candidates = [...(arch.tokenization || []), ...componentText].filter((item) => (
    /encoder|tokeniz|vae|vq|codebook|quant|projection|project|embed|dino|siglip|clip|t5|qwen|internvl|cosmos|wan|cogvideo|stable video diffusion|\bsvd\b|jepa|vggt|resnet/i.test(item)
  )).filter((item) => !/expert uses|sampler|scheduler|loss|objective|discriminator|online update|lora adapter/i.test(item));
  const seen = new Set();
  return candidates.map((item) => ({
    label: encoderLabel(item),
    detail: clean(item, 24),
    kind: kindOf(item),
    exact: true
  })).filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function headLabel(value) {
  const text = String(value);
  const lower = text.toLowerCase();
  const rules = [
    [/per-dimension robot action bins/, "Action Bin Decoder"],
    [/video former.*predictive representation|video former.*token aggregator/, "Video Former Tokens"],
    [/latent-action extractor/, "Latent-Action Extractor"],
    [/latent fdm reconstruction/, "Forward Dynamics Decoder"],
    [/video denoiser/, "Video Denoiser"],
    [/vd-vae forward dynamics decoder/, "Forward Dynamics Decoder"],
    [/vae decoder reconstructs full frames/, "Video VAE Decoder"],
    [/sdxl vae decoder/, "SDXL VAE Decoder"],
    [/vae decoder.*latent frames/, "Video VAE Decoder"],
    [/vae decoder.*video/, "Video VAE Decoder"],
    [/vae decoder.*rgb.*depth/, "RGB-D VAE Decoder"],
    [/action noise prediction output/, "Action Denoising Head"],
    [/denoising transformer.*noise-prediction|noise prediction output/, "Video Denoising Head"],
    [/flow-matching velocity head/, "Video Flow Head"],
    [/video dynamics module.*diffusion/, "Video Dynamics Head"],
    [/pixel denoising head/, "Pixel Denoising Head"],
    [/observation velocity-field head/, "Observation Flow Head"],
    [/future latent denoising output/, "Future Latent Denoiser"],
    [/action denoising output/, "Action Denoiser"],
    [/world-model vector-field head.*visual latent/, "World Flow Head"],
    [/latent denoising outputs.*action latent/, "Action Latent Denoiser"],
    [/latent denoising outputs.*proprioception/, "State Latent Denoiser"],
    [/scale prediction head/, "Geometry Scale Head"],
    [/aligned intermediate features.*geometry/, "Geometry Alignment Head"],
    [/act-latent.*expert/, "ACT-Latent Expert"],
    [/latent next-state token predictor/, "Latent Dynamics Head"],
    [/masked visual-token prediction/, "Visual Token Head"],
    [/parallel decoding head/, "Parallel Token Head"],
    [/image-token head/, "Image Token Head"],
    [/world-model head.*v-jepa/, "JEPA Future Head"],
    [/router network.*expert weights/, "Expert Router"],
    [/task-conditioned.*output heads/, "Task-Conditioned Heads"],
    [/3d convolutional discriminator/, "Video Discriminator"],
    [/autoregressive token head.*vqgan/, "Visual Token Head"],
    [/single-pass latent world representation.*parameterizes/, "Action Flow Head"],
    [/uni-perceiver token condensation/, "Token Condenser"],
    [/dpt probing head/, "Geometry Probe"],
    [/latent dynamics prediction head/, "Latent Dynamics Head"],
    [/vpm denoiser/, "Video Denoiser"],
    [/agm denoiser/, "Action Denoiser"],
    [/proprioceptive state velocity/, "State Flow Head"],
    [/rgb flow-matching velocity/, "RGB Flow Head"],
    [/vae decoders for future rgb and asvm/, "RGB + ASVM Decoders"],
    [/snr-based trajectory scoring/, "Trajectory Scorer"],
    [/dino.*feature extraction target/, "DINO Feature Target"],
    [/state flow velocity/, "State Flow Head"],
    [/rectified-flow velocity head/, "Video Flow Head"],
    [/motion decoder/, "Motion Decoder"],
    [/forward frame decoder/, "Future Frame Decoder"],
    [/joint velocity prediction/, "Joint Video-Action Flow"],
    [/future-rgb denoiser/, "Future RGB Denoiser"],
    [/language\/cot head/, "Language/CoT Head"],
    [/latent-to-text vlm head/, "Latent-to-Text Head"],
    [/next1\/next2\/next3 chunk predictors/, "Multi-Horizon Chunk Heads"],
    [/latent predictor head/, "Latent Dynamics Head"],
    [/action denoiser/, "Action Denoiser"],
    [/flow-matching velocity predictor/, "Future Latent Flow Head"],
    [/jacobian|j-idm/, "Jacobian IDM"],
    [/inverse dynamics|\bidm\b/, "Inverse Dynamics Model"],
    [/whole-body|\bwbc\b/, "Whole-Body Controller"],
    [/future.*(?:image|frame).*decoder|video.*decoder/, "Future Video Decoder"],
    [/future.*feature|dino.*(?:head|decoder|predict)/, "Future Feature Head"],
    [/mask.*(?:head|denois|decoder)/, "Mask Denoiser"],
    [/depth.*(?:head|decoder|predict)/, "Depth Head"],
    [/force|tactile/, "Force/Tactile Head"],
    [/reward/, "Reward Head"],
    [/value/, "Value Head"],
    [/latent.action.*(?:head|decoder)|(?:head|decoder).*latent.action/, "Latent-Action Head"],
    [/cvae.*action|conditional vae.*action/, "cVAE Action Decoder"],
    [/action decoder/, "Action Decoder"],
    [/flow.*action|action.*flow|action.*velocity/, "Action Flow Head"],
    [/diffusion.*action|action.*diffusion/, "Diffusion Action Head"],
    [/action.*(?:head|decoder|expert|predict|projection)|(?:head|decoder).*action/, "Action Head"],
    [/video.*(?:head|denois|velocity)|future.*(?:head|predict)/, "Video/Future Head"],
    [/projection|projector|mlp/, "Projection Head"]
  ];
  return rules.find(([pattern]) => pattern.test(lower))?.[1] || clean(text, 7);
}

function heads(model, arch) {
  const source = [...(arch.heads || [])];
  if (!source.length) {
    source.push(...(model.diagram?.components || []).filter((item) => /head|decoder|idm|controller|predictor/i.test(item)));
  }
  const seen = new Set();
  return source.filter((item) => !/sampler|scheduler|rollout evaluator|debug video|hook interface|lora adapter|online update|online prediction|cache|variant|smoothing|interpolation|grpo objective|latent-action encoders|action encoder$|vision encoders|mppi planner|online data streaming|generation interface/i.test(item))
    .map((item) => ({ label: headLabel(item), detail: clean(item), exact: true })).filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function outputs(model, arch) {
  const inference = arch.inferenceRecipe || [];
  return (model.diagram?.outputs || ["action chunk"]).slice(0, 5).map((label) => ({
    label,
    detail: detailFor(label, inference)
  }));
}

function attentionBadges(arch) {
  const text = (arch.attention || []).join(" ").toLowerCase();
  const badges = [];
  const add = (label, pattern) => { if (pattern.test(text)) badges.push(label); };
  add("block-causal mask", /blockwise causal|block-causal|causal mask/);
  add("causal temporal mask", /causal temporal/);
  add("unilateral cross-attn", /unilateral/);
  add("tri-model joint attn", /tri-model/);
  add("shared cross-attn", /shared cross-modal|shared.*attention/);
  add("cross-attn", /cross-attention|cross attention|cross-attn/);
  add("self-attn", /self-attention|self attention/);
  add("AdaLN", /adaln|adaptive layer norm/);
  add("KV cache / memory", /kv.cache|cache|memory/);
  add("intent-causal", /intent-causal/);
  add("causal chunk attention", /autoregressive chunk|chunk-level attention/);
  add("action-video mask", /action-video mask|future leakage/);
  return [...new Set(badges)].slice(0, 7);
}

function trainingItems(arch) {
  const objectives = (arch.objectives || []).slice(0, 4).map((item) => ({
    label: objectiveLabel(item), detail: clean(item, 26), kind: "loss"
  }));
  const stages = (arch.trainingRecipe || []).slice(0, 3).map((item) => ({
    label: stageLabel(item), detail: clean(item, 26), kind: "stage"
  }));
  return [...objectives, ...stages].slice(0, 7);
}

function objectiveLabel(value) {
  const text = String(value).toLowerCase();
  if (/flow matching|velocity/.test(text) && /action/.test(text)) return "Action flow matching";
  if (/flow matching|velocity/.test(text) && /video|future|world|observation/.test(text)) return "World flow matching";
  if (/flow matching|velocity/.test(text)) return "Flow matching";
  if (/behavior cloning|imitation|smooth-l1|l1 loss/.test(text)) return "Behavior cloning";
  if (/reconstruct|prediction mse|future.*mse/.test(text)) return "Future reconstruction";
  if (/contrast|align|cosine|distill/.test(text)) return "Representation alignment";
  if (/reward|grpo|reinforcement/.test(text)) return "Reward optimization";
  if (/vq|quantiz|codebook/.test(text)) return "Vector quantization";
  if (/video/.test(text)) return "Video objective";
  if (/action/.test(text)) return "Action objective";
  return clean(value, 5);
}

function stageLabel(value) {
  const text = String(value).toLowerCase();
  if (/pretrain/.test(text)) return "Pretraining";
  if (/fine.?tun/.test(text)) return "Finetuning";
  if (/post.?train/.test(text)) return "Post-training";
  if (/stage\s*1/.test(text)) return "Stage 1";
  if (/stage\s*2/.test(text)) return "Stage 2";
  if (/freeze|frozen/.test(text)) return "Frozen modules";
  if (/online|test-time/.test(text)) return "Online adaptation";
  return "Training stage";
}

function layerBadges(arch) {
  const text = [...(arch.backbone || []), ...(arch.attention || [])].join(" ").toLowerCase();
  const badges = [];
  if (/self-attention|self attention|joint attention|shared attention/.test(text)) badges.push("self-attn");
  if (/cross-attention|cross attention|cross-attn/.test(text)) badges.push("cross-attn");
  if (/adaln|adaptive layer norm/.test(text)) badges.push("AdaLN");
  if (/ffn|feed-forward|mlp/.test(text)) badges.push("FFN");
  if (/diffusion|denois|flow matching|rectified flow/.test(text)) badges.push("noise t");
  return badges.length ? badges.slice(0, 5) : ["attention", "MLP", "head"];
}

function streamsFor(model) {
  const items = [...(model.diagram?.inputs || []), ...(model.diagram?.outputs || [])];
  const kinds = [...new Set(items.map(kindOf))];
  return kinds.slice(0, 6).map((kind) => ({
    label: ({ visual: "Video / Vision", language: "Language", action: "Action", state: "Robot State", future: "Future / Latent", value: "Value / Reward" })[kind],
    detail: items.filter((item) => kindOf(item) === kind).join(" + "),
    color: colors[kind] || colors.visual
  }));
}

const profiles = {};
for (const model of atlas.models) {
  const arch = model.literalArchitecture || {};
  const core = cores[model.id];
  if (!core) throw new Error(`Missing reviewed core identity for ${model.id}`);
  const allText = Object.values(arch).flat(2).filter((item) => typeof item === "string").join(" ").toLowerCase();
  profiles[model.id] = {
    review: {
      status: "paper-specific",
      sourceExtract: arch.sourceExtract,
      sourceLines: arch.sourceLines || [],
      uncertainty: uncertaintyOverrides[model.id] || model.uncertainty,
      sourceCoverage: /abstract-level|architecture specifics.*outside/i.test(allText) ? "abstract-level" : "method-level"
    },
    pattern: patternOverrides[model.id] || model.diagram?.pattern || model.family,
    variant: variantOverrides[model.id] || null,
    thesis: model.oneLine,
    inputs: inputGroups(model, arch),
    encoders: encoders(model, arch),
    core: {
      label: core[0],
      kind: core[1],
      details: coreDetailOverrides[model.id] || (arch.backbone || model.diagram?.components || []).slice(0, 3).map((item) => clean(item, 28)),
      layerBadges: layerBadges(arch)
    },
    streams: streamsFor(model),
    attention: attentionBadges(arch),
    heads: heads(model, arch),
    outputs: outputs(model, arch),
    components: (model.diagram?.components || []).slice(0, 10).map((label) => ({
      label,
      detail: detailFor(label, [...(arch.backbone || []), ...(arch.branches || []), ...(arch.heads || [])])
    })),
    data: model.diagram?.data || [],
    training: trainingOverrides[model.id] || trainingItems(arch),
    runtime: runtimeOverrides[model.id] || (arch.inferenceRecipe || model.diagram?.runtimePath || []).slice(0, 4).map((item) => clean(item, 36)),
    motifs: {
      diffusion: /diffusion|denois|flow matching|rectified flow|noise/.test(allText),
      multiStream: /mixture-of-transformer|multi-stream|dual-stream|branch|expert/.test(allText),
      trainingOnly: /training-only|during training|pretrain|finetun|frozen/.test(allText),
      online: /online|test-time|ttt|memory|cache/.test(allText)
    }
  };
}

const output = {
  version: "1.0.0",
  generatedOn: "2026-07-16",
  purpose: "Paper-specific reviewed diagram profiles for the existing WAM atlas renderer.",
  reviewPolicy: "Every atlas paper has an explicit architectural identity and source-linked profile. Abstract-level sources are marked by coverage level instead of filling missing details with a family template.",
  models: profiles
};

fs.writeFileSync("data/diagram-profiles.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Generated ${Object.keys(profiles).length} paper-specific diagram profiles.`);
