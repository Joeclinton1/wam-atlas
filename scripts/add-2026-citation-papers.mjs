// Adds the 2026 citation-frontier expansion batch (15 new WAM/VAM papers) to the atlas.
// Papers were selected by taking the citing papers of the March-April 2026 frontier
// cluster and keeping those newer than the atlas (arXiv 2605+) with >=2 citations,
// plus VERA (2605.27817) as a curator exception. Surveys and non-model papers excluded.
//
// Writes methods/<id>.md source files, appends model cards to data/wam-models.json,
// and appends benchmark/metric overrides to data/metric-overrides.json.
// Run scripts/enrich-comparative-metrics.mjs afterwards to (re)generate comparative metrics.

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const modelsPath = path.join(root, "data", "wam-models.json");
const overridesPath = path.join(root, "data", "metric-overrides.json");
const methodsDir = path.join(root, "methods");

const categoryFor = {
  pixel_idm: "Pixel-space IDM",
  latent_idm: "Latent-space IDM",
  encoder_only: "Training-time video, action-only runtime",
  joint_latent: "Shared action-observation latent space",
  unified: "Unified action-observation prediction",
  multi_stream: "Separate streams or expert mixtures",
  implicit_future: "Implicit future representation",
  latent_action: "Latent action interface",
  alignment: "Representation or executability alignment",
  multimodal: "Tactile, depth, or 4D state",
  online_adaptation: "Online adaptive world-action policy",
  speedup: "Shortcut or deployment acceleration"
};

