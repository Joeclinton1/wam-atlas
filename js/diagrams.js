import { state, familyColors, typeColors, escapeHtml, wrapText, shortText } from './shared.js?v=wam-atlas-33';

export function renderDiagram(container, model, options = {}) {
  container.innerHTML = architectureDiagramMarkup(model, options);
}

export function architectureDiagramMarkup(model, options = {}) {
  const view = { w: 1160, h: options.gallery ? 326 : options.mini ? 452 : 720 };
  if (state.showOriginalDiagrams) {
    const original = state.originalDiagrams?.[model.id];
    if (original) return originalDiagramMarkup(model, original, view);
  }
  const spec = getArchitectureSpec(model);
  const diagram = buildArchitectureDiagram(model, spec, options);
  const ids = diagramIds(model, options);
  const header = "";

  return `
    <svg class="wam-diagram" viewBox="0 0 ${view.w} ${view.h}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${escapeHtml(model.name)} architecture diagram">
      ${diagramDefs(model, ids)}
      <rect class="diagram-bg" x="0" y="0" width="${view.w}" height="${view.h}"></rect>
      ${header}
      ${drawArchitectureDiagram(diagram, view, options, ids)}
      ${drawGlobalUnifiedTokenLegend(diagram, view, options)}
    </svg>
  `;
}

function originalDiagramMarkup(model, original, view) {
  const src = escapeHtml(original.file);
  const caption = escapeHtml(original.caption || `${model.name} — as published`);
  const captionMarkup = `<text class="diagram-original-caption-text" x="${view.w / 2}" y="${view.h - 10}" text-anchor="middle">${caption}</text>`;
  return `
    <svg class="wam-diagram wam-diagram-original" viewBox="0 0 ${view.w} ${view.h}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${escapeHtml(model.name)} original paper diagram">
      <rect class="diagram-bg" x="0" y="0" width="${view.w}" height="${view.h}"></rect>
      <image href="${src}" x="0" y="0" width="${view.w}" height="${view.h}" preserveAspectRatio="xMidYMid meet"></image>
      ${captionMarkup}
    </svg>
  `;
}

function diagramIds(model, options = {}) {
  const safeId = String(model.id || "model").replace(/[^a-z0-9_-]/gi, "-");
  const size = options.gallery ? "gallery" : options.mini ? "mini" : "large";
  return {
    coreGrad: `${safeId}-${size}-coreGrad`,
    softShadow: `${safeId}-${size}-softShadow`,
    arrow: `${safeId}-${size}-diagramArrow`,
    visualFlow: `${safeId}-${size}-visualFlow`,
    languageFlow: `${safeId}-${size}-languageFlow`,
    stateFlow: `${safeId}-${size}-stateFlow`,
    actionFlow: `${safeId}-${size}-actionFlow`,
    futureFlow: `${safeId}-${size}-futureFlow`
  };
}

function buildArchitectureDiagram(model, spec, options = {}) {
  const reviewed = state.diagramProfiles?.[model.id];
  if (reviewed) return buildReviewedArchitectureDiagram(model, reviewed, options);
  const arch = model.literalArchitecture || spec || {};
  const allText = [
    model.family,
    model.category,
    ...(model.diagram?.inputs || []),
    ...(model.diagram?.runtimePath || []),
    ...(arch.inputTokens || []),
    ...(arch.tokenization || []),
    ...(arch.backbone || []),
    ...(arch.branches || []),
    ...(arch.attention || []),
    ...(arch.heads || []),
    ...(arch.objectives || []),
    ...(arch.trainingRecipe || []),
    ...(arch.inferenceRecipe || [])
  ].join(" ").toLowerCase();

  return {
    pattern: model.diagram?.pattern || model.family,
    family: model.family,
    thesis: model.oneLine || model.insights?.method || model.category,
    inputs: inferTokenGroups(model, arch, allText, options),
    encoders: inferEncoders(arch, allText, options),
    core: inferCore(model, arch, allText),
    streams: inferStreams(model, arch, allText, options),
    attention: inferAttentionBadges(allText, options),
    heads: inferHeads(model, arch, allText, options),
    outputs: inferOutputs(model, arch, allText, options),
    components: inferComponents(model, arch, options),
    data: (model.diagram?.data || []).slice(0, options.mini ? 2 : 4),
    training: inferTraining(arch, allText, options),
    runtime: inferRuntime(arch, options),
    motifs: inferMotifs(allText)
  };
}

function buildReviewedArchitectureDiagram(model, profile, options = {}) {
  const mini = Boolean(options.mini);
  const take = (items, miniCount, fullCount) => (items || []).slice(0, mini ? miniCount : fullCount);
  return {
    pattern: profile.pattern || model.diagram?.pattern || model.family,
    variant: profile.variant || null,
    family: model.family,
    thesis: profile.thesis || model.oneLine || model.category,
    inputs: take(profile.inputs, 3, 5),
    encoders: take(profile.encoders, 3, 6),
    core: profile.core,
    streams: take(profile.streams, 4, 6),
    attention: take(profile.attention, 4, 7),
    heads: take(profile.heads, 3, 6),
    outputs: take(profile.outputs, 3, 5),
    components: take(profile.components, 6, 10),
    data: take(profile.data || model.diagram?.data, 2, 4),
    training: take(profile.training, 4, 7),
    runtime: take(profile.runtime, 2, 4),
    motifs: profile.motifs || { diffusion: false, multiStream: false, trainingOnly: false, online: false }
  };
}

function drawArchitectureDiagram(diagram, view, options = {}, ids) {
  if (diagram.variant === "dreamzero_joint_flow") return drawDreamZeroArchitecture(diagram, view, options, ids);
  const pattern = diagram.pattern || diagram.family;
  if ([
    "unified",
    "multi_stream",
    "joint_latent",
    "latent_action",
    "implicit_future",
    "encoder_only",
    "alignment",
    "multimodal",
    "online_adaptation",
    "speedup"
  ].includes(pattern)) return drawStandardArchitecture(diagram, view, options, ids);
  if (["pixel_idm", "latent_idm"].includes(pattern)) return drawFutureIdmArchitecture(diagram, view, options, ids);

  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = mini ? 22 : 118;
  const coreBox = { x: 455, y: y0, w: 380, h: mini ? 270 : 330 };
  const inputBox = { x: 34, y: y0, w: 206, h: coreBox.h };
  const encoderBox = { x: 270, y: y0, w: 150, h: coreBox.h };
  const headBox = { x: 872, y: y0, w: 118, h: coreBox.h };
  const outputBox = { x: 1014, y: y0, w: 112, h: coreBox.h };
  const trainBox = { x: 34, y: y0 + coreBox.h + 36, w: 1092, h: mini ? 108 : 142 };

  return [
    drawColumnPanel(inputBox, "input token sequences", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "tokenizers / encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawCorePanel(diagram, coreBox, mini, ids),
    drawColumnPanel(headBox, "heads", drawHeadStack(diagram.heads, headBox, mini)),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawMainConnectors(inputBox, encoderBox, coreBox, headBox, outputBox, ids),
    showTraining ? drawTrainingBand(diagram, trainBox, coreBox, headBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
  ].join("");
}

function drawDreamZeroArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const gallery = Boolean(options.gallery);
  const y0 = gallery ? 18 : mini ? 22 : 34;
  const panelH = gallery ? 286 : mini ? 270 : 330;
  const left = { x: 34, y: y0, w: 536, h: panelH };
  const right = { x: 590, y: y0, w: 536, h: panelH };
  const trainingBox = { x: 34, y: y0 + panelH + 26, w: 1092, h: mini ? 100 : 132 };
  return [
    drawDreamZeroTrainingPanel(left, diagram, mini, ids),
    drawDreamZeroInferencePanel(right, diagram, mini, ids),
    gallery ? "" : drawTrainingBand(diagram, trainingBox, left, right, mini, ids),
    gallery || mini ? "" : drawRuntimeStrip(diagram.runtime, right, right, trainingBox)
  ].join("");
}

function drawDreamZeroTrainingPanel(box, diagram, mini, ids) {
  const compact = mini;
  const videoY = box.y + (compact ? 66 : 80);
  const actionY = box.y + (compact ? 137 : 164);
  const stateY = box.y + (compact ? 208 : 248);
  const core = { x: box.x + 282, y: box.y + (compact ? 52 : 62), w: 174, h: compact ? 186 : 226 };
  const encoderX = box.x + 90;
  const noiseX = box.x + 194;
  const outputX = box.x + 474;
  return `
    <g class="dreamzero-panel dreamzero-training">
      <rect class="sequence-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 16}" y="${box.y + 24}">training · joint video-action flow matching</text>
      <text class="core-detail" x="${box.x + 16}" y="${box.y + 42}">separate video/action noise · shared causal DiT · teacher forcing</text>

      ${drawFrameStackGlyph("video frames", box.x + 18, videoY - 22, 54, 42, true)}
      ${drawDreamZeroModule(encoderX, videoY - 25, 82, 50, "VAE Encoder", "visual")}
      ${drawDreamZeroNoise(noiseX, videoY - 23, "video + noise", "future")}
      ${drawConnector(box.x + 72, videoY, encoderX, videoY, "", false, ids)}
      ${drawConnector(encoderX + 82, videoY, noiseX, videoY, "", false, ids)}
      ${drawConnector(noiseX + 70, videoY, core.x, videoY, "", false, ids)}

      ${drawActionGlyph(box.x + 18, actionY - 20, 54, 40)}
      ${drawDreamZeroModule(encoderX, actionY - 25, 82, 50, "Action Encoder", "action")}
      ${drawDreamZeroNoise(noiseX, actionY - 23, "action + noise", "action")}
      ${drawConnector(box.x + 72, actionY, encoderX, actionY, "", false, ids)}
      ${drawConnector(encoderX + 82, actionY, noiseX, actionY, "", false, ids)}
      ${drawConnector(noiseX + 70, actionY, core.x, actionY, "", false, ids)}

      ${drawDreamZeroModule(box.x + 18, stateY - 25, 154, 50, "State + Text Encoder", "state")}
      ${drawConnector(box.x + 172, stateY, core.x + 36, core.y + core.h, "proprio + language", false, ids)}

      <g filter="url(#${ids.softShadow})">
        <rect class="core-panel" x="${core.x}" y="${core.y}" width="${core.w}" height="${core.h}" fill="url(#${ids.coreGrad})"></rect>
        <title>${escapeHtml(diagram.core.label)}</title>
        ${drawWrappedText("Joint Video-Action Causal DiT", core.x + 16, core.y + 26, 22, 2, "core-title", 13)}
        ${drawCoreVisual("dit", core.x + 42, core.y + 70, core.w - 84, compact ? 70 : 92, { autoregressive: true, diffusion: true })}
        <text class="core-note" x="${core.x + 22}" y="${core.y + core.h - 24}">clean previous chunks condition the current chunk</text>
      </g>
      ${drawDreamZeroNoise(outputX, videoY - 23, "video velocity", "future")}
      ${drawDreamZeroNoise(outputX, actionY - 23, "action velocity", "action")}
      ${drawConnector(core.x + core.w, videoY, outputX, videoY, "", false, ids)}
      ${drawConnector(core.x + core.w, actionY, outputX, actionY, "", false, ids)}
      <text class="core-note" x="${outputX - 2}" y="${stateY + 5}">joint loss</text>
    </g>
  `;
}

function drawDreamZeroInferencePanel(box, diagram, mini, ids) {
  const compact = mini;
  const videoY = box.y + (compact ? 78 : 92);
  const actionY = box.y + (compact ? 170 : 194);
  const conditionY = box.y + (compact ? 228 : 270);
  const core = { x: box.x + 210, y: box.y + (compact ? 50 : 60), w: 174, h: compact ? 190 : 224 };
  const encoderX = box.x + 104;
  const decoderX = box.x + 398;
  const outputX = box.x + 482;
  const feedbackY = box.y + box.h - 16;
  return `
    <g class="dreamzero-panel dreamzero-inference">
      <rect class="sequence-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 16}" y="${box.y + 24}">inference · closed-loop real-world execution</text>
      <text class="core-detail" x="${box.x + 16}" y="${box.y + 42}">autoregressive flow sampling · KV cache · asynchronous action execution</text>

      ${drawFrameStackGlyph("past real frames", box.x + 18, videoY - 22, 56, 42, true)}
      ${drawDreamZeroModule(encoderX, videoY - 25, 84, 50, "VAE Encoder", "visual")}
      ${drawConnector(box.x + 74, videoY, encoderX, videoY, "", false, ids)}
      ${drawConnector(encoderX + 84, videoY, core.x, videoY, "", false, ids)}

      ${drawDreamZeroModule(box.x + 18, conditionY - 25, 154, 50, "State + Text Encoder", "state")}
      ${drawConnector(box.x + 172, conditionY, core.x + 44, core.y + core.h, "condition", false, ids)}

      <g filter="url(#${ids.softShadow})">
        <rect class="core-panel" x="${core.x}" y="${core.y}" width="${core.w}" height="${core.h}" fill="url(#${ids.coreGrad})"></rect>
        <title>${escapeHtml(diagram.core.label)}</title>
        ${drawWrappedText("Joint Video-Action Causal DiT", core.x + 16, core.y + 26, 22, 2, "core-title", 13)}
        ${drawCoreVisual("dit", core.x + 42, core.y + 66, core.w - 84, compact ? 66 : 82, { autoregressive: true, diffusion: true })}
        <rect class="attention-badge" x="${core.x + 36}" y="${core.y + core.h - 52}" width="${core.w - 72}" height="28"></rect>
        <text class="attention-text" x="${core.x + core.w / 2}" y="${core.y + core.h - 34}" text-anchor="middle">KV cache</text>
      </g>

      ${drawDreamZeroModule(decoderX, videoY - 25, 76, 50, "VAE Decoder", "future")}
      ${drawFrameStackGlyph("future frames", outputX, videoY - 21, 42, 40, true)}
      ${drawConnector(core.x + core.w, videoY, decoderX, videoY, "", false, ids)}
      ${drawConnector(decoderX + 76, videoY, outputX, videoY, "", false, ids)}

      ${drawDreamZeroModule(decoderX, actionY - 25, 76, 50, "Action Decoder", "action")}
      ${drawActionGlyph(outputX, actionY - 19, 42, 38)}
      ${drawConnector(core.x + core.w, actionY, decoderX, actionY, "", false, ids)}
      ${drawConnector(decoderX + 76, actionY, outputX, actionY, "", false, ids)}
      <text class="core-note" x="${decoderX + 2}" y="${actionY + 39}">async execution</text>

      <path class="dashed-flow" d="M ${outputX + 22} ${actionY + 25} L ${outputX + 22} ${feedbackY} L ${box.x + 12} ${feedbackY} L ${box.x + 12} ${videoY}" marker-end="url(#${ids.arrow})"></path>
      <text class="edge-label" x="${box.x + box.w / 2}" y="${feedbackY - 5}" text-anchor="middle">update the KV cache with the next real observation</text>
    </g>
  `;
}

function drawDreamZeroModule(x, y, w, h, label, kind) {
  const palette = {
    visual: ["#edf5fb", "#78a7d3"],
    future: ["#e9f6f7", "#4f9ca5"],
    action: ["#fff5e7", "#d49a3d"],
    state: ["#eef7ed", "#72a36e"]
  }[kind] || ["#f3f5f6", "#8b979d"];
  return `
    <g>
      <title>${escapeHtml(label)}</title>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${palette[0]}" stroke="${palette[1]}" stroke-width="1.4"></rect>
      ${drawWrappedText(label, x + 8, y + 20, Math.max(10, Math.floor(w / 7)), 2, "block-title", 11)}
    </g>
  `;
}

function drawDreamZeroNoise(x, y, label, kind) {
  const color = kind === "action" ? "#d49a3d" : "#4f9ca5";
  return `
    <g>
      <rect class="noise-step" x="${x}" y="${y}" width="70" height="46" rx="7"></rect>
      <path d="M ${x + 10} ${y + 31} C ${x + 22} ${y + 8}, ${x + 36} ${y + 40}, ${x + 58} ${y + 15}" fill="none" stroke="${color}" stroke-width="1.5"></path>
      <text class="core-note" x="${x + 35}" y="${y + 42}" text-anchor="middle">${escapeHtml(shortText(label, 15))}</text>
    </g>
  `;
}

function drawStandardArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const unifiedDirect = diagram.pattern === "unified";
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const coreH = standardCoreHeight(diagram, mini);
  const inputBox = { x: 34, y: y0, w: 132, h };
  const encoderBox = { x: 200, y: y0, w: 184, h };
  const coreBox = { x: 432, y: y0 + (h - coreH) / 2, w: 304, h: coreH };
  const headBox = unifiedDirect ? { x: 0, y: y0, w: 0, h } : { x: 782, y: y0, w: 184, h };
  const outputBox = unifiedDirect ? { x: 910, y: y0, w: 132, h } : { x: 1020, y: y0, w: 106, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  const inputs = denseTokenRows(diagram.inputs, inputBox, mini);
  const outputs = denseOutputRows(diagram.outputs, outputBox, mini);
  const encoders = denseEncoderRows(diagram.encoders, encoderBox, mini, inputs);
  const heads = unifiedDirect ? [] : denseHeadRows(diagram.heads, headBox, mini, outputs);
  return [
    drawFittedColumnShell(inputBox, inputs),
    drawColumnLabel(encoderBox, "encoders"),
    drawStandardCorePanel(diagram, coreBox, mini, ids),
    heads.length ? drawColumnLabel(headBox, "heads") : "",
    drawFittedColumnShell(outputBox, outputs),
    drawSankeyRibbons(diagram, [inputBox, encoderBox, coreBox, headBox, outputBox], ids, mini, { inputs, encoders, heads, outputs, directOutputs: unifiedDirect }),
    drawDenseTokenRows(inputs, mini),
    drawDenseEncoderRows(encoders, mini),
    drawDenseHeadRows(heads, mini),
    drawDenseOutputRows(outputs, mini),
    showTraining ? drawTrainingBand(diagram, trainBox, coreBox, unifiedDirect ? outputBox : headBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
  ].join("");
}

function standardCoreHeight(diagram, mini) {
  if (diagram.pattern === "unified") return mini ? 198 : 224;
  if (diagram.pattern === "multi_stream") {
    const count = Math.max(2, Math.min(diagram.streams.length || 2, mini ? 4 : 5));
    return mini ? 92 + count * 48 : 100 + count * 54;
  }
  if (diagram.pattern === "implicit_future") return mini ? 230 : 270;
  if (diagram.pattern === "joint_latent") return mini ? 198 : 224;
  if (diagram.pattern === "latent_action") return mini ? 226 : 268;
  if (diagram.pattern === "encoder_only") return mini ? 226 : 270;
  if (diagram.pattern === "alignment") return mini ? 226 : 266;
  return mini ? 228 : 270;
}

function drawStandardCorePanel(diagram, box, mini, ids) {
  if (diagram.pattern === "encoder_only") return drawEncoderOnlyCore(box, diagram, mini, ids);
  if (diagram.pattern === "unified") return drawUnifiedCore(box, diagram, mini, ids);
  if (diagram.pattern === "multi_stream") return drawParallelStreams(box, diagram, mini, ids);
  if (diagram.pattern === "joint_latent") return drawJointLatentSequenceCore(box, diagram, mini, ids);
  if (diagram.pattern === "latent_action") return drawLatentActionCodebook(box, diagram, mini);
  if (["pixel_idm", "latent_idm"].includes(diagram.pattern)) return drawFuturePredictor(box, diagram, mini, ids);
  if (diagram.pattern === "implicit_future") return drawImplicitFutureRepresentation(box, diagram, mini, ids);
  if (diagram.pattern === "alignment") return drawAlignmentCore(box, diagram, mini, ids);
  return drawCorePanel(diagram, box, mini, ids);
}

function diagramLayoutY(options) {
  return options.mini ? 22 : 34;
}

function diagramMainHeight(options) {
  return options.mini ? 270 : 330;
}

function drawUnifiedArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 188, h };
  const encoderBox = { x: 250, y: y0, w: 160, h };
  const sequenceBox = { x: 438, y: y0 + 18, w: 178, h: h - 36 };
  const coreBox = { x: 650, y: y0, w: 256, h };
  const outputBox = { x: 948, y: y0, w: 178, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "typed input streams", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "vision / text encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawUnifiedSequence(sequenceBox, diagram, mini),
    drawUnifiedCore(coreBox, diagram, mini, ids),
    drawUnifiedOutputs(outputBox, diagram, mini, ids),
    drawTypedFlow(inputBox, encoderBox, "visual", ids, 0.34, 0.34, "encode"),
    drawTypedFlow(inputBox, encoderBox, "language", ids, 0.5, 0.5, ""),
    drawTypedFlow(inputBox, encoderBox, "action", ids, 0.66, 0.66, ""),
    drawTypedFlow(encoderBox, sequenceBox, "visual", ids, 0.36, 0.36, "pack"),
    drawTypedFlow(encoderBox, sequenceBox, "action", ids, 0.62, 0.62, ""),
    drawTypedFlow(sequenceBox, coreBox, "future", ids, 0.5, 0.5, "shared sequence"),
    drawTypedFlow(coreBox, outputBox, "future", ids, 0.36, 0.32, "obs head"),
    drawTypedFlow(coreBox, outputBox, "action", ids, 0.64, 0.68, "action head"),
    showTraining ? drawTrainingBand(diagram, trainBox, coreBox, outputBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
  ].join("");
}

function drawUnifiedSequence(box, diagram, mini) {
  const groups = diagram.inputs.slice(0, mini ? 4 : 5);
  const tokenKinds = groups.length ? groups : [
    { kind: "visual", label: "obs" },
    { kind: "action", label: "act" },
    { kind: "noise", label: "future" }
  ];
  const colors = { visual: "#5d8fc5", language: "#9874b8", state: "#72a36e", action: "#d49a3d", noise: "#a9b1b8" };
  const rows = tokenKinds.map((group, row) => {
    const y = box.y + 54 + row * (mini ? 36 : 42);
    const cells = Array.from({ length: 8 }, (_, i) => `
      <rect class="sequence-token" x="${box.x + 28 + i * 19}" y="${y}" width="14" height="18" fill="${colors[group.kind] || colors.visual}"></rect>
    `).join("");
    return `
      <g>
        <text class="stream-label" x="${box.x + 18}" y="${y - 8}">${escapeHtml(shortText(group.label, 18))}</text>
        ${cells}
      </g>
    `;
  }).join("");
  const attentionLink = tokenKinds.length > 1 ? `
    <path class="stream-attention-link" d="M ${box.x + box.w - 28} ${box.y + 64} C ${box.x + box.w + 12} ${box.y + box.h * 0.36}, ${box.x + box.w + 12} ${box.y + box.h * 0.66}, ${box.x + box.w - 28} ${box.y + box.h - 42}"></path>
    <text class="attention-text" x="${box.x + box.w - 78}" y="${box.y + box.h - 18}">joint attention</text>
  ` : "";
  return `
    <g>
      <rect class="sequence-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">one interleaved token sequence</text>
      ${rows}
      ${attentionLink}
    </g>
  `;
}

function drawUnifiedCore(box, diagram, mini, ids) {
  const visualY = box.y + (mini ? 58 : 62);
  const visualH = mini ? 106 : 124;
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel unified-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 50, 32, 1, "core-detail", 11)}
      ${drawUnifiedStreamCore(box.x + 20, visualY, box.w - 40, visualH, diagram, mini)}
      ${drawUnifiedModeBadges(diagram, box, mini)}
    </g>
  `;
}

function drawJointLatentSequenceCore(box, diagram, mini, ids) {
  const visualH = Math.min(mini ? 92 : 108, box.h - 116);
  const visualY = box.y + (mini ? 60 : 62);
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel unified-core joint-latent-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 50, 32, 1, "core-detail", 11)}
      ${drawCoreVisual(diagram.core.kind, box.x + 42, visualY, box.w - 84, visualH, { autoregressive: isAutoregressiveDiagram(diagram) })}
      ${drawCompactAttentionBadges(diagram.attention, box, mini)}
    </g>
  `;
}

function drawUnifiedStreamCore(x, y, w, h, diagram, mini) {
  const ar = isAutoregressiveDiagram(diagram);
  const diffusion = !ar && (diagram.motifs?.diffusion || /diffusion|denois|flow|dit/i.test(`${diagram.core?.label || ""} ${diagram.core?.details?.join(" ") || ""}`));
  const block = { x: x + w * 0.2, y: y + h * 0.25, w: w * 0.6, h: h * 0.5 };
  const topY = y + 8;
  const bottomY = y + h - 28;
  const vocab = unifiedStreamVocabulary(diagram);
  const arTokens = ["o", "p", "a", "o", "p", "a", "f"];
  const denoiseTokens = vocab.some(([letter]) => letter === "v") ? ["o", "p", "n", "f", "a", "v"] : ["o", "p", "n", "f", "a"];
  const denoiseTargets = vocab.some(([letter]) => letter === "v") ? ["f", "a", "f", "a", "v"] : ["f", "a", "f", "a"];
  const top = unifiedStreamTokens(x + 10, topY, w - 20, ar ? arTokens : denoiseTokens, "context");
  const bottom = unifiedStreamTokens(x + 18, bottomY, w - 36, ar ? arTokens : denoiseTargets, "target");
  const causal = ar ? `<path class="unified-causal-sweep" d="M ${x + 24} ${topY + 27} C ${x + w * 0.26} ${topY + 46}, ${x + w * 0.52} ${topY + 46}, ${x + w - 26} ${topY + 22}"></path>` : "";
  const loop = diffusion && !["dit", "diffusion"].includes(diagram.core?.kind)
    ? drawDiffusionLoop(block.x + block.w + 26, block.y + block.h * 0.5, 42, 34)
    : "";
  return `
    <g class="unified-stream-core">
      <rect class="unified-stream-shell" x="${x}" y="${y}" width="${w}" height="${h}"></rect>
      ${top}
      <g class="unified-core-block">
        ${drawCoreVisual(diagram.core.kind, block.x, block.y, block.w, block.h, { autoregressive: ar, diffusion, expanded: ar })}
        ${causal}
        ${loop}
      </g>
      ${bottom}
    </g>
  `;
}

function drawGlobalUnifiedTokenLegend(diagram, view, options = {}) {
  if (diagram.pattern !== "unified") return "";
  const mini = Boolean(options.mini);
  return drawUnifiedTokenLegend(diagram, view.w - (mini ? 92 : 110), mini ? 18 : 38, mini);
}

