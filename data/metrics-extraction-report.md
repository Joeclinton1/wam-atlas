# Metrics Extraction Report

Generated: 2026-07-14T19:50:47.836Z

This report validates the automated extraction pass on a representative sample of model families. It records raw detected quantities, normalized estimates, and warnings that identify values needing manual review.

## Quality Counts

- weak-auto: 10
- needs-review: 37
- usable-auto: 20

## Sample Audit

### GR-2 (gr-2)
- quality: weak-auto; confidence: medium
- benchmarks: none detected
- extracted: GPUh=none; FPS/Hz=none; paramsB=50; denoising=none
- estimates: accuracy=null; pretrainGPUh=22572; finetuneGPUh5h=262.5; fps4090=1.3; generalization=null
- warnings: no benchmark key detected; estimated accuracy uses atlas priors; no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; diffusion-like method without detected denoising-step count; excluded from Metrics: no target benchmark result

### LAPA (lapa)
- quality: needs-review; confidence: medium
- benchmarks: simpler
- extracted: GPUh=none; FPS/Hz=none; paramsB=7, 4.1, 4, 15; denoising=none
- estimates: accuracy=57.3; pretrainGPUh=272; finetuneGPUh5h=28; fps4090=52.9; generalization=16.7
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; diffusion-like method without detected denoising-step count

### VPP (vpp)
- quality: needs-review; confidence: medium
- benchmarks: none detected
- extracted: GPUh=none; FPS/Hz=none; paramsB=1.5; denoising=10
- estimates: accuracy=null; pretrainGPUh=480; finetuneGPUh5h=36; fps4090=8.5; generalization=null
- warnings: no benchmark key detected; estimated accuracy uses atlas priors; no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; excluded from Metrics: no target benchmark result

### VideoVLA (videovla)
- quality: usable-auto; confidence: medium
- benchmarks: simpler
- extracted: GPUh=none; FPS/Hz=3; paramsB=5, 1, 2; denoising=50, 10
- estimates: accuracy=63; pretrainGPUh=3200; finetuneGPUh5h=480; fps4090=0.9; generalization=23.7
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate

### Cosmos Policy (cosmos-policy)
- quality: usable-auto; confidence: medium
- benchmarks: libero, robocasa
- extracted: GPUh=none; FPS/Hz=5; paramsB=2, 7; denoising=5, 10, 1, 66
- estimates: accuracy=67.1; pretrainGPUh=106920; finetuneGPUh5h=1536; fps4090=1.6; generalization=17.6
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate

### VLA-JEPA (vla-jepa)
- quality: needs-review; confidence: medium
- benchmarks: libero, simpler
- extracted: GPUh=none; FPS/Hz=none; paramsB=2; denoising=none
- estimates: accuracy=57.3; pretrainGPUh=2192; finetuneGPUh5h=75; fps4090=33.9; generalization=null
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; diffusion-like method without detected denoising-step count; excluded from generalization: no real-world unseen-task evidence

### Fast-WAM (fast-wam)
- quality: usable-auto; confidence: medium-high
- benchmarks: libero, robotwinAllData
- extracted: GPUh=none; FPS/Hz=none; paramsB=6, 5, 1, 2; denoising=10
- estimates: accuracy=80; pretrainGPUh=2741; finetuneGPUh5h=75; fps4090=5.3; generalization=null
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; excluded from generalization: no real-world unseen-task evidence

### VTAM (vtam)
- quality: needs-review; confidence: medium-low
- benchmarks: none detected
- extracted: GPUh=none; FPS/Hz=1; paramsB=3; denoising=none
- estimates: accuracy=null; pretrainGPUh=14877; finetuneGPUh5h=262.5; fps4090=1; generalization=null
- warnings: no benchmark key detected; estimated accuracy uses atlas priors; no explicit GPU-hour value detected; compute uses scale/parameter estimate; diffusion-like method without detected denoising-step count; excluded from Metrics: no target benchmark result

### GigaWorld-Policy (gigaworld-policy)
- quality: usable-auto; confidence: medium-high
- benchmarks: robotwinAllData
- extracted: GPUh=6000; FPS/Hz=none; paramsB=5, 3, 1; denoising=none
- estimates: accuracy=75.1; pretrainGPUh=6000; finetuneGPUh5h=520; fps4090=2.8; generalization=null
- warnings: no explicit model inference FPS/Hz detected; inference uses architecture estimate; diffusion-like method without detected denoising-step count; excluded from generalization: no real-world unseen-task evidence

### XR-1 (xr-1)
- quality: usable-auto; confidence: medium-high
- benchmarks: none detected
- extracted: GPUh=38400, 576; FPS/Hz=5; paramsB=2.6, 3, 0.9, 4, 1; denoising=none
- estimates: accuracy=null; pretrainGPUh=76800; finetuneGPUh5h=576; fps4090=5; generalization=null
- warnings: no benchmark key detected; estimated accuracy uses atlas priors; diffusion-like method without detected denoising-step count; excluded from Metrics: no target benchmark result

### LingBot-VA (lingbot-va)
- quality: usable-auto; confidence: medium
- benchmarks: robotwinAllData, robotwinTaskSpecific
- extracted: GPUh=none; FPS/Hz=5; paramsB=5.3, 5, 4, 1; denoising=none
- estimates: accuracy=78.4; pretrainGPUh=2496; finetuneGPUh5h=520; fps4090=2; generalization=15
- warnings: no explicit GPU-hour value detected; compute uses scale/parameter estimate; diffusion-like method without detected denoising-step count

### Rhoda DVA (rhoda-dva)
- quality: needs-review; confidence: medium-low
- benchmarks: none detected
- extracted: GPUh=none; FPS/Hz=none; paramsB=none; denoising=none
- estimates: accuracy=null; pretrainGPUh=10260; finetuneGPUh5h=10; fps4090=4.6; generalization=null
- warnings: no benchmark key detected; estimated accuracy uses atlas priors; no explicit GPU-hour value detected; compute uses scale/parameter estimate; no explicit model inference FPS/Hz detected; inference uses architecture estimate; excluded from Metrics: no target benchmark result

