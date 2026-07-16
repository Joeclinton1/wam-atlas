ABot-M0.5 is a unified mobility-and-manipulation world action model.
The backbone is a Wan2.2 5B video diffusion model, giving the model 5 billion parameters.
Frame-level latent actions provide an intermediate embodiment-agnostic bridge between coarse video prediction and fine-grained control.
A dual-level Mixture-of-Transformers disentangles modality and separates mobility and manipulation branches with shared attention and asymmetric causal masking.
Training uses conditional flow matching for video, latent actions, and actions across three cascade stages, ending with a Dream Forcing SFT stage.
Data spans OXE, OXE-AugE, Agibot-Beta, RoboCOIN, RoboMind, Galaxea, InternData-A1, plus RoboNet, BridgeData V2, and DROID.
On RoboCasa365 the average success is 40.4% and 54.2% on the target-100% split, using few-step denoising at inference.
On RoboTwin 2.0 the average success is 94.1% and on LIBERO the average is 99.4%.
On LIBERO-Plus zero-shot ABot-M0.5 is state-of-the-art among world-action models.