function unifiedStreamVocabulary(diagram) {
  const ar = isAutoregressiveDiagram(diagram);
  if (ar) {
    return [
      ["o", "obs", "visual"],
      ["p", "proprio", "state"],
      ["a", "action", "action"],
      ["f", "future", "future"]
    ];
  }
  const text = [
    diagram.core?.label,
    ...(diagram.core?.details || []),
    ...(diagram.inputs || []).map((item) => `${item.label || ""} ${item.detail || ""}`),
    ...(diagram.outputs || []).map((item) => `${item.label || ""} ${item.detail || ""}`)
  ].join(" ").toLowerCase();
  const entries = [
    ["o", "obs", "visual"],
    ["p", "proprio", "state"],
    ["n", "noise", "noise"],
    ["f", "future", "future"],
    ["a", "action", "action"]
  ];
  if (/value|reward|score/.test(text)) entries.push(["v", "value", "future"]);
  return entries;
}

function drawUnifiedTokenLegend(diagram, x, y, mini) {
  const entries = unifiedStreamVocabulary(diagram);
  const visible = entries.slice(0, mini ? 4 : 6);
  const gap = mini ? 3 : 4;
  const parts = visible.map((entry, index) => {
    const [letter, label, kind] = entry;
    const ix = x;
    const iy = y + index * (mini ? 14 : 16);
    return `
      <g class="unified-token-legend-item">
        <rect class="unified-stream-token ${kind}" x="${ix}" y="${iy}" width="13" height="13"></rect>
        <text class="legend-letter" x="${ix + 6.5}" y="${iy + 9.5}" text-anchor="middle">${escapeHtml(letter)}</text>
        <text class="legend-label" x="${ix + 17}" y="${iy + 9.5}">${escapeHtml(label)}</text>
      </g>
    `;
  }).join("");
  return `<g class="unified-token-legend">${parts}</g>`;
}

function unifiedStreamTokens(x, y, w, items, role) {
  const gap = 7;
  const tokenW = Math.min(28, (w - gap * (items.length - 1)) / items.length);
  const total = items.length * tokenW + (items.length - 1) * gap;
  const x0 = x + (w - total) / 2;
  return `
    <g class="unified-stream-tokens ${role}">
      ${items.map((item, index) => {
        const tx = x0 + index * (tokenW + gap);
        const kind = item === "a" ? "action" : item === "p" ? "state" : item === "n" ? "noise" : item === "v" || item === "f" ? "future" : "visual";
        return `
          <rect class="unified-stream-token ${kind}" x="${tx}" y="${y}" width="${tokenW}" height="18"></rect>
          <text x="${tx + tokenW / 2}" y="${y + 12.5}" text-anchor="middle">${escapeHtml(item)}</text>
        `;
      }).join("")}
    </g>
  `;
}

function drawUnifiedModeBadges(diagram, box, mini) {
  const badges = [
    "direct tokens",
    "no heads",
    isAutoregressiveDiagram(diagram) ? "AR order" : "",
    diagram.motifs?.diffusion ? "noise targets" : "",
    ...(diagram.attention || []).filter((badge) => !/causal mask|leakage mask/i.test(badge)).slice(0, 2).map(compactAttentionLabel)
  ].filter(Boolean);
  const visibleBadges = uniqueByText(badges, "value").slice(0, 3);
  const chipW = mini ? 72 : 78;
  const gap = 10;
  const totalW = visibleBadges.length * chipW + Math.max(0, visibleBadges.length - 1) * gap;
  const x0 = box.x + (box.w - totalW) / 2;
  const y = box.y + box.h - (mini ? 29 : 31);
  return visibleBadges.map((badge, index) => {
    const x = x0 + index * (chipW + gap);
    return `
      <rect class="attention-badge compact-attention-badge" x="${x}" y="${y}" width="${chipW}" height="20"></rect>
      <text class="attention-text" x="${x + chipW / 2}" y="${y + 14}" text-anchor="middle">${escapeHtml(badge)}</text>
    `;
  }).join("");
}

function drawCompactAttentionBadges(badges, box, mini) {
  const visibleBadges = (badges || []).filter((badge) => !/causal mask|leakage mask/i.test(badge)).slice(0, 3);
  const chipW = mini ? 72 : 78;
  const gap = 10;
  const totalW = visibleBadges.length * chipW + Math.max(0, visibleBadges.length - 1) * gap;
  const x0 = box.x + (box.w - totalW) / 2;
  const y = box.y + box.h - (mini ? 30 : 32);
  return visibleBadges.map((badge, index) => {
    const x = x0 + index * (chipW + gap);
    const label = compactAttentionLabel(badge);
    return `
      <rect class="attention-badge compact-attention-badge" x="${x}" y="${y}" width="${chipW}" height="20"></rect>
      <text class="attention-text" x="${x + chipW / 2}" y="${y + 14}" text-anchor="middle">${escapeHtml(label)}</text>
    `;
  }).join("");
}

function compactAttentionLabel(badge) {
  const text = String(badge || "").toLowerCase();
  if (/cache|memory/.test(text)) return "cache";
  if (/async/.test(text)) return "async";
  if (/cross/.test(text)) return "cross-attn";
  if (/self/.test(text) && /joint/.test(text)) return "joint attn";
  if (/shared/.test(text)) return "shared attn";
  if (/bidirectional|bi-directional/.test(text)) return "bi-dir";
  if (/causal/.test(text)) return "causal";
  if (/language/.test(text)) return "lang attn";
  return shortText(String(badge || ""), 12).replace(/\.{3,}$/, "");
}

function drawUnifiedOutputs(box, diagram, mini, ids) {
  const headMode = unifiedHeadMode(diagram);
  const outputs = headMode === "unified"
    ? uniqueByText([{ label: "Unified Token Head", detail: "one decoder emits obs/action tokens" }, ...diagram.outputs], "label").slice(0, mini ? 3 : 4)
    : uniqueByText([
      { label: "Observation / Future Head", detail: "visual, latent or video tokens" },
      { label: "Action Head", detail: "control chunk tokens" },
      ...diagram.outputs
    ], "label").slice(0, mini ? 3 : 4);
  const itemH = mini ? 44 : 50;
  return `
    <g>
      <rect class="diagram-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">heads</text>
      <rect class="head-split-badge" x="${box.x + 18}" y="${box.y + 36}" width="${box.w - 36}" height="24"></rect>
      <text class="head-split-text" x="${box.x + box.w / 2}" y="${box.y + 52}" text-anchor="middle">${headMode === "unified" ? "obs + action emitted together" : "observation and action split"}</text>
      ${outputs.map((output, index) => {
        const y = box.y + 72 + index * (itemH + 8);
        return `
          <g class="diagram-node">
            <rect class="${/action/i.test(output.label) ? "action-output" : "output-block"}" x="${box.x + 18}" y="${y}" width="${box.w - 36}" height="${itemH}"></rect>
            <text class="output-label" x="${box.x + 30}" y="${y + 18}">${escapeHtml(shortText(output.label, 19))}</text>
            ${drawWrappedText(output.detail, box.x + 30, y + 35, 18, 1, "output-detail", 10)}
          </g>
        `;
      }).join("")}
    </g>
  `;
}

function drawMultiStreamArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 178, h };
  const encoderBox = { x: 238, y: y0, w: 160, h };
  const streamBox = { x: 426, y: y0, w: 418, h };
  const headBox = { x: 892, y: y0, w: 234, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "stream inputs", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "per-modality encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawParallelStreams(streamBox, diagram, mini, ids),
    drawColumnPanel(headBox, "heads", drawHeadStack([...diagram.heads, ...diagram.outputs].slice(0, mini ? 4 : 5), headBox, mini)),
    drawTypedFlow(inputBox, encoderBox, "visual", ids, 0.34, 0.34, "encode"),
    drawTypedFlow(inputBox, encoderBox, "language", ids, 0.5, 0.5, ""),
    drawTypedFlow(inputBox, encoderBox, "action", ids, 0.66, 0.66, ""),
    drawTypedFlow(encoderBox, streamBox, "visual", ids, 0.36, 0.35, "route"),
    drawTypedFlow(encoderBox, streamBox, "action", ids, 0.64, 0.65, ""),
    drawTypedFlow(streamBox, headBox, "future", ids, 0.5, 0.5, "fuse"),
    showTraining ? drawTrainingBand(diagram, trainBox, streamBox, headBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, streamBox, headBox, trainBox)
  ].join("");
}

function drawParallelStreams(box, diagram, mini, ids) {
  const streams = diagram.streams.length ? diagram.streams : [
    { label: "Video stream", detail: "world tokens", color: "#4c78a8" },
    { label: "Action stream", detail: "policy tokens", color: "#d08a2e" }
  ];
  const visible = streams.slice(0, mini ? 4 : 5);
  const laneH = Math.min(mini ? 58 : 68, (box.h - 76) / Math.max(visible.length, 1) - 8);
  const laneGap = 12;
  const lanes = visible.map((stream, index) => {
    const y = box.y + 58 + index * (laneH + laneGap);
    const kind = streamCoreKind(stream, diagram);
    return `
      <g>
        <rect class="stream-lane" x="${box.x + 22}" y="${y}" width="${box.w - 46}" height="${laneH}" style="--stream:${stream.color}"></rect>
        ${drawCoreVisual(kind, box.x + 36, y + 9, box.w - 92, laneH - 18, { autoregressive: isAutoregressiveDiagram(diagram) })}
        <text class="stream-label" x="${box.x + 46}" y="${y + laneH - 8}">${escapeHtml(shortText(stream.label, 24))}</text>
      </g>
    `;
  }).join("");
  const sharedMarkers = drawSharedAttentionMarkers(box, visible, laneH, laneGap, mini);
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${lanes}
      ${sharedMarkers}
    </g>
  `;
}

function drawSharedAttentionMarkers(box, visible, laneH, laneGap, mini) {
  if (visible.length < 2) return "";
  const groups = sharedAttentionGroups(visible);
  return groups.map((group, groupIndex) => {
    const x = box.x + box.w - 56 - groupIndex * 22;
    const firstY = box.y + 58 + group.start * (laneH + laneGap) + 8;
    const lastY = box.y + 58 + group.end * (laneH + laneGap) + laneH - 8;
    const labelY = Math.min(box.y + box.h - 18, lastY + (mini ? 15 : 18) + groupIndex * 3);
    return `
      <g class="shared-attention-marker">
        <path d="M ${x} ${firstY} L ${x} ${lastY}"></path>
        <text x="${x - 8}" y="${labelY}" text-anchor="middle">shared attention</text>
      </g>
    `;
  }).join("");
}

function sharedAttentionGroups(visible) {
  return [{ start: 0, end: visible.length - 1 }];
}

function streamCoreKind(stream, diagram) {
  const streamText = `${stream.label || ""} ${stream.detail || ""}`.toLowerCase();
  const coreText = `${diagram.core.label || ""} ${diagram.core.details.join(" ")}`.toLowerCase();
  const text = `${streamText} ${coreText}`;
  if (/\bact\b|act-vae|act style|act-style/.test(streamText)) return "act";
  if (/\bdit\b|diffusion transformer|mm-dit/.test(text)) return "dit";
  if (/diffusion|denois|flow/.test(text)) return "diffusion";
  if (/cnn|u-net|unet/.test(text)) return "cnn";
  if (/mlp|linear/.test(text)) return "mlp";
  return "transformer";
}

function drawJointLatentArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const latent = { x: 456, y: y0 + 38, w: 286, h: h - 76 };
  const leftBox = { x: 34, y: y0, w: 258, h };
  const rightBox = { x: 886, y: y0, w: 240, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(leftBox, "inputs + encoders", drawInputEncoderStack(diagram, leftBox, mini)),
    drawLatentManifold(latent, diagram, mini, ids),
    drawColumnPanel(rightBox, "heads", drawOutputStack([...diagram.outputs, ...diagram.heads].slice(0, mini ? 4 : 5), rightBox, mini)),
    drawConnector(leftBox.x + leftBox.w, leftBox.y + h * 0.42, latent.x, latent.y + latent.h * 0.44, "embed", false, ids),
    drawConnector(latent.x + latent.w, latent.y + latent.h * 0.44, rightBox.x, rightBox.y + h * 0.42, "decode", false, ids),
    drawConnector(rightBox.x, rightBox.y + h * 0.66, latent.x + latent.w, latent.y + latent.h * 0.66, "align", true, ids),
    showTraining ? drawTrainingBand(diagram, trainBox, latent, rightBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, latent, rightBox, trainBox)
  ].join("");
}

function drawLatentManifold(box, diagram, mini, ids) {
  const nodes = [
    ["obs z", box.x + box.w * 0.35, box.y + box.h * 0.26, "#5d8fc5"],
    ["action z", box.x + box.w * 0.66, box.y + box.h * 0.32, "#d49a3d"],
    ["future z", box.x + box.w * 0.50, box.y + box.h * 0.58, "#72a36e"],
    ["goal z", box.x + box.w * 0.35, box.y + box.h * 0.76, "#9874b8"]
  ].slice(0, mini ? 3 : 4);
  return `
    <g filter="url(#${ids.softShadow})">
      <ellipse class="latent-space" cx="${box.x + box.w / 2}" cy="${box.y + box.h / 2}" rx="${box.w / 2}" ry="${box.h / 2}"></ellipse>
      <title>${escapeHtml(diagram.core.label)}</title>
      <text class="core-title" x="${box.x + box.w / 2}" y="${box.y + 30}" text-anchor="middle">${escapeHtml(shortText(diagram.core.label, 38))}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 40, box.y + 52, 32, 2, "core-detail", 11)}
      ${nodes.map(([label, x, y, color], index) => `
        <g>
          <circle class="latent-node" cx="${x}" cy="${y}" r="${mini ? 20 : 24}" fill="${color}"></circle>
          <text class="latent-label" x="${x}" y="${y + 4}" text-anchor="middle">${escapeHtml(label)}</text>
          ${index ? `<path class="dashed-flow" d="M ${nodes[0][1]} ${nodes[0][2]} C ${box.x + box.w / 2} ${box.y + box.h / 2}, ${box.x + box.w / 2} ${box.y + box.h / 2}, ${x} ${y}" marker-end="url(#${ids.arrow})"></path>` : ""}
        </g>
      `).join("")}
    </g>
  `;
}

function drawLatentActionArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const videoBox = { x: 34, y: y0, w: 240, h };
  const codeBox = { x: 330, y: y0 + 18, w: 250, h: h - 36 };
  const policyBox = { x: 642, y: y0, w: 250, h };
  const outputBox = { x: 940, y: y0, w: 186, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(videoBox, "evidence + encoders", drawInputEncoderStack(diagram, videoBox, mini)),
    drawLatentActionCodebook(codeBox, diagram, mini),
    drawPolicyGrounding(policyBox, diagram, mini, ids),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(videoBox.x + videoBox.w, videoBox.y + h * 0.42, codeBox.x, codeBox.y + codeBox.h * 0.42, "infer code", false, ids),
    drawConnector(codeBox.x + codeBox.w, codeBox.y + codeBox.h * 0.5, policyBox.x, policyBox.y + h * 0.5, "condition", false, ids),
    drawConnector(policyBox.x + policyBox.w, policyBox.y + h * 0.48, outputBox.x, outputBox.y + h * 0.48, "decode", false, ids),
    showTraining ? drawTrainingBand(diagram, trainBox, codeBox, policyBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, policyBox, outputBox, trainBox)
  ].join("");
}

function drawLatentActionCodebook(box, diagram, mini) {
  const cells = Array.from({ length: mini ? 18 : 28 }, (_, index) => {
    const col = index % 7;
    const row = Math.floor(index / 7);
    return `<rect class="codebook-cell" x="${box.x + 36 + col * 24}" y="${box.y + 82 + row * 24}" width="17" height="17"></rect>`;
  }).join("");
  return `
    <g>
      <rect class="codebook-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <title>${escapeHtml(diagram.core.label)}</title>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(shortText(diagram.core.label, 30))}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 52, 28, 2, "core-detail", 11)}
      ${cells}
      <text class="core-note" x="${box.x + 32}" y="${box.y + box.h - 24}">discrete / continuous action code</text>
    </g>
  `;
}

function drawPolicyGrounding(box, diagram, mini, ids) {
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawEncoderStack(diagram.encoders.slice(0, mini ? 3 : 4), { x: box.x + 8, y: box.y + 26, w: box.w - 16, h: box.h - 40 }, mini)}
      <rect class="action-head-large" x="${box.x + 34}" y="${box.y + box.h - 82}" width="${box.w - 68}" height="48"></rect>
      <text class="output-label" x="${box.x + box.w / 2}" y="${box.y + box.h - 53}" text-anchor="middle">policy grounding head</text>
    </g>
  `;
}

function drawFutureIdmArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const futureH = futurePredictorHeight(diagram, mini);
  const inputBox = { x: 34, y: y0, w: 132, h };
  const encoderBox = { x: 194, y: y0, w: 166, h };
  const futureBox = { x: 396, y: y0 + (h - futureH) / 2, w: 292, h: futureH };
  const idmBox = { x: 724, y: y0, w: 174, h };
  const outputBox = { x: 934, y: y0, w: 130, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  const inputs = denseTokenRows(diagram.inputs, inputBox, mini);
  const outputs = denseOutputRows(idmActionOutputs(diagram), outputBox, mini);
  const encoders = denseEncoderRows(diagram.encoders, encoderBox, mini, inputs);
  const idmHeads = denseHeadRows(idmHeadRows(diagram), idmBox, mini, outputs);
  return [
    drawFittedColumnShell(inputBox, inputs),
    drawColumnLabel(encoderBox, "encoders"),
    drawFuturePredictor(futureBox, diagram, mini, ids),
    drawColumnLabel(idmBox, "heads"),
    drawFittedColumnShell(outputBox, outputs),
    drawFutureIdmSankey(diagram, inputBox, encoderBox, futureBox, idmBox, outputBox, ids, mini, { inputs, encoders, idmHeads, outputs }),
    drawDenseTokenRows(inputs, mini),
    drawDenseEncoderRows(encoders, mini),
    drawDenseHeadRows(idmHeads, mini),
    drawDenseOutputRows(outputs, mini),
    showTraining ? drawTrainingBand(diagram, trainBox, futureBox, idmBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, idmBox, outputBox, trainBox)
  ].join("");
}

function drawFutureIdmSankey(diagram, inputBox, encoderBox, futureBox, idmBox, outputBox, ids, mini, rows = {}) {
  const visualTrack = { kind: "visual" };
  const languageTrack = { kind: "language" };
  const futureTrack = { kind: "future" };
  const actionTrack = { kind: "action" };
  const inputRoutes = buildInputEncoderRoutes(rows.inputs || [], rows.encoders || []);
  const visualEncoderY = routeYForKind(rows.encoders || [], "visual") ?? futureBox.y + futureBox.h * 0.36;
  const languageEncoderY = routeYForKind(rows.encoders || [], "language") ?? futureBox.y + futureBox.h * 0.49;
  const idmY = rows.idmHeads?.[0]?.centerY ?? idmBox.y + idmBox.h * 0.5;
  const outputAnchor = routeAnchorForKind(rows.outputs || [], "action", "left") || { x: outputBox.x + outputBox.w - 8, y: outputBox.y + outputBox.h * 0.5 };
  const futureIn = futureBox.x - 10;
  const futureOut = futureBox.x + futureBox.w + 10;
  const idmIn = idmBox.x - 10;
  const idmOut = idmBox.x + idmBox.w + 10;
  return `
    <g class="sankey-layer idm-sankey-layer">
      ${inputRoutes.map((route) => drawSankeyRibbon(route.track, [
        [route.input.rightAnchor.x, route.input.rightAnchor.y],
        [route.input.rightAnchor.x + 14, route.input.rightAnchor.y],
        [route.encoder.x - 10, route.encoder.centerY],
        [route.encoder.x + route.encoder.w * 0.42, route.encoder.centerY]
      ], ids, "input-to-encoder", route.width)).join("")}
      ${drawSankeyRibbon(visualTrack, [
        [encoderBox.x + encoderBox.w - 10, visualEncoderY],
        [encoderBox.x + encoderBox.w + 22, visualEncoderY],
        [futureIn, futureBox.y + futureBox.h * 0.38]
      ], ids, "encoder-to-future", mini ? 13 : 16)}
      ${streamPresent("language", diagram) ? drawSankeyRibbon(languageTrack, [
        [encoderBox.x + encoderBox.w - 10, languageEncoderY],
        [encoderBox.x + encoderBox.w + 22, languageEncoderY],
        [futureIn, futureBox.y + futureBox.h * 0.5]
      ], ids, "encoder-to-future", mini ? 10 : 13) : ""}
      ${drawSankeyRibbon(futureTrack, [
        [futureOut, futureBox.y + futureBox.h * 0.5],
        [futureOut + 36, futureBox.y + futureBox.h * 0.5],
        [idmIn, idmY]
      ], ids, "future-to-idm", mini ? 18 : 22)}
      ${drawSankeyRibbon(actionTrack, [
        [idmOut, idmY],
        [idmOut + 32, idmY],
        [outputAnchor.x, outputAnchor.y]
      ], ids, "idm-to-action", mini ? 16 : 20)}
    </g>
  `;
}

function drawImplicitFutureArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 226, h };
  const repBox = { x: 324, y: y0 + 18, w: 286, h: h - 36 };
  const policyBox = { x: 682, y: y0, w: 276, h };
  const outputBox = { x: 1002, y: y0, w: 124, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "context + encoders", drawInputEncoderStack(diagram, inputBox, mini)),
    drawImplicitFutureRepresentation(repBox, diagram, mini, ids),
    drawConditionedPolicy(policyBox, diagram, mini, ids),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.44, repBox.x, repBox.y + repBox.h * 0.44, "predict hidden future", false, ids),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.67, policyBox.x, policyBox.y + h * 0.66, "current obs", false, ids),
    drawConnector(repBox.x + repBox.w, repBox.y + repBox.h * 0.43, policyBox.x, policyBox.y + h * 0.38, "condition / prefix", false, ids),
    drawConnector(policyBox.x + policyBox.w, policyBox.y + h * 0.5, outputBox.x, outputBox.y + h * 0.5, "act", false, ids),
    showTraining ? drawTrainingBand(diagram, trainBox, repBox, policyBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, policyBox, outputBox, trainBox)
  ].join("");
}

function drawImplicitFutureRepresentation(box, diagram, mini, ids) {
  const hasValue = diagram.outputs.some((item) => /value|intent|trajectory/i.test(item.label || item)) || diagram.streams.some((item) => /value|reward/i.test(item.label));
  const cx = box.x + box.w / 2;
  const topY = box.y + (mini ? 76 : 84);
  const latentY = box.y + (mini ? 132 : 154);
  const policyY = box.y + (mini ? 188 : 222);
  const obsX = box.x + 36;
  const futureX = cx - 47;
  const actionX = box.x + box.w - 88;
  const futureSlots = Array.from({ length: mini ? 4 : 5 }, (_, index) => {
    const x = futureX + index * 20;
    return `<rect class="implicit-slot compact" x="${x}" y="${latentY - 16 + (index % 2) * 4}" width="16" height="24"></rect>`;
  }).join("");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="implicit-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <title>${escapeHtml(diagram.core.label)}</title>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(shortText(diagram.core.label, 32))}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 52, 31, 1, "core-detail", 11)}
      <g class="implicit-stage implicit-observation">
        ${drawFrameStackGlyph("current observation", obsX, topY - 24, 58, 42, false)}
        <text x="${obsX + 29}" y="${topY + 35}" text-anchor="middle">now</text>
      </g>
      <path class="implicit-flow" d="M ${obsX + 64} ${topY} C ${box.x + 120} ${topY}, ${futureX - 18} ${latentY - 22}, ${futureX + 6} ${latentY - 6}"></path>
      <g class="implicit-future-slots">
        <rect class="implicit-latent-shell" x="${futureX - 10}" y="${latentY - 29}" width="${mini ? 100 : 118}" height="56"></rect>
        ${futureSlots}
        <text x="${futureX + (mini ? 40 : 48)}" y="${latentY + 40}" text-anchor="middle">hidden future z</text>
      </g>
      <path class="implicit-flow condition" d="M ${futureX + 96} ${latentY} C ${actionX - 46} ${latentY}, ${actionX - 44} ${policyY}, ${actionX - 12} ${policyY}"></path>
      <g class="implicit-policy-mini">
        ${drawCoreVisual(/diffusion|flow|denois/i.test(`${diagram.core.label} ${diagram.core.details.join(" ")}`) ? "diffusion" : "mlp", actionX - 56, policyY - 30, 76, 54, {})}
        <text x="${actionX - 18}" y="${policyY + 42}" text-anchor="middle">policy condition</text>
      </g>
      ${hasValue ? `<path class="value-contour compact" d="M ${box.x + 56} ${box.y + box.h - 36} C ${box.x + 110} ${box.y + box.h - 70}, ${box.x + 180} ${box.y + box.h - 12}, ${box.x + 238} ${box.y + box.h - 42}"></path>
        <text class="core-note" x="${box.x + 42}" y="${box.y + box.h - 16}">value / intent shapes the hidden future</text>` : `<text class="core-note" x="${box.x + 42}" y="${box.y + box.h - 16}">future is a latent condition, not rendered video</text>`}
    </g>
  `;
}

function drawAlignmentCore(box, diagram, mini, ids) {
  const teacher = alignmentTeacherLabel(diagram);
  const target = alignmentTargetLabel(diagram);
  const leftX = box.x + 34;
  const rightX = box.x + box.w - 100;
  const midX = box.x + box.w / 2;
  const y = box.y + (mini ? 92 : 106);
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel alignment-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 50, 32, 1, "core-detail", 11)}
      <g class="alignment-teacher">
        <rect class="alignment-feature-stack teacher" x="${leftX}" y="${y - 30}" width="68" height="54"></rect>
        ${drawAlignmentFeatureGrid(leftX + 10, y - 20, "#6b7280")}
        <text x="${leftX + 34}" y="${y + 42}" text-anchor="middle">${escapeHtml(teacher)}</text>
      </g>
      <g class="alignment-bridge">
        <path class="alignment-match-line" d="M ${leftX + 78} ${y - 14} C ${midX - 28} ${y - 48}, ${midX + 28} ${y - 48}, ${rightX - 10} ${y - 14}"></path>
        <path class="alignment-match-line second" d="M ${leftX + 78} ${y + 12} C ${midX - 28} ${y + 48}, ${midX + 28} ${y + 48}, ${rightX - 10} ${y + 12}"></path>
        <rect class="alignment-loss-chip" x="${midX - 44}" y="${y - 13}" width="88" height="26"></rect>
        <text class="alignment-loss-text" x="${midX}" y="${y + 5}" text-anchor="middle">${escapeHtml(alignmentLossLabel(diagram))}</text>
      </g>
      <g class="alignment-student">
        <rect class="alignment-feature-stack student" x="${rightX}" y="${y - 30}" width="68" height="54"></rect>
        ${drawAlignmentFeatureGrid(rightX + 10, y - 20, "#2f8793")}
        <text x="${rightX + 34}" y="${y + 42}" text-anchor="middle">${escapeHtml(target)}</text>
      </g>
      <text class="core-note" x="${box.x + 30}" y="${box.y + box.h - 18}">teacher relations pull the video/world hidden state toward useful physical structure</text>
    </g>
  `;
}

