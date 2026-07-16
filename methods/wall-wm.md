WALL-WM carves world action modeling at the event joints, using semantically coherent action events as the atomic unit of learning.
The backbone is a Wan-series text-to-video DiT with frozen encoders layer-coupled to a randomly initialized Action DiT.
A 3D VAE codec compresses a keyframe plus history frames under a 1+4M+4N temporal rule, and a frozen T5 text encoder conditions the video DiT.
Multi-view learning uses within-view self-attention, zero-initialized cross-view attention, learnable Camera RoPE, and training-only sight-cone and tube patch masks.
An optional Qwen3.5-9B VLM with a Staircase parallel decoder relays latent chain-of-thought via a mixture-of-transformers relay.
Video and action are trained with flow-matching v-prediction MSE, with optional tube up-weighting and a DCT auxiliary action loss.
Training data spans OpenVID (1.2M clips), HD-VILA, Ego4D, EPIC-KITCHENS, DROID, AgiBot World, self-collected teleoperation, and no-embodiment wearable-rig data.
Inference offers an event mode with variable-length execution per next-event caption and a unified mode with fixed-length chunk inference using 50 action denoising steps.
WALL-WM shows clear advantages across real-robot manipulation, reasoning manipulation, dexterous manipulation, generalization, and embodied video-generation metrics.
