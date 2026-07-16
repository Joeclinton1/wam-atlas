HarmoWAM harmonizes generalizable and precise manipulation via adaptive world action models.
The world-model backbone is Wan2.2-TI2V-5B, pretrained on approximately 1.9M robotic trajectories.
Public pretraining data comprises DROID (201,119 trajectories), AgiBot (3,017 trajectories), and RoboMIND (1,721,985 trajectories).
The predictive expert is a 1B-parameter DiT consisting of 28 Transformer blocks and the reactive expert uses DINOv2-base.
A Process-Adaptive Gating Mechanism automatically determines the switching timing and location between the predictive and reactive experts.
HarmoWAM is trained on 8 NVIDIA H20 GPUs in a two-stage paradigm: world-model finetuning then action-experts finetuning.
HarmoWAM achieves an action generation speed of 48 Hz with an action chunk size of 12 and 5 world-model denoising steps.
Across six real-world tasks the in-domain average success rate is 89%, with out-of-domain background 81%, position 80%, and objects 85%.
HarmoWAM improves zero-shot generalization by 33% over VLA models and 29% over prior WAMs across three training-unseen test environments.