function drawAlignmentFeatureGrid(x, y, color) {
  return Array.from({ length: 9 }, (_, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return `<rect class="alignment-feature-cell" x="${x + col * 16}" y="${y + row * 12}" width="10" height="7" fill="${color}"></rect>`;
  }).join("");
}

function alignmentTeacherLabel(diagram) {
  const text = `${diagram.thesis || ""} ${diagram.core.details.join(" ")} ${diagram.components.map((c) => c.label).join(" ")}`.toLowerCase();
  if (/vggt|geometry/.test(text)) return "geometry";
  if (/reward|value|grpo/.test(text)) return "reward";
  if (/idm|execut/.test(text)) return "IDM";
  if (/video.?mae|teacher/.test(text)) return "teacher";
  return "target";
}

function alignmentTargetLabel(diagram) {
  const text = `${diagram.core.label} ${diagram.core.details.join(" ")}`.toLowerCase();
  if (/dynamics|sim/.test(text)) return "dynamics";
  if (/video|diffusion|flow|dit/.test(text)) return "video DiT";
  return "world state";
}

function alignmentLossLabel(diagram) {
  const text = `${diagram.training.map((t) => `${t.label} ${t.detail}`).join(" ")} ${diagram.core.details.join(" ")}`.toLowerCase();
  if (/reward|grpo/.test(text)) return "reward";
  if (/angular|scale|geometry/.test(text)) return "geom align";
  if (/relation|token/.test(text)) return "relation";
  if (/value/.test(text)) return "value";
  return "align";
}

function drawConditionedPolicy(box, diagram, mini, ids) {
  const streamItems = uniqueByText([
    { label: "Current observation", detail: "runtime sensor tokens", color: "#5d8fc5" },
    { label: "Future condition", detail: "prefix / slots / value latent", color: "#2f8793" },
    ...diagram.streams
  ], "label").slice(0, mini ? 4 : 5);
  const laneH = mini ? 34 : 39;
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel conditioned-policy" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${streamItems.map((stream, index) => {
        const y = box.y + 66 + index * (laneH + 9);
        return `
          <g>
            <rect class="condition-row" x="${box.x + 24}" y="${y}" width="${box.w - 48}" height="${laneH}" style="--stream:${stream.color || "#2f8793"}"></rect>
            <text class="stream-label" x="${box.x + 38}" y="${y + 16}">${escapeHtml(shortText(stream.label, 24))}</text>
            ${drawWrappedText(stream.detail, box.x + 38, y + 31, 28, 1, "stream-detail", 9.5)}
          </g>
        `;
      }).join("")}
      ${drawAttentionBadges(diagram.attention, box, mini)}
    </g>
  `;
}

function drawCoreVisual(kind, x, y, w, h, options = {}) {
  if (kind === "dit") return drawTransformerGlyph(x, y, w, h, { ...options, diffusion: true, cls: "core-visual-dit" });
  if (kind === "diffusion") return drawCnnDiffusionGlyph(x, y, w, h, "core-visual-diffusion");
  if (kind === "cnn") return drawCnnGlyph(x, y, w, h, "core-visual-cnn");
  if (kind === "mlp") return drawMlpGlyph(x, y, w, h, "core-visual-mlp");
  if (kind === "act") return drawTransformerGlyph(x, y, w, h, { ...options, label: "ACT", cls: "core-visual-act" });
  return drawTransformerGlyph(x, y, w, h, { ...options, cls: "core-visual-transformer" });
}

function drawTransformerGlyph(x, y, w, h, options = {}) {
  const seqN = 5;
  const tokenW = Math.min(16, (w - 18) / seqN);
  const blockX = x + w * 0.23;
  const blockY = y + h * (options.expanded ? 0.2 : 0.28);
  const blockW = w * 0.54;
  const blockH = h * (options.expanded ? 0.56 : 0.42);
  const tokenGap = 5;
  const seqW = seqN * tokenW + (seqN - 1) * tokenGap;
  const seqX = blockX + (blockW - seqW) / 2;
  const topY = blockY - 14;
  const bottomY = blockY + blockH + 7;
  const tokens = (yy, cls) => Array.from({ length: seqN }, (_, i) => {
    const tx = seqX + i * (tokenW + tokenGap);
    return `<rect class="core-seq-token ${cls}" x="${tx}" y="${yy}" width="${tokenW}" height="7"></rect>`;
  }).join("");
  const layers = Array.from({ length: 5 }, (_, i) => {
    const lx = blockX + 9 + i * ((blockW - 18) / 4);
    return `<path class="core-layer-line" d="M ${lx} ${blockY + 7} L ${lx} ${blockY + blockH - 7}"></path>`;
  }).join("");
  const loop = options.diffusion ? drawDiffusionLoop(x + w * 0.9, y + h * 0.46, Math.min(62, w * 0.28), Math.min(50, h * 0.4)) : "";
  const label = options.label && !options.autoregressive ? `<text class="core-glyph-label" x="${blockX + blockW / 2}" y="${blockY + blockH / 2 + 4}" text-anchor="middle">${escapeHtml(options.label)}</text>` : "";
  const causalMask = options.autoregressive ? drawCausalMaskGlyph(blockX + blockW / 2, blockY + blockH / 2, Math.min(24, blockW * 0.38, blockH * 0.72)) : "";
  return `
    <g class="core-visual ${options.cls || "core-visual-transformer"}">
      ${tokens(topY, "top")}
      <rect class="core-transformer-block" x="${blockX}" y="${blockY}" width="${blockW}" height="${blockH}"></rect>
      ${layers}
      ${label}
      ${causalMask}
      ${tokens(bottomY, "bottom")}
      ${loop}
    </g>
  `;
}

function drawCausalMaskGlyph(cx, cy, size) {
  const gap = 2.2;
  const cell = (size - gap * 2) / 3;
  const x0 = cx - size / 2;
  const y0 = cy - size / 2;
  const cells = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const dark = row >= col;
      cells.push(`<rect class="${dark ? "causal-mask-cell dark" : "causal-mask-cell"}" x="${x0 + col * (cell + gap)}" y="${y0 + row * (cell + gap)}" width="${cell}" height="${cell}"></rect>`);
    }
  }
  return `<g class="causal-mask-glyph">${cells.join("")}</g>`;
}

function drawCnnGlyph(x, y, w, h, cls = "core-visual-cnn") {
  const sx = x + w * 0.2;
  const sy = y + h * 0.2;
  const sw = w * 0.52;
  const sh = h * 0.5;
  const slices = Array.from({ length: 5 }, (_, i) => `
    <rect class="core-cnn-slice" x="${sx + i * 8}" y="${sy + i * 3}" width="${sw}" height="${sh}"></rect>
  `).join("");
  return `<g class="core-visual ${cls}">${slices}</g>`;
}

function drawCnnDiffusionGlyph(x, y, w, h, cls = "core-visual-diffusion") {
  return `
    <g class="core-visual ${cls}">
      ${drawCnnGlyph(x, y, w, h, cls)}
      ${drawDiffusionLoop(x + w * 0.9, y + h * 0.48, Math.min(62, w * 0.3), Math.min(50, h * 0.42))}
    </g>
  `;
}

function drawDiffusionLoop(cx, cy, w, h) {
  const scale = Math.min(w, h) / 24;
  const x = cx - 12 * scale;
  const y = cy - 12 * scale;
  return `
    <g class="core-diffusion-loop-reference" transform="translate(${x} ${y}) scale(${scale})">
      <path class="core-diffusion-loop" d="M 20 11 A 8.1 8.1 0 0 0 4.5 9 M 4 5 L 4 9 L 8 9"></path>
      <path class="core-diffusion-loop" d="M 4 13 A 8.1 8.1 0 0 0 19.5 15 M 20 19 L 20 15 L 16 15"></path>
    </g>
  `;
}

function drawMlpGlyph(x, y, w, h, cls = "core-visual-mlp") {
  const cols = [0.22, 0.5, 0.78];
  const rows = [[0.32, 0.5, 0.68], [0.38, 0.62], [0.32, 0.5, 0.68]];
  const nodes = rows.map((ys, ci) => ys.map((ratio, ri) => ({ x: x + w * cols[ci], y: y + h * ratio, id: `${ci}-${ri}` })));
  const edges = [
    ...nodes[0].flatMap((a) => nodes[1].map((b) => `<path class="core-mlp-edge" d="M ${a.x} ${a.y} L ${b.x} ${b.y}"></path>`)),
    ...nodes[1].flatMap((a) => nodes[2].map((b) => `<path class="core-mlp-edge" d="M ${a.x} ${a.y} L ${b.x} ${b.y}"></path>`))
  ].join("");
  const circles = nodes.flat().map((n) => `<circle class="core-mlp-node" cx="${n.x}" cy="${n.y}" r="4"></circle>`).join("");
  return `<g class="core-visual ${cls}">${edges}${circles}</g>`;
}

function drawFuturePredictor(box, diagram, mini, ids) {
  const rendered = diagram.pattern === "pixel_idm";
  const latent = diagram.pattern === "latent_idm";
  const stages = futurePredictorStages(diagram, mini);
  const title = diagram.core.label || (rendered ? "future video model" : "latent future model");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel future-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <title>${escapeHtml(title)}</title>
      <text class="core-title" x="${box.x + 20}" y="${box.y + 29}">${escapeHtml(shortText(title, 34))}</text>
      ${drawFuturePipelineDiagram(box, diagram, rendered, latent, mini)}
      ${drawFutureStageChips(stages, box, mini)}
    </g>
  `;
}

function futurePredictorHeight(diagram, mini) {
  const chipRows = Math.ceil(futurePredictorStages(diagram, mini).length / (mini ? 3 : 4));
  return mini ? 156 + chipRows * 24 : 186 + chipRows * 25;
}

function drawFuturePipelineDiagram(box, diagram, rendered, latent, mini) {
  const y = box.y + (mini ? 46 : 50);
  const h = mini ? 86 : 104;
  const input = { x: box.x + 22, y: y + 18, w: 58, h: 44 };
  const model = { x: box.x + 104, y: y + 6, w: 84, h: h - 12 };
  const output = { x: box.x + 212, y: y + 18, w: 58, h: 44 };
  const badges = futurePipelineBadges(diagram, rendered, latent);
  return `
    <g class="future-pipeline">
      <g class="future-pipeline-io">
        ${latent ? drawLatentFutureStack(input.x, input.y, input.w, input.h, "z_t") : drawFrameStackGlyph("current image", input.x, input.y, input.w, input.h, false)}
        ${drawFuturePipelineBadge(rendered ? "obs" : "z", input.x + input.w - 8, input.y + input.h + 6)}
      </g>
      ${drawFuturePipelineArrow(input.x + input.w + 4, y + h * 0.5, model.x - 7, y + h * 0.5, "visual")}
      <g class="future-model-box">
        <rect x="${model.x}" y="${model.y}" width="${model.w}" height="${model.h}"></rect>
        ${drawFutureModelGlyph(model, diagram, rendered, latent)}
        <text x="${model.x + model.w / 2}" y="${model.y + model.h - 9}" text-anchor="middle">${rendered ? "render" : "predict"}</text>
      </g>
      ${drawFuturePipelineArrow(model.x + model.w + 7, y + h * 0.5, output.x - 4, y + h * 0.5, latent ? "future" : "visual")}
      <g class="future-pipeline-io">
        ${latent ? drawLatentFutureStack(output.x, output.y, output.w, output.h, "z+1") : drawFrameStackGlyph("future video frames", output.x, output.y, output.w, output.h, true)}
        ${drawFuturePipelineBadge(rendered ? "future frames" : "future z", output.x + output.w - 8, output.y + output.h + 6)}
      </g>
      <g class="future-pipeline-badges">
        ${badges.map((badge, index) => drawFuturePipelineBadge(badge, box.x + 78 + index * 58, y + h + 14)).join("")}
      </g>
    </g>
  `;
}

function drawFutureModelGlyph(model, diagram, rendered, latent) {
  const cx = model.x + model.w / 2;
  const cy = model.y + model.h * 0.45;
  if (diagram.motifs.diffusion || /diffusion|denois|flow/i.test(`${diagram.core.label} ${diagram.core.details.join(" ")}`)) {
    return drawDiffusionLoop(cx, cy, 34, 30);
  }
  if (rendered) {
    return `<g class="future-mini-video">${drawFrameStackGlyph("video model", model.x + 20, model.y + 18, model.w - 40, 34, true)}</g>`;
  }
  return `<g class="future-mini-latent">${drawLatentGlyph(model.x + 18, model.y + 17, model.w - 36, 34)}</g>`;
}

function drawLatentFutureStack(x, y, w, h, badge) {
  const layers = [0, 1, 2].map((index) => `
    <g transform="translate(${index * 5} ${index * 3})">
      <rect class="latent-frame compact-latent-frame" x="${x + 6}" y="${y + 5}" width="${Math.min(42, w - 18)}" height="${Math.min(30, h - 12)}"></rect>
      ${drawLatentGlyph(x + 7, y + 6, Math.min(40, w - 20), Math.min(28, h - 14))}
    </g>
  `).join("");
  return `
    <g>
      ${layers}
      ${drawSmallCornerBadge(x + w - 24, y + h - 11, badge)}
    </g>
  `;
}

function drawFuturePipelineArrow(x1, y1, x2, y2, kind) {
  const color = streamColor(kind);
  return `
    <g class="future-pipeline-arrow" style="--future-flow:${color}">
      <path d="M ${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}"></path>
      <path class="future-pipeline-arrow-head" d="M ${x2} ${y2} L ${x2 - 7} ${y2 - 4} L ${x2 - 7} ${y2 + 4} Z"></path>
    </g>
  `;
}

function futurePipelineBadges(diagram, rendered, latent) {
  const text = [
    diagram.thesis,
    diagram.core.label,
    ...diagram.core.details,
    ...(diagram.runtime || [])
  ].join(" ").toLowerCase();
  const badges = [];
  if (/offline|synthetic|relabel/.test(text)) badges.push("offline");
  if (/one-step|single-step|partial/.test(text)) badges.push("1-step");
  if (/few-step|distill/.test(text)) badges.push("few-step");
  if (/feature|hidden|tap|video former/.test(text)) badges.push("features");
  if (rendered) badges.push("pixels");
  if (latent) badges.push("latent");
  return uniqueByText(badges.map((label) => ({ label })), "label").map((item) => item.label).slice(0, 4);
}

function drawFutureStageChips(stages, box, mini) {
  if (!stages.length) return "";
  const chipW = mini ? 66 : 62;
  const chipH = 19;
  const gap = 7;
  const cols = mini ? 3 : 4;
  const totalW = cols * chipW + (cols - 1) * gap;
  const startX = box.x + (box.w - totalW) / 2;
  const startY = box.y + box.h - (Math.ceil(stages.length / cols) * (chipH + 5)) - 14;
  return `
    <g class="future-stage-chips">
      ${stages.map((stage, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * (chipW + gap);
        const y = startY + row * (chipH + 5);
        return `
          <g class="future-stage-chip">
            <title>${escapeHtml(stage.source || stage.label)}</title>
            <rect x="${x}" y="${y}" width="${chipW}" height="${chipH}"></rect>
            <text x="${x + chipW / 2}" y="${y + 13}" text-anchor="middle">${escapeHtml(stage.label)}</text>
          </g>
        `;
      }).join("")}
    </g>
  `;
}

function drawFuturePipelineBadge(label, rightX, baselineY) {
  const width = Math.max(24, label.length * 5.4 + 10);
  const x = rightX - width;
  const y = baselineY - 14;
  return `
    <g class="future-mini-badge">
      <rect x="${x}" y="${y}" width="${width}" height="15"></rect>
      <text x="${rightX - 5}" y="${baselineY - 4}" text-anchor="end">${escapeHtml(label)}</text>
    </g>
  `;
}

function futurePredictorStages(diagram, mini) {
  const source = [
    ...(diagram.components || []),
    ...diagram.core.details.map((detail) => ({ label: detail, detail })),
    ...diagram.heads.filter((head) => /video former|feature tap|adapter|video|future|latent|predictor|backbone/i.test(`${head.label} ${head.detail}`))
  ];
  const stages = source.map((item) => {
    const text = typeof item === "string" ? item : `${item.label || ""} ${item.detail || ""}`;
    return { label: futureStageLabel(text), source: compactDetail(text) };
  }).filter((stage) => !/^(model|stage|branch)$/i.test(stage.label));
  return uniqueByText(stages, "label").slice(0, mini ? 5 : 8);
}

function futureStageLabel(text) {
  const lower = String(text || "").toLowerCase();
  if (/video former/.test(lower)) return "Video Former";
  if (/feature tap|hidden feature|decoder feature|selected upsampling/.test(lower)) return "Feature Tap";
  if (/offline.*synthetic|synthetic.*data|synthetic.*trajector|generated.*data/.test(lower)) return "Synthetic";
  if (/synthetic rollout|rollout bank|generated videos?/.test(lower)) return "Rollout Bank";
  if (/image-to-video|image to video|i2v/.test(lower)) return "I2V";
  if (/lora|adapter/.test(lower)) return "LoRA Adapt";
  if (/distill/.test(lower)) return "Distill";
  if (/idm|inverse dynamics|relabel/.test(lower)) return "IDM Relabel";
  if (/svd|stable video/.test(lower)) return "SVD";
  if (/cosmos/.test(lower)) return "Cosmos";
  if (/wan2?\.?1|wan2?\.?2|wan/.test(lower)) return "Wan";
  if (/video u-net|unet|u-net/.test(lower)) return "U-Net";
  if (/video prediction backbone|video predictor|v[_ ]?theta|vtheta|backbone/.test(lower)) return "Predictor";
  if (/diffusion|denois|flow/.test(lower)) return "Denoiser";
  if (/future|latent/.test(lower)) return "Future Z";
  if (/policy/.test(lower)) return "Policy";
  return compactFutureStageFallback(text);
}

function compactFutureStageFallback(text) {
  const badge = compactBadgeLabel(text) || conciseLabel(text);
  const lower = badge.toLowerCase();
  if (/offline/.test(lower)) return "Offline";
  if (/synthetic/.test(lower)) return "Synthetic";
  if (/action/.test(lower)) return "Action";
  if (/video/.test(lower)) return "Video";
  if (/image/.test(lower)) return "Image";
  if (/latent/.test(lower)) return "Latent";
  const words = badge.replace(/[^a-z0-9+.-]+/gi, " ").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join(" ").slice(0, 12);
}

function drawInverseDynamics(box, diagram, mini) {
  const idmHeads = idmHeadRows(diagram);
  return `
    <g>
      <rect class="idm-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="core-title" x="${box.x + 20}" y="${box.y + 30}">inverse dynamics model</text>
      ${drawHeadStack(idmHeads, { x: box.x + 6, y: box.y + 28, w: box.w - 12, h: box.h - 42 }, mini)}
    </g>
  `;
}

function idmHeadRows(diagram) {
  const idmRows = diagram.heads.filter((head) => (
    /inverse dynamics|idm|action decoder|action head|policy|control|trajectory|chunk/i.test(`${head.label} ${head.detail}`) &&
    !/unified|world-action|obs\+action/i.test(`${head.label} ${head.detail}`)
  )).map((head) => normalizeIdmHeadForPattern(head, diagram.pattern));
  if (idmRows.length) return idmRows;
  return [{ label: diagram.pattern === "latent_idm" ? "latent IDM" : "IDM", detail: "" }];
}

function normalizeIdmHeadForPattern(head, pattern) {
  if (pattern !== "latent_idm") return head;
  const text = `${head.label || ""} ${head.detail || ""}`.toLowerCase();
  if (/latent.*\bidm\b|\bidm\b.*latent|inverse dynamics|latent action.*relabel|relabel.*latent action/.test(text)) {
    return { ...head, label: "latent IDM" };
  }
  return head;
}

function idmActionOutputs(diagram) {
  const actionRows = diagram.outputs.filter((output) => (
    /action|control|trajectory|chunk|policy/i.test(`${output.label} ${output.detail}`) &&
    !/unified|obs\+action|observation.*action|action.*observation/i.test(`${output.label} ${output.detail}`)
  ));
  if (actionRows.length) return actionRows;
  return [{ label: "Action Chunk", detail: "executable robot controls" }];
}

function drawEncoderOnlyArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 178, h };
  const encoderBox = { x: 238, y: y0, w: 178, h };
  const policyBox = { x: 468, y: y0, w: 290, h };
  const trainOnlyBox = { x: 798, y: y0 + 20, w: 152, h: h - 40 };
  const outputBox = { x: 986, y: y0, w: 140, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "policy inputs", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "runtime encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawEncoderPolicyCore(policyBox, diagram, mini, ids),
    drawEncoderOnlyAuxiliary(trainOnlyBox, diagram, mini),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawTypedFlow(inputBox, encoderBox, "visual", ids, 0.34, 0.34, "encode"),
    drawTypedFlow(inputBox, encoderBox, "language", ids, 0.52, 0.52, ""),
    drawTypedFlow(encoderBox, policyBox, "future", ids, 0.5, 0.5, "represent"),
    drawTypedFlow(policyBox, outputBox, "action", ids, 0.48, 0.48, "act"),
    showTraining ? drawConnector(policyBox.x + policyBox.w, policyBox.y + h * 0.7, trainOnlyBox.x, trainOnlyBox.y + trainOnlyBox.h * 0.68, "training only", true, ids) : "",
    showTraining ? drawTrainingBand(diagram, trainBox, policyBox, trainOnlyBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, policyBox, outputBox, trainBox)
  ].join("");
}

