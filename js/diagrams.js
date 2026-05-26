import { state, familyColors, typeColors, escapeHtml, wrapText, shortText } from './shared.js?v=refactor-modules-2';

export function renderDiagram(container, model, options = {}) {
  const spec = getArchitectureSpec(model);
  const view = { w: 1160, h: options.mini ? 452 : 720 };
  const diagram = buildArchitectureDiagram(model, spec, options);
  const ids = diagramIds(model, options);
  const header = "";

  container.innerHTML = `
    <svg class="wam-diagram" viewBox="0 0 ${view.w} ${view.h}" preserveAspectRatio="xMidYMin meet" role="img" aria-label="${escapeHtml(model.name)} architecture diagram">
      ${diagramDefs(model, ids)}
      <rect class="diagram-bg" x="0" y="0" width="${view.w}" height="${view.h}"></rect>
      ${header}
      ${drawArchitectureDiagram(diagram, view, options, ids)}
    </svg>
  `;
}

function diagramIds(model, options = {}) {
  const safeId = String(model.id || "model").replace(/[^a-z0-9_-]/gi, "-");
  const size = options.mini ? "mini" : "large";
  return {
    coreGrad: `${safeId}-${size}-coreGrad`,
    softShadow: `${safeId}-${size}-softShadow`,
    arrow: `${safeId}-${size}-diagramArrow`
  };
}

function buildArchitectureDiagram(model, spec, options = {}) {
  const arch = model.literalArchitecture || spec || {};
  const allText = [
    model.family,
    model.category,
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
    data: (model.diagram?.data || []).slice(0, options.mini ? 2 : 4),
    training: inferTraining(arch, allText, options),
    runtime: inferRuntime(arch, options),
    motifs: inferMotifs(allText)
  };
}

function drawArchitectureDiagram(diagram, view, options = {}, ids) {
  const pattern = diagram.pattern || diagram.family;
  if (pattern === "unified") return drawUnifiedArchitecture(diagram, view, options, ids);
  if (pattern === "multi_stream") return drawMultiStreamArchitecture(diagram, view, options, ids);
  if (pattern === "joint_latent") return drawJointLatentArchitecture(diagram, view, options, ids);
  if (pattern === "latent_action") return drawLatentActionArchitecture(diagram, view, options, ids);
  if (pattern === "implicit_future") return drawImplicitFutureArchitecture(diagram, view, options, ids);
  if (["pixel_idm", "latent_idm"].includes(pattern)) return drawFutureIdmArchitecture(diagram, view, options, ids);
  if (["alignment", "multimodal", "online_adaptation", "speedup", "encoder_only"].includes(pattern)) return drawEnhancementArchitecture(diagram, view, options, ids);

  const mini = Boolean(options.mini);
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
    drawTrainingBand(diagram, trainBox, coreBox, headBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
  ].join("");
}

function diagramLayoutY(options) {
  return options.mini ? 22 : 34;
}

function diagramMainHeight(options) {
  return options.mini ? 270 : 330;
}

function drawUnifiedArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 218, h };
  const sequenceBox = { x: 286, y: y0 + 20, w: 208, h: h - 40 };
  const coreBox = { x: 532, y: y0, w: 308, h };
  const outputBox = { x: 880, y: y0, w: 246, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "typed input streams", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawUnifiedSequence(sequenceBox, diagram, mini),
    drawUnifiedCore(coreBox, diagram, mini, ids),
    drawUnifiedOutputs(outputBox, diagram, mini),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.5, sequenceBox.x, sequenceBox.y + sequenceBox.h * 0.5, "pack tokens", false, ids),
    drawConnector(sequenceBox.x + sequenceBox.w, sequenceBox.y + sequenceBox.h * 0.5, coreBox.x, coreBox.y + h * 0.5, "single sequence", false, ids),
    drawConnector(coreBox.x + coreBox.w, coreBox.y + h * 0.45, outputBox.x, outputBox.y + h * 0.45, "parallel decode", false, ids),
    drawTrainingBand(diagram, trainBox, coreBox, outputBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, coreBox, outputBox, trainBox)
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
  return `
    <g>
      <rect class="sequence-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">one interleaved token sequence</text>
      ${rows}
    </g>
  `;
}

