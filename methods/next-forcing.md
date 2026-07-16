Next Forcing performs causal world modeling with multi-chunk prediction for World Action Models.
The backbone is a Wan2.2 Transformer with 30 layers, with a video stream and an action stream coupled via a mixture-of-transformers.
Three auxiliary multi-chunk-prediction modules predict the next1, next2, and next3 chunks, each with 3 lightweight transformer blocks fused from intermediate layers {4,12,20,30}.
A shared causal attention mask lets noisy tokens attend only to preceding clean tokens, preventing information leakage.
Training uses flow matching for video dynamics and inverse-dynamics actions, with MCP loss weights w1=0.5, w2=0.2, w3=0.1 and timestep shifts s_main=5 and s_mcp=10.
General video pretraining uses approximately 3.5M video clips of 5-10 seconds, and robot fine-tuning uses RoboTwin with 2,500 Clean and 25,000 Random demonstrations on 64 GPUs.
On RoboTwin Clean Next Forcing reaches 94.1% and on RoboTwin Random 93.5%, versus LingBot-VA at 92.9% and 91.5%.
On PhyWorld the out-of-training FVD improves to 4.7 from 5.3 and the abnormal ratio drops to 8% from 12%.
Parallel chunk generation gives a 2x inference speedup while maintaining comparable accuracy across 12, 25, and 50 fps.
