RLA-WM learns visual feature-based world models via residual latent action.
The backbone features come from DINOv3-Large with 1024-dimensional tokens.
An RLA autoencoder with 12 self-attention layers (16 heads, 1024 channels) compresses DINO residuals s_{t+h} - s_t into a compact 2048-dimensional latent using 32 queries of 64 dimensions.
The RLA-WM condition network of 8 attention layers concatenates embedded actions with current DINO tokens, and a flow-matching network predicts velocity in the compact RLA space.
Training uses ManiSkill simulation (1,000 successful and 500 failed episodes per task across 5 tasks and 3 robots, plus 3,000 play videos per robot) and the IWS real-world dataset with over 600 ALOHA demonstrations per task.
Each component is trained for 100k steps over about 3 days on 4 A6000 GPUs (48GB) with 256GB RAM.
At inference the flow-matching model uses 30 Euler ODE steps and about 3.5 TFLOPs per prediction, with no pixel decoding.
On ManiSkill the prediction reaches LPIPS 0.071, SSIM 0.931, and DINO L1 0.030, and on IWS LPIPS 0.196, SSIM 0.847, DINO L1 0.053.
Latent action learning achieves 35.6% average success versus 27.2% for BC-ResNet, and world-model RL improves success by 6.1% over behavior cloning.