function drawEncoderPolicyCore(box, diagram, mini, ids) {
  const heads = uniqueByText([
    { label: "Action Head", detail: "runtime policy decoder" },
    ...diagram.heads.filter((head) => /action|policy|control|chunk/i.test(head.label || ""))
  ], "label").slice(0, mini ? 2 : 3);
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel encoder-policy-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 52, 32, 2, "core-detail", 11)}
      <rect class="shared-attn-band" x="${box.x + 22}" y="${box.y + 86}" width="${box.w - 44}" height="${mini ? 68 : 82}"></rect>
      <text class="core-note" x="${box.x + 34}" y="${box.y + 112}">vision/text features feed the policy core</text>
      ${drawAttentionBadges(diagram.attention, box, mini)}
      ${drawHeadStack(heads, { x: box.x + 26, y: box.y + box.h - (mini ? 124 : 136), w: box.w - 52, h: mini ? 108 : 118 }, mini)}
    </g>
  `;
}

function drawEncoderOnlyAuxiliary(box, diagram, mini) {
  const items = uniqueByText([
    { label: "World / Video Head", detail: "trains representation" },
    ...diagram.heads.filter((head) => /future|video|latent|world|depth|force/i.test(head.label || ""))
  ], "label").slice(0, mini ? 3 : 4);
  return `
    <g>
      <rect class="encoder-only-aux" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 23}">train-time branch</text>
      ${(items.length ? items : [{ label: "Auxiliary Head", detail: "not used at runtime" }]).map((item, index) => {
        const y = box.y + 48 + index * (mini ? 46 : 52);
        return `
          <g>
            <rect class="aux-head-block" x="${box.x + 14}" y="${y}" width="${box.w - 28}" height="${mini ? 36 : 42}"></rect>
            <text class="block-label" x="${box.x + 24}" y="${y + 17}">${escapeHtml(shortText(item.label, 18))}</text>
            ${drawWrappedText(item.detail, box.x + 24, y + 32, 16, 1, "block-detail", 9.5)}
          </g>
        `;
      }).join("")}
      <path class="encoder-only-cut" d="M ${box.x + 18} ${box.y + box.h - 30} L ${box.x + box.w - 18} ${box.y + box.h - 30}"></path>
      <text class="core-note" x="${box.x + 20}" y="${box.y + box.h - 12}">removed for deployment</text>
    </g>
  `;
}

function drawEnhancementArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const showTraining = !options.gallery;
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 178, h };
  const encoderBox = { x: 238, y: y0, w: 160, h };
  const baseBox = { x: 432, y: y0, w: 310, h };
  const enhanceBox = { x: 786, y: y0, w: 166, h };
  const outputBox = { x: 986, y: y0, w: 140, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "policy inputs", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawColumnPanel(encoderBox, "vision / text encoders", drawEncoderStack(diagram.encoders, encoderBox, mini)),
    drawCorePanel(diagram, baseBox, mini, ids),
    drawEnhancementOverlay(enhanceBox, diagram, mini),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawTypedFlow(inputBox, encoderBox, "visual", ids, 0.35, 0.35, "encode"),
    drawTypedFlow(inputBox, encoderBox, "language", ids, 0.52, 0.52, ""),
    drawTypedFlow(encoderBox, baseBox, "future", ids, 0.5, 0.5, "embed"),
    drawConnector(baseBox.x + baseBox.w, baseBox.y + h * 0.45, enhanceBox.x, enhanceBox.y + h * 0.45, "adapt / align", true, ids),
    drawTypedFlow(enhanceBox, outputBox, "action", ids, 0.5, 0.5, "deploy"),
    showTraining ? drawTrainingBand(diagram, trainBox, baseBox, enhanceBox, mini, ids) : "",
    mini || !showTraining ? "" : drawRuntimeStrip(diagram.runtime, baseBox, outputBox, trainBox)
  ].join("");
}

function drawEnhancementOverlay(box, diagram, mini) {
  const family = diagram.family || diagram.pattern;
  const title = {
    encoder_only: "train-time world signal",
    alignment: "alignment layer",
    multimodal: "physical state branch",
    online_adaptation: "online memory / update",
    speedup: "shortcut / cache"
  }[family] || "enhancement";
  const items = [
    ...diagram.attention.map((label) => ({ label, detail: "attention constraint" })),
    ...diagram.training.slice(0, 3)
  ].slice(0, mini ? 4 : 5);
  return `
    <g>
      <rect class="enhancement-shell" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">${escapeHtml(title)}</text>
      ${(items.length ? items : [{ label: "auxiliary signal", detail: "changes training or runtime path" }]).map((item, index) => {
        const y = box.y + 50 + index * (mini ? 42 : 48);
        return `
          <g>
            <rect class="enhancement-chip" x="${box.x + 16}" y="${y}" width="${box.w - 32}" height="${mini ? 34 : 40}"></rect>
            <text class="training-label" x="${box.x + 26}" y="${y + 16}">${escapeHtml(shortText(item.label, 20))}</text>
            ${drawWrappedText(item.detail, box.x + 26, y + 31, 18, 1, "training-detail", 9.5)}
          </g>
        `;
      }).join("")}
    </g>
  `;
}

function diagramDefs(model, ids) {
  const base = familyColors[model.family] || "#2f7f91";
  return `
    <defs>
      <linearGradient id="${ids.coreGrad}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${escapeHtml(base)}" stop-opacity="0.22"></stop>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0.96"></stop>
      </linearGradient>
      <filter id="${ids.softShadow}" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="9" flood-color="#172024" flood-opacity="0.08"></feDropShadow>
      </filter>
      <marker id="${ids.arrow}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#526066"></path>
      </marker>
      ${flowGradient(ids.visualFlow, "#5d8fc5")}
      ${flowGradient(ids.languageFlow, "#9874b8")}
      ${flowGradient(ids.stateFlow, "#72a36e")}
      ${flowGradient(ids.actionFlow, "#d49a3d")}
      ${flowGradient(ids.futureFlow, "#2f8793")}
    </defs>
  `;
}

function flowGradient(id, color) {
  return `
    <linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.05"></stop>
      <stop offset="34%" stop-color="${color}" stop-opacity="0.32"></stop>
      <stop offset="76%" stop-color="${color}" stop-opacity="0.72"></stop>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.95"></stop>
    </linearGradient>
  `;
}

function inferTokenGroups(model, arch, allText, options = {}) {
  const maxGroups = options.mini ? 3 : 5;
  const tokens = arch.inputTokens || model.diagram?.inputs || [];
  const inputText = [
    ...(tokens || []),
    ...(model.diagram?.inputs || []),
    ...(model.diagram?.runtimePath || []),
    ...(arch.inferenceRecipe || [])
  ].join(" ").toLowerCase();
  const explicitGroups = explicitInputTokenGroups(tokens, maxGroups);
  if (explicitGroups.length >= Math.min(3, tokens.length || 3)) return explicitGroups;

  const groups = [];
  const add = (kind, label, matcher, fallback = "") => {
    const hits = uniqueByText(tokens.filter((item) => matcher.test(item))).slice(0, 3);
    if (hits.length || fallback) {
      groups.push({
        kind,
        label,
        tokens: hits.length ? hits.map((item) => compactToken(item)) : [fallback]
      });
    }
  };

  add("visual", "visual / world", /rgb|image|camera|frame|video|observation|view|depth|tactile|gelsight/i, /rgb|image|camera|frame|video|observation|visual|world/.test(inputText || allText) ? "observation tokens" : "");
  add("language", "language", /language|instruction|\btext\b|textual|t5|qwen|vlm/i, /language|instruction|\btext\b|textual|t5|qwen|vlm|task description/.test(inputText) ? "instruction" : "");
  add("state", "state / context", /state|proprio|force|value|goal|history|memory|latent|dino/i, /state|proprio|gripper|end-effector/.test(inputText) ? "state tokens" : "");
  add("action", "action", /action|trajectory|chunk|control|gripper|end-effector/i, /action|trajectory|policy|control|chunk/.test(inputText || allText) ? "action chunk" : "");
  add("noise", "noise / targets", /noise|noisy|future|flow|diffusion|target/i, "");

  const unique = uniqueByText(groups, "label");
  if (!unique.length) {
    unique.push({ kind: "visual", label: "observation", tokens: ["raw sensor stream"] });
    unique.push({ kind: "action", label: "action", tokens: ["control output"] });
  }
  return unique.slice(0, maxGroups);
}

function explicitInputTokenGroups(tokens, maxGroups) {
  if (!tokens?.length) return [];
  const groups = [];
  tokens.forEach((token) => {
    const text = String(token || "");
    const lower = text.toLowerCase();
    const kind = inputTokenKind(text);
    const label = inputTokenLabel(text, kind);
    if (!label) return;
    groups.push({ kind, label, tokens: [compactToken(text)] });
  });
  return uniqueByText(groups, "label").slice(0, maxGroups);
}

function inputTokenKind(text) {
  const lower = String(text || "").toLowerCase();
  if (/noise|noisy|diffusion timestep|flow.*time|timestep/.test(lower)) return "noise";
  if (/language|instruction|\btext\b|clip language|t5|vlm/.test(lower)) return "language";
  if (/action|trajectory|control|command/.test(lower) && !/feature/.test(lower)) return "action";
  if (/state|proprio|joint|gripper|end-effector|force|tactile/.test(lower)) return "state";
  return "visual";
}

function inputTokenLabel(text, kind) {
  const lower = String(text || "").toLowerCase();
  if (/current image|initial image|current observation|initial observation|\bs0\b/.test(lower)) return "current image s0";
  if (/final noised|white noise|noised video latent|noisy future/.test(lower)) return "xT noisy latent";
  if (/static.*wrist|wrist.*static/.test(lower)) return "static+wrist features";
  if (/learnable.*query|query tokens?/.test(lower)) return "query tokens";
  if (/wrist/.test(lower) && /camera|view|image/.test(lower)) return "wrist view";
  if (/static/.test(lower) && /camera|view|image/.test(lower)) return "static view";
  if (kind === "language") return /clip/.test(lower) ? "CLIP language" : "instruction";
  if (kind === "action") return /noisy/.test(lower) ? "noisy action" : "action chunk";
  if (kind === "state") return /proprio/.test(lower) ? "proprio state" : "robot state";
  if (kind === "noise") return /timestep|flow/.test(lower) ? "diffusion time" : "noise";
  if (/video|frames|clip|history/.test(lower)) return "video/history";
  if (/image|observation|rgb|camera|view/.test(lower)) return "image";
  return "";
}

function inferEncoders(arch, allText, options = {}) {
  const candidates = [];
  const pools = [
    ...(arch.tokenization || []),
    ...(arch.inputTokens || []),
    ...(arch.backbone || [])
  ];
  pools.forEach((item) => {
    const lower = item.toLowerCase();
    const detail = compactDetail(item);
    if (/frozen vlm|vlm.*encod|encod.*vlm|video-language model|vision-language model/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("VLM Vision Path", item), detail, kind: "visual" });
      candidates.push({ label: preciseEncoderLabel("VLM Language Path", item), detail, kind: "language" });
    }
    if (/t5|text encoder|language encoder|\bclip\b text|qwen|llama|gemma|paligemma|prismatic|chameleon|lwm|frozen vlm|\bvlm\b/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("Text Encoder", item), detail, kind: "language" });
    }
    if (/vae|vq-?gan|video vae|causal vae|vq-?vae|codebook|quant/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("Video Tokenizer", item), detail, kind: /action/.test(lower) ? "action" : "visual" });
    }
    if (/cosmos|wan2\.?1|wan2\.?2|cogvideox|stable video diffusion|\bsvd\b/.test(lower) && /latent|token|frame|video/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("Video Tokenizer", item), detail, kind: "visual" });
    }
    if (/dino|siglip|\bclip\b|mae|vit|dpav3|v-jepa|vision encoder|resnet|cnn|vision transformer|frozen vlm|\bvlm\b/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("Vision Encoder", item), detail, kind: "visual" });
    }
    if (/q-former|query/.test(lower)) candidates.push({ label: "Q-Former", detail, kind: "latent" });
    if (/action encoder|action projector|action tokens|chunk|trajectory/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("Action Encoder", item), detail, kind: "action" });
    }
    if (/mlp|project|proprio|state|end-effector|gripper|linear/.test(lower)) {
      candidates.push({ label: preciseEncoderLabel("State MLP Encoder", item), detail, kind: "state" });
    }
  });
  if (/wan2\.?2/.test(allText) && /vae|latent|video/.test(allText)) candidates.push({ label: "Wan2.2 Causal VAE", detail: "pretrained latent video tokenizer", kind: "visual" });
  if (/wan2\.?1/.test(allText) && /vae|latent|video/.test(allText)) candidates.push({ label: "Wan2.1 Causal VAE", detail: "pretrained latent video tokenizer", kind: "visual" });
  if (/cosmos-predict2|cosmos video latent|cosmos video diffusion/.test(allText)) candidates.push({ label: "Cosmos/Wan2.1 VAE", detail: "latent video frame tokenizer", kind: "visual" });
  if (/cogvideox/.test(allText)) candidates.push({ label: "CogVideoX 3D VAE", detail: "latent video tokenizer", kind: "visual" });
  if (/stable video diffusion|\bsvd\b/.test(allText)) candidates.push({ label: "SVD VAE Encoder", detail: "latent video tokenizer", kind: "visual" });
  if (/cosmos/.test(allText) && /\btext\b|textual|task description|language|instruction/.test(allText)) candidates.push({ label: "Cosmos T5-XXL Encoder", detail: "text condition embeddings", kind: "language" });
  if (/wan2\.?2/.test(allText) && /\btext\b|textual|task description|language|instruction/.test(allText)) candidates.push({ label: "Wan2.2 T5 Encoder", detail: "text condition embeddings", kind: "language" });
  if (/wan2\.?1/.test(allText) && /\btext\b|textual|task description|language|instruction/.test(allText)) candidates.push({ label: "Wan2.1 T5 Encoder", detail: "text condition embeddings", kind: "language" });
  if (/cogvideox/.test(allText) && /\btext\b|textual|task description|language|instruction/.test(allText)) candidates.push({ label: "T5 Text Encoder", detail: "CogVideoX text condition", kind: "language" });
  if (/stable video diffusion|\bsvd\b/.test(allText) && /\btext\b|textual|task description|language|instruction/.test(allText)) candidates.push({ label: "CLIP Text Encoder", detail: "text condition embeddings", kind: "language" });
  if (/mae/.test(allText) && /vit/.test(allText)) candidates.push({ label: "MAE ViT Encoder", detail: "visual observation features", kind: "visual" });
  if (/dino\s?v?2|dinov2/.test(allText)) candidates.push({ label: "DINOv2 Encoder", detail: "semantic visual features", kind: "visual" });
  else if (/\bdino\b/.test(allText)) candidates.push({ label: "DINO Encoder", detail: "semantic visual features", kind: "visual" });
  if (/siglip/.test(allText)) candidates.push({ label: "SigLIP Encoder", detail: "vision-language features", kind: "visual" });
  if (/\bclip\b/.test(allText)) candidates.push({ label: /\btext\b/.test(allText) ? "CLIP Text Encoder" : "CLIP Vision Encoder", detail: "CLIP features", kind: /\btext\b/.test(allText) ? "language" : "visual" });
  if (/t5|t5-xxl/.test(allText)) candidates.push({ label: /t5-xxl/.test(allText) ? "T5-XXL Encoder" : (/wan2\.?2/.test(allText) ? "Wan2.2 T5 Encoder" : "T5 Text Encoder"), detail: /t5-xxl/.test(allText) ? "T5-XXL language condition" : "language condition", kind: "language" });
  if (/frozen vlm|vlm.*observation|vlm.*language|vision-language model/.test(allText)) {
    candidates.push({ label: "Frozen VLM Vision Path", detail: "observation features from frozen VLM", kind: "visual" });
    candidates.push({ label: "Frozen VLM Language Path", detail: "language features from frozen VLM", kind: "language" });
  }
  if (/language|instruction|task description|\btext\b goal/.test(allText) && !/t5|clip text|qwen|llama|gemma|paligemma|prismatic|chameleon|lwm|frozen vlm|\bvlm\b|cosmos|wan2\.?|cogvideox|stable video diffusion|\bsvd\b/.test(allText)) {
    candidates.push({ label: "Text Condition Encoder", detail: "language or task condition", kind: "language" });
  }
  if (/action/.test(allText)) candidates.push({ label: "Action Encoder", detail: "chunk or flow tokens", kind: "action" });
  return pruneGenericEncoders(candidates).slice(0, options.mini ? 3 : 6);
}

function inferCore(model, arch, allText) {
  let label = "World-Action Core";
  if (/mixture-of-transformer|mot\b|multi-modal self-attention|mmsa/.test(allText)) label = "MoT / Shared-Attention Core";
  else if (/\bmm-dit\b|\bmmd[it]?\b/.test(allText)) label = "MM-DiT Core";
  else if (/cosmos-predict|cosmos video model|cosmos video diffusion/.test(allText)) label = "Cosmos Diffusion Transformer";
  else if (/\bdit\b|diffusion transformer|diffusion-transformer|joint.*denois|flow matching|noisy action|noisy future/.test(allText)) label = "Diffusion Transformer Core";
  else if (/gpt-style|causal transformer|transformer decoder|autoregressive/.test(allText)) label = "Autoregressive Transformer";
  else if (/vlm|qwen|paligemma|prismatic|llama/.test(allText)) label = "VLM Backbone + Action Expert";
  else if (/latent world|world model/.test(allText)) label = "Latent World Model";

  const details = (arch.backbone || model.diagram?.components || []).slice(0, 3).map(compactDetail);
  const layerBadges = [];
  if (/self-attention|self attention|shared attention|joint attention/.test(allText)) layerBadges.push("self-attn");
  if (/cross-attention|cross attention|cross-attn/.test(allText)) layerBadges.push("cross-attn");
  if (/mlp|ffn|feed-forward/.test(allText)) layerBadges.push("FFN");
  if (/adaln|adaptive layer norm/.test(allText)) layerBadges.push("AdaLN");
  if (/flow matching|diffusion|denois/.test(allText)) layerBadges.push("noise t");
  return { label, details, layerBadges: layerBadges.length ? layerBadges : ["attention", "MLP", "head"], kind: coreVisualKind(label, allText) };
}

function coreVisualKind(label, allText) {
  const text = `${label || ""} ${allText || ""}`.toLowerCase();
  if (/act-style|act actor|actor module \(act\)|\bact-vae\b|action transformer/.test(text)) return "act";
  if (/\bdit\b|diffusion transformer|mm-dit|mmd[it]?/.test(text)) return "dit";
  if (/diffusion|denois|flow matching|rectified flow/.test(text)) return "diffusion";
  if (/transformer|attention|gpt|autoregressive|vlm|llm|qwen|gemma|llama/.test(text)) return "transformer";
  if (/cnn|u-net|unet|conv/.test(text)) return "cnn";
  if (/mlp|linear projector|projection head/.test(text)) return "mlp";
  return "transformer";
}

function isAutoregressiveDiagram(diagram) {
  const text = [
    diagram.core?.label,
    ...(diagram.core?.details || []),
    ...(diagram.attention || []),
    ...(diagram.components || []).map((item) => `${item.label || ""} ${item.detail || ""}`),
    ...(diagram.encoders || []).map((item) => `${item.label || ""} ${item.detail || ""}`)
  ].join(" ").toLowerCase();
  return /autoregressive|auto-regressive|gpt-style|causal transformer|causal attention|causal mask|blockwise causal|block-causal/.test(text);
}

function inferStreams(model, arch, allText, options = {}) {
  const streams = [];
  const add = (label, detail, color, test) => {
    if (test) streams.push({ label, detail, color });
  };
  add("Video / World", streamDetail(arch, /video|rgb|visual|world|future|dino|vae/i, "future/state latents"), "#4c78a8", /video|rgb|visual|world|future|dino|vae/.test(allText));
  add("Language", streamDetail(arch, /language|instruction|\btext\b|textual|t5|vlm/i, "instruction condition"), "#8f6bb8", /language|instruction|\btext\b|textual|t5|vlm/.test(allText));
  add("Action", streamDetail(arch, /action|chunk|policy|control/i, "action chunk"), "#d08a2e", /action|chunk|policy|control/.test(allText));
  add("State", streamDetail(arch, /state|proprio|memory|history/i, "proprio/history"), "#5a8f63", /state|proprio|memory|history/.test(allText));
  add("Value / Reward", streamDetail(arch, /value|reward|map|grpo|rl/i, "value or reward"), "#9f5f63", /value|reward|map|grpo|rl/.test(allText));
  add("Depth / Tactile / Force", streamDetail(arch, /depth|tactile|force|gelsight|rgb-d/i, "physical branch"), "#2f8793", /depth|tactile|force|gelsight|rgb-d/.test(allText));
  return uniqueByText(streams, "label").slice(0, options.mini ? 4 : 6);
}

function inferAttentionBadges(allText, options = {}) {
  const badges = [];
  const add = (label, test) => { if (test) badges.push(label); };
  add("cross-attn", /cross-attention|cross attention|cross-attn/.test(allText));
  add("joint/self-attn", /joint attention|shared attention|self-attention|self attention|mmsa/.test(allText));
  add("unilateral", /unilateral/.test(allText));
  add("cache / memory", /cache|ttt memory|memory/.test(allText));
  add("async denoise", /asynchronous|async|partial denois|few-step|shortcut/.test(allText));
  add("value route", /value map|value-map|spatial value/.test(allText));
  return badges.slice(0, options.mini ? 4 : 7);
}

function inferHeads(model, arch, allText, options = {}) {
  const heads = [];
  const explicitHeadText = [
    ...(arch.heads || []),
    ...(arch.branches || []),
    ...(model.diagram?.components || [])
  ].join(" ").toLowerCase();
  const explicitHeads = arch.heads || [];
  const unified = isUnifiedHeadArchitecture(model, arch, allText);
  const collapsedUnified = shouldCollapseUnifiedHeads(model, arch, allText);

  if (unified || collapsedUnified) {
    explicitHeads
      .filter((item) => /mlp|linear|projection|projector|controller/i.test(item) && !/diffusion policy|\bdit\b|\bact\b|action transformer|cache|variant|flash/i.test(item))
      .forEach((item) => heads.push({ label: unifiedProjectionLabel(item), detail: compactDetail(item) }));
    return uniqueByText(heads, "label").slice(0, options.mini ? 3 : 5);
  }
  explicitHeads
    .filter((item) => !/single-pass.*latent world representation|representation.*parameterizes.*action distribution/i.test(item))
    .forEach((item) => heads.push({ label: headLabel(item), detail: compactDetail(item) }));

  if (!unified && /inverse dynamics|inverse-dynamics|\bidm\b/.test(allText) && !/controlled[^.;,]*\bidm\b[^.;,]*variant|fast-wam-idm/i.test(allText) && !heads.some((head) => /inverse dynamics|idm/i.test(`${head.label} ${head.detail}`))) {
    heads.push({ label: /latent.*\bidm\b|\bidm\b.*latent/.test(allText) ? "latent IDM" : "IDM", detail: "" });
  }
  if (!unified && /action head|action decoder|policy head|control head|trajectory decoder|diffusion policy|action expert|act-vae|cvae action|linear.*action/.test(explicitHeadText) && !heads.some((head) => /action|policy|control|trajectory|chunk/i.test(`${head.label} ${head.detail}`))) {
    heads.push({ label: "Action Head", detail: "paper-specified action decoder" });
  }
  if (!unified && /future.*head|future.*decoder|video.*decoder|observation.*decoder|visual.*head|latent.*head|forecasting branch|forward dynamics branch/.test(explicitHeadText) && !heads.some((head) => /future|video|observation|visual|latent|dynamics/i.test(`${head.label} ${head.detail}`))) {
    heads.push({ label: "Future/Obs Decoder", detail: "paper-specified future output" });
  }
  if (/value head|reward head|value map|value-map|asvm/.test(explicitHeadText)) heads.push({ label: "Value Head", detail: "score future trajectory" });
  if (/depth head|depth decoder|rgb-d|4d/.test(explicitHeadText)) heads.push({ label: "Depth Head", detail: "RGB-D / inverse depth" });
  if (/force head|force predictor|tactile head|tactile decoder/.test(explicitHeadText)) heads.push({ label: "Force/Tactile Head", detail: "contact prediction" });
  return uniqueByText(heads, "label").slice(0, options.mini ? 3 : 6);
}

function unifiedProjectionLabel(item) {
  const lower = String(item || "").toLowerCase();
  if (/vae decoder|vq-?gan decoder/.test(lower)) return "Video Decoder";
  if (/controller/.test(lower)) return "Controller";
  if (/linear/.test(lower)) return "Linear Projection";
  if (/mlp|projection|projector/.test(lower)) return "MLP Projection";
  return headLabel(item);
}

function inferOutputs(model, arch, allText, options = {}) {
  const outputs = [];
  const add = (label, detail, test) => { if (test) outputs.push({ label, detail }); };
  const outputText = [
    ...(arch.inferenceRecipe || []),
    ...(model.diagram?.runtimePath || []),
    ...(model.diagram?.outputs || [])
  ].join(" ").toLowerCase();
  const actionEvidenceText = [
    outputText,
    ...(arch.heads || []),
    ...(arch.branches || [])
  ].join(" ").toLowerCase();
  const unified = isUnifiedHeadArchitecture(model, arch, allText);

  (model.diagram?.outputs || []).forEach((item) => outputs.push({ label: compactToken(item), detail: "paper output" }));
  if (unified && !outputs.length) {
    outputs.unshift({ label: "Unified Obs+Action Tokens", detail: "single prediction stream" });
  }
  add("Future Video", "decoded or latent rollout", !unified && hasRuntimeFutureOutput(outputText) && !outputs.some(isFutureOutputLike));
  add("Latent Future", "DINO/VAE/value state", !unified && hasRuntimeLatentFutureOutput(outputText) && !outputs.some(isFutureOutputLike));
  add("Value Map", "spatial intent/value", /value map|value-map|asvm/.test(outputText));
  add("Depth / 4D", "RGB-D reconstruction", /depth|rgb-d|4d/.test(outputText));
  add("Force / State", "tactile/force/proprio", /force|tactile|virtual force/.test(outputText));
  if (!unified && /action chunk|action output|policy output|control|trajectory/.test(actionEvidenceText) && !outputs.some(isActionOutputLike)) {
    outputs.push({ label: "Action Chunk", detail: "executable robot controls" });
  }
  return normalizeOutputs(outputs).slice(0, options.mini ? 3 : 5);
}

function hasRuntimeFutureOutput(text) {
  return /future video|future frame|generated video|video rollout|decoded future|future observation/.test(text) && !/remove(?:s|d)?\s+(?:the\s+)?future|do not .*future|without .*future|no .*future|training-only .*future|future .*training only/.test(text);
}

function hasRuntimeLatentFutureOutput(text) {
  return /future.*latent|latent future|dino.*future|jepa.*future|visual-state/.test(text) && !/remove(?:s|d)?\s+(?:the\s+)?future|do not .*future|without .*future|no .*future|training-only .*future|future .*training only/.test(text);
}

function isFutureOutputLike(output) {
  const text = `${output?.label || output || ""} ${output?.detail || ""}`.toLowerCase();
  return /future|rollout|observation token|video|latent|dino|jepa|visual-state|rgb-d|depth/.test(text) && !isActionOutputLike(output);
}

function normalizeOutputs(outputs) {
  const result = [];
  let actionOutput = null;
  outputs.forEach((output) => {
    if (isActionOutputLike(output)) {
      actionOutput = mergeActionOutput(actionOutput, output);
      return;
    }
    result.push(output);
  });
  const normalized = uniqueByText(result, "label");
  if (actionOutput) normalized.push(actionOutput);
  return normalized;
}

function isActionOutputLike(output) {
  const text = `${output?.label || output || ""} ${output?.detail || ""}`.toLowerCase();
  if (/latent action|act[_ -]?\d|act token/.test(text) && !/robot|control|chunk|trajectory|command|policy|runtime/.test(text)) return false;
  return /action|control|trajectory|chunk|policy output|robot controls|arm|gripper|end-effector|\bwbc\b|joint/.test(text);
}

function mergeActionOutput(current, next) {
  if (!current) return canonicalActionOutput(next);
  const candidate = canonicalActionOutput(next);
  return actionOutputScore(candidate) > actionOutputScore(current) ? candidate : current;
}

function canonicalActionOutput(output) {
  const label = String(output?.label || output || "Action Chunk");
  const detail = String(output?.detail || "runtime output");
  if (/wbc/i.test(label)) return { label: "WBC Controls", detail };
  if (/gripper|arm|joint|end-effector|cartesian|low-level/i.test(`${label} ${detail}`)) return { label: "Robot Actions", detail };
  if (/sequence|trajectory/i.test(`${label} ${detail}`)) return { label: "Action Trajectory", detail };
  return { label: /action/i.test(label) ? label : "Action Chunk", detail };
}

function actionOutputScore(output) {
  const text = `${output.label || ""} ${output.detail || ""}`.toLowerCase();
  let score = 0;
  if (!/paper output|runtime output|executable robot controls/.test(text)) score += 2;
  if (/robot|wbc|cartesian|joint|end-effector|gripper|arm/.test(text)) score += 4;
  if (/trajectory|sequence/.test(text)) score += 3;
  if (/chunk/.test(text)) score += 2;
  if (/action/.test(text)) score += 1;
  return score;
}

function inferComponents(model, arch, options = {}) {
  return uniqueByText([
    ...(model.diagram?.components || []),
    ...(arch.backbone || []),
    ...(arch.branches || []),
    ...(arch.heads || [])
  ].map((item) => ({
    label: conciseLabel(item),
    detail: compactDetail(item)
  })), "label").slice(0, options.mini ? 6 : 10);
}

function isUnifiedHeadArchitecture(model, arch, allText) {
  const text = [
    model.family,
    model.category,
    ...(arch.heads || []),
    ...(arch.branches || []),
    ...(arch.backbone || []),
    ...(arch.inferenceRecipe || []),
    ...(model.diagram?.outputs || [])
  ].join(" ").toLowerCase();
  if (model.family === "unified" || model.diagram?.pattern === "unified") {
    if (/separate.*head|separate.*decoder|action branch|future.*branch|observation.*branch|cvae action|linear.*action/.test(text)) return false;
    return true;
  }
  return /\bunified\s+(?:token\s+)?head\b|single\s+(?:shared\s+)?head|same\s+head|one\s+head\s+(?:for\s+)?(?:action.*observation|observation.*action)|joint\s+(?:obs|observation).*action\s+head|joint\s+action.*(?:obs|observation)\s+head/.test(text);
}

function shouldCollapseUnifiedHeads(model, arch, allText) {
  const text = [
    model.family,
    model.category,
    ...(arch.heads || []),
    ...(arch.branches || []),
    ...(arch.backbone || []),
    ...(model.diagram?.outputs || [])
  ].join(" ").toLowerCase();
  if (model.family !== "unified" && model.diagram?.pattern !== "unified") return false;
  if (/future image branch|future video branch|foresight branch|world-model branch|action branch reads|conditional vae action|cvae action/.test(text)) return false;
  return /same model can be|single joint|joint video-action|joint velocity prediction|both action noise and future-observation noise/.test(text);
}

function inferTraining(arch, allText, options = {}) {
  const items = [];
  (arch.objectives || []).forEach((item) => items.push({ label: objectiveLabel(item), detail: compactDetail(item), kind: "loss" }));
  (arch.trainingRecipe || []).forEach((item) => items.push({ label: trainingLabel(item), detail: compactDetail(item), kind: "stage" }));
  if (/flow matching/.test(allText)) items.push({ label: "Flow matching", detail: "velocity field supervision", kind: "loss" });
  if (/grpo|reward|rl/.test(allText)) items.push({ label: "Reward post-train", detail: "GRPO / value signal", kind: "stage" });
  return uniqueByText(items, "label").slice(0, options.mini ? 4 : 7);
}

function inferRuntime(arch, options = {}) {
  return (arch.inferenceRecipe || []).map(compactDetail).slice(0, options.mini ? 2 : 4);
}

function inferMotifs(allText) {
  return {
    diffusion: /diffusion|denois|flow matching|noise/.test(allText),
    multiStream: /mot|mixture|multi-stream|stream|branch|expert/.test(allText),
    trainingOnly: /training-only|during training|frozen|post-training|pretraining/.test(allText),
    online: /online|adaptive|test-time|ttt|memory/.test(allText)
  };
}

function drawColumnPanel(box, title, content) {
  return `
    <g>
      <rect class="diagram-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 23}">${escapeHtml(title)}</text>
      ${content}
    </g>
  `;
}

function drawColumnShell(box, title) {
  return `
    <g>
      <rect class="diagram-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 23}">${escapeHtml(title)}</text>
    </g>
  `;
}

function drawFittedColumnShell(box, rows, title = "") {
  const bounds = fittedRowsBounds(box, rows);
  return `
    <g>
      <rect class="diagram-panel io-column-panel" x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}"></rect>
      ${title ? `<text class="panel-title" x="${bounds.x + 14}" y="${bounds.y + 23}">${escapeHtml(title)}</text>` : ""}
    </g>
  `;
}

function fittedRowsBounds(box, rows) {
  if (!rows?.length) return { x: box.x, y: box.y + box.h * 0.42, w: box.w, h: 58 };
  const padY = 12;
  const minY = Math.min(...rows.map((row) => row.y));
  const maxY = Math.max(...rows.map((row) => row.y + row.h));
  return {
    x: box.x,
    y: Math.max(box.y, minY - padY),
    w: box.w,
    h: Math.min(box.y + box.h, maxY + padY) - Math.max(box.y, minY - padY)
  };
}

function drawColumnLabel(box, title) {
  return `<text class="panel-title floating-column-title" x="${box.x + 14}" y="${box.y + 23}">${escapeHtml(title)}</text>`;
}

function drawDenseTokenGroups(groups, box, mini) {
  return drawDenseTokenRows(denseTokenRows(groups, box, mini), mini);
}

function denseTokenRows(groups, box, mini) {
  const list = (groups.length ? groups : [{ kind: "visual", label: "observation", tokens: ["sensor tokens"] }]).slice(0, mini ? 5 : 6);
  const gap = mini ? 5 : 6;
  const available = box.h - 24;
  const rowH = Math.max(28, Math.min(mini ? 42 : 46, Math.floor((available - gap * (list.length - 1)) / list.length)));
  const contentH = list.length * rowH + Math.max(0, list.length - 1) * gap;
  const top = box.y + (box.h - contentH) / 2;
  return list.map((group, index) => {
    const row = {
      item: group,
      kind: group.kind || kindFromText(`${group.label} ${group.tokens?.join(" ")}`),
      x: box.x + 12,
      y: top + index * (rowH + gap),
      w: box.w - 24,
      h: rowH,
      centerY: top + index * (rowH + gap) + rowH / 2
    };
    return withIoAnchors(row);
  });
}

function drawDenseTokenRail(group, x, y, w, h, mini) {
  const colors = tokenColors(group.kind);
  const text = `${group.label || ""} ${(group.tokens || []).join(" ")}`;
  const tooltip = inputTooltip(group);
  const anchors = withIoAnchors({ x, y, w, h, centerY: y + h / 2 });
  const { iconX, iconY, iconW, iconH, tight } = anchors;
  const caption = ioCaption(group.kind, text, true);
  return `
    <g>
      <title>${escapeHtml(tooltip)}</title>
      <rect class="io-hit-area" x="${x}" y="${y}" width="${w}" height="${h}"></rect>
      <rect class="token-rail" x="${tight.x}" y="${tight.y}" width="${tight.w}" height="${tight.h}" fill="${colors[0]}" stroke="${colors[1]}"></rect>
      ${drawInputGlyph(group.kind, text, iconX, iconY, iconW, iconH)}
      ${drawIoDetailBadge(caption, tight.x + tight.w + 7, tight.y + tight.h + 3)}
    </g>
  `;
}

function drawDenseTokenRows(rows, mini) {
  return rows.map((row) => drawDenseTokenRail(row.item, row.x, row.y, row.w, row.h, mini)).join("");
}

function drawDenseEncoderStack(encoders, box, mini) {
  return drawDenseEncoderRows(denseEncoderRows(encoders, box, mini), mini);
}

function denseEncoderRows(encoders, box, mini, inputs = []) {
  const list = orderEncodersForInputs(preciseEncoders(encoders), inputs).slice(0, mini ? 5 : 6);
  const top = box.y + 42;
  const gap = mini ? 5 : 6;
  const available = box.h - 54;
  const itemH = Math.max(mini ? 42 : 40, Math.min(mini ? 48 : 60, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((encoder, index) => ({
    item: encoder,
    kind: encoder.kind || kindFromText(`${encoder.label} ${encoder.detail}`),
    x: box.x + 12,
    y: top + index * (itemH + gap),
    w: box.w - 24,
    h: itemH,
    centerY: top + index * (itemH + gap) + itemH / 2
  }));
}

function drawDenseEncoderRows(rows, mini) {
  return rows.map((row) => {
    const encoder = row.item;
    const y = row.y;
    const itemH = row.h;
    const kind = encoder.kind || "visual";
    const shape = encoderShape(encoder);
    const fill = encoderFill(kind);
    const stroke = encoderStroke(kind);
    const shapeSvg = drawEncoderShape(shape, row.x, y, row.w, itemH, fill, stroke, kind);
    const glyph = drawEncoderBodyGlyph(shape, row.x + row.w / 2, y + itemH * 0.62, row.w, itemH, kind);
    const detail = encoderDetailBadgeText(encoder.detail);
    return `
      <g class="encoder-node encoder-${escapeHtml(kind)} encoder-shape-${shape}">
        <title>${escapeHtml(`${encoder.label}${encoder.detail ? ` — ${encoder.detail}` : ""}`)}</title>
        ${shapeSvg}
        <text class="block-title" x="${row.x + row.w / 2}" y="${y + 14}" text-anchor="middle">${escapeHtml(shortText(encoder.label, 22))}</text>
        ${glyph}
        ${detail ? drawBlockDetailBadge(detail, row.x + row.w + 5, y + itemH + 3) : ""}
      </g>
    `;
  }).join("");
}

function drawDenseHeadStack(heads, box, mini) {
  return drawDenseHeadRows(denseHeadRows(heads, box, mini), mini);
}

function denseHeadRows(heads, box, mini, outputs = []) {
  const list = heads.length ? orderHeadsForOutputs(preciseHeads(heads), outputs).slice(0, mini ? 5 : 6) : [];
  if (!list.length) return [];
  const top = box.y + 42;
  const gap = mini ? 5 : 6;
  const available = box.h - 54;
  const itemH = Math.max(46, Math.min(mini ? 48 : 60, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((head, index) => ({
    item: head,
    kind: kindFromText(`${head.label} ${head.detail}`),
    x: box.x + 12,
    y: top + index * (itemH + gap),
    w: box.w - 24,
    h: itemH,
    centerY: top + index * (itemH + gap) + itemH / 2
  }));
}

function drawDenseHeadRows(rows, mini) {
  return rows.map((row) => {
    const head = row.item;
    const y = row.y;
    const kind = row.kind || kindFromText(`${head.label} ${head.detail}`);
    const shape = headShape(head);
    const fill = headFill(kind, shape);
    const stroke = headStroke(kind, shape);
    const shapeSvg = drawHeadShape(shape, row.x, y, row.w, row.h, fill, stroke, kind);
    const glyphKind = headGlyphKind(head);
    const glyphW = Math.min(88, row.w - 24);
    const glyphH = Math.max(21, row.h - 22);
    const glyphX = row.x + (row.w - glyphW) / 2;
    const glyphY = y + 17;
    const hideDetail = glyphKind === "idm" || glyphKind === "latent-idm";
    const detail = hideDetail ? "" : blockDetailBadgeText(head.detail);
    return `
      <g class="head-node head-${escapeHtml(kind)} head-shape-${shape}">
        <title>${escapeHtml(`${head.label}${head.detail ? ` — ${head.detail}` : ""}`)}</title>
        ${shapeSvg}
        <text class="block-title" x="${row.x + row.w / 2}" y="${y + 14}" text-anchor="middle">${escapeHtml(shortText(head.label, 22))}</text>
        ${glyphKind ? drawHeadGlyph(glyphKind, glyphX, glyphY, glyphW, glyphH, kind) : shape === "reverse-funnel" ? drawReverseFunnelGlyph(row.x + row.w / 2, y + row.h * 0.62, kind) : ""}
        ${detail ? drawBlockDetailBadge(detail, row.x + row.w + 5, y + row.h + 3) : ""}
      </g>
    `;
  }).join("");
}

function drawDenseOutputStack(outputs, box, mini) {
  return drawDenseOutputRows(denseOutputRows(outputs, box, mini), mini);
}

function denseOutputRows(outputs, box, mini) {
  const list = normalizeOutputs(outputs.length ? outputs : [{ label: "Action", detail: "runtime output" }]).slice(0, mini ? 5 : 6);
  const gap = mini ? 5 : 6;
  const available = box.h - 24;
  const itemH = Math.max(32, Math.min(mini ? 42 : 46, Math.floor((available - gap * (list.length - 1)) / list.length)));
  const contentH = list.length * itemH + Math.max(0, list.length - 1) * gap;
  const top = box.y + (box.h - contentH) / 2;
  return list.map((output, index) => {
    const row = {
      item: output,
      kind: outputKind(output),
      x: box.x + 10,
      y: top + index * (itemH + gap),
      w: box.w - 20,
      h: itemH,
      centerY: top + index * (itemH + gap) + itemH / 2
    };
    return withIoAnchors(row);
  });
}

function withIoAnchors(row) {
  const iconW = Math.min(row.w - 4, 58);
  const iconH = Math.min(row.h - 4, 42);
  const iconX = row.x + Math.max(4, (row.w - iconW) / 2);
  const iconY = row.y + Math.max(4, (row.h - iconH) / 2);
  const tight = ioTightBox(iconX, iconY, iconW, iconH);
  return {
    ...row,
    iconX,
    iconY,
    iconW,
    iconH,
    tight,
    leftAnchor: { x: tight.x, y: tight.y + tight.h / 2 },
    rightAnchor: { x: tight.x + tight.w, y: tight.y + tight.h / 2 }
  };
}

function drawDenseOutputRows(rows, mini) {
  return rows.map((row) => {
    const output = row.item;
    const y = row.y;
    const text = `${output.label || ""} ${output.detail || ""}`;
    const tooltip = outputTooltip(output);
    const kind = outputKind(output);
    const colors = tokenColors(kind);
    const { iconX, iconY, iconW, iconH, tight } = row;
    const caption = ioCaption(kind, text, false);
    return `
      <g>
        <title>${escapeHtml(tooltip)}</title>
        <rect class="io-hit-area" x="${row.x}" y="${y}" width="${row.w}" height="${row.h}"></rect>
        <rect class="${kind === "action" ? "action-output" : "output-block"}" x="${tight.x}" y="${tight.y}" width="${tight.w}" height="${tight.h}" fill="${colors[0]}" stroke="${colors[1]}"></rect>
        ${drawOutputGlyph(kind, text, iconX, iconY, iconW, iconH)}
        ${drawIoDetailBadge(caption, tight.x + tight.w + 7, tight.y + tight.h + 3)}
      </g>
    `;
  }).join("");
}

function drawSankeyRibbons(diagram, boxes, ids, mini, rows = {}) {
  const tracks = sankeyTracks(diagram).slice(0, mini ? 4 : 6);
  const [inputBox, encoderBox, coreBox, headBox, outputBox] = boxes;
  const coreIn = coreBox.x - 8;
  const coreOut = coreBox.x + coreBox.w + 8;
  const directOutputs = Boolean(rows.directOutputs);
  const inputRoutes = buildInputEncoderRoutes(rows.inputs || [], rows.encoders || []);
  const encoderRoutes = rows.encoders?.length ? rows.encoders : tracks.map((track, index) => ({
    kind: track.kind,
    x: encoderBox.x + 12,
    y: sankeyY(inputBox, track.kind, index, tracks.length) - 16,
    w: encoderBox.w - 24,
    h: 32,
    centerY: sankeyY(inputBox, track.kind, index, tracks.length)
  }));
  return `
    <g class="sankey-layer">
      ${inputRoutes.map((route) => drawSankeyRibbon(route.track, [
        [route.input.rightAnchor.x, route.input.rightAnchor.y],
        [route.input.rightAnchor.x + 10, route.input.rightAnchor.y],
        [route.encoder.x - 8, route.encoder.centerY],
        [route.encoder.x + route.encoder.w * 0.34, route.encoder.centerY]
      ], ids, "input-to-encoder", route.width)).join("")}
      ${encoderRoutes.map((encoder) => {
        const track = { kind: encoder.kind || "visual" };
        return drawSankeyRibbon(track, [
          [encoder.x + encoder.w * 0.66, encoder.centerY],
          [encoder.x + encoder.w + 12, encoder.centerY],
          [coreIn, encoder.centerY + sankeyDrift(track.kind, 1)]
        ], ids, "encoder-to-core", Math.max(12, sankeyWidth(track.kind) * 0.72));
      }).join("")}
      ${tracks.map((track, index) => {
        const outputAnchor = routeAnchorForKind(rows.outputs || [], track.kind, "left");
        if (!outputAnchor) return "";
        const y = routeYForKind(rows.heads || [], track.kind) ?? outputAnchor.y ?? sankeyY(inputBox, track.kind, index, tracks.length);
        const outputPoints = directOutputs
          ? [
            [coreOut, y + sankeyDrift(track.kind, 2)],
            [coreOut + Math.max(58, (outputAnchor.x - coreOut) * 0.42), y + sankeyDrift(track.kind, 2)],
            [outputAnchor.x, outputAnchor.y]
          ]
          : [
            [coreOut, y + sankeyDrift(track.kind, 2)],
            [headBox.x + 4, y + sankeyDrift(track.kind, 2)],
            [outputAnchor.x, outputAnchor.y]
          ];
        return drawSankeyRibbon(track, outputPoints, ids, "output");
      }).join("")}
    </g>
  `;
}

function drawInputGlyph(kind, text, x, y, w, h) {
  const resolved = ioKind(kind, text);
  if (/tactile|gelsight|touch|finger/.test(String(text || "").toLowerCase())) return drawTactileGlyph(x, y, w, h);
  if (/wrist|hand|end-effector|end effector|gripper/.test(String(text || "").toLowerCase())) return drawHandGlyph(x, y, w, h);
  if (resolved === "language") return drawLanguageGlyph(text, x, y, w, h);
  if (resolved === "state") return drawStateGlyph(x, y, w, h);
  if (resolved === "action") return drawActionGlyph(x, y, w, h);
  if (resolved === "noise") return drawNoisyFrameGlyph(x, y, w, h);
  return drawFrameStackGlyph(text, x, y, w, h, /video|frames|history|clip|rollout|future/i.test(text));
}

function drawOutputGlyph(kind, text, x, y, w, h) {
  const resolved = ioKind(kind, text);
  if (/tactile|gelsight|touch|finger/.test(String(text || "").toLowerCase())) return drawTactileGlyph(x, y, w, h);
  if (/wrist|hand|end-effector|end effector|gripper/.test(String(text || "").toLowerCase())) return drawHandGlyph(x, y, w, h);
  if (resolved === "action") return drawActionGlyph(x, y, w, h);
  if (resolved === "state") return drawStateGlyph(x, y, w, h);
  if (resolved === "noise") return drawNoisyFrameGlyph(x, y, w, h);
  if (resolved === "language") return drawLanguageGlyph(text, x, y, w, h);
  if (/latent|token|dino|jepa|value/i.test(text)) return drawLatentGlyph(x, y, w, h);
  return drawFrameStackGlyph(text, x, y, w, h, /video|frames|future|rollout|observation/i.test(text));
}

function drawIoDetailBadge(caption, rightX, baselineY) {
  if (!caption) return "";
  const width = Math.max(24, caption.length * 5.4 + 9);
  const x = rightX - width;
  const y = baselineY - 13;
  return `
    <g class="io-detail-badge">
      <rect x="${x}" y="${y}" width="${width}" height="15"></rect>
      <text x="${rightX - 5}" y="${baselineY - 3}" text-anchor="end">${escapeHtml(caption)}</text>
    </g>
  `;
}

function blockDetailBadgeText(detail) {
  const text = String(detail || "").trim();
  if (!text || /runtime output|paper output decoder|observation features|instruction features/i.test(text)) return "";
  return compactBadgeLabel(text);
}

function encoderDetailBadgeText(detail) {
  return blockDetailBadgeText(detail);
}

function compactBadgeLabel(detail) {
  const text = String(detail || "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const rules = [
    [/clip.*language|language.*clip|instruction.*clip|clip.*text/, "CLIP text"],
    [/t5.*language|language.*t5|instruction.*t5|t5.*text/, "T5 text"],
    [/qwen|gemma|paligemma|vlm/, "VLM"],
    [/history.*observ|observ.*history|frame history|past frames?/, "history obs"],
    [/current.*observ|current.*image|initial.*image|\bs0\b/, "current obs"],
    [/\bcls\b|class token/, "CLS token"],
    [/patch token|image patch/, "patch tokens"],
    [/static.*wrist|wrist.*static/, "static+wrist"],
    [/query tokens?|q-former|perceiver/, "queries"],
    [/action.*decoder|decoder.*action/, "action dec"],
    [/(arm|gripper).*action|action.*(arm|gripper|control|chunk|trajectory)|continuous arm|binary gripper/, "action dec"],
    [/action.*chunk|chunk.*action|chunk|horizon/, "chunk"],
    [/proprio|state|joint|end-effector|6-?dof/, "proprio"],
    [/future.*image|image.*decoder|future.*decoder|observation.*decoder/, "future dec"],
    [/hidden feature|feature tap|feature aggregation/, "feature tap"],
    [/diffusion|denois|noise|flow/, "diffusion"],
    [/velocity field|velocity/, "velocity"],
    [/latent/, "latent"],
    [/vae|vq-?gan|vq-?vae/, "VAE/VQ"],
    [/dino|jepa|siglip|mae|vit|resnet|cnn/, "vision feat"],
    [/linear|mlp|projection|projector/, "MLP"],
    [/video/, "video"],
    [/image|frame|rgb|camera|view/, "image"]
  ];
  const match = rules.find(([pattern]) => pattern.test(lower));
  if (match) return match[1];
  return fallbackBadgeLabel(text);
}

function fallbackBadgeLabel(text) {
  const cleaned = text
    .replace(/\b(?:encoded|processed|generated|trained|conditioned|supplied|through|using|with|from|into|by|the|and|for|during|runtime)\b/gi, " ")
    .replace(/[^a-z0-9+.-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  return words.slice(0, 2).join(" ") || "";
}

function drawBlockDetailBadge(caption, rightX, baselineY) {
  if (!caption) return "";
  const width = Math.max(32, caption.length * 5.1 + 11);
  const x = rightX - width;
  const y = baselineY - 16;
  return `
    <g class="block-detail-badge">
      <rect x="${x}" y="${y}" width="${width}" height="16"></rect>
      <text x="${rightX - 6}" y="${baselineY - 5}" text-anchor="end">${escapeHtml(caption)}</text>
    </g>
  `;
}

function ioTightBox(iconX, iconY, iconW, iconH) {
  return {
    x: iconX + 1,
    y: iconY + 1,
    w: Math.max(28, iconW - 1),
    h: Math.max(26, iconH - 1)
  };
}

function inputTooltip(group) {
  const role = {
    visual: "visual input",
    language: "language input",
    state: "robot state input",
    action: "action input",
    noise: "noise/timestep input",
    future: "future/latent input"
  }[group.kind] || "input";
  const detail = [group.label, ...(group.tokens || [])].filter(Boolean).join(": ");
  return detail ? `${role}: ${detail}` : role;
}

function outputTooltip(output) {
  const kind = outputKind(output);
  const role = {
    visual: "visual output",
    future: "latent/future output",
    action: "action output",
    state: "state/force output",
    language: "language output",
    noise: "noise output"
  }[kind] || "output";
  const detail = [output.label, output.detail].filter(Boolean).join(": ");
  return detail ? `${role}: ${detail}` : role;
}

function ioKind(kind, text) {
  const lower = String(text || "").toLowerCase();
  if (kind === "noise" || /noise|noisy|diffusion timestep/.test(lower)) return "noise";
  if (kind === "language" || /language|instruction|\btext\b|task description|goal/.test(lower)) return "language";
  if (kind === "state" || /state|proprio|joint|gripper|end-effector|force|tactile/.test(lower)) return "state";
  if (kind === "action" || /action|control|trajectory|chunk|policy|command/.test(lower)) return "action";
  return "visual";
}

function outputKind(output) {
  const text = `${output.label || ""} ${output.detail || ""}`;
  if (/action|control|trajectory|chunk|policy|command/i.test(text)) return "action";
  if (/state|force|tactile|proprio/i.test(text)) return "state";
  if (/noise|noisy/i.test(text)) return "noise";
  if (/language|instruction|\btext\b/i.test(text)) return "language";
  if (/latent|dino|jepa|value/i.test(text)) return "future";
  return "visual";
}

function ioCaption(kind, text, input) {
  const resolved = ioKind(kind, text);
  const detail = criticalIoDetail(resolved, text, input);
  return detail;
}

function criticalIoDetail(kind, text, input) {
  const lower = String(text || "").toLowerCase();
  const count = mediaFrameCount(lower);
  const views = lower.match(/(\d{1,2})\s*(?:camera|view|rgb[- ]?d|rgb)\b/);
  const hz = lower.match(/(\d{1,3})\s*hz\b/);
  const dof = lower.match(/(\d{1,2})[- ]?dof|\b(\d{1,2})[- ]?d\b.*(?:action|pose|end-effector)/);
  const chunk = lower.match(/(?:chunk|horizon|sequence)\D{0,10}(\d{1,3})/);
  if (views) return `${views[1]} views`;
  if (hz) return `${hz[1]} Hz`;
  if (/\bs0\b|current image|initial image/.test(lower)) return "s0";
  if (/static.*wrist|wrist.*static/.test(lower)) return "static+wrist";
  if (/final noised|white noise|x_t|xt noisy|noised video latent/.test(lower)) return "xT noise";
  if (kind === "visual" && count > 4) return `${count}x`;
  if (kind === "visual" && /dino/.test(lower)) return "DINO";
  if (kind === "visual" && /\bvae\b|latent/.test(lower)) return "VAE latent";
  if (kind === "state" && /6-?dof|6d/.test(lower)) return "6-DoF";
  if (kind === "state" && /proprio/.test(lower)) return "proprio";
  if (kind === "state" && /joint/.test(lower)) return "joints";
  if (kind === "action" && dof) return `${dof[1] || dof[2]}-D`;
  if (kind === "action" && chunk) return `${chunk[1]}-step`;
  if (kind === "action" && /chunk/.test(lower)) return "chunk";
  if (/query tokens?|learnable.*query/.test(lower)) return "queries";
  if (kind === "noise" && /flow/.test(lower)) return "flow t";
  if (kind === "noise" && /diffusion|denois/.test(lower)) return "diffusion t";
  return "";
}

function mediaFrameCount(text) {
  const lower = String(text || "").toLowerCase();
  const explicit = lower.match(/(?:^|\D)(\d{1,3})\s*(?:rgb\s*)?(?:frames?|views?|images?|camera views?|future frames?)/);
  if (explicit) return Number(explicit[1]);
  const horizon = lower.match(/(?:horizon|chunk|history|window|clip|sequence)\D{0,12}(\d{1,3})/);
  if (horizon) return Number(horizon[1]);
  if (/single|current|initial/.test(lower) && !/history|video|frames|clip/.test(lower)) return 1;
  if (/history|video|frames|clip|rollout|future/.test(lower)) return 4;
  return 1;
}

function drawFrameStackGlyph(text, x, y, w, h, preferStack = false) {
  const count = mediaFrameCount(text);
  const visible = Math.max(1, Math.min(4, preferStack ? count : 1));
  const frameW = Math.min(w - 4, 42);
  const frameH = Math.min(h - 4, 30);
  const baseX = x + Math.max(0, (w - frameW - (visible - 1) * 5) / 2);
  const baseY = y + Math.max(0, (h - frameH - (visible - 1) * 3) / 2);
  const frames = Array.from({ length: visible }, (_, index) => {
    const dx = (visible - 1 - index) * 5;
    const dy = (visible - 1 - index) * 3;
    return `
      <g>
        <rect class="io-frame" x="${baseX + dx}" y="${baseY + dy}" width="${frameW}" height="${frameH}"></rect>
        ${drawSceneIcon(baseX + dx, baseY + dy, frameW, frameH)}
      </g>
    `;
  }).join("");
  return frames;
}

function drawSceneIcon(x, y, w, h) {
  const sunX = x + w - 9;
  const sunY = y + 8;
  const flowerX = x + w * 0.42;
  const flowerY = y + h * 0.58;
  return `
    <rect class="io-sky" x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h * 0.45}"></rect>
    <circle class="io-sun" cx="${sunX}" cy="${sunY}" r="3.2"></circle>
    <path class="io-ground" d="M ${x + 3} ${y + h - 6} C ${x + w * 0.35} ${y + h - 10}, ${x + w * 0.66} ${y + h - 3}, ${x + w - 3} ${y + h - 7}"></path>
    <path class="io-stem" d="M ${flowerX} ${y + h - 7} C ${flowerX - 1} ${flowerY + 5}, ${flowerX + 1} ${flowerY + 2}, ${flowerX} ${flowerY}"></path>
    <circle class="io-flower-petal" cx="${flowerX}" cy="${flowerY - 4}" r="2.3"></circle>
    <circle class="io-flower-petal" cx="${flowerX + 4}" cy="${flowerY}" r="2.3"></circle>
    <circle class="io-flower-petal" cx="${flowerX}" cy="${flowerY + 4}" r="2.3"></circle>
    <circle class="io-flower-petal" cx="${flowerX - 4}" cy="${flowerY}" r="2.3"></circle>
    <circle class="io-flower-core" cx="${flowerX}" cy="${flowerY}" r="2"></circle>
  `;
}

function drawNoisyFrameGlyph(x, y, w, h) {
  const size = Math.min(w - 4, h - 4, 34);
  const fx = x + Math.max(0, (w - size) / 2);
  const fy = y + Math.max(0, (h - size) / 2);
  const cell = size / 8;
  const cells = Array.from({ length: 64 }, (_, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const cx = fx + col * cell;
    const cy = fy + row * cell;
    const hash = noiseHash(col, row);
    const shade = 38 + Math.floor(hash * 148);
    return `<rect class="io-noise-cell" x="${cx}" y="${cy}" width="${cell + 0.15}" height="${cell + 0.15}" fill="rgb(${shade},${shade},${shade})"></rect>`;
  }).join("");
  return `
    <rect class="io-frame io-noisy-frame" x="${fx}" y="${fy}" width="${size}" height="${size}"></rect>
    <g clip-path="inset(0 round 3px)">${cells}</g>
  `;
}

function noiseHash(x, y) {
  const n = Math.sin((x + 1) * 127.1 + (y + 1) * 311.7 + x * y * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function drawLanguageGlyph(text, x, y, w, h) {
  const boxW = Math.min(w - 3, 44);
  const boxH = Math.min(h - 3, 32);
  const bx = x + Math.max(0, (w - boxW) / 2);
  const by = y + Math.max(0, (h - boxH) / 2);
  return `
    <rect class="io-language-box" x="${bx}" y="${by}" width="${boxW}" height="${boxH}"></rect>
    <path class="io-quote-mark" d="M ${bx + 8} ${by + 9} C ${bx + 5} ${by + 12}, ${bx + 5} ${by + 17}, ${bx + 10} ${by + 18} M ${bx + 15} ${by + 9} C ${bx + 12} ${by + 12}, ${bx + 12} ${by + 17}, ${bx + 17} ${by + 18}"></path>
    <path class="io-language-line" d="M ${bx + 24} ${by + 10} L ${bx + boxW - 7} ${by + 10} M ${bx + 8} ${by + 23} L ${bx + boxW - 7} ${by + 23} M ${bx + 8} ${by + 28} L ${bx + boxW - 14} ${by + 28}"></path>
  `;
}

function drawStateGlyph(x, y, w, h) {
  return drawActionGlyph(x, y, w, h);
}

function drawActionGlyph(x, y, w, h) {
  const sx = x + 4;
  const sy = y + h * 0.5;
  const width = Math.min(w - 8, 54);
  return `
    <path class="io-action-path io-action-a" d="M ${sx} ${sy - 8} C ${sx + width * 0.2} ${sy - 18}, ${sx + width * 0.55} ${sy + 5}, ${sx + width} ${sy - 10}"></path>
    <path class="io-action-path io-action-b" d="M ${sx} ${sy} C ${sx + width * 0.25} ${sy + 12}, ${sx + width * 0.58} ${sy - 14}, ${sx + width} ${sy + 2}"></path>
    <path class="io-action-path io-action-c" d="M ${sx} ${sy + 8} C ${sx + width * 0.32} ${sy - 2}, ${sx + width * 0.63} ${sy + 18}, ${sx + width} ${sy + 8}"></path>
    <path class="io-action-path io-action-d" d="M ${sx} ${sy + 14} C ${sx + width * 0.22} ${sy + 2}, ${sx + width * 0.62} ${sy - 4}, ${sx + width} ${sy + 15}"></path>
    <circle class="io-action-point" cx="${sx}" cy="${sy - 8}" r="2"></circle>
  `;
}

function drawHandGlyph(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const scale = Math.min(w, h) / 42;
  const tx = cx - 21 * scale;
  const ty = cy - 21 * scale;
  return `
    <g class="io-hand-glyph" transform="translate(${tx} ${ty}) scale(${scale})">
      <path d="M 12 22 C 8 18, 8 13, 12 12 C 14 11.5, 16 13, 17 15 L 17 6 C 17 4.6, 18.1 3.5, 19.5 3.5 C 20.9 3.5, 22 4.6, 22 6 L 22 17 L 23 8 C 23.2 6.7, 24.3 5.8, 25.6 6 C 26.9 6.2, 27.7 7.3, 27.5 8.6 L 26.4 18 L 29 11 C 29.5 9.8, 30.8 9.2, 32 9.7 C 33.2 10.2, 33.8 11.5, 33.3 12.7 L 30.8 20.2 L 33.3 16.4 C 34.1 15.4, 35.5 15.1, 36.5 15.9 C 37.5 16.7, 37.7 18.1, 37 19.1 L 30.5 29 C 28.5 32, 25.4 34, 21.8 34 L 18 34 C 15.4 34, 13.1 32.6, 11.9 30.3 L 8.9 24.5 C 8.1 23.1, 9.1 21.4, 10.7 21.4 C 11.2 21.4, 11.6 21.6, 12 22 Z"></path>
      <path d="M 17 15 L 17 23 M 22 17 L 22 24 M 26.4 18 L 25.4 24"></path>
    </g>
  `;
}

function drawTactileGlyph(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const scale = Math.min(w, h) / 42;
  const tx = cx - 21 * scale;
  const ty = cy - 21 * scale;
  return `
    <g class="io-tactile-glyph" transform="translate(${tx} ${ty}) scale(${scale})">
      <path class="finger-body" d="M 15 28 C 13 20, 13 13, 17 8 C 20.4 3.8, 27 6.3, 27.2 11.7 C 27.5 18.6, 25.3 23.2, 22.5 29.3 C 21.5 31.6, 16 32, 15 28 Z"></path>
      <path class="fingerprint-line" d="M 18.8 13.5 C 21.2 11.6, 24.8 13.1, 24.8 16.3"></path>
      <path class="fingerprint-line" d="M 17.4 17.2 C 19.3 14.2, 23.4 14.7, 24.2 18.2 C 24.8 20.7, 23.5 23.2, 22.4 25.3"></path>
      <path class="fingerprint-line" d="M 16.8 21 C 18.2 18.2, 21.5 18, 22.3 20.6 C 22.9 22.3, 21.8 24.8, 20.8 26.5"></path>
      <path class="fingerprint-line" d="M 18.5 26.5 C 19.5 24.8, 20.4 22.8, 20 21.4"></path>
    </g>
  `;
}

function drawLatentGlyph(x, y, w, h) {
  const gx = x + Math.max(0, (w - 42) / 2);
  const gy = y + Math.max(0, (h - 26) / 2);
  return Array.from({ length: 12 }, (_, i) => {
    const cx = gx + (i % 4) * 11;
    const cy = gy + Math.floor(i / 4) * 9;
    return `<rect class="io-latent-cell" x="${cx}" y="${cy}" width="7" height="6"></rect>`;
  }).join("");
}

function drawSankeyRibbon(track, points, ids, phase = "", widthOverride = null) {
  const width = widthOverride || sankeyWidth(track.kind);
  const color = streamColor(track.kind);
  const top = points.map(([x, y]) => [x, y - width / 2]);
  const bottom = points.map(([x, y]) => [x, y + width / 2]).reverse();
  const d = [
    `M ${top[0][0]} ${top[0][1]}`,
    ...top.slice(1).map(([x, y], index) => {
      const [px, py] = top[index];
      const c = Math.max(28, (x - px) * 0.42);
      return `C ${px + c} ${py}, ${x - c} ${y}, ${x} ${y}`;
    }),
    `L ${bottom[0][0]} ${bottom[0][1]}`,
    ...bottom.slice(1).map(([x, y], index) => {
      const [px, py] = bottom[index];
      const c = Math.max(28, Math.abs(x - px) * 0.42);
      return `C ${px - c} ${py}, ${x + c} ${y}, ${x} ${y}`;
    }),
    "Z"
  ].join(" ");
  return `
    <path class="sankey-ribbon sankey-${escapeHtml(track.kind)} ${phase ? `sankey-${phase}` : ""}" d="${d}" fill="${streamGradient(track.kind, ids)}"></path>
    <path class="sankey-ribbon-edge" d="${ribbonCenterPath(points)}" stroke="${color}"></path>
  `;
}

function buildInputEncoderRoutes(inputs, encoders) {
  return inputs.map((input) => {
    const encoder = findBestEncoderForInput(input, encoders);
    const kind = routeKind(input, encoder);
    return {
      input,
      encoder: encoder || {
        x: input.x + input.w + 42,
        y: input.y,
        w: 80,
        h: input.h,
        centerY: input.centerY,
        kind
      },
      track: { kind },
      width: Math.min(sankeyWidth(kind), Math.max(12, input.h * 0.48))
    };
  });
}

function findBestEncoderForInput(input, encoders) {
  const inputText = `${input.item?.label || ""} ${input.item?.tokens?.join(" ") || ""}`.toLowerCase();
  const preferredKinds = encoderKindsForInput(input.kind, inputText);
  const scored = encoders.map((encoder) => ({
    encoder,
    score: encoderScoreForInput(input, inputText, encoder, preferredKinds)
  })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
  return scored[0]?.encoder || encoders.find((encoder) => preferredKinds.includes(encoder.kind)) || encoders[0];
}

function orderEncodersForInputs(encoders, inputs = []) {
  const remaining = encoders.map((encoder) => ({
    ...encoder,
    kind: encoder.kind || kindFromText(`${encoder.label} ${encoder.detail}`)
  }));
  const ordered = [];
  inputs.forEach((input) => {
    const inputText = `${input.item?.label || input.label || ""} ${input.item?.tokens?.join(" ") || input.tokens?.join(" ") || ""}`.toLowerCase();
    const preferredKinds = encoderKindsForInput(input.kind, inputText);
    let bestIndex = -1;
    let bestScore = 0;
    remaining.forEach((encoder, index) => {
      const score = encoderScoreForInput(input, inputText, { item: encoder, kind: encoder.kind }, preferredKinds);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) ordered.push(remaining.splice(bestIndex, 1)[0]);
  });
  return ordered.concat(remaining);
}

function orderHeadsForOutputs(heads, outputs = []) {
  const remaining = heads.map((head) => ({
    ...head,
    kind: kindFromText(`${head.label} ${head.detail}`)
  }));
  const ordered = [];
  outputs.forEach((output) => {
    const targetKind = output.kind || outputKind(output.item || output);
    let bestIndex = -1;
    let bestScore = 0;
    remaining.forEach((head, index) => {
      const score = headScoreForOutput(head, targetKind, output);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) ordered.push(remaining.splice(bestIndex, 1)[0]);
  });
  return ordered.concat(remaining);
}

function headScoreForOutput(head, targetKind, output) {
  const text = `${head.label || ""} ${head.detail || ""}`.toLowerCase();
  const outputText = `${output.item?.label || output.label || ""} ${output.item?.detail || output.detail || ""}`.toLowerCase();
  let score = head.kind === targetKind ? 4 : 0;
  if (targetKind === "action" && /action|policy|control|trajectory|chunk|act\b|diffusion|dit|mlp|idm/.test(text)) score += 8;
  if ((targetKind === "visual" || targetKind === "future") && /future|obs|observation|video|image|frame|decoder|vae|vq|latent/.test(text)) score += 8;
  if (targetKind === "language" && /language|text|instruction|t5/.test(text)) score += 8;
  if (targetKind === "state" && /state|proprio|force|tactile|joint/.test(text)) score += 8;
  if (/future|video|image|observation/.test(outputText) && /future|obs|video|image|decoder/.test(text)) score += 4;
  return score;
}

function encoderKindsForInput(kind, text) {
  if (/instruction|language|\btext\b|textual|goal/.test(text) || kind === "language") return ["language", "visual"];
  if (/state|proprio|gripper|end-effector|force|tactile/.test(text) || kind === "state") return ["state", "action", "visual"];
  if (/action|trajectory|chunk|control/.test(text) || kind === "action") return ["action", "state"];
  if (/future|latent|world|target|noise/.test(text) || kind === "future" || kind === "noise") return ["future", "visual", "action"];
  return ["visual", "future"];
}

function encoderScoreForInput(input, inputText, encoder, preferredKinds) {
  const encoderText = `${encoder.item?.label || ""} ${encoder.item?.detail || ""}`.toLowerCase();
  let score = preferredKinds.includes(encoder.kind) ? 4 : 0;
  if (/instruction|language|\btext\b|textual|goal/.test(inputText) && /t5|\btext\b|textual|language|vlm|qwen|gemma|llama|clip text|chameleon|prismatic|lwm/.test(encoderText)) score += 8;
  if (/image|rgb|camera|frame|visual|observation|video/.test(inputText) && /vae|vq|dino|siglip|clip|mae|vit|resnet|cnn|jepa|vggt|vision|image|video|chameleon|vlm|qwen|gemma|lwm/.test(encoderText)) score += 8;
  if (/state|proprio|gripper|end-effector|force|tactile/.test(inputText) && /state|proprio|mlp|linear|force|tactile/.test(encoderText)) score += 8;
  if (/action|trajectory|chunk|control/.test(inputText) && /action|trajectory|chunk|flow|mlp|linear|token/.test(encoderText)) score += 8;
  if (/future|latent|world|target/.test(inputText) && /future|latent|vae|dino|jepa|world|video/.test(encoderText)) score += 4;
  return score;
}

function routeKind(input, encoder) {
  if (input.kind === "language") return "language";
  if (input.kind === "state") return "state";
  if (input.kind === "action") return "action";
  if (input.kind === "future" || input.kind === "noise") return "future";
  return encoder?.kind || input.kind || "visual";
}

function routeYForKind(rows, kind) {
  const direct = rows.find((row) => row.kind === kind);
  if (direct) return direct.centerY;
  if (kind === "future") return rows.find((row) => /future|video|latent|value|depth/i.test(`${row.item?.label} ${row.item?.detail}`))?.centerY;
  if (kind === "action") return rows.find((row) => /action|policy|control|trajectory/i.test(`${row.item?.label} ${row.item?.detail}`))?.centerY;
  return null;
}

function routeAnchorForKind(rows, kind, side = "left") {
  const row = routeRowForKind(rows, kind);
  if (!row) return null;
  const anchor = side === "right" ? row.rightAnchor : row.leftAnchor;
  return anchor || { x: side === "right" ? row.x + row.w : row.x, y: row.centerY };
}

function routeRowForKind(rows, kind) {
  const direct = rows.find((row) => row.kind === kind);
  if (direct) return direct;
  if (kind === "future") return rows.find((row) => /future|video|latent|value|depth/i.test(`${row.item?.label} ${row.item?.detail}`));
  if (kind === "action") return rows.find((row) => /action|policy|control|trajectory|chunk/i.test(`${row.item?.label} ${row.item?.detail}`));
  if (kind === "visual") return rows.find((row) => /visual|image|video|frame|observation|rgb/i.test(`${row.item?.label} ${row.item?.detail}`));
  if (kind === "language") return rows.find((row) => /language|instruction|text|task/i.test(`${row.item?.label} ${row.item?.detail}`));
  if (kind === "state") return rows.find((row) => /state|proprio|joint|force|tactile/i.test(`${row.item?.label} ${row.item?.detail}`));
  return null;
}

function ribbonCenterPath(points) {
  return [
    `M ${points[0][0]} ${points[0][1]}`,
    ...points.slice(1).map(([x, y], index) => {
      const [px, py] = points[index];
      const c = Math.max(28, (x - px) * 0.42);
      return `C ${px + c} ${py}, ${x - c} ${y}, ${x} ${y}`;
    })
  ].join(" ");
}

function drawSankeyLabels(diagram, boxes) {
  const tracks = sankeyTracks(diagram).slice(0, 5);
  const inputBox = boxes[0];
  const outputBox = boxes[4];
  return `
    <g class="sankey-labels">
      ${tracks.map((track, index) => {
        const y = sankeyY(inputBox, track.kind, index, tracks.length);
        return `
          <text class="sankey-flow-label" x="${inputBox.x + 16}" y="${y - sankeyWidth(track.kind) / 2 - 4}">${escapeHtml(shortText(track.label, 18))}</text>
          <text class="sankey-flow-label is-output" x="${outputBox.x + outputBox.w - 10}" y="${y + sankeyDrift(track.kind, 3) - sankeyWidth(track.kind) / 2 - 4}" text-anchor="end">${escapeHtml(shortText(track.output, 16))}</text>
        `;
      }).join("")}
    </g>
  `;
}

function sankeyTracks(diagram) {
  const sources = [
    ...diagram.inputs.map((item) => ({ kind: item.kind || kindFromText(`${item.label} ${item.tokens?.join(" ")}`), label: item.label })),
    ...diagram.encoders.map((item) => ({ kind: item.kind || kindFromText(`${item.label} ${item.detail}`), label: item.label })),
    ...diagram.outputs.map((item) => ({ kind: kindFromText(`${item.label} ${item.detail}`), output: item.label }))
  ];
  const byKind = new Map();
  sources.forEach((item) => {
    if (!item.kind) return;
    const existing = byKind.get(item.kind) || { kind: item.kind, label: streamLabel(item.kind), output: streamOutput(item.kind, diagram) };
    if (item.label && existing.label === streamLabel(item.kind)) existing.label = item.label;
    if (item.output) existing.output = item.output;
    byKind.set(item.kind, existing);
  });
  ["visual", "language", "state", "future", "action"].forEach((kind) => {
    if (streamPresent(kind, diagram) && !byKind.has(kind)) byKind.set(kind, { kind, label: streamLabel(kind), output: streamOutput(kind, diagram) });
  });
  const order = ["visual", "language", "state", "future", "action", "latent", "noise"];
  return Array.from(byKind.values()).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

function streamPresent(kind, diagram) {
  const haystack = [
    ...diagram.inputs.map((item) => `${item.kind} ${item.label} ${item.tokens?.join(" ")}`),
    ...diagram.encoders.map((item) => `${item.kind} ${item.label} ${item.detail}`),
    ...diagram.heads.map((item) => `${item.label} ${item.detail}`),
    ...diagram.outputs.map((item) => `${item.label} ${item.detail}`)
  ].join(" ").toLowerCase();
  return kindFromText(haystack) === kind || new RegExp(kind === "visual" ? "rgb|image|video|observation|vision|vae|dino|siglip|clip" : kind).test(haystack);
}

function streamLabel(kind) {
  return {
    visual: "visual stream",
    language: "language stream",
    state: "state stream",
    future: "future/world stream",
    action: "action stream",
    latent: "latent stream",
    noise: "noise stream"
  }[kind] || "stream";
}

function streamOutput(kind, diagram) {
  const hit = diagram.outputs.find((output) => kindFromText(`${output.label} ${output.detail}`) === kind);
  if (hit) return hit.label;
  return {
    visual: "visual tokens",
    language: "conditioning",
    state: "state",
    future: "future state",
    action: "action",
    latent: "latent",
    noise: "denoise"
  }[kind] || "output";
}

function sankeyY(box, kind, index, count) {
  const fixed = {
    visual: 0.22,
    language: 0.36,
    state: 0.5,
    future: 0.64,
    action: 0.78,
    latent: 0.58,
    noise: 0.7
  };
  const ratio = fixed[kind] || (0.25 + index * (0.55 / Math.max(count - 1, 1)));
  return box.y + box.h * ratio;
}

function sankeyWidth(kind) {
  return {
    visual: 28,
    language: 18,
    state: 18,
    future: 24,
    action: 24,
    latent: 20,
    noise: 16
  }[kind] || 18;
}

function sankeyDrift(kind, stage) {
  const drift = {
    visual: [0, -6, -10, -8],
    language: [3, -2, 4, 8],
    state: [0, 4, 2, 0],
    future: [-2, -8, -10, -4],
    action: [0, 8, 10, 4],
    latent: [0, -4, -2, 0],
    noise: [0, 5, 6, 0]
  }[kind] || [0, 0, 0, 0];
  return drift[stage] || 0;
}

function encoderShape(encoder) {
  const text = `${encoder.label || ""} ${encoder.detail || ""}`.toLowerCase();
  if (/vlm|qwen|gemma|paligemma|prismatic|lwm|chameleon|llama|language model/.test(text)) return "vlm";
  if (/vae|vq|tokenizer|codebook|compress|latent|dino|siglip|clip vision|mae|resnet|cnn|vit|v-jepa|vggt|video encoder/.test(text)) return "funnel";
  if (/t5|text encoder|clip text|language/.test(text)) return "text";
  return "block";
}

function drawEncoderShape(shape, x, y, w, h, fill, stroke, kind) {
  if (shape === "funnel") {
    const narrow = Math.max(40, w * 0.42);
    const rightX = x + w;
    const ny0 = y + h * 0.27;
    const ny1 = y + h * 0.73;
    return `<path class="encoder-block encoder-funnel encoder-${escapeHtml(kind)}" d="M ${x} ${y} L ${rightX} ${ny0} L ${rightX} ${ny1} L ${x} ${y + h} Z" fill="${fill}" stroke="${stroke}"></path>`;
  }
  if (shape === "vlm") {
    return `
      <rect class="encoder-block encoder-vlm encoder-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>
      <rect class="encoder-vlm-screen" x="${x + w - 38}" y="${y + 8}" width="24" height="${Math.max(14, h - 16)}"></rect>
    `;
  }
  if (shape === "text") {
    return `<rect class="encoder-block encoder-text encoder-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>`;
  }
  return `<rect class="encoder-block encoder-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>`;
}

