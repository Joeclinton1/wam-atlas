Turning Video Models into Generalist Robot Policies (VERA), a Video-to-Embodied Robot Action model.
VERA decouples an action-free video generative planner from an embodiment-specific Jacobian inverse-dynamics model (J-IDM).
The video backbone is the Wan family of open-weight video diffusion transformers, used at 1.3B and 14B parameters, and is not finetuned per embodiment.
The J-IDM predicts pixel-space Jacobian fields from generated video and is trained on readily available self-play data.
Training data spans DROID, MimicGen (Panda sim), PushT-Sim, Allegro-Sim, and real robot deployments.
The 1.3B model is trained on 1 H100 GPU and the 14B model on a single H200 node with 8 GPUs.
On Panda-Sim (MimicGen) VERA reaches 94.0 success, on PushT-Sim 92.5, and on Allegro-Sim 70.0 for 16-DoF dexterous cube reorientation.
VERA performs zero-shot language-conditioned manipulation on a real Panda arm and real Allegro hand across embodiments without retraining the video model.
The pipeline is a closed-loop video-to-action policy combining world-model video predictions with Jacobian IDM translation.
