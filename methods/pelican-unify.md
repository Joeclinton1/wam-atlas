Pelican-Unify 1.0 is a Unified Embodied Intelligence model for understanding, reasoning, imagination, and action.
A single Qwen3-VL with 4B parameters serves as the unified understanding and reasoning module across scenes, instructions, visual contexts, and action histories.
Shared embedders are a 3D video VAE and an action MLP that map every modality into the VLM token space.
The VLM autoregressively generates interleaved video and action chain-of-thought and projects its final hidden state to a dense loop state z.
A single Wan2.2 diffusion transformer with two lightweight modality-specific heads jointly denoises future video and action conditioned on z.
Training jointly optimizes an autoregressive text loss, a flow-matching video loss on the future region, and a SmoothL1 action regression loss.
On the RoboTwin 50-task dual-arm simulator Pelican-Unify 1.0 reaches a 93.5% success rate.
It scores 64.7 average across eight VLM benchmarks and ranks first on WorldArena with an EWM score of 66.03.
On a real Tienkung humanoid across five seen and three unseen tasks it averages 1.76 out of 2.0 on human evaluation, ranking first.