function headShape(head) {
  const text = `${head.label || ""} ${head.detail || ""}`.toLowerCase();
  if (/vae|vq-?gan|decoder|decode|reconstruct|uncompress|decompress/.test(text) && /video|image|frame|visual|observation|future|latent|depth|rgb-d|vae|vq/.test(text)) return "reverse-funnel";
  if (/unified|world-action|joint/.test(text)) return "vlm";
  if (/language|text|t5/.test(text)) return "text";
  return "block";
}

function drawHeadShape(shape, x, y, w, h, fill, stroke, kind) {
  if (shape === "reverse-funnel") {
    const wide = Math.max(40, w * 0.58);
    const leftX = x;
    const wy0 = y;
    const wy1 = y + h;
    return `<path class="head-block decoder-reverse-funnel head-${escapeHtml(kind)}" d="M ${leftX} ${y + h * 0.28} L ${x + w} ${wy0} L ${x + w} ${wy1} L ${leftX} ${y + h * 0.72} Z" fill="${fill}" stroke="${stroke}"></path>`;
  }
  if (shape === "vlm") {
    return `<rect class="head-block head-vlm head-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>`;
  }
  if (shape === "text") {
    return `<rect class="head-block head-text head-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>`;
  }
  return `<rect class="head-block head-${escapeHtml(kind)}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>`;
}

