MoLA turns imagined futures into executable actions via a mixture of latent actions for robot manipulation.
Imagination uses Stable Video Diffusion and the action head is a Diffusion Transformer trained with flow matching.
The core interface is a mixture of three pretrained inverse-dynamics models specialized for semantic (SAM2), depth (Depth Anything v2), and flow (CoTracker3) modalities.
ViT encoders extract modality features, spatiotemporal transformers model transitions, and VQ codebooks discretize the latent actions.
Video generation uses a single denoising step, and training data includes RT-X, Bridge Data, DROID, and task-specific datasets.
On CALVIN ABC-D the success sequence is 98.5%, 95.0%, 91.1%, 88.1%, 82.6% with an average length of 4.55.
On LIBERO the overall success rate is 97.0% (Spatial 93.0%, Object 99.5%, Goal 99.5%, Long 96.0%).
On LIBERO-Plus the overall success rate is 92.7% (Spatial 97.5%, Object 96.3%, Goal 85.1%, Long 91.8%).
On a real UR5e the average success is 73.0%, including 60.0% with distracting objects and 64.0% under lighting changes.