function drawUnifiedCore(box, diagram, mini, ids) {
  const layerH = mini ? 28 : 34;
  const layers = diagram.core.layerBadges.slice(0, mini ? 5 : 6).map((label, index) => `
    <g>
      <rect class="unified-layer" x="${box.x + 34 + index * 18}" y="${box.y + 76 + index * (layerH - 12)}" width="${box.w - 68}" height="${layerH}"></rect>
      <text class="layer-text" x="${box.x + box.w / 2 + index * 18}" y="${box.y + 94 + index * (layerH - 12)}" text-anchor="middle">${escapeHtml(label)}</text>
    </g>
  `).join("");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel unified-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 50, 32, 2, "core-detail", 11)}
      ${layers}
      ${drawAttentionBadges(diagram.attention, box, mini)}
    </g>
  `;
}

function drawUnifiedOutputs(box, diagram, mini) {
  const outputs = uniqueByText([
    ...diagram.outputs,
    { label: "Observation Tokens", detail: "future/current visual tokens" },
    { label: "Action Tokens", detail: "control chunk tokens" }
  ], "label").slice(0, mini ? 4 : 5);
  const itemH = mini ? 48 : 54;
  return `
    <g>
      <rect class="diagram-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="panel-title" x="${box.x + 14}" y="${box.y + 24}">decoded token heads</text>
      ${outputs.map((output, index) => {
        const y = box.y + 48 + index * (itemH + 10);
        return `
          <g class="diagram-node">
            <rect class="${/action/i.test(output.label) ? "action-output" : "output-block"}" x="${box.x + 18}" y="${y}" width="${box.w - 36}" height="${itemH}"></rect>
            <text class="output-label" x="${box.x + 30}" y="${y + 18}">${escapeHtml(shortText(output.label, 25))}</text>
            ${drawWrappedText(output.detail, box.x + 30, y + 35, 26, 1, "output-detail", 10)}
          </g>
        `;
      }).join("")}
    </g>
  `;
}

function drawMultiStreamArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 190, h };
  const streamBox = { x: 272, y: y0, w: 536, h };
  const headBox = { x: 858, y: y0, w: 268, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "stream inputs", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawParallelStreams(streamBox, diagram, mini, ids),
    drawColumnPanel(headBox, "expert / fused outputs", drawHeadStack([...diagram.heads, ...diagram.outputs].slice(0, mini ? 4 : 5), headBox, mini)),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.5, streamBox.x, streamBox.y + h * 0.5, "route", false, ids),
    drawConnector(streamBox.x + streamBox.w, streamBox.y + h * 0.5, headBox.x, headBox.y + h * 0.5, "fuse", false, ids),
    drawTrainingBand(diagram, trainBox, streamBox, headBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, streamBox, headBox, trainBox)
  ].join("");
}

function drawParallelStreams(box, diagram, mini, ids) {
  const streams = diagram.streams.length ? diagram.streams : [
    { label: "Video stream", detail: "world tokens", color: "#4c78a8" },
    { label: "Action stream", detail: "policy tokens", color: "#d08a2e" }
  ];
  const visible = streams.slice(0, mini ? 4 : 5);
  const laneH = Math.min(mini ? 48 : 56, (box.h - 76) / Math.max(visible.length, 1) - 8);
  const lanes = visible.map((stream, index) => {
    const y = box.y + 58 + index * (laneH + 12);
    return `
      <g>
        <rect class="stream-lane" x="${box.x + 22}" y="${y}" width="${box.w - 86}" height="${laneH}" style="--stream:${stream.color}"></rect>
        <text class="stream-label" x="${box.x + 38}" y="${y + 18}">${escapeHtml(stream.label)}</text>
        ${drawWrappedText(stream.detail, box.x + 38, y + 35, 36, 1, "stream-detail", 9.5)}
        <path class="diagram-flow stream-to-hub" d="M ${box.x + box.w - 64} ${y + laneH / 2} L ${box.x + box.w - 24} ${box.y + box.h / 2}" marker-end="url(#${ids.arrow})"></path>
      </g>
    `;
  }).join("");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      <rect class="attention-hub" x="${box.x + box.w - 70}" y="${box.y + box.h / 2 - 46}" width="58" height="92"></rect>
      <text class="attention-hub-label" x="${box.x + box.w - 41}" y="${box.y + box.h / 2 - 10}" text-anchor="middle">shared</text>
      <text class="attention-hub-label" x="${box.x + box.w - 41}" y="${box.y + box.h / 2 + 7}" text-anchor="middle">attention</text>
      ${lanes}
    </g>
  `;
}

function drawJointLatentArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const latent = { x: 456, y: y0 + 38, w: 286, h: h - 76 };
  const leftBox = { x: 34, y: y0, w: 258, h };
  const rightBox = { x: 886, y: y0, w: 240, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(leftBox, "encoders into shared space", drawTokenGroups(diagram.inputs, leftBox, mini)),
    drawLatentManifold(latent, diagram, mini, ids),
    drawColumnPanel(rightBox, "decoders from latent space", drawOutputStack([...diagram.outputs, ...diagram.heads].slice(0, mini ? 4 : 5), rightBox, mini)),
    drawConnector(leftBox.x + leftBox.w, leftBox.y + h * 0.42, latent.x, latent.y + latent.h * 0.44, "embed", false, ids),
    drawConnector(latent.x + latent.w, latent.y + latent.h * 0.44, rightBox.x, rightBox.y + h * 0.42, "decode", false, ids),
    drawConnector(rightBox.x, rightBox.y + h * 0.66, latent.x + latent.w, latent.y + latent.h * 0.66, "align", true, ids),
    drawTrainingBand(diagram, trainBox, latent, rightBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, latent, rightBox, trainBox)
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
      <text class="core-title" x="${box.x + box.w / 2}" y="${box.y + 30}" text-anchor="middle">shared action-observation latent space</text>
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
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const videoBox = { x: 34, y: y0, w: 240, h };
  const codeBox = { x: 330, y: y0 + 18, w: 250, h: h - 36 };
  const policyBox = { x: 642, y: y0, w: 250, h };
  const outputBox = { x: 940, y: y0, w: 186, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(videoBox, "video transition evidence", drawTokenGroups(diagram.inputs, videoBox, mini)),
    drawLatentActionCodebook(codeBox, diagram, mini),
    drawPolicyGrounding(policyBox, diagram, mini, ids),
    drawColumnPanel(outputBox, "grounded controls", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(videoBox.x + videoBox.w, videoBox.y + h * 0.42, codeBox.x, codeBox.y + codeBox.h * 0.42, "infer code", false, ids),
    drawConnector(codeBox.x + codeBox.w, codeBox.y + codeBox.h * 0.5, policyBox.x, policyBox.y + h * 0.5, "condition", false, ids),
    drawConnector(policyBox.x + policyBox.w, policyBox.y + h * 0.48, outputBox.x, outputBox.y + h * 0.48, "decode", false, ids),
    drawTrainingBand(diagram, trainBox, codeBox, policyBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, policyBox, outputBox, trainBox)
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
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">latent action interface</text>
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
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 224, h };
  const futureBox = { x: 318, y: y0, w: 310, h };
  const idmBox = { x: 700, y: y0 + 36, w: 196, h: h - 72 };
  const outputBox = { x: 960, y: y0, w: 166, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "observation / goal", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawFuturePredictor(futureBox, diagram, mini, ids),
    drawInverseDynamics(idmBox, diagram, mini),
    drawColumnPanel(outputBox, "action result", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.44, futureBox.x, futureBox.y + h * 0.44, "predict", false, ids),
    drawConnector(futureBox.x + futureBox.w, futureBox.y + h * 0.5, idmBox.x, idmBox.y + idmBox.h * 0.5, "future state", false, ids),
    drawConnector(idmBox.x + idmBox.w, idmBox.y + idmBox.h * 0.5, outputBox.x, outputBox.y + h * 0.5, "inverse dynamics", false, ids),
    drawTrainingBand(diagram, trainBox, futureBox, idmBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, idmBox, outputBox, trainBox)
  ].join("");
}

function drawImplicitFutureArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const inputBox = { x: 34, y: y0, w: 226, h };
  const repBox = { x: 324, y: y0 + 18, w: 286, h: h - 36 };
  const policyBox = { x: 682, y: y0, w: 276, h };
  const outputBox = { x: 1002, y: y0, w: 124, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "observation / goal context", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawImplicitFutureRepresentation(repBox, diagram, mini, ids),
    drawConditionedPolicy(policyBox, diagram, mini, ids),
    drawColumnPanel(outputBox, "policy outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.44, repBox.x, repBox.y + repBox.h * 0.44, "predict hidden future", false, ids),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.67, policyBox.x, policyBox.y + h * 0.66, "current obs", false, ids),
    drawConnector(repBox.x + repBox.w, repBox.y + repBox.h * 0.43, policyBox.x, policyBox.y + h * 0.38, "condition / prefix", false, ids),
    drawConnector(policyBox.x + policyBox.w, policyBox.y + h * 0.5, outputBox.x, outputBox.y + h * 0.5, "act", false, ids),
    drawTrainingBand(diagram, trainBox, repBox, policyBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, policyBox, outputBox, trainBox)
  ].join("");
}

function drawImplicitFutureRepresentation(box, diagram, mini, ids) {
  const hasValue = diagram.outputs.some((item) => /value|intent|trajectory/i.test(item.label || item)) || diagram.streams.some((item) => /value|reward/i.test(item.label));
  const slots = Array.from({ length: mini ? 5 : 7 }, (_, index) => {
    const x = box.x + 38 + (index % 4) * 48;
    const y = box.y + 88 + Math.floor(index / 4) * 54;
    return `
      <g>
        <rect class="implicit-slot" x="${x}" y="${y}" width="34" height="34"></rect>
        <text class="implicit-slot-label" x="${x + 17}" y="${y + 22}" text-anchor="middle">z${index + 1}</text>
      </g>
    `;
  }).join("");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="implicit-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">implicit future representation</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 52, 31, 2, "core-detail", 11)}
      ${slots}
      ${hasValue ? `<path class="value-contour" d="M ${box.x + 52} ${box.y + box.h - 64} C ${box.x + 105} ${box.y + box.h - 108}, ${box.x + 176} ${box.y + box.h - 18}, ${box.x + 232} ${box.y + box.h - 62}"></path>
        <text class="core-note" x="${box.x + 48}" y="${box.y + box.h - 28}">value / intent field</text>` : `<text class="core-note" x="${box.x + 36}" y="${box.y + box.h - 28}">no decoded future video or IDM bottleneck</text>`}
    </g>
  `;
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

function drawFuturePredictor(box, diagram, mini, ids) {
  const rendered = diagram.pattern === "pixel_idm";
  const latent = diagram.pattern === "latent_idm";
  const frames = Array.from({ length: 4 }, (_, index) => `
    <rect class="${rendered ? "future-frame" : "latent-frame"}" x="${box.x + 34 + index * 54}" y="${box.y + 98 + index * 8}" width="74" height="52"></rect>
  `).join("");
  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel future-core" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 22}" y="${box.y + 30}">${latent ? "latent future model" : "pixel future generator"}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 22, box.y + 52, 31, 2, "core-detail", 11)}
      ${frames}
      ${diagram.motifs.diffusion ? drawNoiseSchedule({ ...box, h: box.h - 12 }, mini, ids) : ""}
      <text class="core-note" x="${box.x + 28}" y="${box.y + box.h - 24}">${rendered ? "decoded future frames are action evidence" : "hidden future features stay compressed"}</text>
    </g>
  `;
}

