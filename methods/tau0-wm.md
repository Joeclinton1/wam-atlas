tau0-WM is a unified video-action world model for robotic manipulation.
The backbone is a Wan 5B video diffusion transformer paired with a 0.5B action DiT decoder, giving 5.5 billion parameters.
Cross-attention links action tokens to video features at matched transformer stages, with video, action, and reward prediction heads.
Training jointly flow-matches future latents and actions (VAM) and future latents with dense rewards (ACVS).
Pre-training uses 27.3K hours total: 17.8K hours of real-robot teleoperation (AGIBOT-G01, ARX, dual-arm Franka), 6.5K hours of UMI-style demonstrations, and 3.0K hours of egocentric human video.
At test time the model samples N action candidates and applies re-denoising consistency scoring, then invokes an action-conditioned video simulator to evaluate rollouts and rectify low-quality actions.
Action generation latency is about 220 ms per query, 180 ms with caching and 140 ms with torch.compile, on a single RTX 5090.
On zero-shot pen-to-holder the average success is 0.55 with heterogeneous pre-training versus 0.14 robot-only, and fine-tuned object-wipe-place reaches 0.83.
Test-time computation raises success to 0.60 with RCS and LAR versus 0.43 without on Tissue-to-Box and Pen-to-Box tasks.