function headGlyphKind(head) {
  const label = `${head.label || ""}`.toLowerCase();
  const text = `${head.label || ""} ${head.detail || ""}`.toLowerCase();
  if (/latent.*\bidm\b|\bidm\b.*latent/.test(text)) return "latent-idm";
  if (/inverse dynamics|\bidm\b/.test(text)) return "idm";
  if (/diffusion policy/.test(text)) return "diffusion-policy";
  if (/action expert dit|\bdit\b|diffusion transformer/.test(text)) return "dit";
  if (/act-style|\bact-vae\b|\bact\b actor|\bact\b module|autoregressive action decoder/.test(text)) return "act";
  if (/depth|inverse-depth|regression|state\/action mlp|state-action mlp|mlp decoder/.test(text)) return "mlp";
  if (/future\/obs|future|video|image|frame|observation|vae|vq-?gan|decoder/.test(label) && !/diffusion|denois|flow|\bdit\b|idm/.test(text)) return "";
  if (/diffusion|denois|flow/.test(text)) return "diffusion-policy";
  if (/transformer|attention/.test(text)) return "transformer";
  if (/mlp|linear|projection|projector/.test(label)) return "mlp";
  return "";
}

function drawHeadGlyph(kind, x, y, w, h, streamKind = "action") {
  const pad = 1;
  if (kind === "dit") return drawMiniTransformerGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, { diffusion: true });
  if (kind === "act") return drawMiniTransformerGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, { label: "ACT" });
  if (kind === "transformer") return drawMiniTransformerGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, {});
  if (kind === "diffusion-policy") return drawMiniDiffusionPolicyGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2);
  if (kind === "idm") return drawIdmGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, false);
  if (kind === "latent-idm") return drawIdmGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, true);
  if (kind === "mlp") return drawMlpGlyph(x + pad, y + pad, w - pad * 2, h - pad * 2, "core-visual-mlp head-mlp-glyph");
  return "";
}

