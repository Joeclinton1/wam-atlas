Feedback World Model enables precise guidance of a diffusion policy by correcting predictions online.
The world model is a lightweight task-specific latent dynamics model with a Transformer predictor, kept frozen at deployment.
A latent-observer feedback state z-bar is updated online using the discrepancy e_t = z_t - z-bar_t with feedback gain L to iteratively correct future predictions.
Guidance is applied only in the final tau_g low-noise denoising steps of the diffusion policy, with action-aware weighting from counterfactual variance.
Training data uses 20% of Robomimic demonstrations, 50 LIBERO-Plus trajectories per task, and 50-65 real-world demonstrations per task.
On Robomimic under OOD conditions the average success is 52% (Square 46%, Transport 60%, Tool-Hang 36%).
On LIBERO-Plus under OOD the average success is 52% across four tasks.
On the real-world Peach pick-and-place task success is 95% in-distribution and 80% OOD, and on Drawer-Open 75% in-distribution and 70% OOD.
Online feedback reduces prediction error by up to 76.4% on real-world tasks and yields a 30% relative improvement in success rate.
