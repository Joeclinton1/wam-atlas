Being-H0.7: A Latent World-Action Model from Egocentric Videos.
Being-H0.7 is a 3B-parameter latent world-action model built from an InternVL3.5 understanding expert and a Qwen3 action expert.
A deployable prior branch infers latent future states from the current context while a training-only posterior branch reads future-observation embeddings; the two are aligned in latent reasoning space.
At inference Being-H0.7 discards the posterior branch and performs no visual rollout, using latency-aware Universal Async Chunking at roughly 3-4 ms/step.
Training uses mixed human and robot manipulation trajectories in the UniHand 2.0 format together with large-scale egocentric videos across a pretraining and a downstream post-training stage.
On LIBERO the average success rate is 99.2% and on RoboCasa-50 the success rate is 62.1%.
LIBERO-Plus reaches 82.1% zero-shot and 84.8% fine-tuned, showing strong out-of-distribution robustness.
On RoboTwin 2.0 Being-H0.7 reports 90.2% under the easy setting and 89.6% under the hard setting.
On CALVIN ABCD->D it completes 4.67 tasks and on ABC->D 4.48 tasks, and it is evaluated on 12 real-world tasks across five ability suites.