function drawMiniTransformerGlyph(x, y, w, h, options = {}) {
  const blockW = w * 0.58;
  const blockH = h * 0.46;
  const blockX = x + (w - blockW) / 2;
  const blockY = y + h * 0.27;
  const tokenN = 4;
  const tokenW = Math.min(8, (blockW - 8) / tokenN);
  const tokenGap = 3;
  const seqW = tokenN * tokenW + (tokenN - 1) * tokenGap;
  const seqX = blockX + (blockW - seqW) / 2;
  const tokens = (yy) => Array.from({ length: tokenN }, (_, index) => `<rect class="core-seq-token head-seq-token" x="${seqX + index * (tokenW + tokenGap)}" y="${yy}" width="${tokenW}" height="4"></rect>`).join("");
  const layers = Array.from({ length: 4 }, (_, index) => {
    const lx = blockX + 6 + index * ((blockW - 12) / 3);
    return `<path class="core-layer-line head-layer-line" d="M ${lx} ${blockY + 4} L ${lx} ${blockY + blockH - 4}"></path>`;
  }).join("");
  const label = options.label ? `<text class="head-glyph-label" x="${blockX + blockW / 2}" y="${blockY + blockH / 2 + 3}" text-anchor="middle">${escapeHtml(options.label)}</text>` : "";
  return `
    <g class="head-glyph head-transformer-glyph">
      ${tokens(blockY - 7)}
      <rect class="core-transformer-block head-transformer-block" x="${blockX}" y="${blockY}" width="${blockW}" height="${blockH}"></rect>
      ${layers}
      ${label}
      ${tokens(blockY + blockH + 3)}
      ${options.diffusion ? drawDiffusionLoop(blockX + blockW + 9, blockY + blockH / 2, Math.min(22, w * 0.32), Math.min(22, h * 0.56)) : ""}
    </g>
  `;
}

function drawMiniDiffusionPolicyGlyph(x, y, w, h) {
  const cx = x + w * 0.48;
  const cy = y + h * 0.52;
  const sw = w * 0.44;
  const sh = h * 0.46;
  const slices = Array.from({ length: 4 }, (_, index) => `
    <rect class="core-cnn-slice head-cnn-slice" x="${cx - sw / 2 + index * 4}" y="${cy - sh / 2 + index * 2}" width="${sw}" height="${sh}"></rect>
  `).join("");
  return `<g class="head-glyph head-diffusion-policy-glyph">${slices}${drawDiffusionLoop(x + w * 0.78, cy, Math.min(22, w * 0.34), Math.min(22, h * 0.58))}</g>`;
}

function drawIdmGlyph(x, y, w, h, latent = false) {
  const frameW = Math.min(22, w * 0.34);
  const frameH = Math.min(18, h * 0.58);
  const leftX = x + 2;
  const rightX = x + w - frameW - 2;
  const fy = y + (h - frameH) / 2;
  const midX = x + w / 2;
  return `
    <g class="head-glyph idm-glyph ${latent ? "latent-idm-glyph" : ""}">
      ${latent ? drawLatentIdmFrame(leftX, fy, frameW, frameH, "t") : drawIdmFrame(leftX, fy, frameW, frameH, "t")}
      ${latent ? drawLatentIdmFrame(rightX, fy, frameW, frameH, "t+1") : drawIdmFrame(rightX, fy, frameW, frameH, "t+1")}
      <path class="idm-back-arrow" d="M ${rightX - 2} ${fy + frameH * 0.5} C ${midX + 8} ${fy - 2}, ${midX - 8} ${fy - 2}, ${leftX + frameW + 2} ${fy + frameH * 0.5}"></path>
      <path class="idm-back-arrow-head" d="M ${leftX + frameW + 2} ${fy + frameH * 0.5} L ${leftX + frameW + 8} ${fy + frameH * 0.5 - 4} L ${leftX + frameW + 8} ${fy + frameH * 0.5 + 4} Z"></path>
    </g>
  `;
}

function drawIdmFrame(x, y, w, h, badge) {
  return `
    <g>
      <rect class="idm-frame" x="${x}" y="${y}" width="${w}" height="${h}"></rect>
      ${drawSceneIcon(x, y, w, h)}
      ${drawSmallCornerBadge(x + w - 12, y + h - 8, badge)}
    </g>
  `;
}

function drawLatentIdmFrame(x, y, w, h, badge) {
  return `
    <g>
      <rect class="idm-frame latent-idm-frame" x="${x}" y="${y}" width="${w}" height="${h}"></rect>
      <text class="latent-idm-z" x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">Z</text>
      ${drawSmallCornerBadge(x + w - 12, y + h - 8, badge)}
    </g>
  `;
}

function drawSmallCornerBadge(x, y, text) {
  const w = Math.max(12, String(text).length * 4.2 + 5);
  return `
    <g class="idm-time-badge">
      <rect x="${x}" y="${y}" width="${w}" height="8"></rect>
      <text x="${x + w - 2}" y="${y + 6}" text-anchor="end">${escapeHtml(text)}</text>
    </g>
  `;
}

function drawReverseFunnelGlyph(x, y, kind) {
  const color = streamColor(kind);
  return `
    <g class="encoder-glyph decoder-glyph">
      <path d="M ${x - 11} ${y} L ${x + 1} ${y - 8} M ${x - 11} ${y} L ${x + 1} ${y + 8}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
      <circle cx="${x + 9}" cy="${y - 8}" r="2.5" fill="${color}"></circle>
      <circle cx="${x + 9}" cy="${y}" r="2.5" fill="${color}"></circle>
      <circle cx="${x + 9}" cy="${y + 8}" r="2.5" fill="${color}"></circle>
    </g>
  `;
}

function headFill(kind, shape) {
  if (shape === "reverse-funnel") return "#eef8f7";
  return encoderFill(kind);
}

function headStroke(kind, shape) {
  if (shape === "reverse-funnel") return "#2f8793";
  return encoderStroke(kind);
}

function drawFunnelGlyph(x, y, kind) {
  const color = streamColor(kind);
  return `
    <g class="encoder-glyph">
      <circle cx="${x - 9}" cy="${y - 7}" r="2.5" fill="${color}"></circle>
      <circle cx="${x - 9}" cy="${y}" r="2.5" fill="${color}"></circle>
      <circle cx="${x - 9}" cy="${y + 7}" r="2.5" fill="${color}"></circle>
      <path d="M ${x - 2} ${y - 8} L ${x + 10} ${y} L ${x - 2} ${y + 8}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"></path>
    </g>
  `;
}

function drawEncoderBodyGlyph(shape, cx, cy, rowW, rowH, kind) {
  const glyphW = Math.min(74, rowW * 0.56);
  const glyphH = Math.max(18, Math.min(30, rowH - 24));
  const x = cx - glyphW / 2;
  const y = cy - glyphH / 2;
  if (shape === "vlm") return drawVlmGlyph(x, y, glyphW, glyphH, kind);
  if (shape === "funnel") return drawFunnelGlyph(cx, cy, kind);
  if (shape === "text") return drawTextEncoderGlyph(x, y, glyphW, glyphH, kind);
  return drawMlpGlyph(x + 6, y + 1, glyphW - 12, glyphH - 2, "core-visual-mlp encoder-mlp-glyph");
}

function drawTextEncoderGlyph(x, y, w, h, kind) {
  const color = streamColor(kind);
  const lineY = [0.28, 0.5, 0.72].map((p) => y + h * p);
  return `
    <g class="encoder-glyph text-encoder-glyph">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ry="4" fill="rgba(255,255,255,0.36)" stroke="${color}" stroke-width="1.2"></rect>
      ${lineY.map((yy, index) => `<path d="M ${x + 7} ${yy} L ${x + w - 8 - index * 6} ${yy}" stroke="${color}" stroke-width="1.4" stroke-linecap="round"></path>`).join("")}
    </g>
  `;
}

function drawVlmGlyph(x, y, w, h, kind) {
  const color = streamColor(kind);
  const lines = [0.34, 0.5, 0.66].map((p) => {
    const xx = x + w * p;
    return `<path d="M ${xx} ${y + 4} L ${xx} ${y + h - 4}" stroke="${color}" stroke-width="1.25" stroke-linecap="round"></path>`;
  }).join("");
  return `
    <g class="encoder-glyph">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ry="3" fill="none" stroke="${color}" stroke-width="1.3"></rect>
      ${lines}
    </g>
  `;
}

function encoderFill(kind) {
  return {
    language: "#f5ecfb",
    action: "#fff5e4",
    state: "#edf7ed",
    latent: "#eaf7f6",
    future: "#eaf7f6",
    visual: "#eef6ff"
  }[kind] || "#f8fbff";
}

function encoderStroke(kind) {
  return {
    language: "#b48bd0",
    action: "#d49a3d",
    state: "#72a36e",
    latent: "#2f8793",
    future: "#2f8793",
    visual: "#5d8fc5"
  }[kind] || "#b9cbe0";
}

function drawEncoderOnlyCore(box, diagram, mini, ids) {
  const trainY = box.y + (mini ? 74 : 86);
  const runtimeY = box.y + (mini ? 162 : 196);
  const ditX = box.x + box.w * 0.34;
  const latentX = box.x + box.w * 0.5;
  const policyX = box.x + box.w * 0.76;
  const laneX = box.x + 24;
  const laneW = box.w - 48;
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel encoder-policy-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      <g class="encoder-only-train">
        <rect x="${laneX}" y="${trainY - 35}" width="${laneW}" height="${mini ? 70 : 78}"></rect>
        <text x="${laneX + 13}" y="${trainY - 17}">train-only video loss</text>
        ${drawCoreVisual("dit", ditX - 52, trainY - 12, 104, mini ? 42 : 48, { diffusion: true })}
        <path class="encoder-only-train-link" d="M ${ditX + 52} ${trainY + 10} C ${latentX - 36} ${trainY + 22}, ${latentX - 38} ${runtimeY - 38}, ${latentX - 20} ${runtimeY - 18}"></path>
      </g>
      <g class="encoder-only-runtime">
        <rect x="${laneX}" y="${runtimeY - 40}" width="${laneW}" height="${mini ? 76 : 84}"></rect>
        <text x="${laneX + 13}" y="${runtimeY - 21}">runtime path</text>
        ${drawLatentGlyph(latentX - 34, runtimeY - 15, 68, 34)}
        <text x="${latentX}" y="${runtimeY + 34}" text-anchor="middle">latent state</text>
        ${drawMlpGlyph(policyX - 30, runtimeY - 20, 60, 42, "core-visual-mlp encoder-only-policy-glyph")}
        <text x="${policyX}" y="${runtimeY + 34}" text-anchor="middle">action policy</text>
      </g>
      <path class="encoder-only-runtime-arrow" d="M ${laneX + 14} ${runtimeY} C ${box.x + 90} ${runtimeY}, ${latentX - 48} ${runtimeY}, ${latentX - 34} ${runtimeY}"></path>
      <path class="encoder-only-runtime-arrow" d="M ${latentX + 40} ${runtimeY} C ${latentX + 72} ${runtimeY}, ${policyX - 50} ${runtimeY}, ${policyX - 33} ${runtimeY}"></path>
      <path class="encoder-only-cut" d="M ${laneX} ${trainY + 50} L ${box.x + box.w - 24} ${trainY + 50}"></path>
      <text class="core-note" x="${box.x + 32}" y="${box.y + box.h - 17}">video DiT shapes the latent during training, then is absent at inference</text>
    </g>
  `;
}

function drawInputEncoderStack(diagram, box, mini) {
  const splitY = box.y + (mini ? 116 : 134);
  const tokenBox = { x: box.x, y: box.y, w: box.w, h: mini ? 126 : 146 };
  const encoderBox = { x: box.x, y: splitY, w: box.w, h: box.h - (splitY - box.y) };
  const tokenCount = 2;
  const encoderCount = 2;
  return `
    ${drawTokenGroups(diagram.inputs.slice(0, tokenCount), tokenBox, mini)}
    <text class="stack-title" x="${box.x + 18}" y="${splitY + 23}">encoders</text>
    ${drawEncoderStack(diagram.encoders.slice(0, encoderCount), encoderBox, mini)}
  `;
}

function drawTokenGroups(groups, box, mini) {
  const list = groups.length ? groups : [{ kind: "visual", label: "observation", tokens: ["sensor tokens"] }];
  const top = box.y + 44;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const rowH = Math.max(44, Math.min(mini ? 58 : 56, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((group, index) => drawTokenRail(group, box.x + 14, top + index * (rowH + gap), box.w - 28, rowH, mini)).join("");
}

function drawTokenRail(group, x, y, w, h, mini) {
  const colors = {
    visual: ["#e8f2ff", "#5d8fc5"],
    language: ["#f2eafa", "#9874b8"],
    state: ["#edf7ed", "#72a36e"],
    action: ["#fff2dc", "#d49a3d"],
    noise: ["#f4f5f7", "#a9b1b8"]
  };
  const [fill, stroke] = colors[group.kind] || colors.visual;
  const count = Math.max(3, Math.min(6, group.tokens.length + 1));
  const tokenW = Math.min(22, (w - 24) / count);
  const tokenStart = x + w - count * tokenW - (count - 1) * 3 - 10;
  const tokenY = y + h - 21;
  const tokenSvg = Array.from({ length: count }, (_, i) => `
    <rect class="token-cell" x="${tokenStart + i * (tokenW + 3)}" y="${tokenY}" width="${tokenW}" height="14" fill="${fill}" stroke="${stroke}"></rect>
  `).join("");
  const label = compactToken(group.label);
  const details = group.tokens.slice(0, mini ? 1 : 2).join(" / ");
  const detailChars = Math.max(12, Math.floor((tokenStart - x - 18) / 5.4));
  return `
    <g>
      <rect class="token-rail" x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"></rect>
      <text class="rail-label" x="${x + 10}" y="${y + 18}">${escapeHtml(label)}</text>
      ${drawWrappedText(details, x + 10, y + 34, detailChars, mini ? 1 : 2, "rail-detail", 10.5)}
      ${tokenSvg}
    </g>
  `;
}

function drawEncoderStack(encoders, box, mini) {
  const list = encoders.length ? encoders : [
    { label: "Vision Encoder", detail: "observation features" },
    { label: "Text / Goal Encoder", detail: "instruction features" }
  ];
  const top = box.y + 48;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const itemH = Math.max(38, Math.min(mini ? 46 : 50, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((encoder, index) => {
    const y = top + index * (itemH + gap);
    return `
      <g>
        <rect class="encoder-block" x="${box.x + 14}" y="${y}" width="${box.w - 28}" height="${itemH}"></rect>
        <text class="block-label" x="${box.x + 25}" y="${y + 18}">${escapeHtml(encoder.label)}</text>
        ${drawWrappedText(encoder.detail, box.x + 25, y + 34, 18, itemH > 44 ? 1 : 0, "block-detail", 10)}
      </g>
    `;
  }).join("");
}

function drawCorePanel(diagram, box, mini, ids) {
  const attentionSvg = drawAttentionBadges(diagram.attention, box, mini);
  const memorySvg = diagram.motifs.online ? `<text class="core-note" x="${box.x + 24}" y="${box.y + box.h - 22}">online/cache path updates context without changing the main token grammar</text>` : "";

  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 24}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 24, box.y + 50, 36, 2, "core-detail", 11)}
      ${drawCoreVisual(diagram.core.kind, box.x + 44, box.y + 92, box.w - 88, mini ? 116 : 142, { autoregressive: isAutoregressiveDiagram(diagram) })}
      ${attentionSvg}
      ${memorySvg}
    </g>
  `;
}

function drawCoreStream(stream, x, y, w, h) {
  const tokenCount = 5;
  const tokenW = 13;
  const tokenGap = 4;
  const tokenStart = x + w - tokenCount * tokenW - (tokenCount - 1) * tokenGap - 10;
  const tokenSvg = Array.from({ length: tokenCount }, (_, index) => `
    <rect class="core-token" x="${tokenStart + index * (tokenW + tokenGap)}" y="${y + 9}" width="${tokenW}" height="12" fill="${stream.color}"></rect>
  `).join("");
  return `
    <g>
      <rect class="stream-row" x="${x}" y="${y}" width="${w}" height="${h}" style="--stream:${stream.color}"></rect>
      <text class="stream-label" x="${x + 12}" y="${y + 15}">${escapeHtml(stream.label)}</text>
      ${tokenSvg}
      ${drawWrappedText(stream.detail, x + 12, y + 28, 24, 1, "stream-detail", 9.5)}
    </g>
  `;
}

function drawAttentionBadges(badges, box, mini) {
  const visibleBadges = (badges || []).filter((badge) => !/causal mask|leakage mask/i.test(badge));
  const startX = box.x + 24;
  const y = box.y + box.h - (mini ? 74 : 82);
  return visibleBadges.map((badge, index) => {
    const x = startX + (index % 3) * 84;
    const row = Math.floor(index / 3);
    return `
      <rect class="attention-badge" x="${x}" y="${y + row * 28}" width="74" height="20"></rect>
      <text class="attention-text" x="${x + 37}" y="${y + 14 + row * 28}" text-anchor="middle">${escapeHtml(badge)}</text>
    `;
  }).join("");
}

function drawNoiseSchedule(box, mini, ids) {
  const x = box.x + box.w - 128;
  const y = box.y + box.h - (mini ? 70 : 78);
  const steps = Array.from({ length: 4 }, (_, index) => {
    const cx = x + 14 + index * 24;
    const cy = y + 28 - index * 5;
    return `
      <circle class="noise-step" cx="${cx}" cy="${cy}" r="${7 - index}"></circle>
      ${index < 3 ? `<path class="dashed-flow" d="M ${cx + 8} ${cy - 2} L ${cx + 18} ${cy - 5}" marker-end="url(#${ids.arrow})"></path>` : ""}
    `;
  }).join("");
  return `
    <g>
      <text class="core-note" x="${x}" y="${y}">denoise / flow</text>
      ${steps}
    </g>
  `;
}