function drawInverseDynamics(box, diagram, mini) {
  return `
    <g>
      <rect class="idm-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"></rect>
      <text class="core-title" x="${box.x + 20}" y="${box.y + 30}">inverse dynamics / action head</text>
      ${drawHeadStack(diagram.heads, { x: box.x + 6, y: box.y + 28, w: box.w - 12, h: box.h - 42 }, mini)}
    </g>
  `;
}

function drawEnhancementArchitecture(diagram, view, options = {}, ids) {
  const mini = Boolean(options.mini);
  const y0 = diagramLayoutY(options);
  const h = diagramMainHeight(options);
  const baseBox = { x: 334, y: y0, w: 360, h };
  const inputBox = { x: 34, y: y0, w: 220, h };
  const enhanceBox = { x: 748, y: y0, w: 184, h };
  const outputBox = { x: 984, y: y0, w: 142, h };
  const trainBox = { x: 34, y: y0 + h + 36, w: 1092, h: mini ? 108 : 142 };
  return [
    drawColumnPanel(inputBox, "policy inputs", drawTokenGroups(diagram.inputs, inputBox, mini)),
    drawCorePanel(diagram, baseBox, mini, ids),
    drawEnhancementOverlay(enhanceBox, diagram, mini),
    drawColumnPanel(outputBox, "outputs", drawOutputStack(diagram.outputs, outputBox, mini)),
    drawConnector(inputBox.x + inputBox.w, inputBox.y + h * 0.5, baseBox.x, baseBox.y + h * 0.5, "embed", false, ids),
    drawConnector(baseBox.x + baseBox.w, baseBox.y + h * 0.45, enhanceBox.x, enhanceBox.y + h * 0.45, "adapt / align", true, ids),
    drawConnector(enhanceBox.x + enhanceBox.w, enhanceBox.y + h * 0.5, outputBox.x, outputBox.y + h * 0.5, "deploy", false, ids),
    drawTrainingBand(diagram, trainBox, baseBox, enhanceBox, mini, ids),
    mini ? "" : drawRuntimeStrip(diagram.runtime, baseBox, outputBox, trainBox)
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
    </defs>
  `;
}

function inferTokenGroups(model, arch, allText, options = {}) {
  const maxGroups = options.mini ? 3 : 5;
  const tokens = arch.inputTokens || model.diagram?.inputs || [];
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

  add("visual", "visual / world", /rgb|image|camera|frame|video|observation|view|depth|tactile|gelsight/i, /rgb|image|camera|frame|video|observation|visual|world/.test(allText) ? "observation tokens" : "");
  add("language", "language", /language|instruction|text|t5|qwen|vlm/i, /language|instruction|text|t5|qwen|vlm/.test(allText) ? "instruction" : "");
  add("state", "state / context", /state|proprio|force|value|goal|history|memory|latent|dino/i);
  add("action", "action", /action|trajectory|chunk|control|gripper|end-effector/i, /action|trajectory|policy|control|chunk/.test(allText) ? "action chunk" : "");
  add("noise", "noise / targets", /noise|noisy|future|flow|diffusion|target/i, "");

  const unique = uniqueByText(groups, "label");
  if (!unique.length) {
    unique.push({ kind: "visual", label: "observation", tokens: ["raw sensor stream"] });
    unique.push({ kind: "action", label: "action", tokens: ["control output"] });
  }
  return unique.slice(0, maxGroups);
}

function inferEncoders(arch, allText, options = {}) {
  const candidates = [];
  (arch.tokenization || []).forEach((item) => {
    const lower = item.toLowerCase();
    if (/t5|text|language|instruction/.test(lower)) candidates.push({ label: "Text Encoder", detail: compactDetail(item), kind: "language" });
    if (/vae|vqgan|video vae|causal vae/.test(lower)) candidates.push({ label: "Video VAE", detail: compactDetail(item), kind: "visual" });
    if (/dino|siglip|clip|dpav3|v-jepa|vision encoder/.test(lower)) candidates.push({ label: "Vision Encoder", detail: compactDetail(item), kind: "visual" });
    if (/q-former|query/.test(lower)) candidates.push({ label: "Q-Former", detail: compactDetail(item), kind: "latent" });
    if (/fast|vq|codebook|quant/.test(lower)) candidates.push({ label: "Codebook / VQ", detail: compactDetail(item), kind: "action" });
    if (/mlp|project|proprio|state|action/.test(lower)) candidates.push({ label: "MLP Projector", detail: compactDetail(item), kind: "state" });
  });
  if (/vae/.test(allText)) candidates.push({ label: "VAE Latents", detail: "compressed video/state tokens", kind: "visual" });
  if (/dino|siglip|clip/.test(allText)) candidates.push({ label: "VFM Features", detail: "semantic/geometric targets", kind: "visual" });
  if (/t5|language|instruction/.test(allText)) candidates.push({ label: "Text Tokens", detail: "cross-attention condition", kind: "language" });
  if (/action/.test(allText)) candidates.push({ label: "Action Tokens", detail: "chunk or flow tokens", kind: "action" });
  return uniqueByText(candidates, "label").slice(0, options.mini ? 3 : 5);
}

function inferCore(model, arch, allText) {
  let label = "World-Action Core";
  if (/mixture-of-transformer|mot\b|multi-modal self-attention|mmsa/.test(allText)) label = "MoT / Shared-Attention Core";
  else if (/\bmm-dit\b|\bmmd[it]?\b/.test(allText)) label = "MM-DiT Core";
  else if (/\bdit\b|diffusion transformer|diffusion-transformer/.test(allText)) label = "Diffusion Transformer Core";
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
  return { label, details, layerBadges: layerBadges.length ? layerBadges : ["attention", "MLP", "head"] };
}

function inferStreams(model, arch, allText, options = {}) {
  const streams = [];
  const add = (label, detail, color, test) => {
    if (test) streams.push({ label, detail, color });
  };
  add("Video / World", streamDetail(arch, /video|rgb|visual|world|future|dino|vae/i, "future/state latents"), "#4c78a8", /video|rgb|visual|world|future|dino|vae/.test(allText));
  add("Language", streamDetail(arch, /language|instruction|text|t5|vlm/i, "instruction condition"), "#8f6bb8", /language|instruction|text|t5|vlm/.test(allText));
  add("Action", streamDetail(arch, /action|chunk|policy|control/i, "action chunk"), "#d08a2e", /action|chunk|policy|control/.test(allText));
  add("State", streamDetail(arch, /state|proprio|memory|history/i, "proprio/history"), "#5a8f63", /state|proprio|memory|history/.test(allText));
  add("Value / Reward", streamDetail(arch, /value|reward|map|grpo|rl/i, "value or reward"), "#9f5f63", /value|reward|map|grpo|rl/.test(allText));
  add("Depth / Tactile / Force", streamDetail(arch, /depth|tactile|force|gelsight|rgb-d/i, "physical branch"), "#2f8793", /depth|tactile|force|gelsight|rgb-d/.test(allText));
  return uniqueByText(streams, "label").slice(0, options.mini ? 4 : 6);
}

function inferAttentionBadges(allText, options = {}) {
  const badges = [];
  const add = (label, test) => { if (test) badges.push(label); };
  add("causal mask", /causal|autoregressive|block-causal/.test(allText));
  add("cross-attn", /cross-attention|cross attention|cross-attn/.test(allText));
  add("joint/self-attn", /joint attention|shared attention|self-attention|self attention|mmsa/.test(allText));
  add("leakage mask", /cannot attend|no future|prevent.*leak|mask/.test(allText));
  add("unilateral", /unilateral/.test(allText));
  add("cache / memory", /cache|ttt memory|memory/.test(allText));
  add("async denoise", /asynchronous|async|partial denois|few-step|shortcut/.test(allText));
  add("value route", /value map|value-map|spatial value/.test(allText));
  return badges.slice(0, options.mini ? 4 : 7);
}

function inferHeads(model, arch, allText, options = {}) {
  const heads = [];
  (arch.heads || []).forEach((item) => heads.push({ label: headLabel(item), detail: compactDetail(item) }));
  if (/action/.test(allText)) heads.push({ label: "Action Head", detail: "denoise/decode action chunk" });
  if (/future|video/.test(allText)) heads.push({ label: "Future Head", detail: "video or latent prediction" });
  if (/value|reward/.test(allText)) heads.push({ label: "Value Head", detail: "score future trajectory" });
  if (/depth/.test(allText)) heads.push({ label: "Depth Head", detail: "RGB-D / inverse depth" });
  if (/force|tactile/.test(allText)) heads.push({ label: "Force/Tactile Head", detail: "contact prediction" });
  return uniqueByText(heads, "label").slice(0, options.mini ? 3 : 5);
}

function inferOutputs(model, arch, allText, options = {}) {
  const outputs = [];
  const add = (label, detail, test) => { if (test) outputs.push({ label, detail }); };
  add("Action Chunk", "executable robot controls", /action|policy|control|chunk/.test(allText));
  add("Future Video", "decoded or latent rollout", /future video|rgb|video|frame/.test(allText));
  add("Latent Future", "DINO/VAE/value state", /latent|dino|jepa|condition/.test(allText));
  add("Value Map", "spatial intent/value", /value map|value-map|asvm/.test(allText));
  add("Depth / 4D", "RGB-D reconstruction", /depth|rgb-d|4d/.test(allText));
  add("Force / State", "tactile/force/proprio", /force|tactile|state|proprio/.test(allText));
  (model.diagram?.outputs || []).forEach((item) => outputs.push({ label: compactToken(item), detail: "paper output" }));
  return uniqueByText(outputs, "label").slice(0, options.mini ? 3 : 5);
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
  const top = box.y + 48;
  const itemH = mini ? 46 : 50;
  const gap = 9;
  return encoders.map((encoder, index) => {
    const y = top + index * (itemH + gap);
    return `
      <g>
        <rect class="encoder-block" x="${box.x + 14}" y="${y}" width="${box.w - 28}" height="${itemH}"></rect>
        <text class="block-label" x="${box.x + 25}" y="${y + 18}">${escapeHtml(encoder.label)}</text>
        ${drawWrappedText(encoder.detail, box.x + 25, y + 34, 18, 1, "block-detail", 10)}
      </g>
    `;
  }).join("");
}

function drawCorePanel(diagram, box, mini, ids) {
  const streamTop = box.y + 78;
  const streamH = mini ? 30 : 34;
  const streamGap = mini ? 8 : 10;
  const maxStreams = Math.min(diagram.streams.length, mini ? 4 : 6);
  const streamBox = { x: box.x + 22, y: streamTop - 12, w: box.w - 168, h: maxStreams * (streamH + streamGap) + 8 };
  const streamSvg = diagram.streams.slice(0, maxStreams).map((stream, index) => {
    const y = streamTop + index * (streamH + streamGap);
    return drawCoreStream(stream, streamBox.x + 6, y, streamBox.w - 12, streamH);
  }).join("");
  const layerX = box.x + box.w - 122;
  const layerY = box.y + 52;
  const layerSvg = diagram.core.layerBadges.slice(0, 5).map((label, index) => `
    <rect class="layer-chip" x="${layerX}" y="${layerY + index * 31}" width="90" height="22"></rect>
    <text class="layer-text" x="${layerX + 45}" y="${layerY + 15 + index * 31}" text-anchor="middle">${escapeHtml(label)}</text>
  `).join("");
  const attentionSvg = drawAttentionBadges(diagram.attention, box, mini);
  const noiseSvg = diagram.motifs.diffusion ? drawNoiseSchedule(box, mini, ids) : "";
  const memorySvg = diagram.motifs.online ? `<text class="core-note" x="${box.x + 24}" y="${box.y + box.h - 22}">online/cache path updates context without changing the main token grammar</text>` : "";

  return `
    <g filter="url(#${ids.softShadow})">
      <rect class="core-panel" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#${ids.coreGrad})"></rect>
      <text class="core-title" x="${box.x + 24}" y="${box.y + 30}">${escapeHtml(diagram.core.label)}</text>
      ${drawWrappedText(diagram.core.details.join(" / "), box.x + 24, box.y + 50, 36, 2, "core-detail", 11)}
      <rect class="shared-attn-band" x="${streamBox.x}" y="${streamBox.y}" width="${streamBox.w}" height="${streamBox.h}"></rect>
      ${streamSvg}
      <rect class="transformer-stack" x="${layerX - 10}" y="${layerY - 20}" width="112" height="${Math.min(188, diagram.core.layerBadges.length * 31 + 28)}"></rect>
      <text class="stack-title" x="${layerX + 45}" y="${layerY - 5}" text-anchor="middle">N x block</text>
      <g>${layerSvg}</g>
      ${attentionSvg}
      ${noiseSvg}
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
  const startX = box.x + 24;
  const y = box.y + box.h - (mini ? 74 : 82);
  return badges.map((badge, index) => {
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
  const list = outputs.length ? outputs : [{ label: "Action", detail: "runtime output" }];
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
      ${drawConnector(box.x + box.w * 0.44, box.y, coreBox.x + coreBox.w * 0.45, coreBox.y + coreBox.h, "trains", true, ids)}
      ${drawConnector(box.x + box.w * 0.74, box.y, headBox.x + headBox.w * 0.5, headBox.y + headBox.h, "supervises", true, ids)}
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