// Each paper: full card + method source lines + metric override.
// override.accuracy.benchmarks[key].ev  -> 0-based indices into `method` lines.
const papers = [
  {
    id: "being-h07",
    name: "Being-H0.7",
    title: "Being-H0.7: A Latent World-Action Model from Egocentric Videos",
    date: ["2026", "05", "01"],
    arxiv: "2605.00078",
    family: "implicit_future",
    problem: "VLAs learn shortcut action mappings, while pixel-space world models waste compute rendering task-irrelevant visual detail.",
    oneLine: "A latent world-action model that reasons about the future in a latent space via aligned prior/posterior branches, deploying with no visual rollout.",
    insights: {
      problem: "Sparse action supervision encourages shortcuts rather than dynamics; pixel rollouts add overhead and model irrelevant detail.",
      method: "A deployable prior branch infers latent future states from current context; a training-only posterior branch reads future-observation embeddings, and the two are aligned in latent reasoning space.",
      novelty: "Keeps predictive benefit of world models while eliminating pixel rollout, discarding the posterior branch entirely at inference.",
      limitation: "Latent future awareness is only as good as the posterior embeddings used during training; no inspectable future is produced.",
      related: "AIM, MoWM, VLA-JEPA"
    },
    metrics: { runtimeCost: 2, computeScale: 4, evidence: 5, runtimeNote: "Latent prior branch, no visual rollout; latency-aware async chunking ~3-4 ms/step." },
    diagram: {
      pattern: "implicit_future",
      inputs: ["egocentric/robot RGB history", "language instruction", "robot state"],
      data: ["mixed human + robot manipulation trajectories (UniHand 2.0 format)", "large-scale egocentric videos"],
      predictiveState: { form: "aligned latent future-reasoning state", runtime: "implicit", rendered: false },
      components: ["InternVL3.5 understanding expert", "Latent query bottleneck", "Prior branch (deployable)", "Posterior branch (training-only)", "Qwen3 action expert"],
      trainingStages: [
        { name: "Pretraining", data: "human + robot egocentric videos", objective: "learn latent future-aware representation" },
        { name: "Downstream post-training", data: "task manipulation trajectories", objective: "align prior to posterior latent and predict actions" }
      ],
      runtimePath: ["observation + language", "prior latent inference", "action expert"],
      outputs: ["action chunk"]
    },
    lit: {
      inputTokens: ["egocentric/robot RGB frames", "language tokens", "robot proprioceptive state", "learnable latent queries between perception and action"],
      tokenization: ["vision encoded by InternVL3.5 understanding expert", "language embedded into shared token space", "latent queries inserted between perception and action"],
      backbone: ["InternVL3.5 understanding expert (~3B total)", "Qwen3 action expert"],
      branches: ["deployable prior branch infers latent state from current context", "training-only posterior branch conditions on future-observation embeddings"],
      attention: ["prior and posterior share the latent reasoning space", "posterior injects future information only during training"],
      heads: ["action decoder over latent state"],
      objectives: ["latent alignment between prior and posterior branches", "action prediction loss"],
      trainingRecipe: ["pretrain on mixed human/robot egocentric video", "post-train downstream with prior-posterior latent alignment"],
      inferenceRecipe: ["discard posterior branch", "infer latent state from current context via prior", "decode actions with no visual rollout", "latency-aware Universal Async Chunking (~3-4 ms/step)"]
    },
    uncertainty: "medium: architecture and benchmark scores from the paper abstract/body; some data-scale and compute figures not reported.",
    method: [
      "Being-H0.7: A Latent World-Action Model from Egocentric Videos.",
      "Being-H0.7 is a 3B-parameter latent world-action model built from an InternVL3.5 understanding expert and a Qwen3 action expert.",
      "A deployable prior branch infers latent future states from the current context while a training-only posterior branch reads future-observation embeddings; the two are aligned in latent reasoning space.",
      "At inference Being-H0.7 discards the posterior branch and performs no visual rollout, using latency-aware Universal Async Chunking at roughly 3-4 ms/step.",
      "Training uses mixed human and robot manipulation trajectories in the UniHand 2.0 format together with large-scale egocentric videos across a pretraining and a downstream post-training stage.",
      "On LIBERO the average success rate is 99.2% and on RoboCasa-50 the success rate is 62.1%.",
      "LIBERO-Plus reaches 82.1% zero-shot and 84.8% fine-tuned, showing strong out-of-distribution robustness.",
      "On RoboTwin 2.0 Being-H0.7 reports 90.2% under the easy setting and 89.6% under the hard setting.",
      "On CALVIN ABCD->D it completes 4.67 tasks and on ABC->D 4.48 tasks, and it is evaluated on 12 real-world tasks across five ability suites."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        liberoPlus: { value: 84.8, ev: [6], context: "LIBERO-Plus fine-tuned" },
        robocasa: { value: 62.1, ev: [5], context: "RoboCasa-50" },
        robotwinAllData: { value: 90.2, ev: [7], context: "RoboTwin 2.0 easy multi-task" },
        robotwinTaskSpecific: { value: 89.6, ev: [7], context: "RoboTwin 2.0 hard" }
      } },
      inferenceCost: { fps4090: 22, reported: "~3-4 ms/step async chunking", ev: [3], assumptions: { note: "latent prior branch, no rollout; discounted to RTX 4090" } },
      generalization: { improvementPct: 21, unseenTask: true, ev: [6, 8], note: "Strong LIBERO-Plus OOD and 12 real-world tasks across five ability suites (unseen tasks)." },
      warnings: ["training-data hours and GPU-hours not reported; compute uses scale/parameter estimate"]
    }
  },

  {
    id: "vera",
    name: "VERA",
    title: "Turning Video Models into Generalist Robot Policies",
    date: ["2026", "05", "27"],
    arxiv: "2605.27817",
    family: "pixel_idm",
    problem: "Robot foundation models finetune a video model per embodiment, which is expensive and destroys cross-embodiment reuse.",
    oneLine: "Decouples an embodiment-agnostic action-free video planner from a Jacobian inverse-dynamics model for zero-shot cross-embodiment control.",
    insights: {
      problem: "Jointly finetuning video prediction and action per embodiment is costly and non-transferable.",
      method: "Keep the action-free video generative model unchanged as a visual planner; pair it with an embodiment-specific Jacobian inverse-dynamics model (J-IDM) trained on self-play.",
      novelty: "Video model is reused across embodiments without retraining; embodiment specificity is isolated in a small Jacobian IDM.",
      limitation: "Closed-loop video rollout with a 14B backbone is heavy; performance depends on video plan quality.",
      related: "Vidar, DreamGen, UniVLA"
    },
    metrics: { runtimeCost: 4, computeScale: 5, evidence: 3, runtimeNote: "Closed-loop video rollout planner (up to 14B) plus Jacobian IDM translation." },
    diagram: {
      pattern: "pixel_idm",
      inputs: ["current RGB observation", "language goal"],
      data: ["DROID", "MimicGen (Panda sim)", "PushT-Sim", "Allegro-Sim", "self-play for IDM"],
      predictiveState: { form: "future RGB video plan", runtime: "full", rendered: true },
      components: ["Action-free Wan video diffusion planner (1.3B / 14B)", "Jacobian inverse-dynamics model (J-IDM)", "Closed-loop controller"],
      trainingStages: [
        { name: "Video post-training", data: "robot video (DROID, sim)", objective: "diffusion-forcing future RGB prediction" },
        { name: "J-IDM training", data: "embodiment self-play", objective: "predict pixel-space Jacobian action fields" }
      ],
      runtimePath: ["observation + goal", "video plan generation", "J-IDM action translation", "closed-loop execution"],
      outputs: ["future video", "action"]
    },
    lit: {
      inputTokens: ["current RGB frame", "language goal", "generated future RGB frames"],
      tokenization: ["Wan video VAE latent tokens", "language conditioning"],
      backbone: ["Wan open-weight video diffusion transformer at 1.3B and 14B scales"],
      branches: ["action-free video planner (shared across embodiments)", "embodiment-specific Jacobian IDM"],
      attention: ["video diffusion transformer self-attention", "diffusion-forcing over future frames"],
      heads: ["future-RGB denoiser", "J-IDM pixel-space Jacobian field predictor"],
      objectives: ["diffusion forcing on future RGB", "IDM regression from generated video to actions via robot Jacobian"],
      trainingRecipe: ["post-train video model on robot data", "train J-IDM independently on readily available self-play data"],
      inferenceRecipe: ["generate video plan from current frame and goal", "translate to actions with J-IDM", "run closed loop; video model unchanged across embodiments"]
    },
    uncertainty: "medium-high: cross-embodiment sim scores reported (MimicGen/PushT/Allegro); no LIBERO/RoboTwin/SimplerEnv/RoboCasa target benchmark, so accuracy is excluded from the normalized Metrics.",
    method: [
      "Turning Video Models into Generalist Robot Policies (VERA), a Video-to-Embodied Robot Action model.",
      "VERA decouples an action-free video generative planner from an embodiment-specific Jacobian inverse-dynamics model (J-IDM).",
      "The video backbone is the Wan family of open-weight video diffusion transformers, used at 1.3B and 14B parameters, and is not finetuned per embodiment.",
      "The J-IDM predicts pixel-space Jacobian fields from generated video and is trained on readily available self-play data.",
      "Training data spans DROID, MimicGen (Panda sim), PushT-Sim, Allegro-Sim, and real robot deployments.",
      "The 1.3B model is trained on 1 H100 GPU and the 14B model on a single H200 node with 8 GPUs.",
      "On Panda-Sim (MimicGen) VERA reaches 94.0 success, on PushT-Sim 92.5, and on Allegro-Sim 70.0 for 16-DoF dexterous cube reorientation.",
      "VERA performs zero-shot language-conditioned manipulation on a real Panda arm and real Allegro hand across embodiments without retraining the video model.",
      "The pipeline is a closed-loop video-to-action policy combining world-model video predictions with Jacobian IDM translation."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      inferenceCost: { fps4090: 1.3, reported: "closed-loop video rollout (14B)", ev: [2, 8], assumptions: { parameterB: [1.3, 14], note: "full video rollout planner discounted to RTX 4090" } },
      generalization: { improvementPct: 24, unseenTask: true, ev: [7], note: "Zero-shot cross-embodiment real Panda + Allegro hand without finetuning the video model." },
      warnings: ["no LIBERO/RoboTwin/SimplerEnv/RoboCasa target benchmark; accuracy excluded from Metrics", "GPU-hours not reported"]
    }
  },

  {
    id: "harmowam",
    name: "HarmoWAM",
    title: "HarmoWAM: Harmonizing Generalizable and Precise Manipulation via Adaptive World Action Models",
    date: ["2026", "05", "11"],
    arxiv: "2605.10942",
    family: "multi_stream",
    problem: "Imagine-then-Execute WAMs generalize but lack precision; Joint-Modeling WAMs are precise but confined to their training distribution.",
    oneLine: "A world model that harmonizes a predictive expert and a reactive expert through process-adaptive gating for both generalizable transit and precise contact.",
    insights: {
      problem: "The two dominant WAM paradigms trade off generalization against precision.",
      method: "A shared world model drives a reactive expert (direct action from predicted visuals) for exploration and a predictive expert (latent dynamics) for precise interaction, with a process-adaptive gate deciding when/where to switch.",
      novelty: "Unifies predictive and reactive control through automatic gating rather than committing to a single paradigm.",
      limitation: "Evaluated only on real-world tasks; no standard simulation benchmark scores reported.",
      related: "Fast-WAM, GigaWorld-Policy, MotuBrain"
    },
    metrics: { runtimeCost: 3, computeScale: 4, evidence: 3, runtimeNote: "48 Hz action generation via reactive expert; world model uses 5 denoising steps." },
    diagram: {
      pattern: "multi_stream",
      inputs: ["multi-view RGB", "language instruction", "robot state"],
      data: ["DROID (201,119 traj)", "AgiBot (3,017 traj)", "RoboMIND (1,721,985 traj); ~1.9M total"],
      predictiveState: { form: "predicted visuals + latent dynamics", runtime: "partial", rendered: true },
      components: ["Wan2.2-TI2V-5B world model", "Reactive expert (DINOv2-base)", "Predictive expert (1B DiT)", "Process-adaptive gate"],
      trainingStages: [
        { name: "World model finetuning", data: "~1.9M robot trajectories", objective: "spatio-temporal physical prior" },
        { name: "Action experts finetuning", data: "task demonstrations", objective: "train reactive + predictive experts" }
      ],
      runtimePath: ["observation", "world model", "adaptive gate", "reactive or predictive expert"],
      outputs: ["action chunk"]
    },
    lit: {
      inputTokens: ["multi-view RGB frames", "language", "robot state", "predicted future visuals"],
      tokenization: ["Wan2.2 video VAE latent tokens", "DINOv2-base visual features for the reactive expert"],
      backbone: ["Wan2.2-TI2V-5B world model", "1B predictive DiT (28 Transformer blocks)", "DINOv2-base reactive encoder"],
      branches: ["predictive expert models latent dynamics for iterative generation", "reactive expert infers actions directly from predicted visuals"],
      attention: ["world model conditions both experts", "process-adaptive gating selects the active expert"],
      heads: ["predictive action head", "reactive action head"],
      objectives: ["world-model finetuning objective", "action-expert losses for both experts"],
      trainingRecipe: ["Stage 1 finetunes the Wan2.2-5B world model on ~1.9M trajectories", "Stage 2 finetunes the two action experts"],
      inferenceRecipe: ["world model drives the reactive expert for exploration and the predictive expert for precise interaction", "process-adaptive gate switches experts by timing and location", "48 Hz with action chunk size 12, 5 world-model denoising steps"]
    },
    uncertainty: "medium: architecture, data scale, and real-world results reported; no standard simulation benchmark, so accuracy is excluded from the normalized Metrics.",
    method: [
      "HarmoWAM harmonizes generalizable and precise manipulation via adaptive world action models.",
      "The world-model backbone is Wan2.2-TI2V-5B, pretrained on approximately 1.9M robotic trajectories.",
      "Public pretraining data comprises DROID (201,119 trajectories), AgiBot (3,017 trajectories), and RoboMIND (1,721,985 trajectories).",
      "The predictive expert is a 1B-parameter DiT consisting of 28 Transformer blocks and the reactive expert uses DINOv2-base.",
      "A Process-Adaptive Gating Mechanism automatically determines the switching timing and location between the predictive and reactive experts.",
      "HarmoWAM is trained on 8 NVIDIA H20 GPUs in a two-stage paradigm: world-model finetuning then action-experts finetuning.",
      "HarmoWAM achieves an action generation speed of 48 Hz with an action chunk size of 12 and 5 world-model denoising steps.",
      "Across six real-world tasks the in-domain average success rate is 89%, with out-of-domain background 81%, position 80%, and objects 85%.",
      "HarmoWAM improves zero-shot generalization by 33% over VLA models and 29% over prior WAMs across three training-unseen test environments."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      inferenceCost: { fps4090: 30, reported: "48 Hz on H20 (chunk 12)", ev: [6], assumptions: { denoisingSteps: [5], note: "reported 48 Hz on H20 discounted to RTX 4090" } },
      generalization: { improvementPct: 31, unseenTask: true, ev: [7, 8], note: "+33% over VLAs and +29% over prior WAMs zero-shot across three unseen environments." },
      warnings: ["no standard simulation target benchmark; accuracy excluded from Metrics", "GPU-hours not reported"]
    }
  },

  {
    id: "pelican-unify",
    name: "Pelican-Unify 1.0",
    title: "Pelican-Unify 1.0: A Unified Embodied Intelligence Model for Understanding, Reasoning, Imagination and Action",
    date: ["2026", "05", "21"],
    arxiv: "2605.15153",
    family: "unified",
    problem: "Embodied stacks fragment understanding, reasoning, world modeling, and action into separate specialists that never jointly optimize.",
    oneLine: "A single foundation model where one VLM handles understanding and reasoning and one diffusion transformer jointly imagines future video and actions.",
    insights: {
      problem: "Modular assembly of VLM + policy + world model prevents consequence-aware action, steerable imagination, and grounded reasoning.",
      method: "One VLM (Qwen3-VL) encodes all modalities and autoregressively produces interleaved video/action chain-of-thought into a loop state z; a single Wan2.2 DiT with two lightweight heads denoises future video and action from z.",
      novelty: "Structural unification via shared embedders, mutual conditioning, and co-evolving gradients rather than modular hand-off.",
      limitation: "Failures concentrate on long-horizon geometry-sensitive tasks; real-world evaluation limited to two platforms.",
      related: "MotuBrain, X-WAM, tau0-WM"
    },
    metrics: { runtimeCost: 4, computeScale: 4, evidence: 4, runtimeNote: "Autoregressive CoT then diffusion imagination of joint video+action from a shared loop state." },
    diagram: {
      pattern: "unified",
      inputs: ["video frames", "language instruction", "action history", "robot state"],
      data: ["large-scale real-world robot interaction data", "vision-language corpora"],
      predictiveState: { form: "future video + action from shared loop state z", runtime: "full", rendered: true },
      components: ["Qwen3-VL (4B) unified understanding+reasoning", "Shared 3D VAE + action MLP embedders", "Loop-state projection", "Wan2.2 DiT generator", "Video head", "Action head"],
      trainingStages: [
        { name: "Joint unified training", data: "robot + VL data", objective: "NLL CoT + flow-matching video + action regression through shared embedders and z" }
      ],
      runtimePath: ["encode all modalities", "autoregressive video+action CoT", "loop state z", "diffusion denoise video+action"],
      outputs: ["future video", "action chunk"]
    },
    lit: {
      inputTokens: ["video frames via 3D VAE", "action history via action MLP", "language", "robot state"],
      tokenization: ["shared 3D video VAE embedder", "action MLP embedder into the VLM token space"],
      backbone: ["Qwen3-VL 4B VLM (understanding + reasoning)", "Wan2.2 diffusion transformer (future generator)"],
      branches: ["video-CoT and action-CoT interleaved in the VLM", "two modality-specific diffusion heads (video, action)"],
      attention: ["shared self-attention over video/action tokens", "cross-attention injects loop state z throughout denoising"],
      heads: ["autoregressive language/CoT head", "video denoiser head", "action denoiser head"],
      objectives: ["autoregressive NLL on chain-of-thought", "flow-matching MSE on the future video region", "SmoothL1 action regression; all backprop through shared embedders and z"],
      trainingRecipe: ["joint training of understanding, reasoning, imagination, and action with shared gradients"],
      inferenceRecipe: ["autoregressive CoT generation", "extract loop state z", "diffusion denoise dual-head video+action output"]
    },
    uncertainty: "medium: architecture and RoboTwin/real-world scores are reported; parameter total, data scale, and compute are outside the available source coverage.",
    method: [
      "Pelican-Unify 1.0 is a Unified Embodied Intelligence model for understanding, reasoning, imagination, and action.",
      "A single Qwen3-VL with 4B parameters serves as the unified understanding and reasoning module across scenes, instructions, visual contexts, and action histories.",
      "Shared embedders are a 3D video VAE and an action MLP that map every modality into the VLM token space.",
      "The VLM autoregressively generates interleaved video and action chain-of-thought and projects its final hidden state to a dense loop state z.",
      "A single Wan2.2 diffusion transformer with two lightweight modality-specific heads jointly denoises future video and action conditioned on z.",
      "Training jointly optimizes an autoregressive text loss, a flow-matching video loss on the future region, and a SmoothL1 action regression loss.",
      "On the RoboTwin 50-task dual-arm simulator Pelican-Unify 1.0 reaches a 93.5% success rate.",
      "It scores 64.7 average across eight VLM benchmarks and ranks first on WorldArena with an EWM score of 66.03.",
      "On a real Tienkung humanoid across five seen and three unseen tasks it averages 1.76 out of 2.0 on human evaluation, ranking first."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 93.5, ev: [6], context: "RoboTwin 50-task dual-arm simulator" }
      } },
      generalization: { improvementPct: 22, unseenTask: true, ev: [8], note: "Zero-shot unseen humanoid tasks; top-ranked human imagination/action evaluation." },
      warnings: ["total parameter count and GPU-hours not reported"]
    }
  },

  {
    id: "wall-wm",
    name: "WALL-WM",
    title: "WALL-WM: Carving World Action Modeling at the Event Joints",
    date: ["2026", "06", "01"],
    arxiv: "2606.01955",
    family: "unified",
    problem: "Fixed-length action chunks misalign language, vision, and control timescales, so WAMs learn short-horizon correlations instead of composable world models.",
    oneLine: "Event-grounded VLA pretraining that makes semantically coherent manipulation events the atomic unit of video-action learning.",
    insights: {
      problem: "Chunk-centric optimization fragments semantic goals, continuous dynamics, and control into misaligned windows.",
      method: "A frozen Wan video tower is layer-coupled to an Action DiT with event-grounded captions; Camera RoPE and sight-cone/tube masking give geometry-aware multi-view learning, and a Staircase parallel decoder relays latent chain-of-thought.",
      novelty: "Shifts pretraining from fixed chunks to semantically coherent events, with layer-wise one-directional video->action coupling and parallel latent CoT decoding.",
      limitation: "Fixed-length codec truncates events beyond ~65 latent frames; asymmetric schedule may loosen video-action co-denoising.",
      related: "LingBot-VA, Fast-WAM, Next Forcing"
    },
    metrics: { runtimeCost: 4, computeScale: 5, evidence: 4, runtimeNote: "Event-length video rollout; Staircase parallel latent CoT skips the autoregressive token bottleneck." },
    diagram: {
      pattern: "unified",
      inputs: ["multi-view RGB", "language (hierarchical event captions)", "robot state"],
      data: ["OpenVID (1.2M clips)", "HD-VILA", "Ego4D", "EPIC-KITCHENS", "DROID", "AgiBot World", "teleoperation + wearable rig data"],
      predictiveState: { form: "future multi-view video + action", runtime: "full", rendered: true },
      components: ["Frozen Wan video DiT", "Action DiT", "Camera RoPE", "Sight-cone / tube masking", "Qwen3.5-9B VLM + Staircase decoder"],
      trainingStages: [
        { name: "Video pretraining", data: "internet + egocentric video", objective: "Wan-style flow-matching video" },
        { name: "Action pretraining", data: "frozen video + teleop", objective: "event-grounded action flow matching" },
        { name: "VLM adaptation + Staircase distillation", data: "captions", objective: "parallel latent chain-of-thought" }
      ],
      runtimePath: ["observation + event caption", "video DiT", "layer-coupled action DiT", "Staircase latent CoT"],
      outputs: ["future video", "action (event or fixed-length)"]
    },
    lit: {
      inputTokens: ["multi-view RGB via 3D VAE (1+4M+4N temporal rule)", "T5 text of hierarchical event captions", "robot state", "action tokens"],
      tokenization: ["Wan 3D VAE codec", "frozen T5 text encoder", "optional Qwen3.5-9B VLM latent CoT"],
      backbone: ["Wan-series text-to-video DiT (frozen encoders)", "randomly initialized Action DiT", "Qwen3.5-9B VLM"],
      branches: ["multi-view video DiT with cross-view attention", "Action Transformer with layer-wise one-directional video cross-attention"],
      attention: ["within-view self-attention + zero-init cross-view attention", "Camera RoPE for view identity", "sight-cone geometric mask + tube patch mask (training-only)"],
      heads: ["video v-prediction denoiser", "action v-prediction head (optional DCT auxiliary)", "frozen latent-to-text VLM head"],
      objectives: ["flow-matching v-prediction MSE for video and action", "optional tube up-weighting and DCT auxiliary", "frozen latent-to-text reconstruction"],
      trainingRecipe: ["video pretraining -> action pretraining (frozen video, 1-to-Nd anchor) -> VLM adaptation -> Staircase distillation -> optional next-chunk adaptation"],
      inferenceRecipe: ["Event mode: variable-length execution per next-event caption", "Unified mode: fixed-length chunk inference with Staircase parallel latent CoT, skipping autoregressive token generation", "50 action denoising steps (video schedule anchor s*=45)"]
    },
    uncertainty: "high: architecture and training recipe extracted from the method sections; the experiments table was not retrievable, so success rates are qualitative and accuracy is excluded from the normalized Metrics.",
    method: [
      "WALL-WM carves world action modeling at the event joints, using semantically coherent action events as the atomic unit of learning.",
      "The backbone is a Wan-series text-to-video DiT with frozen encoders layer-coupled to a randomly initialized Action DiT.",
      "A 3D VAE codec compresses a keyframe plus history frames under a 1+4M+4N temporal rule, and a frozen T5 text encoder conditions the video DiT.",
      "Multi-view learning uses within-view self-attention, zero-initialized cross-view attention, learnable Camera RoPE, and training-only sight-cone and tube patch masks.",
      "An optional Qwen3.5-9B VLM with a Staircase parallel decoder relays latent chain-of-thought via a mixture-of-transformers relay.",
      "Video and action are trained with flow-matching v-prediction MSE, with optional tube up-weighting and a DCT auxiliary action loss.",
      "Training data spans OpenVID (1.2M clips), HD-VILA, Ego4D, EPIC-KITCHENS, DROID, AgiBot World, self-collected teleoperation, and no-embodiment wearable-rig data.",
      "Inference offers an event mode with variable-length execution per next-event caption and a unified mode with fixed-length chunk inference using 50 action denoising steps.",
      "WALL-WM shows clear advantages across real-robot manipulation, reasoning manipulation, dexterous manipulation, generalization, and embodied video-generation metrics."
    ],
    override: {
      confidence: "medium-low", quality: "agent-audited",
      generalization: { improvementPct: 16, unseenTask: true, ev: [8], note: "Reported gains on real-robot generalization and reasoning manipulation; numeric table not retrievable." },
      warnings: ["experiments table not retrievable; success rates qualitative, accuracy excluded from Metrics", "parameter count and GPU-hours not reported"]
    }
  },

  {
    id: "next-forcing",
    name: "Next Forcing",
    title: "Next Forcing: Causal World Modeling with Multi-Chunk Prediction",
    date: ["2026", "06", "09"],
    arxiv: "2606.11187",
    family: "unified",
    problem: "Teacher-forced video world models exploit appearance copying between adjacent chunks (myopic supervision), stalling dynamics learning at high frame rates.",
    oneLine: "Augments autoregressive video-action world models with multi-chunk prediction heads that supervise several future horizons at once.",
    insights: {
      problem: "Adjacent chunks look similar, so models shortcut dynamics by copying appearance, especially at 50 fps.",
      method: "A Wan2.2 backbone with a video/action mixture-of-transformers gains three lightweight MCP modules predicting next1/next2/next3 chunks, fused from four intermediate layers with causal chaining across depths.",
      novelty: "Extends multi-token prediction from language to continuous denoised video latents with causal chaining, discardable for zero overhead or reused for 2x parallel generation.",
      limitation: "MCP modules add training cost that is not precisely quantified.",
      related: "WALL-WM, LingBot-VA, Fast-WAM"
    },
    metrics: { runtimeCost: 4, computeScale: 4, evidence: 4, runtimeNote: "Autoregressive causal video; MCP heads discardable for zero-overhead or reused for 2x parallel generation." },
    diagram: {
      pattern: "unified",
      inputs: ["RGB frame history", "language", "action context"],
      data: ["large-scale multi-embodiment robot data", "~3.5M human-activity video clips (5-10 s)", "RoboTwin (2,500 Clean + 25,000 Random)"],
      predictiveState: { form: "future video chunks + actions", runtime: "full", rendered: true },
      components: ["Wan2.2 Transformer (30 layers)", "Video/action mixture-of-transformers", "MCP next1/next2/next3 modules"],
      trainingStages: [
        { name: "Video pretraining", data: "~3.5M video clips", objective: "causal video generation" },
        { name: "Robot fine-tuning", data: "RoboTwin demos", objective: "flow-matching video + inverse-dynamics action" }
      ],
      runtimePath: ["observation", "causal video MoT", "action stream"],
      outputs: ["future video", "action"]
    },
    lit: {
      inputTokens: ["video latent tokens", "language", "action tokens"],
      tokenization: ["Wan2.2 video VAE latents", "cross-modal action tokens"],
      backbone: ["Wan2.2 Transformer with 30 layers", "video + action mixture-of-transformers (MoT)"],
      branches: ["video stream", "action stream via cross-modal attention", "three MCP auxiliary modules (3 blocks each)"],
      attention: ["shared causal attention mask; noisy tokens attend only to preceding clean tokens", "MCP features fused from layers {4,12,20,30}"],
      heads: ["video velocity (flow matching)", "inverse-dynamics action head", "next1/next2/next3 chunk predictors"],
      objectives: ["flow matching for video and actions", "three MCP losses w1=0.5, w2=0.2, w3=0.1", "timestep shift s_main=5, s_mcp=10"],
      trainingRecipe: ["general video pretraining on ~3.5M clips, then RoboTwin fine-tuning on 64 GPUs (ablations on 16 GPUs, 20k steps)"],
      inferenceRecipe: ["zero-overhead mode discards MCP modules", "parallel chunk generation retains depth-1 MCP for 2x acceleration across 12/25/50 fps"]
    },
    uncertainty: "medium: RoboTwin and video-quality numbers reported; parameter count not stated.",
    method: [
      "Next Forcing performs causal world modeling with multi-chunk prediction for World Action Models.",
      "The backbone is a Wan2.2 Transformer with 30 layers, with a video stream and an action stream coupled via a mixture-of-transformers.",
      "Three auxiliary multi-chunk-prediction modules predict the next1, next2, and next3 chunks, each with 3 lightweight transformer blocks fused from intermediate layers {4,12,20,30}.",
      "A shared causal attention mask lets noisy tokens attend only to preceding clean tokens, preventing information leakage.",
      "Training uses flow matching for video dynamics and inverse-dynamics actions, with MCP loss weights w1=0.5, w2=0.2, w3=0.1 and timestep shifts s_main=5 and s_mcp=10.",
      "General video pretraining uses approximately 3.5M video clips of 5-10 seconds, and robot fine-tuning uses RoboTwin with 2,500 Clean and 25,000 Random demonstrations on 64 GPUs.",
      "On RoboTwin Clean Next Forcing reaches 94.1% and on RoboTwin Random 93.5%, versus LingBot-VA at 92.9% and 91.5%.",
      "On PhyWorld the out-of-training FVD improves to 4.7 from 5.3 and the abnormal ratio drops to 8% from 12%.",
      "Parallel chunk generation gives a 2x inference speedup while maintaining comparable accuracy across 12, 25, and 50 fps."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 93.5, ev: [6], context: "RoboTwin Random multi-task" },
        robotwinTaskSpecific: { value: 94.1, ev: [6], context: "RoboTwin Clean" }
      } },
      inferenceCost: { fps4090: 2.4, reported: "2x speedup via parallel chunks", ev: [8], assumptions: { note: "full autoregressive video WAM; 2x parallel generation" } },
      generalization: { improvementPct: 12, unseenTask: false, ev: [7], note: "Improved out-of-training FVD and abnormal ratio on PhyWorld; mainly simulation." },
      warnings: ["parameter count not reported"]
    }
  },

  {
    id: "feedback-wm",
    name: "Feedback World Model",
    title: "Feedback World Model Enables Precise Guidance of Diffusion Policy",
    date: ["2026", "05", "15"],
    arxiv: "2605.15705",
    family: "online_adaptation",
    problem: "World models are treated as static predictors at inference, so their errors accumulate under distribution shift and misguide the policy.",
    oneLine: "Maintains a lightweight online feedback state that corrects world-model predictions from real observations to guide a diffusion policy without retraining.",
    insights: {
      problem: "Static world-model predictions become unreliable out of distribution at deployment.",
      method: "A latent-observer feedback state z-bar is updated online from the discrepancy e = z - z-bar with gain L, and the corrected predictions guide diffusion denoising in the final low-noise steps.",
      novelty: "Online feedback correction without parameter updates, plus action-aware guidance weighting via counterfactual variance.",
      limitation: "Guidance during denoising adds inference latency over an unguided base policy.",
      related: "AdaWorldPolicy, MoWM, tau0-WM"
    },
    metrics: { runtimeCost: 3, computeScale: 2, evidence: 3, runtimeNote: "Online feedback correction; guidance applied only in the final low-noise denoising steps adds latency." },
    diagram: {
      pattern: "online_adaptation",
      inputs: ["current observation", "action", "prior latent prediction"],
      data: ["Robomimic (20% demos)", "LIBERO-Plus (50 traj/task)", "real-world (50-65 demos/task)"],
      predictiveState: { form: "action-conditioned latent prediction, online-corrected", runtime: "online_adaptive", rendered: false },
      components: ["Latent dynamics predictor (Transformer)", "Feedback state z-bar (online)", "Diffusion policy", "Action-aware guidance weighting"],
      trainingStages: [
        { name: "World-model + policy training", data: "task demos", objective: "one-step latent prediction (frozen at deployment)" }
      ],
      runtimePath: ["observe", "feedback-correct latent", "guided diffusion denoising"],
      outputs: ["action"]
    },
    lit: {
      inputTokens: ["current observation latent", "action", "predicted latent z"],
      tokenization: ["task-specific latent encoder", "action conditioning"],
      backbone: ["lightweight Transformer latent dynamics predictor", "diffusion policy"],
      branches: ["action-conditioned world model", "online feedback observer"],
      attention: ["Transformer predictor over latent trajectory"],
      heads: ["latent predictor head", "diffusion score/action head"],
      objectives: ["one-step latent prediction loss (frozen at deployment)", "action-aware controllability weighting via counterfactual variance"],
      trainingRecipe: ["train latent dynamics model and diffusion policy on limited demos"],
      inferenceRecipe: ["maintain feedback state z-bar updated online with discrepancy e = z - z-bar and gain L", "apply feedback-corrected guidance during the final tau_g low-noise denoising steps"]
    },
    uncertainty: "medium: Robomimic/LIBERO-Plus/real-world OOD numbers reported; parameter count and compute not stated.",
    method: [
      "Feedback World Model enables precise guidance of a diffusion policy by correcting predictions online.",
      "The world model is a lightweight task-specific latent dynamics model with a Transformer predictor, kept frozen at deployment.",
      "A latent-observer feedback state z-bar is updated online using the discrepancy e_t = z_t - z-bar_t with feedback gain L to iteratively correct future predictions.",
      "Guidance is applied only in the final tau_g low-noise denoising steps of the diffusion policy, with action-aware weighting from counterfactual variance.",
      "Training data uses 20% of Robomimic demonstrations, 50 LIBERO-Plus trajectories per task, and 50-65 real-world demonstrations per task.",
      "On Robomimic under OOD conditions the average success is 52% (Square 46%, Transport 60%, Tool-Hang 36%).",
      "On LIBERO-Plus under OOD the average success is 52% across four tasks.",
      "On the real-world Peach pick-and-place task success is 95% in-distribution and 80% OOD, and on Drawer-Open 75% in-distribution and 70% OOD.",
      "Online feedback reduces prediction error by up to 76.4% on real-world tasks and yields a 30% relative improvement in success rate."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      accuracy: { benchmarks: {
        liberoPlus: { value: 52.0, ev: [6], context: "LIBERO-Plus OOD average" }
      } },
      inferenceCost: { fps4090: 8, reported: "guided denoising adds latency", ev: [3], assumptions: { note: "lightweight latent WM; final-step guidance overhead" } },
      generalization: { improvementPct: 30, unseenTask: true, ev: [8], note: "30% relative success improvement and up to 76.4% prediction-error reduction under OOD." },
      warnings: ["parameter count and GPU-hours not reported"]
    }
  },

  {
    id: "omnihumanoid",
    name: "OmniHumanoid",
    title: "OmniHumanoid: Streaming Cross-Embodiment Video Generation with Paired-Free Adaptation",
    date: ["2026", "05", "12"],
    arxiv: "2605.12038",
    family: "pixel_idm",
    problem: "Cross-embodiment motion transfer entangles transferable dynamics with embodiment-specific appearance and needs paired data per target robot.",
    oneLine: "A streaming cross-embodiment video generator that factorizes shared motion from embodiment-specific appearance for paired-free data synthesis.",
    insights: {
      problem: "Motion dynamics transfer across embodiments but appearance and morphology do not, and prior methods require paired data per embodiment.",
      method: "A shared motion-transfer model learned from motion-aligned paired videos plus lightweight embodiment-specific adapters, with a branch-isolated attention design separating motion conditioning from embodiment modulation.",
      novelty: "Paired-free adaptation to unseen embodiments by isolating motion from embodiment via branch attention.",
      limitation: "It is an offline data-generation video model, not an online policy; abstract-level detail only.",
      related: "DreamGen, VideoPolicy, OmniHumanoid"
    },
    metrics: { runtimeCost: 5, computeScale: 4, evidence: 3, runtimeNote: "Offline streaming cross-embodiment video generation used as a data engine, not an online controller." },
    diagram: {
      pattern: "pixel_idm",
      inputs: ["source motion video", "target embodiment identity"],
      data: ["synthetic cross-embodiment dataset with motion-aligned paired videos across humanoid assets, scenes, viewpoints"],
      predictiveState: { form: "generated cross-embodiment video", runtime: "offline", rendered: true },
      components: ["Shared motion-transfer model", "Embodiment-specific adapters", "Branch-isolated attention"],
      trainingStages: [
        { name: "Motion-transfer pretraining", data: "motion-aligned paired videos", objective: "learn shared transferable motion" },
        { name: "Paired-free adaptation", data: "target embodiment", objective: "lightweight embodiment adapter" }
      ],
      runtimePath: ["source motion", "shared motion model", "embodiment adapter"],
      outputs: ["cross-embodiment video (synthetic training data)"]
    },
    lit: {
      inputTokens: ["source motion frames", "target embodiment conditioning"],
      tokenization: ["video diffusion latent tokens (abstract-level source)"],
      backbone: ["streaming video diffusion generator"],
      branches: ["shared motion conditioning branch", "embodiment modulation branch"],
      attention: ["branch-isolated attention separating motion from embodiment modulation"],
      heads: ["video denoiser"],
      objectives: ["motion-transfer generation from motion-aligned paired videos"],
      trainingRecipe: ["train shared motion model on paired videos", "add lightweight adapters for new embodiments without paired data"],
      inferenceRecipe: ["stream target-embodiment video from source motion via shared model + embodiment adapter"]
    },
    uncertainty: "high: only abstract-level detail is available; architecture specifics, scale, and quantitative metrics are outside the source coverage, so accuracy is excluded from the normalized Metrics.",
    method: [
      "OmniHumanoid performs streaming cross-embodiment video generation with paired-free adaptation.",
      "A shared motion-transfer model is learned from motion-aligned paired videos and captures transferable motion dynamics.",
      "Lightweight embodiment-specific adapters extend the model to new embodiments without paired data for each target.",
      "A branch-isolated attention design separates motion conditioning from embodiment modulation to keep appearance embodiment-specific.",
      "Training uses a synthetic cross-embodiment dataset of motion-aligned paired videos spanning diverse humanoid assets, scenes, and viewpoints.",
      "OmniHumanoid is evaluated on synthetic and real-world benchmarks measuring motion fidelity and embodiment consistency.",
      "The framework targets scalable data generation for embodied intelligence rather than online closed-loop control."
    ],
    override: {
      confidence: "low", quality: "agent-audited",
      generalization: { improvementPct: 14, unseenTask: true, ev: [2], note: "Paired-free adaptation to unseen embodiments; quantitative transfer is outside the available source coverage." },
      warnings: ["abstract-level only; no policy success benchmark, accuracy excluded from Metrics", "parameters, compute, and metrics not reported"]
    }
  },

  {
    id: "mola",
    name: "MoLA",
    title: "From Imagined Futures to Executable Actions: Mixture of Latent Actions for Robot Manipulation",
    date: ["2026", "05", "12"],
    arxiv: "2605.12167",
    family: "latent_action",
    problem: "Video generators optimize perceptual realism, not manipulation-relevant structure, so imagined futures are hard to turn into actions.",
    oneLine: "Bridges video imagination and control with a mixture of modality-aware inverse-dynamics models that decode predicted futures into structured latent actions.",
    insights: {
      problem: "Visual predictions are not inherently action-oriented; conditioning policies on raw frames is brittle.",
      method: "An SVD imagination model plus a mixture of three pretrained IDMs specialized for semantic (SAM2), depth (Depth Anything v2), and flow (CoTracker3) modalities produce complementary latent actions consumed by a flow-matching DiT action head.",
      novelty: "First structured latent-action interface coupling video generation to policy via a modality-aware IDM mixture that beats unified alternatives.",
      limitation: "Depends on video-generation quality and a frozen MoIDM that cannot adapt to an evolving policy.",
      related: "UniVLA, LAPA, VideoPolicy"
    },
    metrics: { runtimeCost: 3, computeScale: 4, evidence: 4, runtimeNote: "Single-denoising-step imagination; mixture of IDMs decode latent actions for a flow-matching head." },
    diagram: {
      pattern: "latent_action",
      inputs: ["current RGB observation", "language"],
      data: ["RT-X", "Bridge Data", "DROID", "task-specific manipulation datasets"],
      predictiveState: { form: "predicted future frame + modality latent actions", runtime: "partial", rendered: true },
      components: ["Stable Video Diffusion imagination", "Mixture of IDMs (SAM2 / Depth Anything v2 / CoTracker3)", "VQ latent-action codebooks", "Flow-matching DiT action head"],
      trainingStages: [
        { name: "Video fine-tuning", data: "robot video", objective: "task-conditioned imagination" },
        { name: "MoIDM pretraining", data: "transitions", objective: "modality-specific latent actions" },
        { name: "Joint optimization", data: "frozen video + fine-tuned MoIDM", objective: "end-to-end action head" }
      ],
      runtimePath: ["observation", "single-step video imagination", "mixture of IDMs", "action head"],
      outputs: ["future frame", "action chunk"]
    },
    lit: {
      inputTokens: ["current RGB frame", "predicted future frame", "language"],
      tokenization: ["SVD video latents", "ViT modality encoders", "VQ codebooks discretize latent actions"],
      backbone: ["Stable Video Diffusion (imagination)", "Diffusion Transformer action head (flow matching)"],
      branches: ["semantic IDM (SAM2)", "depth IDM (Depth Anything v2)", "flow IDM (CoTracker3)"],
      attention: ["spatiotemporal transformers model current->future transitions per modality"],
      heads: ["per-modality latent-action encoders", "flow-matching action decoder"],
      objectives: ["video fine-tuning", "MoIDM latent-action pretraining", "end-to-end action flow matching"],
      trainingRecipe: ["Stage I video fine-tuning, Stage II MoIDM pretraining, Stage III joint optimization with frozen video model"],
      inferenceRecipe: ["single denoising step for video generation", "MoIDM infers complementary latent actions from current->predicted-future transition", "action head produces continuous control"]
    },
    uncertainty: "medium: CALVIN/LIBERO/LIBERO-Plus and real-world numbers reported; parameter count and compute not stated.",
    method: [
      "MoLA turns imagined futures into executable actions via a mixture of latent actions for robot manipulation.",
      "Imagination uses Stable Video Diffusion and the action head is a Diffusion Transformer trained with flow matching.",
      "The core interface is a mixture of three pretrained inverse-dynamics models specialized for semantic (SAM2), depth (Depth Anything v2), and flow (CoTracker3) modalities.",
      "ViT encoders extract modality features, spatiotemporal transformers model transitions, and VQ codebooks discretize the latent actions.",
      "Video generation uses a single denoising step, and training data includes RT-X, Bridge Data, DROID, and task-specific datasets.",
      "On CALVIN ABC-D the success sequence is 98.5%, 95.0%, 91.1%, 88.1%, 82.6% with an average length of 4.55.",
      "On LIBERO the overall success rate is 97.0% (Spatial 93.0%, Object 99.5%, Goal 99.5%, Long 96.0%).",
      "On LIBERO-Plus the overall success rate is 92.7% (Spatial 97.5%, Object 96.3%, Goal 85.1%, Long 91.8%).",
      "On a real UR5e the average success is 73.0%, including 60.0% with distracting objects and 64.0% under lighting changes."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        liberoPlus: { value: 92.7, ev: [7], context: "LIBERO-Plus overall" }
      } },
      inferenceCost: { fps4090: 6, reported: "single-step video imagination", ev: [4], assumptions: { denoisingSteps: [1], note: "single denoising step for imagination" } },
      generalization: { improvementPct: 24, unseenTask: true, ev: [8], note: "Real-world robustness to distractors (60%) and lighting changes (64%) on UR5e." },
      warnings: ["parameter count and GPU-hours not reported"]
    }
  },

  {
    id: "maskwam",
    name: "MaskWAM",
    title: "MaskWAM: Unifying Mask Prompting and Prediction for World-Action Models",
    date: ["2026", "06", "11"],
    arxiv: "2606.13515",
    family: "unified",
    problem: "Text inputs are referentially ambiguous in clutter and unstructured RGB predictions lack semantic grounding, creating a spatial bottleneck in WAMs.",
    oneLine: "An object-centric WAM that jointly predicts future RGB, task-relevant masks, and actions while accepting optional visual mask prompts.",
    insights: {
      problem: "WAMs suffer spatial bottlenecks from ambiguous language and semantically ungrounded RGB prediction.",
      method: "RGB and rendered mask frames are encoded by the same Wan 2.2 VAE and concatenated channel-wise; a mixture-of-transformers with block-wise causal attention jointly denoises RGB, mask, and action with decoupled noise schedules.",
      novelty: "First to unify mask-based visual prompting with future mask prediction as joint training objectives inside a WAM.",
      limitation: "Relies on mask supervision in training and SAM-3 segmentation at deployment; reliable mask extraction in clutter is hard.",
      related: "AIM, X-WAM, MotuBrain"
    },
    metrics: { runtimeCost: 3, computeScale: 4, evidence: 4, runtimeNote: "Single partial-denoising step on the joint RGB-mask stream with KV-cached action generation." },
    diagram: {
      pattern: "unified",
      inputs: ["RGB observation", "optional mask prompt", "language", "robot state"],
      data: ["LIBERO", "RoboTwin datasets", "real-world (~100 human demos/task)"],
      predictiveState: { form: "future RGB + task-relevant masks + action", runtime: "partial", rendered: true },
      components: ["Wan 2.2 video VAE", "Mixture-of-Transformers (visual + action)", "Mask prediction branch", "SAM-3 mask prompting"],
      trainingStages: [
        { name: "Joint RGB-mask-action training", data: "sim + real demos", objective: "flow-matching video + mask + action with decoupled schedules" }
      ],
      runtimePath: ["observation (+ optional mask prompt)", "MoT partial denoise", "KV-cached action stream"],
      outputs: ["future RGB", "future masks", "action chunk"]
    },
    lit: {
      inputTokens: ["RGB frames", "rendered mask frames", "language", "robot state"],
      tokenization: ["Wan 2.2 video VAE for both RGB and mask (concatenated to 2C channels)", "SAM-3 masks at deployment"],
      backbone: ["Mixture-of-Transformers with visual and action branches"],
      branches: ["visual branch (RGB + mask)", "action branch"],
      attention: ["block-wise causal attention enabling unified RGB-mask-action training", "decoupled noise schedules tau_v (visual) and tau_a (action)"],
      heads: ["RGB denoiser", "mask denoiser", "action denoiser"],
      objectives: ["joint flow matching: L_total = L_video + L_mask + L_act"],
      trainingRecipe: ["train jointly on LIBERO, RoboTwin, and ~100 human demonstrations per real-world task"],
      inferenceRecipe: ["single partial-denoising step on the joint RGB-mask stream", "KV-caching for efficient action generation", "no per-frame mask tracking required"]
    },
    uncertainty: "medium: LIBERO/RoboTwin and real-world numbers reported; parameter count and compute not stated.",
    method: [
      "MaskWAM unifies mask prompting and prediction for world-action models.",
      "RGB and rendered mask frames are encoded by the same pretrained Wan 2.2 VAE and concatenated along the channel dimension to 2C channels.",
      "A mixture-of-transformers with visual and action branches uses block-wise causal attention for unified RGB-mask-action training.",
      "The joint flow-matching loss is L_total = L_video + L_mask + L_act with decoupled noise schedules tau_v for visual and tau_a for action.",
      "Real-world tasks use on average 100 human demonstrations per task, and simulation uses LIBERO and RoboTwin datasets.",
      "At deployment MaskWAM performs a single partial-denoising step on the joint RGB-mask stream with KV-caching for efficient action generation.",
      "On LIBERO the average success rate is 98.4% and on RoboTwin 2.0 the average success rate is 92.2%.",
      "On real-world language-clear tasks success is 84.3% and on language-ambiguous tasks 84.9%, outperforming the strongest baseline by 33.2%.",
      "Deployment relies on SAM-3 segmentation, and reliable mask extraction in cluttered real-world scenes remains non-trivial."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 92.2, ev: [6], context: "RoboTwin 2.0 average" }
      } },
      inferenceCost: { fps4090: 9, reported: "single partial-denoising step + KV cache", ev: [5], assumptions: { note: "single partial-denoising step; KV-cached action stream" } },
      generalization: { improvementPct: 33, unseenTask: true, ev: [7], note: "+33.2% over strongest baseline on language-ambiguous real-world tasks." },
      warnings: ["parameter count and GPU-hours not reported"]
    }
  },

  {
    id: "abot-m05",
    name: "ABot-M0.5",
    title: "ABot-M0.5: Unified Mobility-and-Manipulation World Action Model",
    date: ["2026", "07", "01"],
    arxiv: "2607.00678",
    family: "unified",
    problem: "VLAs are reactive and lack world modeling, while existing WAMs are poorly aligned with the structure of mobile manipulation.",
    oneLine: "A unified mobility-and-manipulation WAM that bridges video and control with frame-level latent actions and dual-level action disentanglement.",
    insights: {
      problem: "Mobile manipulation faces coarse video prediction vs fine control, entangled heterogeneous actions, and train-test inverse-dynamics gaps.",
      method: "A Wan2.2 5B video diffusion backbone uses frame-level latent actions plus a dual-level mixture-of-transformers that disentangles modality and separates mobility and manipulation, trained with cascade conditional flow matching and Dream Forcing.",
      novelty: "Intermediate embodiment-agnostic latent actions, dual-level action decoupling, and Dream Forcing for train-test alignment.",
      limitation: "Real-world transfer and scalability beyond proof-of-concept remain understudied.",
      related: "MotuBrain, GigaWorld-Policy, X-WAM"
    },
    metrics: { runtimeCost: 4, computeScale: 5, evidence: 4, runtimeNote: "Autoregressive dream-forcing rollout with few-step denoising on a 5B backbone." },
    diagram: {
      pattern: "unified",
      inputs: ["multi-view RGB", "language", "mobile base + arm state"],
      data: ["OXE", "OXE-AugE", "Agibot-Beta", "RoboCOIN", "RoboMind", "Galaxea", "InternData-A1", "RoboNet", "BridgeData V2", "DROID"],
      predictiveState: { form: "future video + frame-level latent actions", runtime: "full", rendered: true },
      components: ["Wan2.2 5B video diffusion", "Frame-level latent actions", "Dual-level Mixture-of-Transformers", "Mobility branch", "Manipulation branch"],
      trainingStages: [
        { name: "World model pretraining", data: "large multi-embodiment data", objective: "video CFM" },
        { name: "Latent action pretraining", data: "video", objective: "frame-level latent actions" },
        { name: "SFT I / SFT II (Dream Forcing)", data: "clean then predicted futures", objective: "action CFM with train-test alignment" }
      ],
      runtimePath: ["observation", "video diffusion", "latent actions", "mobility/manipulation heads"],
      outputs: ["future video", "mobility action", "manipulation action"]
    },
    lit: {
      inputTokens: ["multi-view RGB via Wan2.2 VAE", "language", "mobile base and arm state", "frame-level latent actions"],
      tokenization: ["Wan2.2 5B video VAE latents", "frame-level latent-action tokens as an intermediate bridge"],
      backbone: ["Wan2.2 5B video diffusion transformer", "dual-level Mixture-of-Transformers"],
      branches: ["modality disentanglement", "mobility branch and manipulation branch with shared attention"],
      attention: ["asymmetric causal masking", "structured sparse attention via FlashAttention"],
      heads: ["video velocity head", "latent-action head", "mobility and manipulation action heads"],
      objectives: ["conditional flow matching for video, latent actions, and actions across three cascade stages"],
      trainingRecipe: ["world-model pretraining -> latent-action pretraining -> SFT Stage I (clean futures) -> SFT Stage II (Dream Forcing)"],
      inferenceRecipe: ["autoregressive rollout with model-predicted futures", "Dream Forcing aligns conditioning to close the train-test gap", "few-step denoising for efficiency"]
    },
    uncertainty: "medium: RoboCasa365/RoboTwin/LIBERO numbers and the 5B scale reported; GPU-hours not stated.",
    method: [
      "ABot-M0.5 is a unified mobility-and-manipulation world action model.",
      "The backbone is a Wan2.2 5B video diffusion model, giving the model 5 billion parameters.",
      "Frame-level latent actions provide an intermediate embodiment-agnostic bridge between coarse video prediction and fine-grained control.",
      "A dual-level Mixture-of-Transformers disentangles modality and separates mobility and manipulation branches with shared attention and asymmetric causal masking.",
      "Training uses conditional flow matching for video, latent actions, and actions across three cascade stages, ending with a Dream Forcing SFT stage.",
      "Data spans OXE, OXE-AugE, Agibot-Beta, RoboCOIN, RoboMind, Galaxea, InternData-A1, plus RoboNet, BridgeData V2, and DROID.",
      "On RoboCasa365 the average success is 40.4% and 54.2% on the target-100% split, using few-step denoising at inference.",
      "On RoboTwin 2.0 the average success is 94.1% and on LIBERO the average is 99.4%.",
      "On LIBERO-Plus zero-shot ABot-M0.5 is state-of-the-art among world-action models."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 94.1, ev: [7], context: "RoboTwin 2.0 average" },
        robocasa: { value: 40.4, ev: [6], context: "RoboCasa365 average" }
      } },
      generalization: { improvementPct: 20, unseenTask: true, ev: [8], note: "State-of-the-art among WAMs on LIBERO-Plus zero-shot perturbations." },
      warnings: ["GPU-hours not reported; compute uses scale/parameter estimate"]
    }
  },

  {
    id: "lawam",
    name: "LaWAM",
    title: "LaWAM: Latent World Action Models for Efficient Dynamics-Aware Robot Policies",
    date: ["2026", "06", "14"],
    arxiv: "2606.15768",
    family: "latent_idm",
    problem: "Pixel-level WAMs are expensive, slow at inference, and do not expose action-relevant dynamics to the action generator.",
    oneLine: "Predicts compact latent visual subgoals instead of pixels by repurposing a latent-action-model decoder as a non-iterative world model.",
    insights: {
      problem: "Pixel synthesis is costly and its dynamics are not action-relevant for downstream control.",
      method: "A Qwen3-VL/DINOv3 policy predicts latent actions; the LaWM decoder converts them to a latent subgoal in one forward pass, and an Alternate-DiT action expert generates the chunk with knowledge insulation.",
      novelty: "Repurposes the forward decoder of a latent-action model as an explicit, non-iterative world-model interface over latent subgoals.",
      limitation: "Most effective with stable cameras; struggles with egocentric shake or large viewpoint change.",
      related: "UniVLA, MoWM, Being-H0.7"
    },
    metrics: { runtimeCost: 2, computeScale: 3, evidence: 4, runtimeNote: "Non-iterative latent subgoal decode (~187 ms/chunk, 10 steps); up to 24x lower latency than pixel WAMs." },
    diagram: {
      pattern: "latent_idm",
      inputs: ["RGB observation", "language", "robot state"],
      data: ["~3,000 h robot videos + ~1,500 h egocentric human videos (Open X-Embodiment)"],
      predictiveState: { form: "latent visual subgoal (non-iterative)", runtime: "partial", rendered: false },
      components: ["Qwen3-VL (first 16 layers)", "DINOv3 ViT-B/16 (frozen)", "Policy prior (latent actions)", "LaWM decoder", "Alternate-DiT action expert"],
      trainingStages: [
        { name: "Latent-action model pretraining", data: "robot + human video", objective: "forward prediction + KL + auxiliary state" },
        { name: "Policy integration", data: "task data", objective: "latent-action distillation + subgoal supervision + action flow matching" }
      ],
      runtimePath: ["observation", "policy predicts latent action", "LaWM decodes latent subgoal", "action expert"],
      outputs: ["latent subgoal", "action chunk"]
    },
    lit: {
      inputTokens: ["RGB via DINOv3 ViT-B/16", "language via Qwen3-VL", "robot state", "latent actions"],
      tokenization: ["DINOv3 frozen visual encoder", "Qwen3-VL first 16 layers as VLM backbone"],
      backbone: ["Qwen3-VL (16 layers)", "DINOv3 ViT-B/16", "Alternate-DiT action expert (4 blocks); 2.3B total (230M LaWM)"],
      branches: ["policy prior predicts latent actions", "LaWM decoder maps latent actions to latent features", "Alternate-DiT action expert"],
      attention: ["causal attention mask", "Alternate-DiT alternates between full VLM state and dynamics stream"],
      heads: ["latent-action head", "LaWM subgoal decoder", "flow-matching action head", "auxiliary state MLP (discarded after Stage 1)"],
      objectives: ["Stage 1: forward prediction + KL + auxiliary state prediction", "Stage 2: latent-action distillation + subgoal supervision + action flow matching with Knowledge Insulation"],
      trainingRecipe: ["Stage 1 latent-action pretraining, Stage 2 policy integration on 64 H100 GPUs (~20 h on RoboTwin)"],
      inferenceRecipe: ["policy predicts latent action", "LaWM decodes to a latent subgoal in a single non-iterative forward pass", "action expert generates chunk in ~187 ms with 10 denoising steps"]
    },
    uncertainty: "low: parameter count, GPU setup, latency, and LIBERO/RoboTwin/real-world numbers all reported in the paper.",
    method: [
      "LaWAM builds latent world action models for efficient dynamics-aware robot policies.",
      "The VLM backbone uses the first 16 layers of Qwen3-VL with a frozen DINOv3 ViT-B/16 visual encoder.",
      "LaWAM has 2.3 billion parameters, of which the LaWM decoder is only 230M, roughly 95% fewer than pixel-space WAM backbones.",
      "A policy prior predicts latent actions, the LaWM decoder converts them to latent features, and an Alternate-DiT action expert with 4 blocks generates the chunk.",
      "Stage 1 trains the latent action model with forward prediction, KL regularization, and auxiliary state prediction; Stage 2 integrates the policy with latent-action distillation, subgoal supervision, and action flow matching with Knowledge Insulation.",
      "Pretraining uses approximately 3,000 hours of robot videos and 1,500 hours of egocentric human videos from Open X-Embodiment and related datasets.",
      "Policy integration runs on 64 H100 GPUs with roughly 20 hours of training on RoboTwin.",
      "At inference LaWAM takes 187 ms per action-chunk prediction with 10 denoising steps, up to 24x lower latency than pixel-space WAMs.",
      "On LIBERO the average success rate is 98.6%, on RoboTwin 92.64% clean and 89.80% randomized, and real-world tasks average 90.0%."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 89.8, ev: [8], context: "RoboTwin randomized multi-task" }
      } },
      computeCost: { pretrainingGpuHours: 1280, finetuningGpuHours5h: 96, pretrainFormula: "64 H100 GPUs * ~20 h RoboTwin policy integration", ev: [6], assumptions: { gpus: 64, gpuType: "H100", hours: 20 } },
      inferenceCost: { fps4090: 5.3, reported: "187 ms/chunk, 10 steps", ev: [7], assumptions: { denoisingSteps: [10], note: "187 ms/action-chunk -> ~5.3 Hz" } },
      generalization: { improvementPct: 15, unseenTask: true, ev: [8], note: "Real-world 90% average across pick-and-place, drawer, and towel folding." },
      warnings: []
    }
  },

  {
    id: "aha-wam",
    name: "AHA-WAM",
    title: "AHA-WAM: Asynchronous Horizon-Adaptive World-Action Modeling with Observation-Guided Context Routing",
    date: ["2026", "06", "08"],
    arxiv: "2606.09811",
    family: "speedup",
    problem: "WAMs couple video prediction and action at the same temporal resolution, forcing the video branch to model redundant short-horizon variation.",
    oneLine: "Decouples slow long-horizon video planning from fast action execution via an asynchronous dual-DiT with observation-guided context routing.",
    insights: {
      problem: "Same-resolution coupling wastes the video branch on short-horizon frame variation and slows control.",
      method: "A Wan2.2-5B video DiT plans long-horizon while a compact action DiT runs high-frequency closed-loop; Observation-Guided Video-Context Routing with 32 queries and a rolling K/V memory adapt cached context without recomputing the video DiT.",
      novelty: "Asynchronous horizon-decoupled formulation with observation-conditioned context routing and horizon-adaptive offset training.",
      limitation: "Temporal hyperparameters lack principled tuning; evaluated only on short-to-medium horizons.",
      related: "Fast-WAM, GigaWorld-Policy, SimDist"
    },
    metrics: { runtimeCost: 2, computeScale: 5, evidence: 3, runtimeNote: "Video DiT removed from the critical path; action DiT runs closed-loop at 24-57 Hz." },
    diagram: {
      pattern: "speedup",
      inputs: ["RGB observation", "language", "robot state"],
      data: ["RoboCOIN subset (24,600 traj, ~165 h)", "RoboTwin (50 clean + 500 randomized/task)", "~120 episodes/real task"],
      predictiveState: { form: "long-horizon video plan + fast action", runtime: "async", rendered: true },
      components: ["Wan2.2-5B video DiT (planner)", "Compact action DiT (executor)", "OVCR routing (32 queries)", "Rolling FIFO K/V memory"],
      trainingStages: [
        { name: "Horizon-adaptive training", data: "RoboCOIN + RoboTwin", objective: "flow matching on 16-horizon actions and 64-horizon video with randomized offset" }
      ],
      runtimePath: ["observation", "action DiT (high frequency)", "OVCR-adapted cached video context"],
      outputs: ["future video (off critical path)", "action chunk"]
    },
    lit: {
      inputTokens: ["RGB observation", "language", "robot state", "action tokens (16-horizon)", "video latents (64-horizon)"],
      tokenization: ["Wan2.2 video VAE latents", "action tokenization"],
      backbone: ["Wan2.2-5B video DiT (4.99B)", "compact action DiT (1.02B)", "routing modules (1.22B); ~7.23B total"],
      branches: ["video planner branch", "action executor branch"],
      attention: ["layerwise joint attention", "video branch fully causal", "action branch masked from future video tokens", "OVCR with 32 learnable queries + rolling 6-frame K/V memory"],
      heads: ["video velocity head", "action velocity head"],
      objectives: ["flow matching on action chunks (16-horizon) and video latents (64-horizon)", "horizon-adaptive offset training (delta in [0, ha))"],
      trainingRecipe: ["AdamW, LR 1e-4, global batch 512, 5 epochs; RoboCOIN subset then RoboTwin/real tasks"],
      inferenceRecipe: ["remove video DiT from the critical path", "action DiT runs high-frequency closed loop", "OVCR adapts cached context per action chunk", "CUDA/TensorRT + ODE distillation 10->2 steps; 24.17 Hz (41.37 ms), Flash 56.95 Hz (17.56 ms)"]
    },
    uncertainty: "low: parameter breakdown, data scale, latency/Hz, and RoboTwin numbers reported; no LIBERO/RoboCasa evaluation.",
    method: [
      "AHA-WAM performs asynchronous horizon-adaptive world-action modeling with observation-guided context routing.",
      "The model has about 7.23B parameters: a 4.99B Wan2.2-5B video DiT, a 1.02B action DiT, and 1.22B routing modules.",
      "The video branch uses a fully causal mask while the action branch is masked from future video tokens, coupled by layerwise joint attention.",
      "Observation-Guided Video-Context Routing uses 32 learnable queries and a rolling FIFO K/V memory of 6 frames to adapt cached context per action chunk.",
      "Training uses a flow-matching objective on 16-horizon action chunks and 64-horizon video latents with horizon-adaptive offset training.",
      "Pretraining uses a RoboCOIN subset of 24,600 trajectories (~165 hours), with RoboTwin 50 clean plus 500 randomized demonstrations per task and ~120 episodes per real-world task.",
      "At inference the video DiT is removed from the critical path and the action DiT runs closed-loop at 24.17 Hz (41.37 ms), with AHA-WAM-Flash at 56.95 Hz (17.56 ms) using ODE distillation from 10 to 2 steps.",
      "This is a 4.59x and 10.82x speedup versus Fast-WAM.",
      "On RoboTwin 2.0 the average success is 92.80% (93.40% clean, 92.20% randomized) and real-world tasks average 78.3%."
    ],
    override: {
      confidence: "medium-high", quality: "agent-audited",
      accuracy: { benchmarks: {
        robotwinAllData: { value: 92.2, ev: [8], context: "RoboTwin 2.0 randomized" },
        robotwinTaskSpecific: { value: 93.4, ev: [8], context: "RoboTwin 2.0 clean" }
      } },
      inferenceCost: { fps4090: 18, reported: "24.17 Hz (RTX 5090D); Flash 56.95 Hz", ev: [6], assumptions: { denoisingSteps: [10, 2], note: "24.17 Hz on RTX 5090D discounted to RTX 4090" } },
      generalization: { improvementPct: 12, unseenTask: true, ev: [8], note: "RoboTwin randomized multi-task and real-world tasks (78.3%)." },
      warnings: ["no LIBERO/RoboCasa evaluation"]
    }
  },

  {
    id: "tau0-wm",
    name: "tau0-WM",
    title: "tau0-WM: A Unified Video-Action World Model for Robotic Manipulation",
    date: ["2026", "05", "31"],
    arxiv: "2606.01027",
    family: "unified",
    problem: "Robots need to generate executable actions while anticipating and evaluating their consequences before acting, across heterogeneous data.",
    oneLine: "A unified video-action world model that proposes actions, then evaluates and revises them at test time using its own learned video simulator.",
    insights: {
      problem: "Data sources differ in embodiment, viewpoint, and action fidelity; video prediction is usually only an auxiliary loss.",
      method: "A Wan 5B video DiT plus a 0.5B action DiT are jointly flow-matched; at test time re-denoising consistency scoring selects among sampled actions, an action-conditioned video simulator evaluates rollouts, and low-quality actions are rectified by re-querying the policy.",
      novelty: "Uses video prediction as a deployment-time mechanism for action selection and rectification, not just training signal.",
      limitation: "Single-embodiment scope, no tactile feedback, and the test-time fallback adds latency.",
      related: "Pelican-Unify 1.0, MotuBrain, Feedback World Model"
    },
    metrics: { runtimeCost: 4, computeScale: 5, evidence: 3, runtimeNote: "Test-time proposal-evaluation-revision; fallback video rollout on unreliable actions on a 5.5B model." },
    diagram: {
      pattern: "unified",
      inputs: ["RGB observation", "language", "robot state"],
      data: ["17.8K h real-robot teleop (AGIBOT-G01, ARX, Franka)", "6.5K h UMI-style (Gen-DAS Grippers)", "3.0K h egocentric; 27.3K h total"],
      predictiveState: { form: "future video + action + dense reward", runtime: "full", rendered: true },
      components: ["Wan 5B video DiT", "0.5B action DiT", "Re-denoising consistency scoring", "Action-conditioned video simulator", "Low-quality action rectification"],
      trainingStages: [
        { name: "Pretraining", data: "27.3K h heterogeneous", objective: "joint flow matching for future latents and actions" },
        { name: "Supervised fine-tuning", data: "downstream tasks", objective: "task adaptation" }
      ],
      runtimePath: ["observation", "sample N actions", "consistency scoring", "video-simulator evaluation", "rectified action"],
      outputs: ["future video", "action", "reward"]
    },
    lit: {
      inputTokens: ["RGB via Wan VAE", "language", "robot state", "action tokens"],
      tokenization: ["Wan 5B video VAE latents", "modality-specific supervision masks for heterogeneous data"],
      backbone: ["Wan 5B video diffusion transformer", "0.5B action DiT decoder; 5.5B total"],
      branches: ["video prediction branch", "action generation branch", "reward prediction"],
      attention: ["cross-attention between action tokens and video features at matched stages"],
      heads: ["video velocity predictor", "action velocity predictor", "dense reward predictor"],
      objectives: ["joint flow matching for future latents and actions (VAM)", "joint flow matching for future latents and dense rewards (ACVS)"],
      trainingRecipe: ["pretrain on 27.3K hours across robot, UMI, and egocentric data, then supervised fine-tuning"],
      inferenceRecipe: ["sample N action candidates", "re-denoising consistency scoring (RCS) selects", "if unreliable, run action-conditioned video simulator (ACVS) for rollout evaluation", "low-quality action rectification (LAR) re-queries the policy; ~220 ms/query (180 ms cached, 140 ms compiled) on RTX 5090"]
    },
    uncertainty: "medium-high: 5.5B scale and 27.3K-hour data reported; evaluation uses custom real tasks rather than standard sim benchmarks, so accuracy is excluded from the normalized Metrics.",
    method: [
      "tau0-WM is a unified video-action world model for robotic manipulation.",
      "The backbone is a Wan 5B video diffusion transformer paired with a 0.5B action DiT decoder, giving 5.5 billion parameters.",
      "Cross-attention links action tokens to video features at matched transformer stages, with video, action, and reward prediction heads.",
      "Training jointly flow-matches future latents and actions (VAM) and future latents with dense rewards (ACVS).",
      "Pre-training uses 27.3K hours total: 17.8K hours of real-robot teleoperation (AGIBOT-G01, ARX, dual-arm Franka), 6.5K hours of UMI-style demonstrations, and 3.0K hours of egocentric human video.",
      "At test time the model samples N action candidates and applies re-denoising consistency scoring, then invokes an action-conditioned video simulator to evaluate rollouts and rectify low-quality actions.",
      "Action generation latency is about 220 ms per query, 180 ms with caching and 140 ms with torch.compile, on a single RTX 5090.",
      "On zero-shot pen-to-holder the average success is 0.55 with heterogeneous pre-training versus 0.14 robot-only, and fine-tuned object-wipe-place reaches 0.83.",
      "Test-time computation raises success to 0.60 with RCS and LAR versus 0.43 without on Tissue-to-Box and Pen-to-Box tasks."
    ],
    override: {
      confidence: "medium", quality: "agent-audited",
      inferenceCost: { fps4090: 4, reported: "~220 ms/query (RTX 5090)", ev: [6], assumptions: { note: "220 ms/query -> ~4.5 Hz, discounted for fallback rollout" } },
      generalization: { improvementPct: 26, unseenTask: true, ev: [7], note: "Zero-shot pen-to-holder 0.55 with heterogeneous pretraining vs 0.14 robot-only." },
      warnings: ["custom real-world tasks, no standard sim target benchmark; accuracy excluded from Metrics", "training GPU-hours not reported"]
    }
  },

  {
    id: "rla-wm",
    name: "RLA-WM",
    title: "Learning Visual Feature-Based World Models via Residual Latent Action",
    date: ["2026", "05", "08"],
    arxiv: "2605.07079",
    family: "latent_idm",
    problem: "Direct-regression feature world models are blurry and generative models over full DINO token space are computationally prohibitive.",
    oneLine: "A visual-feature world model that predicts future DINO features via compact residual latent actions with flow matching.",
    insights: {
      problem: "Predicting future visual features accurately while staying efficient is hard in high-dimensional token space.",
      method: "An autoencoder compresses DINO residuals into a 2048-dim residual latent action; a flow-matching network predicts velocity in that compact space and a decoder reconstructs future DINO tokens.",
      novelty: "First to learn latent actions from DINO residuals and run flow matching in a compact feature space, enabling RL entirely within an offline world model.",
      limitation: "Single-frame-pair training limits occlusion handling; evaluated on small-scale datasets only.",
      related: "VLA-JEPA, MoWM, LaWAM"
    },
    metrics: { runtimeCost: 3, computeScale: 2, evidence: 2, runtimeNote: "Compact DINO-residual latent world model; 30 flow-matching steps in feature space, no pixel decode." },
    diagram: {
      pattern: "latent_idm",
      inputs: ["current RGB observation", "action"],
      data: ["ManiSkill (1,000 success + 500 fail/task x 5 tasks x 3 robots; 3,000 play videos/robot)", "IWS real-world (600+ ALOHA demos/task)"],
      predictiveState: { form: "future DINO visual features", runtime: "partial", rendered: false },
      components: ["DINOv3-Large encoder", "RLA autoencoder", "RLA-WM condition + flow-matching network", "Feature decoder"],
      trainingStages: [
        { name: "RLA autoencoder", data: "DINO residuals", objective: "compress residual latent action" },
        { name: "RLA-WM", data: "actions + current DINO tokens", objective: "flow-matching velocity in RLA space" }
      ],
      runtimePath: ["observation", "encode DINO tokens", "flow-matching in RLA space", "decode future features"],
      outputs: ["future visual features", "latent action (for policy/RL)"]
    },
    lit: {
      inputTokens: ["DINOv3-Large features (1024-dim)", "embedded actions", "residual s_{t+h} - s_t"],
      tokenization: ["DINOv3-Large frozen features", "RLA autoencoder projects residuals to 32 queries x 64-dim (2048-dim latent)"],
      backbone: ["RLA autoencoder (12 self-attention layers, 16 heads, 1024 channels)", "RLA-WM condition network (8 attention layers)"],
      branches: ["residual latent-action encoder/decoder", "flow-matching world model"],
      attention: ["self-attention over DINO tokens", "condition network concatenates embedded actions and current DINO tokens"],
      heads: ["DINO token reconstruction decoder", "flow-matching velocity predictor"],
      objectives: ["MSE on DINO token reconstruction", "flow matching velocity supervision v* = z - epsilon"],
      trainingRecipe: ["train autoencoder and world model 100k steps each on 4xA6000 (48GB) over ~3 days"],
      inferenceRecipe: ["single forward pass through the decoder given RLA + current state", "30 Euler ODE flow-matching steps; ~3.5 TFLOPs per prediction"]
    },
    uncertainty: "medium: DINO prediction metrics, latent-action success, and compute reported; ManiSkill/IWS are not atlas target benchmarks, so accuracy is excluded from the normalized Metrics.",
    method: [
      "RLA-WM learns visual feature-based world models via residual latent action.",
      "The backbone features come from DINOv3-Large with 1024-dimensional tokens.",
      "An RLA autoencoder with 12 self-attention layers (16 heads, 1024 channels) compresses DINO residuals s_{t+h} - s_t into a compact 2048-dimensional latent using 32 queries of 64 dimensions.",
      "The RLA-WM condition network of 8 attention layers concatenates embedded actions with current DINO tokens, and a flow-matching network predicts velocity in the compact RLA space.",
      "Training uses ManiSkill simulation (1,000 successful and 500 failed episodes per task across 5 tasks and 3 robots, plus 3,000 play videos per robot) and the IWS real-world dataset with over 600 ALOHA demonstrations per task.",
      "Each component is trained for 100k steps over about 3 days on 4 A6000 GPUs (48GB) with 256GB RAM.",
      "At inference the flow-matching model uses 30 Euler ODE steps and about 3.5 TFLOPs per prediction, with no pixel decoding.",
      "On ManiSkill the prediction reaches LPIPS 0.071, SSIM 0.931, and DINO L1 0.030, and on IWS LPIPS 0.196, SSIM 0.847, DINO L1 0.053.",
      "Latent action learning achieves 35.6% average success versus 27.2% for BC-ResNet, and world-model RL improves success by 6.1% over behavior cloning."
    ],
    override: {
      confidence: "medium-low", quality: "agent-audited",
      computeCost: { pretrainingGpuHours: 288, finetuningGpuHours5h: 40, pretrainFormula: "4 A6000 GPUs * ~72 h (3 days) per component", ev: [5], assumptions: { gpus: 4, gpuType: "A6000", hours: 72 } },
      inferenceCost: { fps4090: 7, reported: "30 flow-matching steps, ~3.5 TFLOPs", ev: [6], assumptions: { denoisingSteps: [30], note: "compact feature-space prediction, no pixel decode" } },
      generalization: { improvementPct: 8, unseenTask: false, ev: [8], note: "Latent-action success 35.6% vs 27.2% BC-ResNet; +6.1% RL over BC on ManiSkill." },
      warnings: ["ManiSkill/IWS are not atlas target benchmarks; accuracy excluded from Metrics", "total parameter count not reported"]
    }
  }
];

