LaWAM builds latent world action models for efficient dynamics-aware robot policies.
The VLM backbone uses the first 16 layers of Qwen3-VL with a frozen DINOv3 ViT-B/16 visual encoder.
LaWAM has 2.3 billion parameters, of which the LaWM decoder is only 230M, roughly 95% fewer than pixel-space WAM backbones.
A policy prior predicts latent actions, the LaWM decoder converts them to latent features, and an Alternate-DiT action expert with 4 blocks generates the chunk.
Stage 1 trains the latent action model with forward prediction, KL regularization, and auxiliary state prediction; Stage 2 integrates the policy with latent-action distillation, subgoal supervision, and action flow matching with Knowledge Insulation.
Pretraining uses approximately 3,000 hours of robot videos and 1,500 hours of egocentric human videos from Open X-Embodiment and related datasets.
Policy integration runs on 64 H100 GPUs with roughly 20 hours of training on RoboTwin.
At inference LaWAM takes 187 ms per action-chunk prediction with 10 denoising steps, up to 24x lower latency than pixel-space WAMs.
On LIBERO the average success rate is 98.6%, on RoboTwin 92.64% clean and 89.80% randomized, and real-world tasks average 90.0%.
