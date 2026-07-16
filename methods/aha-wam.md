AHA-WAM performs asynchronous horizon-adaptive world-action modeling with observation-guided context routing.
The model has about 7.23B parameters: a 4.99B Wan2.2-5B video DiT, a 1.02B action DiT, and 1.22B routing modules.
The video branch uses a fully causal mask while the action branch is masked from future video tokens, coupled by layerwise joint attention.
Observation-Guided Video-Context Routing uses 32 learnable queries and a rolling FIFO K/V memory of 6 frames to adapt cached context per action chunk.
Training uses a flow-matching objective on 16-horizon action chunks and 64-horizon video latents with horizon-adaptive offset training.
Pretraining uses a RoboCOIN subset of 24,600 trajectories (~165 hours), with RoboTwin 50 clean plus 500 randomized demonstrations per task and ~120 episodes per real-world task.
At inference the video DiT is removed from the critical path and the action DiT runs closed-loop at 24.17 Hz (41.37 ms), with AHA-WAM-Flash at 56.95 Hz (17.56 ms) using ODE distillation from 10 to 2 steps.
This is a 4.59x and 10.82x speedup versus Fast-WAM.
On RoboTwin 2.0 the average success is 92.80% (93.40% clean, 92.20% randomized) and real-world tasks average 78.3%.
