# Causal Video Models Are Data-Efficient Robot Policy Learners

Source: `C:\Users\joecl\OneDrive\Documents\PHD\Lit Reviews\wam papers\rhoda-direct-video-action.html`

Supplementary notes: `C:\Users\joecl\OneDrive\Documents\PHD\Lit Reviews\VLA Video Model Adaption.docx`, Rhoda AI section.

## Method Notes

- Rhoda frames the Direct Video-Action Model (DVA) as a real-time robot policy in which a pretrained causal video model is responsible for decision-making, and an inverse dynamics model translates generated video into robot actions.
- The page describes a policy loop with video context, a causal video model, generated video, an inverse dynamics model, generated actions, and an action rollout fed back into the next context.
- The user notes say Rhoda trains/pretrains a native causal video model from scratch, then uses a compact IDM trained with about 10 hours of robot data to convert generated future video into executable actions.
- Runtime uses a leapfrog/asynchronous loop: while the robot executes the previous action chunk, the model generates the next video-action chunk.
- Long-context visual memory is maintained through autoregressive video context and KV-cache/prefill reuse; real observations are inserted into context for robot control, while fully autoregressive video rollouts are used for visualization and debugging.
- Reported evidence is mostly qualitative/internal videos on the public research page rather than a conventional benchmark paper.
