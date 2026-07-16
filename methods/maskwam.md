MaskWAM unifies mask prompting and prediction for world-action models.
RGB and rendered mask frames are encoded by the same pretrained Wan 2.2 VAE and concatenated along the channel dimension to 2C channels.
A mixture-of-transformers with visual and action branches uses block-wise causal attention for unified RGB-mask-action training.
The joint flow-matching loss is L_total = L_video + L_mask + L_act with decoupled noise schedules tau_v for visual and tau_a for action.
Real-world tasks use on average 100 human demonstrations per task, and simulation uses LIBERO and RoboTwin datasets.
At deployment MaskWAM performs a single partial-denoising step on the joint RGB-mask stream with KV-caching for efficient action generation.
On LIBERO the average success rate is 98.4% and on RoboTwin 2.0 the average success rate is 92.2%.
On real-world language-clear tasks success is 84.3% and on language-ambiguous tasks 84.9%, outperforming the strongest baseline by 33.2%.
Deployment relies on SAM-3 segmentation, and reliable mask extraction in cluttered real-world scenes remains non-trivial.