// ---- write methods files + build overrides ----
const models = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
const overridesFile = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
const existingIds = new Set(models.models.map((m) => m.id));

function evEntry(id, lines, idx, ctx) {
  const text = lines[idx];
  return { source: `methods/${id}.md`, line: idx + 1, excerpt: text };
}

let added = 0;
for (const p of papers) {
  if (existingIds.has(p.id)) { console.log(`skip existing ${p.id}`); continue; }

  // methods/<id>.md
  const mdPath = path.join(methodsDir, `${p.id}.md`);
  const header = `# ${p.name} - ${p.title}\n\narXiv:${p.arxiv} | ${p.date.join("-")} | source-excerpt file for atlas metric extraction\n`;
  const body = p.method.join("\n");
  // The numbered lines used by overrides are the p.method entries; keep them as the file body
  // so that (index within p.method)+1 == file line number, we place body starting at line 1.
  fs.writeFileSync(mdPath, body + "\n", "utf8");

  const [year, month, day] = p.date;
  const card = {
    id: p.id,
    name: p.name,
    title: p.title,
    year: Number(year),
    month,
    day,
    paperUrl: `https://arxiv.org/abs/${p.arxiv}`,
    localText: "",
    family: p.family,
    category: categoryFor[p.family],
    problem: p.problem,
    oneLine: p.oneLine,
    insights: p.insights,
    metrics: {
      runtimeCost: p.metrics.runtimeCost,
      computeScale: p.metrics.computeScale,
      evidence: p.metrics.evidence,
      runtimeNote: p.metrics.runtimeNote
    },
    diagram: p.diagram,
    uncertainty: p.uncertainty,
    literalArchitecture: {
      sourceExtract: `methods/${p.id}.md`,
      sourceLines: [`${p.id}.md:1-${p.method.length}`],
      inputTokens: p.lit.inputTokens,
      tokenization: p.lit.tokenization,
      backbone: p.lit.backbone,
      branches: p.lit.branches,
      attention: p.lit.attention,
      heads: p.lit.heads,
      objectives: p.lit.objectives,
      trainingRecipe: p.lit.trainingRecipe,
      inferenceRecipe: p.lit.inferenceRecipe
    }
  };
  models.models.push(card);

  // metric override
  const o = p.override;
  const ov = { confidence: o.confidence, quality: o.quality };
  if (o.accuracy?.benchmarks) {
    ov.accuracy = { benchmarks: {} };
    for (const [k, b] of Object.entries(o.accuracy.benchmarks)) {
      ov.accuracy.benchmarks[k] = {
        value: b.value,
        context: b.context,
        evidence: b.ev.map((i) => evEntry(p.id, p.method, i))
      };
    }
  }
  if (o.computeCost) {
    ov.computeCost = {
      pretrainingGpuHours: o.computeCost.pretrainingGpuHours,
      finetuningGpuHours5h: o.computeCost.finetuningGpuHours5h,
      pretrainingFormula: o.computeCost.pretrainFormula,
      assumptions: o.computeCost.assumptions || {},
      evidence: (o.computeCost.ev || []).map((i) => evEntry(p.id, p.method, i))
    };
  }
  if (o.inferenceCost) {
    ov.inferenceCost = {
      fps4090: o.inferenceCost.fps4090,
      reported: o.inferenceCost.reported,
      assumptions: o.inferenceCost.assumptions || {},
      evidence: (o.inferenceCost.ev || []).map((i) => evEntry(p.id, p.method, i))
    };
  }
  if (o.generalization) {
    ov.generalization = {
      improvementPct: o.generalization.improvementPct,
      unseenTask: o.generalization.unseenTask === true,
      note: o.generalization.note,
      evidence: (o.generalization.ev || []).map((i) => evEntry(p.id, p.method, i))
    };
  }
  if (o.warnings?.length) ov.warnings = o.warnings;
  overridesFile.models[p.id] = ov;

  added++;
}

fs.writeFileSync(modelsPath, JSON.stringify(models, null, 2) + "\n", "utf8");
fs.writeFileSync(overridesPath, JSON.stringify(overridesFile, null, 2) + "\n", "utf8");
console.log(`Added ${added} papers. Total models: ${models.models.length}`);