function drawHeadStack(heads, box, mini) {
  const list = heads.length ? heads : [{ label: "Policy Head", detail: "paper output decoder" }];
  const top = box.y + 48;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const itemH = Math.max(42, Math.min(mini ? 50 : 54, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((head, index) => {
    const y = top + index * (itemH + gap);
    return `
      <g class="diagram-node">
        <rect class="head-block" x="${box.x + 12}" y="${y}" width="${box.w - 24}" height="${itemH}"></rect>
        <text class="block-label" x="${box.x + 22}" y="${y + 18}">${escapeHtml(head.label)}</text>
        ${drawWrappedText(head.detail, box.x + 22, y + 34, 13, mini ? 1 : 2, "block-detail", 10)}
      </g>
    `;
  }).join("");
}

function drawOutputStack(outputs, box, mini) {
  const list = normalizeOutputs(outputs.length ? outputs : [{ label: "Action", detail: "runtime output" }]);
  const top = box.y + 48;
  const gap = mini ? 7 : 9;
  const available = box.h - 58;
  const itemH = Math.max(42, Math.min(mini ? 52 : 58, Math.floor((available - gap * (list.length - 1)) / list.length)));
  return list.map((output, index) => {
    const y = top + index * (itemH + gap);
    const isAction = /action|control|policy|trajectory/i.test(output.label);
    const cellCount = isAction ? 4 : 3;
    const cellW = 14;
    const tokenStart = box.x + 22;
    const tokenY = y + itemH - 16;
    const labelChars = Math.max(12, Math.floor((box.w - 34) / 5.8));
    const showDetail = itemH >= 52;
    const tokenCells = Array.from({ length: isAction ? 4 : 3 }, (_, i) => `
      <rect class="${isAction ? "action-cell" : "output-cell"}" x="${tokenStart + i * (cellW + 4)}" y="${tokenY}" width="14" height="10"></rect>
    `).join("");
    return `
      <g class="diagram-node">
        <rect class="${isAction ? "action-output" : "output-block"}" x="${box.x + 12}" y="${y}" width="${box.w - 24}" height="${itemH}"></rect>
        <text class="output-label" x="${box.x + 22}" y="${y + 18}">${escapeHtml(shortText(output.label, labelChars))}</text>
        ${showDetail ? drawWrappedText(output.detail, box.x + 22, y + 35, Math.max(10, labelChars + 2), 1, "output-detail", 10) : ""}
        ${tokenCells}
      </g>
    `;
  }).join("");
}

function drawMainConnectors(inputBox, encoderBox, coreBox, headBox, outputBox, ids) {
  return `
    <g>
      ${drawConnector(inputBox.x + inputBox.w, inputBox.y + inputBox.h * 0.42, encoderBox.x, encoderBox.y + encoderBox.h * 0.42, "tokenize", false, ids)}
      ${drawConnector(encoderBox.x + encoderBox.w, encoderBox.y + encoderBox.h * 0.5, coreBox.x, coreBox.y + coreBox.h * 0.5, "embed", false, ids)}
      ${drawConnector(coreBox.x + coreBox.w, coreBox.y + coreBox.h * 0.42, headBox.x, headBox.y + headBox.h * 0.42, "decode", false, ids)}
      ${drawConnector(headBox.x + headBox.w, headBox.y + headBox.h * 0.5, outputBox.x, outputBox.y + outputBox.h * 0.5, "emit", false, ids)}
    </g>
  `;
}

function drawTrainingBand(diagram, box, coreBox, headBox, mini, ids) {
  const items = diagram.training.length ? diagram.training : [{ label: "Supervised objective", detail: "method-section training signal", kind: "loss" }];
  const itemLimit = mini ? 4 : 7;
  const visibleItems = items.slice(0, itemLimit);
  const chipW = Math.min(142, (box.w - 42) / Math.max(visibleItems.length, 1) - 8);
  const dataChips = (diagram.data || []).map((item, index) => `
    <g>
      <rect class="data-chip" x="${box.x + 18 + index * 150}" y="${box.y + 38}" width="136" height="22"></rect>
      <text class="data-text" x="${box.x + 86 + index * 150}" y="${box.y + 53}" text-anchor="middle">${escapeHtml(shortText(compactToken(item), 18))}</text>
    </g>
  `).join("");
  const stageChips = visibleItems.map((item, index) => {
    const x = box.x + 18 + index * (chipW + 8);
    const y = box.y + (mini ? 66 : 76);
    const h = mini ? 34 : 44;
    const labelChars = Math.max(10, Math.floor((chipW - 18) / 7));
    return `
      <g class="training-chip">
        <rect class="stage-chip ${item.kind === "loss" ? "is-loss" : "is-stage"}" x="${x}" y="${y}" width="${chipW}" height="${h}"></rect>
        <text class="training-label" x="${x + 9}" y="${y + 16}">${escapeHtml(shortText(item.label, labelChars))}</text>
        ${drawWrappedText(item.detail, x + 9, y + 31, Math.max(12, Math.floor((chipW - 18) / 5.5)), mini ? 1 : 2, "training-detail", 9.5)}
      </g>
    `;
  }).join("");

  return `
    <g>
      ${drawConnector(box.x + box.w * 0.44, box.y, coreBox.x + coreBox.w * 0.45, coreBox.y + coreBox.h, "", true, ids)}
      ${drawConnector(box.x + box.w * 0.74, box.y, headBox.x + headBox.w * 0.5, headBox.y + headBox.h, "", true, ids)}
      <rect class="training-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">training data + objectives</text>
      ${dataChips}
      ${stageChips}
    </g>
  `;
}

function drawRuntimeStrip(runtime, coreBox, outputBox, trainBox) {
  const steps = runtime.length ? runtime : ["encode current observation", "run core", "decode action"];
  const x = coreBox.x;
  const y = trainBox.y + trainBox.h + 22;
  const w = outputBox.x + outputBox.w - coreBox.x;
  const stepW = Math.min(160, (w - 18) / Math.max(steps.length, 1) - 10);
  const chips = steps.slice(0, 4).map((step, index) => {
    const sx = x + 10 + index * (stepW + 10);
    return `
      <g>
        <rect class="runtime-step" x="${sx}" y="${y}" width="${stepW}" height="34"></rect>
        ${drawWrappedText(`${index + 1}. ${step}`, sx + 10, y + 15, Math.max(12, Math.floor((stepW - 20) / 5.6)), 2, "runtime-text", 9.5)}
      </g>
    `;
  }).join("");
  return `
    <g>
      <text class="panel-title" x="${x}" y="${y - 10}">runtime path</text>
      ${chips}
    </g>
  `;
}

function drawConnector(x1, y1, x2, y2, label = "", dashed = false, ids = { arrow: "diagramArrow" }) {
  const direction = x2 >= x1 ? 1 : -1;
  const c = Math.max(36, Math.abs(x2 - x1) * 0.45);
  const cls = dashed ? "dashed-flow" : "diagram-flow";
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 7;
  return `
    <path class="${cls}" d="M ${x1} ${y1} C ${x1 + direction * c} ${y1}, ${x2 - direction * c} ${y2}, ${x2} ${y2}" marker-end="url(#${ids.arrow})"></path>
    ${label ? `<text class="edge-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(label)}</text>` : ""}
  `;
}

function drawTypedFlow(fromBox, toBox, kind, ids, fromRatio = 0.5, toRatio = 0.5, label = "") {
  const x1 = fromBox.x + fromBox.w;
  const y1 = fromBox.y + fromBox.h * fromRatio;
  const x2 = toBox.x;
  const y2 = toBox.y + toBox.h * toRatio;
  const direction = x2 >= x1 ? 1 : -1;
  const c = Math.max(28, Math.abs(x2 - x1) * 0.42);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 9;
  const color = streamColor(kind);
  return `
    <path class="stream-flow" stroke="${streamGradient(kind, ids)}" d="M ${x1} ${y1} C ${x1 + direction * c} ${y1}, ${x2 - direction * c} ${y2}, ${x2} ${y2}"></path>
    <path class="flow-chevron" stroke="${color}" d="M ${x2 - direction * 12} ${y2 - 5} L ${x2} ${y2} L ${x2 - direction * 12} ${y2 + 5}"></path>
    ${label ? `<text class="edge-label stream-edge-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(label)}</text>` : ""}
  `;
}

function drawStreamBundle(fromBox, toBox, items, ids, label = "") {
  const kinds = uniqueByText((items || []).map((item) => ({
    kind: item.kind || kindFromText(`${item.label || item} ${item.detail || ""}`),
    label: item.label || String(item)
  })), "kind").slice(0, 4);
  const visible = kinds.length ? kinds : [{ kind: "visual", label: "features" }];
  return visible.map((item, index) => {
    const fromRatio = 0.28 + index * (0.44 / Math.max(visible.length - 1, 1));
    const toRatio = fromRatio;
    return drawTypedFlow(fromBox, toBox, item.kind, ids, fromRatio, toRatio, index === 0 ? label : "");
  }).join("");
}

function drawUnificationFlow(fromBox, toBox, diagram, ids) {
  const pattern = diagram.pattern || diagram.family;
  if (pattern === "multi_stream") {
    return [
      drawTypedFlow(fromBox, toBox, "visual", ids, 0.34, 0.36, "fuse"),
      drawTypedFlow(fromBox, toBox, "action", ids, 0.64, 0.64, "")
    ].join("");
  }
  if (pattern === "encoder_only") {
    return [
      drawTypedFlow(fromBox, toBox, "action", ids, 0.48, 0.52, "policy"),
      drawConnector(fromBox.x + fromBox.w, fromBox.y + fromBox.h * 0.74, toBox.x, toBox.y + toBox.h * 0.78, "train-only", true, ids)
    ].join("");
  }
  if (["pixel_idm", "latent_idm", "implicit_future"].includes(pattern)) {
    return [
      drawTypedFlow(fromBox, toBox, "future", ids, 0.4, 0.36, "future"),
      drawTypedFlow(fromBox, toBox, "action", ids, 0.65, 0.66, "action")
    ].join("");
  }
  return [
    drawTypedFlow(fromBox, toBox, "future", ids, 0.36, 0.34, "decode"),
    drawTypedFlow(fromBox, toBox, "action", ids, 0.64, 0.66, "")
  ].join("");
}

function streamGradient(kind, ids) {
  const key = `${kind}Flow`;
  return ids[key] ? `url(#${ids[key]})` : `url(#${ids.futureFlow})`;
}

function tokenColors(kind) {
  const colors = {
    visual: ["#e8f2ff", "#5d8fc5"],
    language: ["#f2eafa", "#9874b8"],
    state: ["#edf7ed", "#72a36e"],
    action: ["#fff2dc", "#d49a3d"],
    noise: ["#f4f5f7", "#a9b1b8"],
    future: ["#eaf7f6", "#2f8793"],
    latent: ["#edf7ed", "#72a36e"]
  };
  return colors[kind] || colors.visual;
}

function streamColor(kind) {
  return {
    visual: "#5d8fc5",
    language: "#9874b8",
    state: "#72a36e",
    action: "#d49a3d",
    future: "#2f8793",
    latent: "#2f8793",
    noise: "#a9b1b8"
  }[kind] || "#5d8fc5";
}

function kindFromText(text) {
  const lower = String(text || "").toLowerCase();
  if (/language|instruction|\btext\b|textual|t5|qwen|llama|paligemma|vlm/.test(lower)) return "language";
  if (/action|policy|control|trajectory|chunk|gripper|end-effector/.test(lower)) return "action";
  if (/depth|rgb-d|4d/.test(lower)) return "future";
  if (/state|proprio|force|tactile|gelsight/.test(lower)) return "state";
  if (/future|world|latent|video|rollout/.test(lower)) return "future";
  return "visual";
}

function preciseEncoders(encoders) {
  const list = encoders.length ? encoders : [
    { label: "Vision Encoder", detail: "observation features", kind: "visual" },
    { label: "Text / Goal Encoder", detail: "instruction features", kind: "language" },
    { label: "Action Projector", detail: "state/action tokens", kind: "action" }
  ];
  return pruneGenericEncoders(list.map((encoder) => ({
    ...encoder,
    label: encoder.exact ? encoder.label : preciseEncoderLabel(encoder.label, encoder.detail),
    detail: compactDetail(encoder.detail || encoder.label),
    kind: encoder.kind || kindFromText(`${encoder.label} ${encoder.detail}`)
  })));
}

function preciseHeads(heads) {
  const list = heads.length ? heads : [{ label: "Action Head", detail: "runtime policy decoder" }];
  return pruneGenericHeads(list.map((head) => ({
    ...head,
    label: head.exact ? head.label : preciseHeadLabel(head.label, head.detail),
    detail: compactDetail(head.detail || head.label)
  })));
}

function preciseEncoderLabel(label, detail) {
  const text = `${label || ""} ${detail || ""}`;
  const lower = text.toLowerCase();
  if (/wan2\.?2/.test(lower) && /causal vae|vae/.test(lower)) return "Wan2.2 Causal VAE";
  if (/wan2\.?1/.test(lower) && /causal vae|vae/.test(lower)) return "Wan2.1 Causal VAE";
  if (/wan/.test(lower) && /causal vae|vae/.test(lower)) return "Wan Causal VAE";
  if (/wan2\.?2/.test(lower) && /t5/.test(lower)) return "Wan2.2 T5 Encoder";
  if (/wan2\.?1/.test(lower) && /t5/.test(lower)) return "Wan2.1 T5 Encoder";
  if (/cosmos/.test(lower) && /t5|\btext\b|textual|language|instruction|goal/.test(lower)) return "Cosmos T5-XXL Encoder";
  if (/t5-xxl/.test(lower)) return "T5-XXL Encoder";
  if (/cosmos/.test(lower) && /vae|tokenizer/.test(lower)) return "Cosmos VAE Tokenizer";
  if (/cosmos-reason/.test(lower)) return "Cosmos-Reason Encoder";
  if (/cogvideox/.test(lower) && /vae|3d/.test(lower)) return "CogVideoX 3D VAE";
  if (/stable video diffusion|\bsvd\b/.test(lower) && /vae|latent|encoder/.test(lower)) return "SVD VAE Encoder";
  if (/sdxl/.test(lower) && /vae/.test(lower)) return "SDXL VAE";
  if (/t5/.test(lower)) return "T5 Text Encoder";
  if (/\bclip\b/.test(lower) && /\btext\b|textual|language|instruction/.test(lower)) return "CLIP Text Encoder";
  if (/\bclip\b/.test(lower)) return "CLIP Vision Encoder";
  if (/eagle-?2/.test(lower) && /siglip/.test(lower)) return "Eagle-2 SigLIP-2";
  if (/siglip/.test(lower)) return "SigLIP Encoder";
  if (/dino\s?v?2|dinov2/.test(lower)) return "DINOv2 Encoder";
  if (/dino\s?v?3|dinov3/.test(lower)) return "DINOv3 Encoder";
  if (/\bdino\b/.test(lower)) return "DINO Encoder";
  if (/mae/.test(lower) && /vit/.test(lower)) return "MAE ViT Encoder";
  if (/v-jepa\s?2|vjepa\s?2/.test(lower)) return "V-JEPA2 Encoder";
  if (/v-jepa|vjepa/.test(lower)) return "V-JEPA Encoder";
  if (/video ?mae/.test(lower)) return "VideoMAE Encoder";
  if (/vggt/.test(lower)) return "VGGT Feature Encoder";
  if (/chameleon/.test(lower)) return /\btext\b|textual|bpe/.test(lower) ? "Chameleon BPE Tokenizer" : "Chameleon VQ-GAN";
  if (/vq-?gan/.test(lower)) return "VQ-GAN Tokenizer";
  if (/vq-?vae|codebook/.test(lower)) return "VQ-VAE Codebook";
  if (/kl-f16/.test(lower)) return "kl-f16 VAE";
  if (/vae/.test(lower)) return /video|frame|image|visual/.test(lower) ? "Video VAE" : "VAE Encoder";
  if (/qwen3-vl|qwen3vl/.test(lower)) return "Qwen3-VL Encoder";
  if (/qwen2\.?5/.test(lower)) return "Qwen2.5 VLM";
  if (/qwen/.test(lower)) return "Qwen/VLM Encoder";
  if (/lwm-chat|large world model|\blwm\b/.test(lower)) return "LWM-Chat-1M";
  if (/gemma|paligemma/.test(lower)) return /siglip/.test(lower) ? "PaliGemma SigLIP" : "PaliGemma/Gemma";
  if (/paligemma/.test(lower)) return "PaliGemma Encoder";
  if (/prismatic/.test(lower)) return "Prismatic VLM Encoder";
  if (/\bvlm\b/.test(lower) && /vision path|observation|visual/.test(lower)) return "Frozen VLM Vision Path";
  if (/\bvlm\b/.test(lower) && /language path|language|instruction|\btext\b|textual/.test(lower)) return "Frozen VLM Language Path";
  if (/frozen vlm|\bvlm\b/.test(lower)) return "Frozen VLM Encoder";
  if (/resnet|cnn/.test(lower)) return "CNN Vision Encoder";
  if (/vit|vision transformer/.test(lower)) return "ViT Vision Encoder";
  if (/proprio|state|mlp|linear/.test(lower)) return "State MLP Encoder";
  if (/action/.test(lower)) return "Action Encoder";
  if (/language|instruction|\btext\b|textual/.test(lower)) return "Text Encoder";
  return shortText(label || "Encoder", 24);
}

function pruneGenericEncoders(encoders) {
  const unique = uniqueByText(encoders, "label");
  const labels = unique.map((encoder) => encoder.label.toLowerCase());
  const hasNamedText = labels.some((label) => /t5|clip text|qwen|llama|gemma|paligemma|prismatic|chameleon bpe|cosmos-reason|vlm language/.test(label));
  const hasNamedVision = labels.some((label) => /wan|dino|siglip|clip vision|mae|vq-gan|vqgan|vq-vae|sdxl|svd|cogvideox|resnet|cnn|vit|v-jepa|vggt|chameleon|vlm vision/.test(label));
  const hasNamedAction = labels.some((label) => /act-vae|action projector|latent action|vq-vae codebook/.test(label));
  return unique.filter((encoder) => {
    const label = encoder.label.toLowerCase();
    if (labels.some((item) => /vlm vision path/.test(item)) && /^frozen vlm encoder$/.test(label)) return false;
    if (hasNamedText && /^text encoder$|^t5\/text encoder$/.test(label)) return false;
    if (labels.some((item) => /wan2\.[12] t5|t5-xxl/.test(item)) && /^t5 text encoder$/.test(label)) return false;
    if (hasNamedVision && /^vision encoder$|^video tokenizer$|^video vae$|^vae encoder$|^clip vision encoder$|^v-jepa encoder$/.test(label)) return false;
    if (hasNamedAction && /^action encoder$/.test(label)) return false;
    return true;
  });
}

function preciseHeadLabel(label, detail) {
  const text = `${label || ""} ${detail || ""}`;
  const lower = text.toLowerCase();
  if (/latent.*\bidm\b|\bidm\b.*latent/.test(lower)) return "latent IDM";
  if (/inverse dynamics|idm/.test(lower)) return "IDM";
  if (/unified world-action|world-action denoiser|unified.*denois/.test(lower)) return "Unified World-Action Denoiser";
  if (/state\/action|state-action/.test(lower) && /mlp|decoder|physical/.test(lower)) return "State/Action MLP";
  if (/inverse-depth|depth.*mse|depth.*regression|depth branch/.test(lower)) return "Depth Head";
  if (/visuo.?tactile|visual.*tactile/.test(lower) && /flow|velocity|vector-field/.test(lower)) return "Visuo-Tactile Flow";
  if (/(rgb|video|visual|latent).*flow|flow.*(rgb|video|visual|latent)|future.*velocity/.test(lower)) return "Video Flow Head";
  if (/state|proprio/.test(lower) && /flow|velocity/.test(lower)) return "State Flow Head";
  if (/vae/.test(lower) && /decoder/.test(lower)) return "VAE Video Decoder";
  if (/force|tactile|gelsight/.test(lower) && /flow|velocity|head|predict/.test(lower)) return "Force/Tactile Head";
  if (/action/.test(lower) && /flow|velocity/.test(lower)) return "Action Flow Head";
  if (/cvae|conditional vae/.test(lower) && /action/.test(lower)) return "cVAE Action Decoder";
  if (/diffusion|denois|flow/.test(lower) && /action/.test(lower)) return "Diffusion Action Head";
  if (/linear/.test(lower) && /action|arm|gripper/.test(lower)) return "Linear Action Head";
  if (/action expert dit/.test(lower)) return "Action Expert DiT";
  if (/ge-act|autoregressive action decoder/.test(lower)) return "GE-Act Decoder";
  if (/1d cnn|u-net|unet/.test(lower) && /action/.test(lower)) return "1D CNN Action U-Net";
  if (/act-vae/.test(lower)) return "Act-VAE Decoder";
  if (/vqgan|vq-gan/.test(lower) && /decoder/.test(lower)) return "VQ-GAN Video Decoder";
  if (/vqgan/.test(lower) && /decoder/.test(lower)) return "VQGAN Video Decoder";
  if (/vae/.test(lower) && /decoder/.test(lower)) return "VAE Video Decoder";
  if (/value/.test(lower) && /map|asvm/.test(lower)) return "ASVM Value Head";
  if (/force/.test(lower)) return "Force Predictor";
  if (/video|future|image|frame|observation/.test(lower)) return "Future/Obs Decoder";
  if (/value|reward|score/.test(lower)) return "Value Head";
  if (/depth|rgb-d|4d/.test(lower)) return "Depth Decoder";
  if (/force|tactile|gelsight/.test(lower)) return "Force/Tactile Head";
  if (/action|policy|control|trajectory|chunk/.test(lower)) return "Action Head";
  return shortText(label || "Prediction Head", 24);
}

function pruneGenericHeads(heads) {
  const unique = uniqueByText(heads, "label");
  const labels = unique.map((head) => head.label.toLowerCase());
  const hasSpecificAction = labels.some((label) => /diffusion|linear|cvae|expert dit|u-net|act-vae|inverse dynamics|ge-act/.test(label));
  const hasSpecificFuture = labels.some((label) => /vq-gan|vae video|asvm|force|future\/obs|value/.test(label));
  return unique.filter((head) => {
    const label = head.label.toLowerCase();
    if (hasSpecificAction && /^action head$/.test(label)) return false;
    if (hasSpecificFuture && /^future head$/.test(label)) return false;
    return true;
  });
}

function streamGradientForLabel(label, ids) {
  const lower = String(label || "").toLowerCase();
  if (/action|policy|control/.test(lower)) return streamGradient("action", ids);
  if (/language|instruction|\btext\b|textual|goal/.test(lower)) return streamGradient("language", ids);
  if (/state|proprio|force|tactile/.test(lower)) return streamGradient("state", ids);
  if (/future|world|latent|video/.test(lower)) return streamGradient("future", ids);
  return streamGradient("visual", ids);
}

function unifiedHeadMode(diagram) {
  const headText = diagram.heads.map((head) => `${head.label} ${head.detail}`).join(" ").toLowerCase();
  const outputText = diagram.outputs.map((head) => `${head.label} ${head.detail}`).join(" ").toLowerCase();
  if (/unified token head|single.*head|same.*head|joint.*head/.test(`${headText} ${outputText}`)) return "unified";
  const hasObs = /future|video|observation|latent|world|depth|force/.test(`${headText} ${outputText}`);
  const hasAction = /action|policy|control|chunk/.test(`${headText} ${outputText}`);
  return hasObs && hasAction ? "separate" : "unified";
}

function drawWrappedText(text, x, y, maxChars, maxLines, cls, lineHeight = 12) {
  return wrapText(text, maxChars)
    .slice(0, maxLines)
    .filter(Boolean)
    .map((line, index) => `<text class="${cls}" x="${x}" y="${y + index * lineHeight}">${escapeHtml(line)}</text>`)
    .join("");
}

function uniqueByText(items, key = "") {
  const seen = new Set();
  return items.filter((item) => {
    const value = typeof item === "string"
      ? item
      : item?.[key] || item?.label || item?.detail || JSON.stringify(item);
    const normalized = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function compactToken(value) {
  const text = String(value || "")
    .replace(/[{}[\]()`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/[.;:]/)[0].split(/\s+/).slice(0, 5).join(" ");
}

function compactDetail(value) {
  const text = String(value || "")
    .replace(/[{}[\]()`*_]/g, "")
    .replace(/\bFig(?:ure)?\.?\s*\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.split(/[.;]/)[0].split(/\s+/).slice(0, 13).join(" ");
}

function streamDetail(arch, matcher, fallback) {
  const pools = [
    ...(arch.inputTokens || []),
    ...(arch.tokenization || []),
    ...(arch.branches || []),
    ...(arch.backbone || []),
    ...(arch.attention || []),
    ...(arch.heads || [])
  ];
  const hit = pools.find((item) => matcher.test(item));
  return hit ? compactDetail(hit) : fallback;
}

function headLabel(value) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  if (/state\/action|state-action/.test(lower) && /mlp|decoder|physical/.test(lower)) return "State/Action MLP";
  if (/inverse-depth|depth.*mse|depth.*regression|depth branch/.test(lower)) return "Depth Head";
  if (/visuo.?tactile|visual.*tactile/.test(lower) && /flow|velocity|vector-field/.test(lower)) return "Visuo-Tactile Flow";
  if (/(rgb|video|visual|latent).*flow|flow.*(rgb|video|visual|latent)|future.*velocity/.test(lower)) return "Video Flow Head";
  if (/state|proprio/.test(lower) && /flow|velocity/.test(lower)) return "State Flow Head";
  if (/vae/.test(lower) && /decoder/.test(lower)) return "VAE Video Decoder";
  if (/force|tactile|gelsight/.test(lower) && /flow|velocity|head|predict/.test(lower)) return "Force/Tactile Head";
  if (/action/.test(lower) && /flow|velocity/.test(lower)) return "Action Flow Head";
  if (/action|trajectory|chunk|control|policy/i.test(text)) return "Action Head";
  if (/future|video|image|frame|observation/i.test(text)) return "Future Head";
  if (/value|reward|score/i.test(text)) return "Value Head";
  if (/depth|rgb-d|4d/i.test(text)) return "Depth Head";
  if (/force|tactile|gelsight/i.test(text)) return "Force/Tactile Head";
  if (/cvae|vae|decoder/i.test(text)) return "Decoder Head";
  return conciseLabel(text) || "Prediction Head";
}

function objectiveLabel(value) {
  const text = String(value || "");
  if (/flow matching/i.test(text)) return "Flow matching";
  if (/diffusion|denois|noise/i.test(text)) return "Diffusion loss";
  if (/smooth[- ]?l1|l1|l2|mse/i.test(text) && /action|control|arm|trajectory/i.test(text)) return "Action regression";
  if (/binary cross[- ]?entropy|bce/i.test(text) && /gripper|action/i.test(text)) return "Gripper BCE";
  if (/cross[- ]?entropy|ce loss/i.test(text)) return "Token CE";
  if (/behavior cloning|bc\b|imitation/i.test(text)) return "Behavior cloning";
  if (/future|video|frame|observation/i.test(text)) return "Future prediction";
  if (/value|reward|grpo|rl/i.test(text)) return "Reward/value loss";
  if (/reconstruct|reconstruction/i.test(text)) return "Reconstruction";
  if (/contrast|alignment|align/i.test(text)) return "Alignment";
  return conciseLabel(text) || "Training loss";
}

function trainingLabel(value) {
  const text = String(value || "");
  if (/pretrain|pre-training/i.test(text)) return "Pretraining";
  if (/fine[- ]?tun/i.test(text)) return "Finetuning";
  if (/preprocess|filter|relabel|annotat/i.test(text)) return "Preprocessing";
  if (/post[- ]?train|grpo|rl|reward/i.test(text)) return "Post-training";
  if (/freeze|frozen/i.test(text)) return "Frozen modules";
  if (/mask/i.test(text)) return "Masked training";
  if (/dataset|data|mixture/i.test(text)) return "Data mixture";
  return conciseLabel(text) || "Training stage";
}

export function getArchitectureSpec(model) {
  const explicit = state.arch[model.id];
  if (explicit) return explicit;
  if (!model.literalArchitecture) return null;
  return literalArchitectureSpec(model);
}

function literalArchitectureSpec(model) {
  const arch = model.literalArchitecture;
  const modules = [];
  const add = (lane, type, items, count) => {
    (items || []).slice(0, count).forEach((item, index) => {
      const id = `${lane}${index}`;
      modules.push({
        id,
        lane,
        type,
        label: conciseLabel(item),
        details: conciseDetails(item)
      });
    });
  };

  add("inputs", "input", arch.inputTokens, 3);
  add("tokenization", "tokenizer", arch.tokenization, 2);
  add("backbone", "backbone", arch.backbone, 3);
  add("heads", "head", [...(arch.attention || []).slice(0, 1), ...(arch.heads || [])], 3);
  add("training", "objective", [...(arch.objectives || []).slice(0, 2), ...(arch.trainingRecipe || []).slice(0, 1)], 3);
  const outputs = model.diagram?.outputs?.length ? model.diagram.outputs : ["action chunk"];
  add("outputs", "output", outputs, 2);

  return {
    sourceExtract: arch.sourceExtract,
    sourceLines: arch.sourceLines,
    inferenceRecipe: arch.inferenceRecipe,
    diagramModules: modules,
    diagramEdges: literalEdges(modules)
  };
}

function conciseLabel(value) {
  return String(value || "")
    .replace(/^stage[- ]\d+[: ]*/i, "")
    .replace(/^the /i, "")
    .split(/[.;:]/)[0]
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
}

function conciseDetails(value) {
  return String(value || "")
    .split(/[.;]/)[0]
    .split(/\s+/)
    .slice(0, 14)
    .join(" ");
}

function literalEdges(modules) {
  const first = (lane) => modules.find((module) => module.lane === lane);
  const edges = [];
  const chain = ["inputs", "tokenization", "backbone", "heads", "outputs"].map(first).filter(Boolean);
  for (let i = 0; i < chain.length - 1; i += 1) {
    edges.push({ from: chain[i].id, to: chain[i + 1].id, label: i === 0 ? "encodes" : "conditions" });
  }
  const training = modules.filter((module) => module.lane === "training");
  const target = first("backbone") || first("heads");
  training.forEach((module) => {
    if (target) edges.push({ from: target.id, to: module.id, label: "trained by", kind: "training" });
  });
  return edges;
}

function fallbackModules(model) {
  const modules = [];
  (model.diagram?.inputs || []).slice(0, 4).forEach((label, i) => {
    modules.push({ id: `in${i}`, lane: "inputs", label, type: "input", details: "input" });
  });
  (model.diagram?.components || []).slice(0, 5).forEach((label, i) => {
    modules.push({ id: `comp${i}`, lane: i < 2 ? "backbone" : "heads", label, type: i < 2 ? "backbone" : "head", details: "survey component" });
  });
  (model.diagram?.trainingStages || []).slice(0, 2).forEach((stage, i) => {
    modules.push({ id: `train${i}`, lane: "training", label: stage.name, type: "objective", details: stage.objective });
  });
  (model.diagram?.outputs || []).slice(0, 3).forEach((label, i) => {
    modules.push({ id: `out${i}`, lane: "outputs", label, type: "output", details: "output" });
  });
  return modules;
}

function fallbackEdges(modules) {
  const byLane = Object.groupBy ? Object.groupBy(modules, (m) => m.lane) : modules.reduce((acc, item) => {
    (acc[item.lane] ||= []).push(item);
    return acc;
  }, {});
  const order = ["inputs", "tokenization", "backbone", "heads", "outputs"];
  const edges = [];
  for (let i = 0; i < order.length - 1; i += 1) {
    const left = byLane[order[i]] || [];
    const right = byLane[order[i + 1]] || [];
    if (left[0] && right[0]) edges.push({ from: left[0].id, to: right[0].id, label: "flows" });
  }
  (byLane.training || []).forEach((train) => {
    const target = (byLane.backbone || byLane.heads || [])[0];
    if (target) edges.push({ from: target.id, to: train.id, label: "supervises", kind: "training" });
  });
  return edges;
}

function layoutModules(modules, view) {
  const laneX = {
    inputs: 44,
    tokenization: 236,
    backbone: 458,
    heads: 700,
    training: 392,
    outputs: 922
  };
  const widths = {
    inputs: 150,
    tokenization: 165,
    backbone: 185,
    heads: 170,
    training: 185,
    outputs: 150
  };
  const groups = modules.reduce((acc, module) => {
    (acc[module.lane] ||= []).push(module);
    return acc;
  }, {});
  const result = [];
  Object.entries(groups).forEach(([lane, list]) => {
    list.forEach((module, i) => {
      const isTraining = lane === "training";
      const x = isTraining ? laneX.training + (i % 3) * 205 : laneX[lane] || 460;
      const y = isTraining ? view.h - 130 + Math.floor(i / 3) * 76 : 74 + i * 86;
      result.push({ ...module, x, y, w: widths[lane] || 170, h: 58 });
    });
  });
  return result;
}

function drawLaneLabels(view) {
  const labels = [
    ["inputs", 44],
    ["tokenization", 236],
    ["backbone", 458],
    ["heads", 700],
    ["outputs", 922]
  ];
  return labels.map(([label, x]) => `<text class="stage-label" x="${x}" y="58">${label}</text>`).join("") +
    `<text class="stage-label" x="392" y="${view.h - 146}">training / losses</text>`;
}

function drawModule(module) {
  const color = typeColors[module.type] || typeColors.backbone;
  const textColor = color.text || "#172024";
  const lines = wrapText(module.label, 18).slice(0, 2);
  const details = wrapText(module.details || "", 24).slice(0, 2);
  return `
    <g class="module" data-id="${escapeHtml(module.id)}">
      <rect x="${module.x}" y="${module.y}" width="${module.w}" height="${module.h}" fill="${color.fill}" stroke="${color.stroke}"></rect>
      ${lines.map((line, i) => `<text x="${module.x + 10}" y="${module.y + 20 + i * 13}" fill="${textColor}">${escapeHtml(line)}</text>`).join("")}
      ${details.map((line, i) => `<text class="detail" x="${module.x + 10}" y="${module.y + 43 + i * 11}" fill="${textColor}">${escapeHtml(line)}</text>`).join("")}
    </g>
  `;
}

function drawEdge(edge, moduleMap) {
  const from = moduleMap.get(edge.from);
  const to = moduleMap.get(edge.to);
  if (!from || !to) return "";
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const c = Math.max(45, Math.abs(x2 - x1) * 0.45);
  const dashed = edge.kind === "training" ? " stroke-dasharray=\"5 5\"" : "";
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 6;
  return `
    <path class="edge" d="M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}" marker-end="url(#diagramArrow)"${dashed}></path>
    ${edge.label ? `<text class="stage-label" x="${midX}" y="${midY}" text-anchor="middle">${escapeHtml(edge.label)}</text>` : ""}
  `;
}
