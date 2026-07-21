import {
  state,
  familyColors,
  familyLabels,
  modeDescriptions,
  rootProblemQuestion,
  problemBranches,
  taxonomyGroups,
  familyProblemQuestions,
  familyProblemSplits,
  familyInsights,
  institutionMeta,
  $,
  $$,
  escapeHtml,
  slugDate,
  scoreLabel,
  wrapText,
  shortText
} from './shared.js?v=wam-atlas-42';
import { renderDiagram, architectureDiagramMarkup, getArchitectureSpec } from './diagrams.js?v=wam-atlas-42';

function hasMetricsTargetBenchmark(model) {
  return Boolean(model.metrics?.comparative?.metricsEligible);
}

function isModelIncludedInMetricView(model) {
  const comparative = model.metrics?.comparative;
  if (state.mode !== "metrics") return true;
  if (!hasMetricsTargetBenchmark(model)) return false;
  if (!passesMetricAccuracyFilter(model)) return false;
  if (state.metricView === "accuracy" && state.accuracyBenchmark !== "estimated") {
    return Boolean(comparative?.accuracy?.benchmarkScores?.[state.accuracyBenchmark]);
  }
  if (state.metricView === "generalization") {
    return Boolean(comparative?.generalization?.includeInMetrics);
  }
  return true;
}

function filteredModels() {
  const q = state.query.trim().toLowerCase();
  return state.models.filter((model) => {
    if (!isModelIncludedInMetricView(model)) return false;
    if (state.mode === "timeline" && state.timelineExcludedFamilies?.has(model.family)) return false;
    if (!q) return true;
    const haystack = [
      model.name,
      model.title,
      model.family,
      model.category,
      model.problem,
      model.oneLine,
      model.insights?.method,
      model.insights?.novelty
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

async function loadData() {
  const [modelsRes, schemaRes, archRes, profilesRes, originalRes] = await Promise.all([
    fetch("data/wam-models.json"),
    fetch("data/schema.json"),
    fetch("data/architecture-specs.json"),
    fetch("data/diagram-profiles.json?v=wam-atlas-42"),
    fetch("data/original-diagrams.json?v=wam-atlas-42")
  ]);
  const modelsData = await modelsRes.json();
  state.schema = await schemaRes.json();
  const archData = await archRes.json();
  const profileData = await profilesRes.json();
  const originalData = originalRes.ok ? await originalRes.json() : { models: {} };
  state.models = modelsData.models;
  state.methodology = modelsData.methodology;
  state.arch = archData.models || {};
  state.diagramProfiles = profileData.models || {};
  state.originalDiagrams = originalData.models || {};
  state.showOriginalDiagrams = localStorage.getItem("wam-original-diagrams") === "1";

  animateStatCount($("#modelCount"), state.models.length);
  animateStatCount($("#familyCount"), new Set(state.models.map((m) => m.family)).size);
  populateMetricControls();
  setDefaultZoomForMode(state.mode);
  renderLearn();
  renderSources();
  routeFromHash();
}

function animateStatCount(el, target) {
  if (!el) return;
  const value = Number(target) || 0;
  const duration = 1050;
  const start = performance.now();
  el.textContent = "0";
  const tick = (now) => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(value * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function familyOrder() {
  return [...new Set(state.models.map((model) => model.family))];
}

function isCompactViewport() {
  return window.matchMedia("(max-width: 620px)").matches;
}

function isPortraitAtlas(bounds) {
  return bounds.height > bounds.width && bounds.width <= 900;
}

function problemBranchForFamily(family) {
  return problemBranches.find((branch) => branch.families.includes(family));
}

function problemColorForFamily(family) {
  return problemBranchForFamily(family)?.color || familyColors[family] || "#8aa0a7";
}

function problemColorForModel(model) {
  return problemColorForFamily(model.family);
}

function timelineVisibleModels() {
  return state.models.filter((model) => !state.timelineExcludedFamilies?.has(model.family));
}

function modelIndexInFamily(model) {
  return state.models.filter((item) => item.family === model.family).findIndex((item) => item.id === model.id);
}

function positionModel(model, index, models, bounds) {
  if (state.mode === "problem") {
    return problemGeometry(models, bounds).positions.get(model.id);
  }
  const families = familyOrder();
  const familyIndex = families.indexOf(model.family);
  const jitter = ((index * 37) % 23) - 11;
  const w = bounds.width;
  const h = bounds.height;

  if (state.mode === "metrics") {
    return metricsPosition(model, bounds, index);
  }

  if (state.mode === "timeline") {
    return timelineGeometry(timelineVisibleModels(), bounds).positions.get(model.id);
  }

  if (state.mode === "taxonomy") {
    return taxonomyPaperPosition(model, bounds) || { x: w / 2, y: h / 2 };
  }

  return { x: bounds.width / 2, y: bounds.height / 2 };
}

function drawAtlasBackdrop(group, defs, bounds, geometry = null) {
  if (state.mode === "problem") {
    drawProblemBackdrop(group, defs, geometry || problemGeometry(state.models, bounds));
    return;
  }
  if (state.mode === "timeline") {
    drawTimelineBackdrop(group, timelineGeometry(timelineVisibleModels(), bounds));
    return;
  }
  if (state.mode === "metrics") {
    drawMetricsBackdrop(group, bounds);
    return;
  }
  if (state.mode === "taxonomy") {
    drawTaxonomyBackdrop(group, bounds, defs);
  }
}

function problemGeometry(models, bounds) {
  const portrait = isPortraitAtlas(bounds);
  const root = { id: "root", x: bounds.width / 2, y: bounds.height * 0.46 + 36, fixed: true };
  const branchRx = clamp(bounds.width * 0.255, 330, 470);
  const branchRy = clamp(bounds.height * 0.255, 210, 315);
  const familyRx = clamp(bounds.width * 0.145, 185, 275);
  const familyRy = clamp(bounds.height * 0.155, 128, 200);
  const positions = new Map();
  const branchNodes = [];
  const familyNodes = [];
  const edges = [];
  const leafByModelId = new Map();

  problemBranches.forEach((branch) => {
    const angle = degToRad(branch.angle);
    const branchPos = {
      x: root.x + Math.cos(angle) * branchRx,
      y: root.y + Math.sin(angle) * branchRy
    };
    const branchNode = { ...branch, groupId: branch.id, x: branchPos.x, y: branchPos.y, startX: branchPos.x, startY: branchPos.y };
    branchNodes.push(branchNode);
    edges.push({ from: root, to: branchNode, color: branch.color, id: `${branch.id}-root` });

    branch.families.forEach((family, familyIndex) => {
      const papers = models.filter((model) => model.family === family);
      const problemGroups = splitProblemLeafGroups(family, papers);
      const fan = degToRad((familyIndex - (branch.families.length - 1) / 2) * 18);
      problemGroups.forEach((group, groupIndex) => {
        const groupFan = degToRad((groupIndex - (problemGroups.length - 1) / 2) * 12);
        const familyAngle = angle + fan + groupFan;
        const radialBump = problemGroups.length > 1 ? (groupIndex - (problemGroups.length - 1) / 2) * 12 : 0;
        const familyVector = {
          x: Math.cos(familyAngle) * (familyRx + Math.abs(radialBump)),
          y: Math.sin(familyAngle) * (familyRy + Math.abs(radialBump) * 0.55)
        };
        const familyPos = {
          x: branchPos.x + familyVector.x,
          y: branchPos.y + familyVector.y
        };
        const familyNode = {
          id: group.id,
          family,
          question: group.question,
          label: group.label,
          x: familyPos.x,
          y: familyPos.y,
          baseX: familyPos.x,
          baseY: familyPos.y,
          startX: familyPos.x,
          startY: familyPos.y,
          groupId: branch.id,
          color: branch.color
        };
        familyNodes.push(familyNode);
        edges.push({ from: branchNode, to: familyNode, color: branch.color, id: `${branch.id}-${group.id}` });

        group.papers.forEach((model, index) => {
          positions.set(model.id, { x: familyPos.x, y: familyPos.y + 52 + index * 4 });
          leafByModelId.set(model.id, familyNode);
        });
      });
    });
  });

  relaxProblemQuestions({ root, branchNodes, familyNodes }, bounds);
  separateLeafQuestionsFromBranches({ branchNodes, familyNodes }, bounds);
  layoutProblemPapers(positions, models, leafByModelId, { root, branchNodes, familyNodes });
  separateProblemGroups({ root, branchNodes, familyNodes }, positions, models, leafByModelId, bounds);
  if (portrait) {
    problemBranches.forEach((branch) => {
      const items = [
        ...branchNodes.filter((node) => node.groupId === branch.id).map((node) => ({ ref: node, ...problemNodeBox(node, "branch") })),
        ...familyNodes.filter((node) => node.groupId === branch.id).map((node) => ({ ref: node, ...problemNodeBox(node, "leaf") }))
      ];
      models.forEach((model) => {
        const leaf = leafByModelId.get(model.id);
        const point = positions.get(model.id);
        if (leaf?.groupId === branch.id && point) items.push({ ref: point, ...problemPaperBox(model, point) });
      });
      if (!items.length) return;
      const box = groupBounds(items);
      const portraitYScale = branch.id === "futures" || branch.id === "coupling" ? 1.55 : 1.05;
      const targetX = root.x + (box.x - root.x) * 0.42;
      const targetY = root.y + (box.y - root.y) * portraitYScale;
      const dx = targetX - box.x;
      const dy = targetY - box.y;
      new Set(items.map((item) => item.ref)).forEach((point) => {
        point.x += dx;
        point.y += dy;
        if (Number.isFinite(point.startX)) point.startX += dx;
        if (Number.isFinite(point.startY)) point.startY += dy;
        if (Number.isFinite(point.baseX)) point.baseX += dx;
        if (Number.isFinite(point.baseY)) point.baseY += dy;
        point.portrait = true;
      });
    });
    const branchOffsets = {
      futures: { x: -120, y: -80 },
      coupling: { x: 120, y: -150 },
      speed: { x: 110, y: 0 },
      grounding: { x: 0, y: 45 },
      physics: { x: -130, y: 0 }
    };
    branchNodes.forEach((node) => {
      const offset = branchOffsets[node.groupId];
      if (!offset) return;
      node.x += offset.x;
      node.y += offset.y;
      node.startX = node.x;
      node.startY = node.y;
    });
    root.portrait = true;
  }
  return { portrait, root, branchNodes, familyNodes, edges, positions, leafAssignments: leafByModelId };
}

function splitProblemLeafGroups(family, papers) {
  const maxPapers = 3;
  if (papers.length <= maxPapers) {
    return [{
      id: family,
      family,
      label: familyLabels[family] || family,
      question: familyProblemQuestions[family] || familyLabels[family] || family,
      papers
    }];
  }
  const questions = familyProblemSplits[family] || [];
  const groupCount = Math.ceil(papers.length / maxPapers);
  return Array.from({ length: groupCount }, (_, index) => {
    const groupPapers = papers.slice(index * maxPapers, (index + 1) * maxPapers);
    return {
      id: `${family}-${index + 1}`,
      family,
      label: `${familyLabels[family] || family} ${index + 1}`,
      question: questions[index] || `${familyProblemQuestions[family] || familyLabels[family] || family} (${index + 1})`,
      papers: groupPapers
    };
  });
}

function relaxProblemQuestions(geometry, bounds) {
  const leafWidth = problemQuestionWidth("leaf");
  const branchWidth = problemQuestionWidth("branch");
  const rootWidth = problemQuestionWidth("root");
  const rootLayout = questionTextLayout(rootProblemQuestion, rootWidth, "root");
  const nodes = [
    { ...geometry.root, ref: geometry.root, fixed: true, w: 760, h: rootLayout.h + 120 },
    ...geometry.branchNodes.map((node) => ({
      ...node,
      ref: node,
      anchorX: node.x,
      anchorY: node.y,
      w: problemQuestionCollision("branch", branchWidth, measureQuestionHeight(node.question, branchWidth, "branch")).w,
      h: measureQuestionHeight(node.question, branchWidth, "branch") + 58
    })),
    ...geometry.familyNodes.map((node) => ({
      ...node,
      ref: node,
      anchorX: node.x,
      anchorY: node.y,
      w: questionTextLayout(node.question, leafWidth, "leaf", node.label).boxWidth + 18,
      h: measureQuestionHeight(node.question, leafWidth, "leaf", node.label) + 12
    }))
  ];
  const pad = { left: 58, right: 58, top: 158, bottom: 132 };

  for (let tick = 0; tick < 180; tick += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const minX = (a.w + b.w) / 2 + 34;
        const minY = (a.h + b.h) / 2 + 28;
        const dx = b.x - a.x || 0.01;
        const dy = b.y - a.y || 0.01;
        const ox = minX - Math.abs(dx);
        const oy = minY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const pushX = Math.sign(dx) * ox * 0.72;
        const pushY = Math.sign(dy) * oy * 0.72;
        if (!a.fixed && ox < oy) a.x -= pushX;
        if (!b.fixed && ox < oy) b.x += pushX;
        if (!a.fixed && ox >= oy) a.y -= pushY;
        if (!b.fixed && ox >= oy) b.y += pushY;
      }
    }

    nodes.forEach((node) => {
      if (node.fixed) return;
      node.x += (node.anchorX - node.x) * 0.014;
      node.y += (node.anchorY - node.y) * 0.014;
      node.x = clamp(node.x, pad.left + node.w / 2, bounds.width - pad.right - node.w / 2);
      node.y = clamp(node.y, pad.top + node.h / 2, bounds.height - pad.bottom - node.h / 2);
    });
  }

  nodes.forEach((node) => {
    node.ref.startX = node.anchorX ?? node.x;
    node.ref.startY = node.anchorY ?? node.y;
    node.ref.x = node.x;
    node.ref.y = node.y;
  });
}

function separateLeafQuestionsFromBranches(geometry, bounds) {
  const pad = { left: -760, right: -760, top: 120, bottom: -620 };
  geometry.branchNodes.forEach((branch) => {
    const leaves = geometry.familyNodes.filter((leaf) => leaf.groupId === branch.groupId);
    const outward = directionalVector(problemBranchAngle(branch.groupId));
    const branchLayout = problemBranchLeafLayout(branch.groupId, outward);
    const { tangent } = branchLayout;
    const branchBox = problemNodeBox(branch, "branch");
    leaves.forEach((leaf, index) => {
      const leafBox = problemNodeBox(leaf, "leaf");
      const offset = (index - (leaves.length - 1) / 2) * Math.max(branchLayout.offsetGap, leafBox.h * branchLayout.heightWeight + leafBox.w * branchLayout.widthWeight + branchLayout.offsetPad);
      const radial = Math.max(branchLayout.minRadial, branchBox.w * 0.5 + leafBox.w * 0.5 + branchLayout.radialPad);
      leaf.x = branch.x + outward.x * radial + tangent.x * offset;
      leaf.y = branch.y + outward.y * radial + tangent.y * offset;
    });

    for (let tick = 0; tick < 180; tick += 1) {
      leaves.forEach((leaf) => {
        const liveBranchBox = { ...problemNodeBox(branch, "branch"), x: branch.x, y: branch.y };
        const leafBox = { ...problemNodeBox(leaf, "leaf"), x: leaf.x, y: leaf.y };
        const overlap = boxOverlap(liveBranchBox, leafBox, 40, 28);
        if (!overlap) {
          leaf.x += (leaf.startX - leaf.x) * 0.006;
          leaf.y += (leaf.startY - leaf.y) * 0.006;
          return;
        }
        const dx = leaf.x - branch.x;
        const dy = leaf.y - branch.y;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 1.05;
        leaf.x += (dx / length) * push;
        leaf.y += (dy / length) * push;
      });

      for (let i = 0; i < leaves.length; i += 1) {
        for (let j = i + 1; j < leaves.length; j += 1) {
          const a = leaves[i];
          const b = leaves[j];
          const boxA = { ...problemNodeBox(a, "leaf"), x: a.x, y: a.y };
          const boxB = { ...problemNodeBox(b, "leaf"), x: b.x, y: b.y };
          const overlap = boxOverlap(boxA, boxB, 34, 24);
          if (!overlap) continue;
          const dx = b.x - a.x || tangent.x || 0.01;
          const dy = b.y - a.y || tangent.y || 0.01;
          const length = Math.hypot(dx, dy) || 1;
          const push = overlap.push * 0.62;
          a.x -= (dx / length) * push;
          a.y -= (dy / length) * push;
          b.x += (dx / length) * push;
          b.y += (dy / length) * push;
        }
      }

      leaves.forEach((leaf) => {
        const leafBox = problemNodeBox(leaf, "leaf");
        leaf.x = clamp(leaf.x, pad.left + leafBox.w / 2, bounds.width - pad.right - leafBox.w / 2);
        leaf.y = clamp(leaf.y, pad.top + leafBox.h / 2, bounds.height - pad.bottom - leafBox.h / 2);
      });
    }
  });
}

function problemBranchLeafLayout(groupId, outward) {
  if (groupId === "coupling") {
    return {
      tangent: directionalVector(Math.PI / 2),
      offsetGap: 76,
      heightWeight: 1.18,
      widthWeight: 0.08,
      offsetPad: 34,
      minRadial: 132,
      radialPad: 38
    };
  }
  return {
    tangent: { x: -outward.y, y: outward.x },
    offsetGap: 76,
    heightWeight: 0,
    widthWeight: 1,
    offsetPad: 18,
    minRadial: 154,
    radialPad: 54
  };
}

function measureQuestionHeight(text, width, level, eyebrow = "") {
  const layout = questionTextLayout(text, width, level, eyebrow);
  return layout.h;
}

function layoutProblemPapers(positions, models, leafByModelId, geometry) {
  const leafWidth = problemQuestionWidth("leaf");
  const papersByLeaf = new Map();
  const placedByGroup = new Map();
  const obstacles = [
    { ref: geometry.root, ...rootProblemBox() },
    ...geometry.branchNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "branch") })),
    ...geometry.familyNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "leaf") }))
  ];
  models.forEach((model) => {
    const leaf = leafByModelId.get(model.id);
    const point = positions.get(model.id);
    if (!leaf || !point) return;
    if (!papersByLeaf.has(leaf.id)) papersByLeaf.set(leaf.id, { leaf, papers: [] });
    papersByLeaf.get(leaf.id).papers.push({ model, point, box: problemPaperBox(model, point) });
  });

  papersByLeaf.forEach(({ leaf, papers }) => {
    const leafLayout = questionTextLayout(leaf.question, leafWidth, "leaf", leaf.label);
    const leafBox = problemQuestionCollision("leaf", leafLayout.boxWidth, leafLayout.h);
    const route = problemPaperRoute(leaf, geometry.root);
    const { outward, tangent } = route;
    const edgeDistance = rectEdgeDistance(leafBox, outward);
    const groupPlaced = placedByGroup.get(leaf.groupId) || [];
    const groupObstacles = obstacles.filter((item) => !item.ref.groupId || item.ref.groupId === leaf.groupId);

    papers
      .slice()
      .sort((a, b) => b.box.w - a.box.w)
      .forEach((paper, index) => {
        const candidate = bestPaperSlot({
          paper,
          leaf,
          outward,
          tangent,
          edgeDistance,
          obstacles: groupObstacles,
          placed: groupPlaced,
          index,
          route
        });
        paper.point.x = candidate.x;
        paper.point.y = candidate.y;
        groupPlaced.push({ ref: paper.point, w: paper.box.w, h: paper.box.h });
        placedByGroup.set(leaf.groupId, groupPlaced);
      });
  });
}

function problemPaperRoute(leaf, root) {
  if (leaf.groupId === "coupling") {
    return {
      outward: { x: 1, y: 0 },
      tangent: { x: 0, y: 1 },
      tangentGapScale: 0.42,
      radialGap: 22,
      radialBase: 6
    };
  }
  const outward = radialVectorFromRoot(leaf, root);
  return {
    outward,
    tangent: { x: -outward.y, y: outward.x },
    tangentGapScale: 0.48,
    radialGap: 24,
    radialBase: 10
  };
}

function bestPaperSlot({ paper, leaf, outward, tangent, edgeDistance, obstacles, placed, index, route = {} }) {
  const tangentSteps = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const radialSteps = [0, 1, 2, 3, 4];
  const tangentGap = Math.max(52, paper.box.w * (route.tangentGapScale || 0.48));
  const radialGap = route.radialGap || 24;
  let fallback = null;

  for (const radialIndex of radialSteps) {
    for (const tangentIndex of tangentSteps) {
      const localX = tangentIndex * tangentGap + (index % 2 ? tangentGap * 0.12 : 0);
      const radialPush = edgeDistance + (route.radialBase ?? 10) + radialIndex * radialGap + Math.abs(localX) * 0.025;
      const candidate = {
        x: leaf.x + outward.x * radialPush + tangent.x * localX,
        y: leaf.y + outward.y * radialPush + tangent.y * localX,
        w: paper.box.w,
        h: paper.box.h
      };
      const score = paperSlotOverlapScore(candidate, obstacles, placed);
      const distance = radialIndex * 1000 + Math.abs(tangentIndex) * 70 + Math.abs(localX) * 0.02;
      const ranked = { ...candidate, score, distance };
      if (!fallback || score < fallback.score || (score === fallback.score && distance < fallback.distance)) fallback = ranked;
      if (score === 0) return candidate;
    }
  }
  return fallback || {
    x: leaf.x + outward.x * (edgeDistance + 24),
    y: leaf.y + outward.y * (edgeDistance + 24)
  };
}

function paperSlotOverlapScore(candidate, obstacles, placed) {
  let score = 0;
  [...obstacles, ...placed].forEach((item) => {
    const box = {
      x: item.ref.x,
      y: item.ref.y,
      w: item.w,
      h: item.h
    };
    const overlap = boxOverlap(candidate, box, 5, 4);
    if (overlap) score += overlap.x * overlap.y;
  });
  return score;
}

function radialVectorFromRoot(point, root) {
  const dx = point.x - root.x;
  const dy = point.y - root.y;
  const length = Math.hypot(dx, dy);
  if (length > 0.001) return { x: dx / length, y: dy / length };
  return directionalVector(problemBranchAngle(point.groupId));
}

function separateProblemGroups(geometry, positions, models, leafByModelId, bounds) {
  const groups = new Map(problemBranches.map((branch) => [branch.id, {
    id: branch.id,
    angle: degToRad(branch.angle),
    branch,
    items: []
  }]));
  geometry.branchNodes.forEach((node) => {
    groups.get(node.groupId)?.items.push({ ref: node, ...problemNodeBox(node, "branch") });
  });
  geometry.familyNodes.forEach((node) => {
    groups.get(node.groupId)?.items.push({ ref: node, ...problemNodeBox(node, "leaf") });
  });
  models.forEach((model) => {
    const point = positions.get(model.id);
    const leaf = leafByModelId.get(model.id);
    if (!point || !leaf) return;
    groups.get(leaf.groupId)?.items.push({ ref: point, ...problemPaperBox(model, point) });
  });

  packProblemGroups(Array.from(groups.values()).filter((group) => group.items.length), geometry.root, bounds);
}

function packProblemGroups(groups, root, bounds) {
  const pad = { left: -900, right: -900, top: 90, bottom: -720 };
  const rootLayout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
  const rootBox = {
    x: root.x,
    y: root.y,
    w: Math.min(bounds.width * 0.41, 650),
    h: rootLayout.h + 104
  };
  groups.forEach((group) => {
    const anchor = problemGroupAnchor(group.id, root, bounds);
    const box = groupBounds(group.items);
    translateProblemGroup(group, anchor.x - box.x, anchor.y - box.y);
    Object.assign(group, {
      x: anchor.x,
      y: anchor.y,
      vx: 0,
      vy: 0,
      anchorX: anchor.x,
      anchorY: anchor.y
    });
  });

  for (let tick = 0; tick < 420; tick += 1) {
    groups.forEach((group) => {
      const box = groupBounds(group.items);
      group.x = box.x;
      group.y = box.y;
      group.w = box.w;
      group.h = box.h;
      group.vx += (group.anchorX - group.x) * 0.018;
      group.vy += (group.anchorY - group.y) * 0.018;

      const rootOverlap = boxOverlap(box, rootBox, 50, 36);
      if (rootOverlap) {
        const dir = directionalVector(group.angle);
        group.vx += dir.x * rootOverlap.push * 0.18;
        group.vy += dir.y * rootOverlap.push * 0.18;
      }
    });

    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        const boxA = groupBounds(a.items);
        const boxB = groupBounds(b.items);
        const overlap = boxOverlap(boxA, boxB, 66, 48);
        if (!overlap) continue;
        const dx = boxB.x - boxA.x || Math.cos(b.angle) - Math.cos(a.angle) || 0.01;
        const dy = boxB.y - boxA.y || Math.sin(b.angle) - Math.sin(a.angle) || 0.01;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 0.26;
        a.vx -= (dx / length) * push;
        a.vy -= (dy / length) * push;
        b.vx += (dx / length) * push;
        b.vy += (dy / length) * push;
      }
    }

    groups.forEach((group) => {
      group.vx *= 0.54;
      group.vy *= 0.54;
      translateProblemGroup(group, group.vx, group.vy);
      const box = groupBounds(group.items);
      let dx = 0;
      let dy = 0;
      if (box.left < pad.left) dx = pad.left - box.left;
      if (box.right > bounds.width - pad.right) dx = bounds.width - pad.right - box.right;
      if (box.top < pad.top) dy = pad.top - box.top;
      if (box.bottom > bounds.height - pad.bottom) dy = bounds.height - pad.bottom - box.bottom;
      if (dx || dy) {
        translateProblemGroup(group, dx, dy);
        group.vx *= 0.2;
        group.vy *= 0.2;
      }
    });
  }

  for (let pass = 0; pass < 12; pass += 1) {
    groups.forEach((group) => {
      const box = groupBounds(group.items);
      const rootOverlap = boxOverlap(box, rootBox, 58, 42);
      if (!rootOverlap) return;
      const dir = directionalVector(group.angle);
      translateProblemGroup(group, dir.x * rootOverlap.push * 0.8, dir.y * rootOverlap.push * 0.8);
    });
    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const a = groups[i];
        const b = groups[j];
        const boxA = groupBounds(a.items);
        const boxB = groupBounds(b.items);
        const overlap = boxOverlap(boxA, boxB, 78, 58);
        if (!overlap) continue;
        const dx = boxB.x - boxA.x || 0.01;
        const dy = boxB.y - boxA.y || 0.01;
        const length = Math.hypot(dx, dy) || 1;
        const push = overlap.push * 0.55;
        translateProblemGroup(a, (-dx / length) * push, (-dy / length) * push);
        translateProblemGroup(b, (dx / length) * push, (dy / length) * push);
      }
    }
  }
}

function problemGroupAnchor(groupId, root, bounds) {
  const w = bounds.width;
  const h = bounds.height;
  const anchors = {
    futures: { x: root.x - w * 0.145, y: root.y - h * 0.12 },
    coupling: { x: root.x + w * 0.145, y: root.y - h * 0.13 },
    speed: { x: root.x + w * 0.17, y: root.y + h * 0.1 },
    grounding: { x: root.x + w * 0.025, y: root.y + h * 0.19 },
    physics: { x: root.x - w * 0.155, y: root.y + h * 0.13 }
  };
  return anchors[groupId] || {
    x: root.x + Math.cos(problemBranchAngle(groupId)) * w * 0.3,
    y: root.y + Math.sin(problemBranchAngle(groupId)) * h * 0.28
  };
}

function problemNodeBox(node, level) {
  const width = problemQuestionWidth(level);
  const layout = questionTextLayout(node.question, width, level, node.label);
  const collision = problemQuestionCollision(level, layout.boxWidth, layout.h);
  return { x: node.x, y: node.y, w: collision.w, h: collision.h };
}

function problemGeometryBounds(geometry, models) {
  const items = [
    { ref: geometry.root, ...rootProblemBox() },
    ...geometry.branchNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "branch") })),
    ...geometry.familyNodes.map((node) => ({ ref: node, ...problemNodeBox(node, "leaf") }))
  ];
  models.forEach((model) => {
    const point = geometry.positions.get(model.id);
    if (!point) return;
    items.push({ ref: point, ...problemPaperBox(model, point) });
  });
  return groupBounds(items);
}

function problemVisibleGeometryBounds(geometry, models, bounds) {
  const items = [
    { ref: geometry.root, w: problemQuestionWidth("root") + 48, h: questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root").h + 24 },
    ...geometry.branchNodes.map((node) => {
      const layout = questionTextLayout(node.question, problemQuestionWidth("branch"), "branch");
      return { ref: node, w: layout.boxWidth + 34, h: layout.h + 30 };
    }),
    ...geometry.familyNodes.map((node) => {
      const layout = questionTextLayout(node.question, problemQuestionWidth("leaf"), "leaf", node.label);
      return { ref: node, w: layout.boxWidth + 10, h: layout.h + 10 };
    })
  ];
  models.forEach((model) => {
    const point = geometry.positions.get(model.id);
    if (!point) return;
    const box = problemPaperBox(model, point);
    const labelSide = point.x > bounds.width - 180 ? "left" : "right";
    const labelShift = labelSide === "left" ? -box.w * 0.18 : box.w * 0.18;
    items.push({ ref: { x: point.x + labelShift, y: point.y }, w: box.w, h: box.h });
  });
  return groupBounds(items);
}

function rootProblemBox() {
  const layout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
  return problemQuestionCollision("root", layout.boxWidth, layout.h);
}

function problemPaperBox(model, point) {
  return {
    x: point.x,
    y: point.y,
    w: Math.min(150, Math.max(98, shortPaperName(model.name).length * 7 + 46)),
    h: 50
  };
}

function groupBounds(items) {
  const bounds = items.reduce((acc, item) => {
    const x = item.ref.x;
    const y = item.ref.y;
    const left = x - item.w / 2;
    const right = x + item.w / 2;
    const top = y - item.h / 2;
    const bottom = y + item.h / 2;
    return {
      left: Math.min(acc.left, left),
      right: Math.max(acc.right, right),
      top: Math.min(acc.top, top),
      bottom: Math.max(acc.bottom, bottom)
    };
  }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  return {
    ...bounds,
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
    w: bounds.right - bounds.left,
    h: bounds.bottom - bounds.top
  };
}

function boxOverlap(a, b, gapX, gapY) {
  const ox = (a.w + b.w) / 2 + gapX - Math.abs(b.x - a.x);
  const oy = (a.h + b.h) / 2 + gapY - Math.abs(b.y - a.y);
  if (ox <= 0 || oy <= 0) return null;
  return { x: ox, y: oy, push: Math.min(ox, oy) + 6 };
}

function directionalVector(angle) {
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function translateProblemGroup(group, dx, dy) {
  group.items.forEach((item) => {
    item.ref.x += dx;
    item.ref.y += dy;
  });
}

function timelineGeometry(models, bounds) {
  if (isPortraitAtlas(bounds)) return portraitTimelineGeometry(models, bounds);
  const sorted = models.slice().sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name));
  if (!sorted.length) {
    const timelineWidth = Math.max(bounds.width * 1.72, 1680);
    const left = 92;
    const right = timelineWidth - 92;
    const centerY = bounds.height / 2 + 8;
    const fallbackDate = 2026;
    return {
      domainMin: fallbackDate - 0.08,
      domainMax: fallbackDate + 0.08,
      left,
      right,
      centerY,
      positions: new Map(),
      connectors: [],
      monthTicks: timelineMonthTicks(fallbackDate - 0.08, fallbackDate + 0.08)
    };
  }
  const dates = sorted.map(slugDate);
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const domainMin = minDate - 0.055;
  const domainMax = maxDate + 0.07;
  const span = Math.max(0.1, domainMax - domainMin);
  const timelineWidth = Math.max(bounds.width * 1.72, 1680);
  const left = 92;
  const right = timelineWidth - 92;
  const centerY = bounds.height / 2 + 8;
  const positions = new Map();
  const connectors = [];
  const monthTicks = timelineMonthTicks(domainMin, domainMax);
  const laneState = { top: [], bottom: [] };
  const laneGap = bounds.width < 760 ? 34 : 38;
  const baseGap = bounds.width < 760 ? 50 : 56;
  const topLanes = clamp(Math.floor((centerY - 58 - baseGap) / laneGap) + 1, 2, 5);
  const bottomLanes = clamp(Math.floor((bounds.height - 58 - centerY - baseGap) / laneGap) + 1, 2, 5);

  sorted.forEach((model, index) => {
    const x = left + ((slugDate(model) - domainMin) / span) * (right - left);
    const labelW = timelinePaperLabelWidth(model);
    const preferredSide = pickTimelineSide(model, index);
    const lanePick = assignTimelineSlot(laneState, preferredSide, x, labelW, { top: topLanes, bottom: bottomLanes }, {
      minX: 54
    });
    const sideKey = lanePick.side;
    const side = sideKey === "top" ? -1 : 1;
    const lane = lanePick.lane;
    const y = centerY + side * (baseGap + lane * laneGap);
    const nodeX = lanePick.x;
    const nodeY = clamp(y, 56, bounds.height - 56);
    positions.set(model.id, { x: nodeX, y: nodeY });
    connectors.push({
      id: model.id,
      x,
      y: nodeY,
      nodeX,
      centerY,
      color: problemColorForModel(model)
    });
  });

  return {
    domainMin,
    domainMax,
    left,
    right,
    centerY,
    positions,
    connectors,
    monthTicks
  };
}

function portraitTimelineGeometry(models, bounds) {
  const sorted = models.slice().sort((a, b) => slugDate(b) - slugDate(a) || a.name.localeCompare(b.name));
  const dates = sorted.map(slugDate);
  const fallbackDate = 2026;
  const minDate = dates.length ? Math.min(...dates) : fallbackDate - 0.08;
  const maxDate = dates.length ? Math.max(...dates) : fallbackDate + 0.08;
  const domainMin = minDate - 0.055;
  const domainMax = maxDate + 0.07;
  const span = Math.max(0.1, domainMax - domainMin);
  const sceneHeight = Math.max(bounds.height * 2.35, 2200);
  const top = 88;
  const bottom = sceneHeight - 88;
  const centerX = bounds.width / 2;
  const positions = new Map();
  const connectors = [];
  const monthTicks = timelineMonthTicks(domainMin, domainMax);
  const laneLast = { left: [-Infinity, -Infinity], right: [-Infinity, -Infinity] };
  const laneGap = Math.min(64, bounds.width * 0.14);
  const baseGap = Math.min(70, bounds.width * 0.17);
  const minNodeGap = 43;

  const candidateFor = (side, dateY) => {
    let best = null;
    laneLast[side].forEach((lastY, lane) => {
      const nodeY = Math.max(dateY, lastY + minNodeGap);
      const candidate = { side, lane, nodeY, shift: nodeY - dateY };
      if (!best || candidate.shift < best.shift) best = candidate;
    });
    return best;
  };

  sorted.forEach((model, index) => {
    const dateY = top + ((domainMax - slugDate(model)) / span) * (bottom - top);
    const preferred = pickTimelineSide(model, index) === "top" ? "left" : "right";
    const alternate = preferred === "left" ? "right" : "left";
    const preferredCandidate = candidateFor(preferred, dateY);
    const alternateCandidate = candidateFor(alternate, dateY);
    const chosen = alternateCandidate.shift + 10 < preferredCandidate.shift ? alternateCandidate : preferredCandidate;
    laneLast[chosen.side][chosen.lane] = chosen.nodeY;
    const direction = chosen.side === "left" ? -1 : 1;
    const nodeX = centerX + direction * (baseGap + chosen.lane * laneGap);
    positions.set(model.id, { x: nodeX, y: chosen.nodeY, labelSide: "bottom" });
    connectors.push({
      id: model.id,
      y: dateY,
      nodeY: chosen.nodeY,
      nodeX,
      centerX,
      side: chosen.side,
      color: problemColorForModel(model)
    });
  });

  return {
    orientation: "vertical",
    newestFirst: true,
    sceneHeight,
    domainMin,
    domainMax,
    top,
    bottom,
    centerX,
    positions,
    connectors,
    monthTicks
  };
}

function pickTimelineSide(model, index) {
  const familyBias = {
    unified: "top",
    joint_latent: "top",
    multi_stream: "top",
    encoder_only: "top",
    pixel_idm: "bottom",
    latent_idm: "bottom",
    implicit_future: "bottom",
    latent_action: "bottom",
    alignment: "bottom",
    multimodal: "top",
    online_adaptation: "bottom",
    speedup: "top"
  };
  return familyBias[model.family] || (index % 2 === 0 ? "top" : "bottom");
}

function assignTimelineSlot(laneState, preferredSide, x, labelW, maxLanes, bounds) {
  const otherSide = preferredSide === "top" ? "bottom" : "top";
  const preferred = timelineLaneCandidate(laneState[preferredSide], x, labelW, maxLanes[preferredSide], bounds);
  const alternate = timelineLaneCandidate(laneState[otherSide], x, labelW, maxLanes[otherSide], bounds);
  const useAlternate = alternate.overflow + 12 < preferred.overflow;
  const chosen = useAlternate ? alternate : preferred;
  const side = useAlternate ? otherSide : preferredSide;
  laneState[side][chosen.lane] = chosen.x;
  return { ...chosen, side };
}

function timelineLaneCandidate(lanes, x, labelW, maxLanes, bounds) {
  const gap = 16;
  let bestLane = 0;
  let bestOverflow = Infinity;
  let bestX = x;
  for (let lane = 0; lane < maxLanes; lane += 1) {
    const lastX = lanes[lane] ?? -Infinity;
    const overflow = lastX + labelW + gap - x;
    if (overflow <= 0) {
      const placedX = Math.max(bounds.minX, x);
      return { lane, x: placedX, overflow: 0 };
    }
    if (overflow < bestOverflow) {
      bestOverflow = overflow;
      bestLane = lane;
      bestX = Math.max(x, lastX + labelW + gap);
    }
  }
  const placedX = Math.max(bounds.minX, bestX);
  return { lane: bestLane, x: placedX, overflow: bestOverflow };
}

function timelinePaperLabelWidth(model) {
  return clamp(shortPaperName(model.name).length * 6.1 + 26, 66, 116);
}

function timelineMonthTicks(domainMin, domainMax) {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const startIndex = Math.floor(domainMin * 12);
  const endIndex = Math.ceil(domainMax * 12);
  const ticks = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    const year = Math.floor(index / 12);
    const monthIndex = ((index % 12) + 12) % 12;
    const value = year + monthIndex / 12;
    if (value < domainMin || value > domainMax) continue;
    const isYearStart = monthIndex === 0;
    const isEdge = ticks.length === 0 || index === endIndex;
    ticks.push({
      value,
      label: isYearStart || isEdge ? `${labels[monthIndex]} '${String(year).slice(-2)}` : labels[monthIndex],
      major: isYearStart || isEdge,
      side: ticks.length % 2 === 0 ? "top" : "bottom"
    });
  }
  return ticks;
}

function drawProblemBackdrop(group, defs, geometry) {
  const layer = atlasAnnotationLayer("problem-tree");
  if (geometry.portrait) layer.classList.add("is-portrait");
  geometry.edges.forEach((edge, index) => {
    drawFadingConnector(layer, defs, `problem-${index}-${edge.id}`, edge.from, edge.to, edge.color, true);
  });
  geometry.positions.forEach((point, modelId) => {
    const leaf = geometry.leafAssignments.get(modelId);
    if (!leaf) return;
    drawPaperTether(layer, leaf, point, modelId);
  });
  layer.insertAdjacentHTML("beforeend", drawQuestionNode(geometry.root, rootProblemQuestion, "problem-root", "#172024", problemQuestionWidth("root", geometry.portrait), "root"));
  geometry.branchNodes.forEach((branch) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(branch, branch.question, "problem-branch", branch.color, problemQuestionWidth("branch", geometry.portrait), "branch"));
  });
  geometry.familyNodes.forEach((family) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(family, family.question, "problem-leaf-question", family.color, problemQuestionWidth("leaf", geometry.portrait), "leaf"));
  });
  group.appendChild(layer);
}

function drawPaperTether(layer, leaf, point, modelId = "") {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "paper-tether");
  path.dataset.leafId = leaf.id || "";
  path.dataset.paperId = modelId;
  path.setAttribute("stroke", leaf.color || "#9aa6aa");
  path.setAttribute("d", paperTetherPath(leaf, point));
  layer.appendChild(path);
}

function paperTetherPath(leaf, point) {
  const dx = point.x - leaf.x;
  const dy = point.y - leaf.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const leafWidth = problemQuestionWidth("leaf", leaf.portrait);
  const leafLayout = questionTextLayout(leaf.question, leafWidth, "leaf", leaf.label);
  const leafBox = problemQuestionCollision("leaf", leafLayout.boxWidth, leafLayout.h);
  const startDistance = rectEdgeDistance(leafBox, unit) + 5;
  const start = {
    x: leaf.x + unit.x * startDistance,
    y: leaf.y + unit.y * startDistance
  };
  const end = {
    x: point.x - unit.x * 14,
    y: point.y - unit.y * 14
  };
  return `M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`;
}

function drawTimelineBackdrop(group, geometry) {
  const layer = atlasAnnotationLayer("timeline-map");
  if (geometry.orientation === "vertical") {
    layer.classList.add("is-vertical");
    const ticks = geometry.monthTicks.map((tick) => {
      const progress = geometry.newestFirst
        ? (geometry.domainMax - tick.value) / Math.max(0.1, geometry.domainMax - geometry.domainMin)
        : (tick.value - geometry.domainMin) / Math.max(0.1, geometry.domainMax - geometry.domainMin);
      const y = geometry.top + progress * (geometry.bottom - geometry.top);
      const side = tick.side === "top" ? -1 : 1;
      const cls = tick.major ? "timeline-tick is-major" : "timeline-tick";
      return `
        <line class="${cls}" x1="${geometry.centerX - (tick.major ? 15 : 10)}" y1="${y}" x2="${geometry.centerX + (tick.major ? 15 : 10)}" y2="${y}"></line>
        <text class="timeline-date ${tick.major ? "is-major" : ""}" style="fill:${tick.major ? "#35434a" : "#59676e"};font-size:${tick.major ? 13 : 11}px" x="${geometry.centerX + side * 20}" y="${y + 3}" text-anchor="${side < 0 ? "end" : "start"}">${tick.label}</text>
      `;
    }).join("");
    const lines = geometry.connectors.map((item) => {
      const side = item.side === "left" ? -1 : 1;
      const elbowX = geometry.centerX + side * 24;
      const endX = item.nodeX - side * 15;
      return `
        <circle class="timeline-bead" cx="${geometry.centerX}" cy="${item.y}" r="4.5" fill="${item.color}"></circle>
        <path class="timeline-branch" stroke="${item.color}" d="M ${geometry.centerX + side * 5} ${item.y} H ${elbowX} V ${item.nodeY} H ${endX}"></path>
      `;
    }).join("");
    layer.innerHTML = `
      <rect x="${geometry.centerX - 3}" y="${geometry.top}" width="6" height="${geometry.bottom - geometry.top}" rx="3" fill="rgba(23,32,36,0.3)"></rect>
      ${ticks}
      ${lines}
    `;
    group.appendChild(layer);
    return;
  }
  const ticks = geometry.monthTicks.map((tick) => {
    const x = geometry.left + ((tick.value - geometry.domainMin) / Math.max(0.1, geometry.domainMax - geometry.domainMin)) * (geometry.right - geometry.left);
    const cls = tick.major ? "timeline-tick is-major" : "timeline-tick";
    const labelY = geometry.centerY + (tick.side === "top" ? -14 : 23);
    return `
      <line class="${cls}" x1="${x}" y1="${geometry.centerY - (tick.major ? 15 : 10)}" x2="${x}" y2="${geometry.centerY + (tick.major ? 15 : 10)}"></line>
      <text class="timeline-date ${tick.major ? "is-major" : ""} is-${tick.side}" x="${x}" y="${labelY}" text-anchor="middle">${tick.label}</text>
    `;
  });
  const lines = geometry.connectors.map((item, index) => {
    const side = item.y < item.centerY ? -1 : 1;
    const elbowY = item.centerY + side * 22;
    const endY = item.y - side * 16;
    return `
      <circle class="timeline-bead" cx="${item.x}" cy="${item.centerY}" r="4.5" fill="${item.color}"></circle>
      <path class="timeline-branch" stroke="${item.color}" d="M ${item.x} ${item.centerY + side * 5} V ${elbowY} H ${item.nodeX} V ${endY}"></path>
    `;
  }).join("");
  layer.innerHTML = `
    <path class="timeline-spine" d="M ${geometry.left} ${geometry.centerY} H ${geometry.right}"></path>
    ${ticks.join("")}
    ${lines}
  `;
  group.appendChild(layer);
}

function renderTimelineLegend() {
  const legend = $("#timelineLegend");
  if (!legend) return;
  legend.hidden = state.mode !== "timeline";
  if (legend.hidden) return;
  const labels = {
    futures: "Imagined futures",
    coupling: "World-action coupling",
    speed: "Fast control",
    grounding: "World grounding",
    physics: "Physical robustness"
  };
  legend.innerHTML = problemBranches.map((branch) => {
    const checked = branch.families.some((family) => !state.timelineExcludedFamilies?.has(family));
    return `
    <button class="timeline-legend-item ${checked ? "is-checked" : "is-unchecked"}" type="button" data-branch="${escapeHtml(branch.id)}" aria-pressed="${checked ? "true" : "false"}">
      <span class="timeline-legend-box" aria-hidden="true">${checked ? "&#10003;" : ""}</span>
      <span class="timeline-legend-dot" style="background:${branch.color}"></span>
      <span>${escapeHtml(labels[branch.id] || branch.question)}</span>
    </button>
  `;
  }).join("");
  legend.querySelectorAll(".timeline-legend-item").forEach((item) => {
    item.addEventListener("click", () => {
      const branch = problemBranches.find((candidate) => candidate.id === item.dataset.branch);
      if (!branch) return;
      const hasVisible = branch.families.some((family) => !state.timelineExcludedFamilies.has(family));
      branch.families.forEach((family) => {
        if (hasVisible) state.timelineExcludedFamilies.add(family);
        else state.timelineExcludedFamilies.delete(family);
      });
      renderAtlas();
    });
  });
}

function populateMetricControls() {
  const select = $("#accuracyBenchmark");
  if (!select) return;
  const keys = new Set();
  state.models.forEach((model) => {
    if (!hasMetricsTargetBenchmark(model)) return;
    (model.metrics?.comparative?.accuracy?.defaultBenchmarkKeys || []).forEach((key) => keys.add(key));
  });
  const ordered = ["estimated", ...Array.from(keys).sort((a, b) => benchmarkLabel(a).localeCompare(benchmarkLabel(b)))];
  select.innerHTML = ordered.map((key) => `
    <option value="${escapeHtml(key)}">${escapeHtml(key === "estimated" ? "Estimated normalized" : benchmarkLabel(key))}</option>
  `).join("");
  if (!ordered.includes(state.accuracyBenchmark)) state.accuracyBenchmark = "estimated";
  select.value = state.accuracyBenchmark;
}

function metricConfig() {
  const configs = {
    accuracy: {
      label: state.accuracyBenchmark === "estimated" ? "estimated normalized accuracy" : `${benchmarkLabel(state.accuracyBenchmark)} accuracy`,
      unit: "%",
      min: 30,
      max: 95,
      better: "higher",
      value: (model) => state.accuracyBenchmark === "estimated"
        ? (hasMetricsTargetBenchmark(model) ? model.metrics?.comparative?.accuracy?.estimatedScore : null)
        : model.metrics?.comparative?.accuracy?.benchmarkScores?.[state.accuracyBenchmark]?.estimatedScore
    },
    compute: {
      label: state.computeMetric === "finetuning" ? "task fine-tune cost for 5h data" : "pretraining compute cost",
      unit: "GPUh",
      min: state.computeMetric === "finetuning" ? 1 : 8,
      max: state.computeMetric === "finetuning" ? 1800 : 120000,
      scale: "log",
      better: "lower",
      value: (model) => state.computeMetric === "finetuning"
        ? (hasMetricsTargetBenchmark(model) ? model.metrics?.comparative?.computeCost?.finetuningGpuHours5h : null)
        : (hasMetricsTargetBenchmark(model) ? model.metrics?.comparative?.computeCost?.pretrainingGpuHours : null)
    },
    inference: {
      label: "estimated inference throughput on RTX 4090",
      unit: "FPS",
      min: 0.1,
      max: 220,
      scale: "log",
      better: "higher",
      value: (model) => hasMetricsTargetBenchmark(model) ? model.metrics?.comparative?.inferenceCost?.fps4090 : null
    },
    generalization: {
      label: "normalized generalization improvement",
      unit: "%",
      min: 0,
      max: 75,
      better: "higher",
      value: (model) => model.metrics?.comparative?.generalization?.includeInMetrics
        ? model.metrics?.comparative?.generalization?.improvementPct
        : null
    }
  };
  return configs[state.metricView] || configs.accuracy;
}

function metricValue(model) {
  const value = Number(metricConfig().value(model));
  return Number.isFinite(value) ? value : null;
}

function metricChartMode() {
  return state.metricView === "accuracy" && state.metricChart === "compare" ? "bar" : state.metricChart;
}

function metricAccuracyFilterApplies() {
  return state.mode === "metrics"
    && metricChartMode() === "frontier"
    && (state.metricView === "compute" || state.metricView === "inference");
}

function passesMetricAccuracyFilter(model) {
  if (!metricAccuracyFilterApplies() || !state.metricAccuracyFilterEnabled) return true;
  const accuracy = Number(model.metrics?.comparative?.accuracy?.estimatedScore);
  return Number.isFinite(accuracy) && accuracy >= Number(state.metricAccuracyThreshold || 0);
}

function metricChartModels() {
  const config = metricConfig();
  return filteredModels().filter((model) => Number.isFinite(Number(config.value(model))));
}

function metricSortMultiplier(config = metricConfig()) {
  return config.better === "lower" ? 1 : -1;
}

function sortedMetricModels() {
  const config = metricConfig();
  return metricChartModels()
    .slice()
    .sort((a, b) => {
      const delta = (metricValue(a) - metricValue(b)) * metricSortMultiplier(config);
      if (delta) return delta;
      return slugDate(a) - slugDate(b);
    });
}

function metricDateValue(model) {
  return new Date(Number(model.year || 2024), Number(model.month || 6) - 1, Number(model.day || 15)).getTime();
}

function metricDateDomain(models) {
  const dates = models.map(metricDateValue).filter(Number.isFinite);
  if (!dates.length) return [Date.UTC(2024, 0, 1), Date.UTC(2026, 0, 1)];
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const pad = Math.max(86400000 * 20, (max - min) * 0.06);
  return [min - pad, max + pad];
}

function metricXForDate(model, chart, domain) {
  const [min, max] = domain;
  return chart.left + ((metricDateValue(model) - min) / Math.max(1, max - min)) * (chart.right - chart.left);
}

function metricYForValue(value, chart, config) {
  const t = metricScaleValue(value, config);
  return config.better === "lower"
    ? chart.top + t * (chart.bottom - chart.top)
    : chart.bottom - t * (chart.bottom - chart.top);
}

function metricXForValue(value, chart, config) {
  return chart.left + metricScaleValue(value, config) * (chart.right - chart.left);
}

function metricYForAccuracy(model, chart) {
  const accuracy = Number(model.metrics?.comparative?.accuracy?.estimatedScore);
  return chart.bottom - metricScaleValue(accuracy, { min: 30, max: 100 }) * (chart.bottom - chart.top);
}

function metricScaleValue(value, config) {
  if (config.scale === "log") {
    const min = Math.log10(Math.max(0.001, config.min));
    const max = Math.log10(Math.max(config.min + 0.001, config.max));
    return clamp((Math.log10(Math.max(0.001, value)) - min) / (max - min), 0, 1);
  }
  return clamp((value - config.min) / (config.max - config.min), 0, 1);
}

function metricTicks(config) {
  if (config.scale === "log") {
    const raw = config.max > 10000 ? [10, 100, 1000, 10000, 100000] : [0.1, 1, 10, 100, 1000];
    return raw.filter((value) => value >= config.min && value <= config.max);
  }
  const step = (config.max - config.min) / 4;
  return Array.from({ length: 5 }, (_, index) => config.min + index * step);
}

function metricsBounds(bounds) {
  if (bounds.width <= 620) {
    return {
      left: 70,
      right: bounds.width - 22,
      top: 186,
      bottom: bounds.height - 54
    };
  }
  return {
    left: 96,
    right: bounds.width - 92,
    top: 168,
    bottom: bounds.height - 86
  };
}

function metricLaneForModel(model, bounds) {
  const branch = problemBranchForFamily(model.family);
  const branches = problemBranches.filter((item) => item.families.some((family) => state.models.some((model) => model.family === family)));
  const index = Math.max(0, branches.findIndex((item) => item.id === branch?.id));
  const top = metricsBounds(bounds).top + 38;
  const bottom = metricsBounds(bounds).bottom - 38;
  const count = Math.max(1, branches.length - 1);
  return top + (index / count) * (bottom - top);
}

function metricsPosition(model, bounds, index) {
  const chart = metricsBounds(bounds);
  const config = metricConfig();
  const value = metricValue(model);
  if (value == null) return { x: chart.left, y: chart.bottom };
  const mode = metricChartMode();
  if (mode === "frontier") {
    const domain = metricDateDomain(metricChartModels());
    const jitter = ((index * 31) % 15) - 7;
    return {
      x: clamp(metricXForDate(model, chart, domain), chart.left, chart.right),
      y: clamp(metricYForValue(value, chart, config) + jitter * 0.35, chart.top + 18, chart.bottom - 18)
    };
  }
  if (mode === "compare") {
    const jitter = ((index * 17) % 13) - 6;
    return {
      x: clamp(metricXForValue(value, chart, config), chart.left, chart.right),
      y: clamp(metricYForAccuracy(model, chart) + jitter * 0.4, chart.top + 18, chart.bottom - 18)
    };
  }
  const items = sortedMetricModels();
  const rank = Math.max(0, items.findIndex((item) => item.id === model.id));
  const y = chart.top + ((rank + 0.5) / Math.max(1, items.length)) * (chart.bottom - chart.top);
  const x = chart.left + metricScaleValue(value, config) * (chart.right - chart.left);
  return { x: clamp(x, chart.left, chart.right), y: clamp(y, chart.top + 18, chart.bottom - 18) };
}

function drawMetricsBackdrop(group, bounds) {
  const layer = atlasAnnotationLayer("metrics-map");
  const chart = metricsBounds(bounds);
  const config = metricConfig();
  const mode = metricChartMode();
  const valueTicks = mode === "bar" || mode === "compare" ? "" : metricTicks(config).map((value) => {
    const y = metricYForValue(value, chart, config);
    return `
      <line class="metrics-grid" x1="${chart.left}" y1="${y}" x2="${chart.right}" y2="${y}"></line>
      <text class="metrics-tick" x="${chart.left - 14}" y="${y + 3}" text-anchor="end">${escapeHtml(formatMetricValue(value, config))}</text>
    `;
  }).join("");
  const chartBody = mode === "frontier"
    ? drawTimeFrontierBackdrop(metricChartModels(), chart, config)
    : mode === "compare"
      ? drawAccuracyComparisonBackdrop(metricChartModels(), chart, config)
      : drawBarMetricBackdrop(sortedMetricModels(), chart, config);
  const xLabel = mode === "frontier" ? "release date" : config.label;
  const yLabel = mode === "compare" ? "estimated normalized accuracy (%, higher is better)" : `${config.label} (${config.unit}, ${config.better} is better)`;
  layer.innerHTML = `
    ${valueTicks}
    ${chartBody}
    <line class="metrics-axis" x1="${chart.left}" y1="${chart.bottom}" x2="${chart.right}" y2="${chart.bottom}"></line>
    <line class="metrics-axis" x1="${chart.left}" y1="${chart.top}" x2="${chart.left}" y2="${chart.bottom}"></line>
    <text class="axis-label metrics-axis-label" x="${chart.left}" y="${chart.top - 24}">${escapeHtml(yLabel)}</text>
    <text class="metrics-axis-caption" x="${chart.right}" y="${chart.bottom + 32}" text-anchor="end">${escapeHtml(xLabel)}</text>
  `;
  group.appendChild(layer);
}

function drawBarMetricBackdrop(models, chart, config) {
  const count = Math.max(1, models.length);
  const barH = clamp((chart.bottom - chart.top) / count * 0.45, 3, 12);
  const ticks = metricTicks(config).map((value) => {
    const x = chart.left + metricScaleValue(value, config) * (chart.right - chart.left);
    return `
      <line class="metrics-grid" x1="${x}" y1="${chart.top}" x2="${x}" y2="${chart.bottom}"></line>
      <text class="metrics-tick" x="${x}" y="${chart.bottom + 18}" text-anchor="middle">${escapeHtml(formatMetricValue(value, config))}</text>
    `;
  }).join("");
  const bars = models.map((model, rank) => {
    const value = metricValue(model);
    const x = chart.left + metricScaleValue(value, config) * (chart.right - chart.left);
    const y = chart.top + ((rank + 0.5) / count) * (chart.bottom - chart.top);
    return `
      <line class="metrics-bar" x1="${chart.left}" y1="${y}" x2="${x}" y2="${y}" stroke="${problemColorForModel(model)}" stroke-width="${barH}"></line>
      <text class="metrics-bar-label" x="${chart.left - 12}" y="${y + 3}" text-anchor="end">${escapeHtml(shortText(model.name, 18))}</text>
    `;
  }).join("");
  return `${ticks}${bars}`;
}

function drawTimeFrontierBackdrop(models, chart, config) {
  const domain = metricDateDomain(models);
  const years = Array.from(new Set(models.map((model) => Number(model.year)).filter(Number.isFinite))).sort((a, b) => a - b);
  const yearTicks = years.map((year) => {
    const x = chart.left + ((new Date(year, 0, 1).getTime() - domain[0]) / Math.max(1, domain[1] - domain[0])) * (chart.right - chart.left);
    return `
      <line class="metrics-grid" x1="${x}" y1="${chart.top}" x2="${x}" y2="${chart.bottom}"></line>
      <text class="metrics-tick" x="${x}" y="${chart.bottom + 18}" text-anchor="middle">${year}</text>
    `;
  }).join("");
  const best = frontierPolyline(models, chart, config, (model) => metricXForDate(model, chart, domain));
  const anti = state.metricView === "compute" || state.metricView === "inference"
    ? frontierPolyline(models, chart, config, (model) => metricXForDate(model, chart, domain), { anti: true, dashed: true })
    : "";
  const guide = anti ? `
    <text class="metrics-frontier-label" x="${chart.right}" y="${chart.top + 16}" text-anchor="end">best frontier</text>
    <text class="metrics-frontier-label is-anti" x="${chart.right}" y="${chart.top + 32}" text-anchor="end">worst frontier</text>
  ` : "";
  return `${yearTicks}${anti}${best}${guide}`;
}

function drawAccuracyComparisonBackdrop(models, chart, config) {
  const metricXTicks = metricTicks(config).map((value) => {
    const x = metricXForValue(value, chart, config);
    return `
      <line class="metrics-grid" x1="${x}" y1="${chart.top}" x2="${x}" y2="${chart.bottom}"></line>
      <text class="metrics-tick" x="${x}" y="${chart.bottom + 18}" text-anchor="middle">${escapeHtml(formatMetricValue(value, config))}</text>
    `;
  }).join("");
  const accuracyYTicks = [40, 55, 70, 85, 100].map((value) => {
    const y = chart.bottom - metricScaleValue(value, { min: 30, max: 100 }) * (chart.bottom - chart.top);
    return `
      <line class="metrics-grid" x1="${chart.left}" y1="${y}" x2="${chart.right}" y2="${y}"></line>
      <text class="metrics-tick" x="${chart.left - 14}" y="${y + 3}" text-anchor="end">${value}</text>
    `;
  }).join("");
  return `${metricXTicks}${accuracyYTicks}${comparisonParetoPolyline(models, chart, config)}`;
}

function comparisonParetoPolyline(models, chart, config) {
  const points = models
    .map((model) => {
      const metric = metricValue(model);
      const accuracy = Number(model.metrics?.comparative?.accuracy?.estimatedScore);
      if (!Number.isFinite(metric) || !Number.isFinite(accuracy)) return null;
      return {
        x: metricXForValue(metric, chart, config),
        y: metricYForAccuracy(model, chart),
        metric,
        accuracy
      };
    })
    .filter(Boolean)
    .sort((a, b) => config.better === "lower" ? a.metric - b.metric : b.metric - a.metric);
  let bestAccuracy = -Infinity;
  const frontier = [];
  points.forEach((point) => {
    if (point.accuracy <= bestAccuracy) return;
    bestAccuracy = point.accuracy;
    frontier.push(point);
  });
  if (config.better !== "lower") frontier.reverse();
  if (frontier.length < 2) return "";
  const attr = frontier.map(({ x, y }) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ");
  return `<polyline class="metrics-frontier is-dashed" points="${attr}"></polyline>`;
}

function frontierPolyline(models, chart, config, xForModel, options = {}) {
  const dashed = Boolean(options.dashed);
  const anti = Boolean(options.anti);
  const sorted = models
    .filter((model) => metricValue(model) != null)
    .sort((a, b) => xForModel(a) - xForModel(b));
  let best = null;
  const points = [];
  sorted.forEach((model) => {
    const value = metricValue(model);
    const improves = best == null || (config.better === "lower" ? value < best : value > best);
    const worsens = best == null || (config.better === "lower" ? value > best : value < best);
    if (anti ? !worsens : !improves) return;
    best = value;
    points.push([xForModel(model), metricYForValue(value, chart, config)]);
  });
  if (points.length < 2) return "";
  const attr = points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ");
  return `<polyline class="metrics-frontier${dashed ? " is-dashed" : ""}${anti ? " is-anti" : ""}" points="${attr}"></polyline>`;
}

function metricLaneForBranch(branch, bounds) {
  const branches = problemBranches.filter((item) => item.families.some((family) => state.models.some((model) => model.family === family)));
  const index = Math.max(0, branches.findIndex((item) => item.id === branch.id));
  const chart = metricsBounds(bounds);
  const top = chart.top + 38;
  const bottom = chart.bottom - 38;
  return top + (index / Math.max(1, branches.length - 1)) * (bottom - top);
}

function formatMetricValue(value, config) {
  if (config.unit === "GPUh") {
    if (value >= 1000) return `${Math.round(value / 1000)}k`;
    return `${Math.round(value)}`;
  }
  if (config.unit === "FPS") {
    if (value < 1) return String(Math.round(value * 100) / 100);
    return value < 10 ? String(Math.round(value * 10) / 10) : String(Math.round(value));
  }
  return `${Math.round(value)}`;
}

function benchmarkLabel(key) {
  const labels = {
    robotwinAllData: "RoboTwin all-data",
    robotwinTaskSpecific: "RoboTwin task-specific",
    liberoPlus: "LIBERO-Plus",
    liberoPro: "LIBERO-Pro",
    simpler: "SimplerEnv",
    robocasa: "RoboCasa"
  };
  return labels[key] || key;
}

const taxonomyTreeBranches = [
  {
    id: "architecture",
    label: "Architecture",
    color: "#8fc5d4",
    children: [
      { id: "future-bridge", label: "Future-to-action bridge", families: ["pixel_idm", "latent_idm", "implicit_future"] },
      { id: "shared-core", label: "Shared temporal core", families: ["unified", "joint_latent", "multi_stream"] },
      { id: "runtime-policy", label: "Fast runtime policy", families: ["encoder_only"] },
      { id: "physical-grounding", label: "Physical state grounding", families: ["multimodal"] }
    ]
  },
  {
    id: "enhancement",
    label: "Enhancement",
    color: "#ddb06d",
    children: [
      { id: "action-abstraction", label: "Action abstraction", families: ["latent_action"] },
      { id: "representation-alignment", label: "Representation alignment", families: ["alignment"] },
      { id: "deployment-adaptation", label: "Deployment adaptation", families: ["online_adaptation", "speedup"] }
    ]
  }
];

function drawTaxonomyBackdrop(group, bounds, defs) {
  if (state.taxonomyTree) {
    drawTaxonomyTreeBackdrop(group, bounds, defs);
    return;
  }
  if (state.taxonomyGallery) {
    drawTaxonomyGalleryBackdrop(group, bounds);
    return;
  }
  const layer = atlasAnnotationLayer("taxonomy-map");
  const layouts = taxonomyFamilyLayouts(bounds);
  taxonomyContainers(bounds).forEach((container) => {
    layer.insertAdjacentHTML("beforeend", `
      <g class="taxonomy-container">
        <rect x="${container.x}" y="${container.y}" width="${container.w}" height="${container.h}"></rect>
        <text x="${container.x + 18}" y="${container.y - 12}">${escapeHtml(container.label)}</text>
      </g>
    `);
  });
  familyOrder().forEach((family) => {
    const layout = layouts.get(family);
    if (!layout) return;
    const color = problemColorForFamily(family);
    layer.insertAdjacentHTML("beforeend", `
      <g class="taxonomy-family" data-family="${escapeHtml(family)}" data-x="${layout.x}" data-y="${layout.y}" transform="translate(${layout.x} ${layout.y})" style="--tax-color:${color}">
        <rect class="taxonomy-family-hit" x="0" y="0" width="${layout.w}" height="${layout.h}"></rect>
        <g class="taxonomy-family-visual">
          <text class="layout-label taxonomy-family-label" x="${layout.w / 2}" y="16" text-anchor="middle">${escapeHtml(familyLabels[family] || family)}</text>
          ${drawTaxonomyFamilyGlyph(family, layout, color)}
        </g>
      </g>
    `);
  });
  group.appendChild(layer);
}

function drawTaxonomyTreeBackdrop(group, bounds, defs) {
  const layer = atlasAnnotationLayer("taxonomy-tree-map");
  const geometry = taxonomyTreeGeometry(bounds);
  geometry.edges.forEach((edge, index) => {
    drawFadingConnector(layer, defs, `taxonomy-tree-${index}-${edge.from.id}-${edge.to.id}`, edge.from, edge.to, edge.color, true);
  });
  const drawNode = (node) => {
    const color = node.color || "#9aa6aa";
    const lines = wrapText(node.label, taxonomyTreeTextChars(node)).slice(0, 3);
    const firstDy = -(lines.length - 1) * node.lineHeight / 2 + 4;
    return `
      <g class="taxonomy-tree-node taxonomy-tree-${node.level}${node.family ? " taxonomy-family" : ""}" data-family="${escapeHtml(node.family || "")}" data-x="${node.x}" data-y="${node.y}" transform="translate(${node.x} ${node.y})" style="--tax-color:${color}">
        <rect x="${-node.w / 2}" y="${-node.h / 2}" width="${node.w}" height="${node.h}"></rect>
        <text text-anchor="middle" y="${firstDy}">
          ${lines.map((line, index) => `<tspan x="0" dy="${index ? node.lineHeight : 0}">${escapeHtml(line)}</tspan>`).join("")}
        </text>
      </g>
    `;
  };
  layer.innerHTML += geometry.nodes.map(drawNode).join("");
  geometry.paperContainers.forEach((container) => {
    layer.insertAdjacentHTML("beforeend", `
      <g class="taxonomy-tree-paper-container" style="--tax-color:${container.color}">
        <rect x="${container.x}" y="${container.y}" width="${container.w}" height="${container.h}"></rect>
      </g>
    `);
  });
  group.appendChild(layer);
}

function taxonomyTreeTextChars(node) {
  if (node.level === "root") return 18;
  if (node.level === "major") return 13;
  if (node.level === "category") return 15;
  return 14;
}

function taxonomyTreeGeometry(bounds) {
  const top = 68;
  const familyGap = 12;
  const categoryGap = 18;
  const x = {
    root: 58,
    major: 238,
    category: 446,
    family: 656,
    paper: 1068
  };
  const nodes = [];
  const paperContainers = [];
  const edges = [];
  const positions = new Map();
  const blocks = [];
  const nodeById = new Map();

  const makeNode = (node) => {
    const full = {
      lineHeight: 21,
      w: 176,
      h: 66,
      color: "#9aa6aa",
      ...node
    };
    nodeById.set(full.id, full);
    return full;
  };
  const modelSort = (a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name);

  taxonomyTreeBranches.forEach((major) => {
    const majorBlock = { major, categories: [], h: 0 };
    major.children.forEach((category) => {
      const categoryBlock = { category, families: [], h: 0 };
      category.families.filter((family) => familyOrder().includes(family)).forEach((family) => {
        const models = state.models.filter((model) => model.family === family).sort(modelSort);
        const paperCols = Math.min(4, Math.max(1, models.length));
        const paperRows = Math.ceil(models.length / paperCols);
        const h = Math.max(82, paperRows * 42 + 26);
        categoryBlock.families.push({ family, models, h, paperCols, paperRows });
      });
      categoryBlock.h = Math.max(74, categoryBlock.families.reduce((sum, item) => sum + item.h, 0) + Math.max(0, categoryBlock.families.length - 1) * familyGap);
      majorBlock.categories.push(categoryBlock);
    });
    majorBlock.h = Math.max(120, majorBlock.categories.reduce((sum, item) => sum + item.h, 0) + Math.max(0, majorBlock.categories.length - 1) * categoryGap);
    blocks.push(majorBlock);
  });

  let cursor = top;
  blocks.forEach((majorBlock, majorIndex) => {
    majorBlock.y0 = cursor;
    majorBlock.y1 = cursor + majorBlock.h;
    cursor = majorBlock.y1 + 26 + majorIndex * 6;
  });
  const root = makeNode({
    id: "taxonomy-root",
    label: "World action model taxonomy",
    level: "root",
    x: x.root,
    y: (blocks[0].y0 + blocks[blocks.length - 1].y1) / 2,
    w: 210,
    h: 82,
    lineHeight: 23,
    color: "#172024"
  });
  nodes.push(root);

  blocks.forEach((majorBlock) => {
    const majorNode = makeNode({
      id: `taxonomy-${majorBlock.major.id}`,
      label: majorBlock.major.label,
      level: "major",
      x: x.major,
      y: (majorBlock.y0 + majorBlock.y1) / 2,
      w: 184,
      h: 68,
      lineHeight: 23,
      color: majorBlock.major.color
    });
    nodes.push(majorNode);
    edges.push({ from: root, to: majorNode, color: majorBlock.major.color });

    let categoryY = majorBlock.y0;
    majorBlock.categories.forEach((categoryBlock) => {
      const categoryNode = makeNode({
        id: `taxonomy-${categoryBlock.category.id}`,
        label: categoryBlock.category.label,
        level: "category",
        x: x.category,
        y: categoryY + categoryBlock.h / 2,
        w: 190,
        h: 64,
        lineHeight: 20,
        color: majorBlock.major.color
      });
      nodes.push(categoryNode);
      edges.push({ from: majorNode, to: categoryNode, color: majorBlock.major.color });

      let familyY = categoryY;
      categoryBlock.families.forEach((familyBlock) => {
        const familyColor = problemColorForFamily(familyBlock.family);
        const familyNode = makeNode({
          id: `taxonomy-family-${familyBlock.family}`,
          label: familyLabels[familyBlock.family] || familyBlock.family,
          level: "family",
          family: familyBlock.family,
          x: x.family,
          y: familyY + familyBlock.h / 2,
          w: 194,
          h: 62,
          lineHeight: 19,
          color: familyColor
        });
        nodes.push(familyNode);
        edges.push({ from: categoryNode, to: familyNode, color: familyColor });

        const paperColGap = 108;
        const paperRowGap = 38;
        const paperCenterY = familyY + familyBlock.h / 2;
        familyBlock.models.forEach((model, paperIndex) => {
          const col = paperIndex % familyBlock.paperCols;
          const row = Math.floor(paperIndex / familyBlock.paperCols);
          const rowCount = Math.min(familyBlock.paperCols, familyBlock.models.length - row * familyBlock.paperCols);
          const offsetX = (col - (rowCount - 1) / 2) * paperColGap;
          const offsetY = (row - (familyBlock.paperRows - 1) / 2) * paperRowGap + 3;
          const point = { id: model.id, x: x.paper + offsetX, y: paperCenterY + offsetY, w: 104, h: 44 };
          positions.set(model.id, point);
        });
        const containerW = Math.max(176, (familyBlock.paperCols - 1) * paperColGap + 154);
        const containerH = Math.max(54, (familyBlock.paperRows - 1) * paperRowGap + 50);
        paperContainers.push({
          id: `taxonomy-papers-${familyBlock.family}`,
          family: familyBlock.family,
          color: familyColor,
          x: x.paper - containerW / 2,
          y: paperCenterY - containerH / 2,
          w: containerW,
          h: containerH
        });
        familyY += familyBlock.h + familyGap;
      });
      categoryY += categoryBlock.h + categoryGap;
    });
  });

  const fit = taxonomyTreeContentBounds(nodes, paperContainers, positions);
  return { sceneWidth: fit.w, sceneHeight: fit.h, root, nodes, paperContainers, edges, positions, fit };
}

function taxonomyTreeContentBounds(nodes, paperContainers, positions) {
  const items = [
    ...nodes.map((node) => ({ ref: node, w: node.w, h: node.h })),
    ...paperContainers.map((container) => ({
      ref: { x: container.x + container.w / 2, y: container.y + container.h / 2 },
      w: container.w,
      h: container.h
    })),
    ...Array.from(positions.values()).map((point) => ({ ref: point, w: 136, h: 56 }))
  ];
  const bounds = groupBounds(items);
  const pad = 16;
  return {
    x: bounds.x,
    y: bounds.y,
    w: bounds.w + pad * 2,
    h: bounds.h + pad * 2,
    left: bounds.left - pad,
    right: bounds.right + pad,
    top: bounds.top - pad,
    bottom: bounds.bottom + pad
  };
}

function drawTaxonomyGalleryBackdrop(group, bounds) {
  const layer = atlasAnnotationLayer("taxonomy-gallery-map");
  const containers = taxonomyGalleryContainers(bounds);
  containers.forEach((container) => {
    const layouts = taxonomyGalleryFamilyLayouts(container);
    const galleryBounds = taxonomyGalleryContainerBounds(container, layouts);
    layer.insertAdjacentHTML("beforeend", `
      <g class="taxonomy-container taxonomy-gallery-container">
        <rect x="${galleryBounds.x}" y="${galleryBounds.y}" width="${galleryBounds.w}" height="${galleryBounds.h}"></rect>
        <text x="${galleryBounds.x + 18}" y="${galleryBounds.y - 12}">${escapeHtml(container.label)}</text>
      </g>
    `);
    layouts.forEach((layout) => {
      const color = problemColorForFamily(layout.family);
      const cards = layout.models.map((model, index) => drawTaxonomyGalleryCard(model, layout, index, color)).join("");
      layer.insertAdjacentHTML("beforeend", `
        <g class="taxonomy-gallery-family" data-family="${escapeHtml(layout.family)}" style="--tax-color:${color}">
          <rect class="taxonomy-gallery-family-bg" x="${layout.x}" y="${layout.y}" width="${layout.w}" height="${layout.h}"></rect>
          <text class="taxonomy-gallery-family-label" x="${layout.x + 12}" y="${layout.y + 18}">${escapeHtml(familyLabels[layout.family] || layout.family)}</text>
          ${cards}
        </g>
      `);
    });
  });
  group.appendChild(layer);
  bindTaxonomyGalleryCards(layer);
}

function taxonomyGalleryContainers(bounds) {
  const top = bounds.width >= 900 ? 118 : 128;
  const gap = bounds.width >= 900 ? 42 : 30;
  const x0 = bounds.width >= 900 ? 120 : 42;
  if (bounds.width < 900) {
    const w = 980;
    return taxonomyGroups.map((group, index) => ({
      ...group,
      x: x0,
      y: top + index * 820,
      w,
      h: 760
    }));
  }
  const architectureW = 1180;
  const enhancementW = 700;
  return taxonomyGroups.map((group) => {
    if (group.id === "enhancement") {
      return { ...group, x: x0 + architectureW + gap, y: top, w: enhancementW, h: 760 };
    }
    return { ...group, x: x0, y: top, w: architectureW, h: 760 };
  });
}

function taxonomyGalleryContainerBounds(container, layouts) {
  if (!layouts.length) return container;
  const pad = 22;
  const minX = Math.min(container.x, ...layouts.map((layout) => layout.x - pad));
  const minY = Math.min(container.y, ...layouts.map((layout) => layout.y - 28));
  const maxX = Math.max(container.x + container.w, ...layouts.map((layout) => layout.x + layout.w + pad));
  const maxY = Math.max(container.y + container.h, ...layouts.map((layout) => layout.y + layout.h + pad));
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY
  };
}

function taxonomyGalleryFamilyLayouts(container) {
  const families = container.families.filter((family) => familyOrder().includes(family));
  const columnCount = container.id === "enhancement" ? 2 : 3;
  const pad = 28;
  const gap = 18;
  const columnW = (container.w - pad * 2 - gap * (columnCount - 1)) / columnCount;
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    x: container.x + pad + index * (columnW + gap),
    y: container.y + 34,
    bottom: container.y + 34
  }));
  return families.map((family) => {
    const models = state.models.filter((model) => model.family === family);
    const column = columns.slice().sort((a, b) => a.bottom - b.bottom)[0];
    const cardGap = 9;
    const cardCols = 1;
    const cardW = columnW - 18;
    const cardH = clamp(cardW * 0.32, 100, 124);
    const rows = Math.ceil(models.length / cardCols);
    const h = 34 + rows * cardH + Math.max(0, rows - 1) * cardGap + 12;
    const layout = {
      family,
      models,
      x: column.x,
      y: column.bottom,
      w: columnW,
      h,
      cardCols,
      cardW,
      cardH,
      cardGap,
      cardX: column.x + 9,
      cardY: column.bottom + 28
    };
    column.bottom += h + gap;
    return layout;
  });
}

function drawTaxonomyGalleryCard(model, layout, index, color) {
  const col = index % layout.cardCols;
  const row = Math.floor(index / layout.cardCols);
  const x = layout.cardX + col * (layout.cardW + layout.cardGap);
  const y = layout.cardY + row * (layout.cardH + layout.cardGap);
  return `
    <foreignObject x="${x}" y="${y}" width="${layout.cardW}" height="${layout.cardH}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="taxonomy-gallery-card" data-id="${escapeHtml(model.id)}" style="--family-color:${color}">
        <div class="taxonomy-gallery-title">${escapeHtml(model.name)}</div>
        <div class="taxonomy-gallery-diagram">${architectureDiagramMarkup(model, { mini: true, gallery: true })}</div>
      </div>
    </foreignObject>
  `;
}

function bindTaxonomyGalleryCards(layer) {
  layer.querySelectorAll(".taxonomy-gallery-card").forEach((card) => {
    card.addEventListener("mouseenter", (event) => showPreview(card.dataset.id, event));
    card.addEventListener("mousemove", positionPreview);
    card.addEventListener("mouseleave", hidePreview);
    card.addEventListener("click", () => openModel(card.dataset.id));
  });
  observeLazyDiagrams(layer);
}

let diagramLazyObserver = null;

// Original-diagram images in the gallery are emitted with a data-diagram-lazy
// attribute instead of href; we only fetch each PNG once its card nears the
// viewport, so switching the whole grid to original diagrams stays snappy.
function observeLazyDiagrams(root) {
  const images = root.querySelectorAll("image[data-diagram-lazy]");
  if (!images.length) return;
  if (!("IntersectionObserver" in window)) {
    images.forEach(loadLazyDiagram);
    return;
  }
  if (!diagramLazyObserver) {
    diagramLazyObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadLazyDiagram(entry.target);
        obs.unobserve(entry.target);
      });
    }, { rootMargin: "300px" });
  }
  images.forEach((image) => diagramLazyObserver.observe(image));
}

function loadLazyDiagram(image) {
  const src = image.getAttribute("data-diagram-lazy");
  if (!src) return;
  image.setAttribute("href", src);
  image.removeAttribute("data-diagram-lazy");
}

function taxonomyFamilyCenters(bounds) {
  const layouts = taxonomyFamilyLayouts(bounds);
  const centers = new Map();
  layouts.forEach((layout, family) => {
    centers.set(family, { x: layout.x + layout.w / 2, y: layout.y + layout.diagramY + layout.diagramH / 2 });
  });
  return centers;
}

function taxonomyFamilyLayouts(bounds) {
  const centers = new Map();
  const metrics = taxonomyMetrics(bounds);
  taxonomyContainers(bounds).forEach((container) => {
    const families = container.families.filter((family) => familyOrder().includes(family));
    const columns = bounds.width <= 620
      ? 2
      : container.id === "enhancement"
        ? Math.min(2, Math.max(1, families.length))
        : clamp(Math.ceil(Math.sqrt(families.length * (container.w / Math.max(1, container.h)))), 2, 4);
    const rows = Math.ceil(families.length / columns);
    families.forEach((family, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const innerGap = metrics.cellGap;
      const cellW = (container.w - innerGap) / columns;
      const cellH = (container.h - innerGap - 4) / rows;
      const x = container.x + innerGap / 2 + col * cellW;
      const y = container.y + 22 + row * cellH;
      const baseDiagramW = clamp(cellW - metrics.diagramSideInset * 2, 126, metrics.maxDiagramW);
      centers.set(family, {
        family,
        x,
        y,
        w: Math.max(154, cellW - innerGap * 0.55),
        h: Math.max(152, cellH - 10),
        diagramX: metrics.diagramSideInset,
        diagramY: 28,
        diagramW: baseDiagramW,
        diagramH: metrics.diagramH,
        paperPitch: metrics.paperPitch,
        paperRowGap: metrics.paperRowGap,
        paperRadius: metrics.paperRadius,
        paperLiteralRadius: metrics.paperLiteralRadius,
        paperLabelSize: metrics.paperLabelSize,
        paperLogoRadius: metrics.paperLogoRadius,
        paperTopGap: metrics.paperTopGap
      });
    });
  });
  return centers;
}

function taxonomyPaperPosition(model, bounds) {
  if (state.taxonomyTree) {
    return taxonomyTreeGeometry(bounds).positions.get(model.id) || null;
  }
  const layout = taxonomyFamilyLayouts(bounds).get(model.family);
  if (!layout) return null;
  const familyModels = state.models.filter((item) => item.family === model.family);
  const index = familyModels.findIndex((item) => item.id === model.id);
  const targetCols = Math.min(3, familyModels.length);
  const maxThreeColPitch = targetCols > 1 ? (layout.w - 18) / (targetCols - 1) : layout.paperPitch || 54;
  const pitchX = Math.min(layout.paperPitch || 54, maxThreeColPitch);
  const cols = Math.max(1, Math.min(3, 1 + Math.floor((layout.w - 18) / pitchX)));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const remaining = familyModels.length - row * cols;
  const rowCount = Math.min(cols, remaining);
  const rowWidth = (rowCount - 1) * pitchX;
  const rowStart = (layout.w - rowWidth) / 2;
  const startY = layout.y + layout.diagramY + layout.diagramH + (layout.paperTopGap || 22);
  return {
    x: layout.x + rowStart + col * pitchX,
    y: startY + row * (layout.paperRowGap || 29)
  };
}

function taxonomyMetrics(bounds) {
  const width = bounds.width || 1200;
  if (width <= 620) {
    return {
      cellGap: 22,
      diagramSideInset: 6,
      maxDiagramW: 154,
      diagramH: 70,
      paperPitch: 46,
      paperRowGap: 27,
      paperRadius: 7,
      paperLiteralRadius: 9,
      paperLabelSize: 13,
      paperLogoRadius: 7,
      paperTopGap: 24
    };
  }
  const large = width >= 1500;
  const xl = width >= 1900;
  const scale = 1.15;
  return {
    cellGap: xl ? 48 : large ? 42 : 36,
    diagramSideInset: xl ? 8 : large ? 9 : 12,
    maxDiagramW: (xl ? 230 : large ? 198 : 154) * scale,
    diagramH: (xl ? 92 : large ? 80 : 66) * scale,
    paperPitch: (xl ? 76 : large ? 66 : 54) * scale,
    paperRowGap: (xl ? 40 : large ? 35 : 29) * scale,
    paperRadius: (xl ? 8 : large ? 7 : 6) * scale,
    paperLiteralRadius: (xl ? 10 : large ? 9 : 7.5) * scale,
    paperLabelSize: (xl ? 9.2 : large ? 8.4 : 7.2) * scale,
    paperLogoRadius: (xl ? 7.4 : large ? 6.6 : 5.8) * scale,
    paperTopGap: (xl ? 32 : large ? 28 : 24) * scale
  };
}

function drawTaxonomyFamilyGlyph(family, layout, color) {
  const x = layout.diagramX;
  const y = layout.diagramY;
  const w = layout.diagramW;
  const h = layout.diagramH;
  const scaleX = w / 154;
  const scaleY = h / 70;
  const sx = (value) => x + value * scaleX;
  const sy = (value) => y + value * scaleY;
  const ms = Math.min(scaleX, scaleY);
  const rect = (bx, by, bw, bh, cls = "glyph-block", text = "") => `
    <g>
      <rect class="${cls}" x="${sx(bx)}" y="${sy(by)}" width="${bw * scaleX}" height="${bh * scaleY}"></rect>
      ${text ? `<text class="glyph-mini-label" x="${sx(bx + bw / 2)}" y="${sy(by + bh / 2 + 3)}" text-anchor="middle">${escapeHtml(text)}</text>` : ""}
    </g>
  `;
  const stack = (bx, by, bw, bh, cls = "glyph-core", text = "") => `
    <g>
      <rect class="${cls} glyph-stack-back" x="${sx(bx + 5)}" y="${sy(by - 3)}" width="${bw * scaleX}" height="${bh * scaleY}"></rect>
      <rect class="${cls} glyph-stack-mid" x="${sx(bx + 2.5)}" y="${sy(by + 1.5)}" width="${bw * scaleX}" height="${bh * scaleY}"></rect>
      <rect class="${cls}" x="${sx(bx)}" y="${sy(by + 6)}" width="${bw * scaleX}" height="${bh * scaleY}"></rect>
      ${text ? `<text class="glyph-mini-label light" x="${sx(bx + bw / 2)}" y="${sy(by + 6 + bh / 2 + 3)}" text-anchor="middle">${escapeHtml(text)}</text>` : ""}
    </g>
  `;
  const arrow = (x1, y1, x2, y2, cls = "glyph-line") =>
    `<path class="${cls}" d="M ${sx(x1)} ${sy(y1)} C ${sx(x1 + (x2 - x1) * 0.48)} ${sy(y1)}, ${sx(x1 + (x2 - x1) * 0.52)} ${sy(y2)}, ${sx(x2)} ${sy(y2)}" marker-end="url(#atlasArrow)"></path>`;
  const tokens = (tx, ty, count, cls = "glyph-token") => Array.from({ length: count }, (_, i) =>
    `<rect class="${cls}" x="${sx(tx + i * 6.8)}" y="${sy(ty)}" width="${4.8 * scaleX}" height="${7.5 * scaleY}"></rect>`
  ).join("");
  const codebook = (tx, ty, cols, rows) => Array.from({ length: cols * rows }, (_, i) =>
    `<rect class="glyph-code" x="${sx(tx + (i % cols) * 8.8)}" y="${sy(ty + Math.floor(i / cols) * 8.8)}" width="${6.2 * scaleX}" height="${6.2 * scaleY}"></rect>`
  ).join("");
  const dot = (cx, cy, cls = "glyph-dot", r = 4.7) =>
    `<circle class="${cls}" cx="${sx(cx)}" cy="${sy(cy)}" r="${r * ms}"></circle>`;
  const label = (text) => `<text class="taxonomy-glyph-caption" x="${x + w / 2}" y="${y + h + 12}" text-anchor="middle">${escapeHtml(text)}</text>`;

  const diagrams = {
    pixel_idm: () => `
      ${rect(6, 18, 25, 32, "glyph-sensor", "obs")}
      ${arrow(33, 34, 50, 34)}
      ${stack(50, 12, 31, 34, "glyph-world", "video")}
      <rect class="glyph-frame" x="${sx(86)}" y="${sy(13)}" width="${24 * scaleX}" height="${17 * scaleY}"></rect>
      <rect class="glyph-frame" x="${sx(94)}" y="${sy(23)}" width="${24 * scaleX}" height="${17 * scaleY}"></rect>
      <rect class="glyph-frame" x="${sx(102)}" y="${sy(33)}" width="${24 * scaleX}" height="${17 * scaleY}"></rect>
      ${arrow(126, 41, 136, 41)}
      ${rect(133, 22, 16, 28, "glyph-action", "IDM")}
      ${label("decoded future -> IDM")}
    `,
    latent_idm: () => `
      ${rect(6, 18, 25, 32, "glyph-sensor", "obs")}
      ${arrow(33, 34, 52, 34)}
      ${stack(52, 13, 32, 34, "glyph-world", "world")}
      <ellipse class="glyph-latent-cloud" cx="${sx(102)}" cy="${sy(35)}" rx="${23 * scaleX}" ry="${18 * scaleY}"></ellipse>
      ${dot(94, 30)}${dot(108, 35, "glyph-dot action")}${dot(99, 43, "glyph-dot state")}
      ${arrow(125, 35, 137, 35)}
      ${rect(134, 22, 16, 28, "glyph-action", "IDM")}
      ${label("latent future -> IDM")}
    `,
    implicit_future: () => `
      ${rect(6, 16, 25, 36, "glyph-sensor", "obs")}
      ${arrow(33, 34, 56, 34)}
      <g>
        <rect class="glyph-implicit-region" x="${sx(56)}" y="${sy(12)}" width="${45 * scaleX}" height="${45 * scaleY}"></rect>
        ${dot(70, 24)}${dot(84, 34, "glyph-dot state")}${dot(72, 47, "glyph-dot action")}
        <path class="glyph-value-curve" d="M ${sx(62)} ${sy(51)} C ${sx(75)} ${sy(31)}, ${sx(88)} ${sy(58)}, ${sx(98)} ${sy(40)}"></path>
      </g>
      ${arrow(103, 35, 119, 35)}
      ${stack(119, 14, 28, 34, "glyph-core", "policy")}
      ${label("hidden future conditions policy")}
    `,
    unified: () => `
      <g>
        <rect class="glyph-sequence-shell" x="${sx(5)}" y="${sy(15)}" width="${53 * scaleX}" height="${40 * scaleY}"></rect>
        ${["o", "p", "a", "o", "p"].map((text, index) => {
          const cls = text === "a" ? "glyph-token action" : text === "p" ? "glyph-token state" : "glyph-token";
          const tx = 12 + index * 8.2;
          return `
            <rect class="${cls}" x="${sx(tx)}" y="${sy(24 + (index % 2) * 7)}" width="${6 * scaleX}" height="${9 * scaleY}"></rect>
            <text class="glyph-token-letter" x="${sx(tx + 3)}" y="${sy(31 + (index % 2) * 7)}" text-anchor="middle">${text}</text>
          `;
        }).join("")}
        <path class="glyph-causal-sweep" d="M ${sx(13)} ${sy(47)} C ${sx(26)} ${sy(59)}, ${sx(46)} ${sy(58)}, ${sx(56)} ${sy(43)}" marker-end="url(#atlasArrow)"></path>
      </g>
      ${arrow(60, 35, 75, 35)}
      ${stack(75, 8, 32, 45, "glyph-core", "Tr")}
      ${arrow(109, 35, 124, 35)}
      <g>
        <rect class="glyph-sequence-shell direct" x="${sx(123)}" y="${sy(19)}" width="${27 * scaleX}" height="${32 * scaleY}"></rect>
        ${["a", "o", "p"].map((text, index) => {
          const cls = text === "a" ? "glyph-token action" : text === "p" ? "glyph-token state" : "glyph-token";
          const tx = 128 + index * 7;
          return `
            <rect class="${cls}" x="${sx(tx)}" y="${sy(30)}" width="${5.5 * scaleX}" height="${8 * scaleY}"></rect>
            <text class="glyph-token-letter" x="${sx(tx + 2.75)}" y="${sy(36.1)}" text-anchor="middle">${text}</text>
          `;
        }).join("")}
      </g>
      ${label("direct obs-proprio-action tokens")}
    `,
    joint_latent: () => `
      <g>
        <rect class="glyph-sequence-shell" x="${sx(6)}" y="${sy(13)}" width="${48 * scaleX}" height="${44 * scaleY}"></rect>
        ${tokens(13, 22, 5, "glyph-token")}
        ${tokens(13, 35, 5, "glyph-token action")}
      </g>
      ${arrow(56, 35, 74, 35)}
      ${stack(74, 8, 38, 45, "glyph-core", "Tr")}
      ${arrow(113, 35, 132, 22)}
      ${arrow(113, 35, 132, 49)}
      ${rect(132, 14, 17, 16, "glyph-world", "o")}
      ${rect(132, 42, 17, 16, "glyph-action", "a")}
      ${label("one action-observation sequence")}
    `,
    multi_stream: () => `
      ${rect(7, 10, 78, 11, "glyph-world", "video stream")}
      ${rect(7, 30, 78, 11, "glyph-action", "action stream")}
      ${rect(7, 50, 78, 11, "glyph-state", "state/lang")}
      ${arrow(87, 15, 119, 35)}
      ${arrow(87, 35, 119, 35)}
      ${arrow(87, 55, 119, 35)}
      ${rect(117, 18, 30, 34, "glyph-core", "fuse")}
      ${label("separate streams, shared fusion")}
    `,
    encoder_only: () => `
      ${rect(6, 18, 28, 30, "glyph-sensor", "obs")}
      ${arrow(36, 33, 61, 33, "glyph-line train")}
      ${stack(61, 10, 34, 40, "glyph-world", "world")}
      <path class="glyph-cut" d="M ${sx(99)} ${sy(12)} L ${sx(99)} ${sy(58)}"></path>
      ${rect(105, 18, 28, 30, "glyph-core", "enc")}
      ${arrow(134, 33, 148, 33)}
      ${rect(144, 23, 8, 20, "glyph-action", "a")}
      ${label("world loss removed at runtime")}
    `,
    multimodal: () => `
      ${rect(6, 7, 48, 11, "glyph-world", "RGB")}
      ${rect(6, 26, 48, 11, "glyph-state", "depth")}
      ${rect(6, 45, 48, 11, "glyph-physical", "touch/force")}
      ${arrow(56, 12, 84, 34)}
      ${arrow(56, 31, 84, 34)}
      ${arrow(56, 50, 84, 34)}
      ${stack(84, 13, 38, 40, "glyph-core", "WAM")}
      ${arrow(123, 34, 142, 34)}
      ${rect(140, 23, 10, 22, "glyph-action", "a")}
      ${label("physical state enters core")}
    `,
    latent_action: () => `
      ${rect(6, 14, 27, 18, "glyph-sensor", "o_t")}
      ${rect(6, 42, 27, 18, "glyph-sensor", "o_t+1")}
      ${arrow(35, 24, 58, 34)}
      ${arrow(35, 51, 58, 36)}
      <rect class="glyph-codebook-shell" x="${sx(58)}" y="${sy(14)}" width="${44 * scaleX}" height="${43 * scaleY}"></rect>
      ${codebook(64, 21, 4, 3)}
      ${arrow(104, 35, 127, 35)}
      ${rect(127, 17, 22, 36, "glyph-action", "policy")}
      ${label("transition -> action code")}
    `,
    alignment: () => `
      ${stack(10, 16, 36, 36, "glyph-core", "base")}
      ${arrow(49, 35, 71, 35)}
      <rect class="glyph-align-layer" x="${sx(70)}" y="${sy(16)}" width="${34 * scaleX}" height="${36 * scaleY}"></rect>
      <path class="glyph-align-wave" d="M ${sx(76)} ${sy(42)} C ${sx(84)} ${sy(22)}, ${sx(94)} ${sy(50)}, ${sx(101)} ${sy(28)}"></path>
      ${arrow(106, 35, 130, 35)}
      ${rect(129, 22, 18, 26, "glyph-action", "a")}
      ${label("align world features to actions")}
    `,
    online_adaptation: () => `
      ${rect(8, 18, 28, 30, "glyph-sensor", "obs")}
      ${arrow(38, 33, 66, 33)}
      ${stack(66, 12, 34, 40, "glyph-core", "policy")}
      ${arrow(102, 33, 131, 33)}
      ${rect(130, 22, 18, 24, "glyph-action", "a")}
      <path class="glyph-loop" d="M ${sx(133)} ${sy(51)} C ${sx(102)} ${sy(68)}, ${sx(68)} ${sy(68)}, ${sx(66)} ${sy(50)}" marker-end="url(#atlasArrow)"></path>
      ${rect(72, 52, 28, 12, "glyph-state", "error")}
      ${label("prediction error updates policy")}
    `,
    speedup: () => `
      ${rect(7, 18, 27, 30, "glyph-sensor", "obs")}
      ${arrow(36, 33, 61, 33)}
      ${stack(61, 11, 36, 42, "glyph-world dim", "slow")}
      <path class="glyph-bypass" d="M ${sx(37)} ${sy(50)} C ${sx(62)} ${sy(68)}, ${sx(105)} ${sy(66)}, ${sx(131)} ${sy(44)}" marker-end="url(#atlasArrow)"></path>
      ${rect(104, 18, 24, 28, "glyph-state", "cache")}
      ${rect(132, 22, 17, 24, "glyph-action", "a")}
      ${label("cache, distill, or skip foresight")}
    `
  };

  const svg = (diagrams[family] || diagrams.alignment)();
  return `
    <g class="taxonomy-glyph" style="--tax-color:${color}">
      <rect class="taxonomy-glyph-bg" x="${x}" y="${y}" width="${w}" height="${h}"></rect>
      ${svg}
    </g>
  `;
}

function bindTaxonomyFamilyHover(group) {
  if (state.mode !== "taxonomy") return;
  if (isCompactViewport()) {
    group.querySelectorAll(".taxonomy-family").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.taxonomyHoveredFamily = item.dataset.family;
        showFamilyHoverCard(item.dataset.family);
      });
    });
    return;
  }
  const setFamilyHover = (family, active, event = null) => {
    state.taxonomyHoveredFamily = active ? family : null;
    if (active && event) showFamilyHoverCard(family, event);
    else hideFamilyHoverCard();
    const item = Array.from(group.querySelectorAll(".taxonomy-family")).find((candidate) => candidate.dataset.family === family);
    if (!item) return;
    const box = item.getBBox();
    const localCx = box.x + box.width / 2;
    const localCy = box.y + box.height / 2;
    const absCx = Number(item.dataset.x || 0) + localCx;
    const absCy = Number(item.dataset.y || 0) + localCy;
    const scale = 1.3;
    group.querySelectorAll(".taxonomy-family").forEach((item) => {
      if (item.dataset.family !== family) return;
      item.classList.toggle("is-hovered", active);
      if (!active) {
        item.setAttribute("transform", item.dataset.baseTransform || item.getAttribute("transform") || "");
        return;
      }
      item.dataset.baseTransform ||= item.getAttribute("transform") || "";
      item.setAttribute("transform", `${item.dataset.baseTransform} translate(${localCx} ${localCy}) scale(${scale}) translate(${-localCx} ${-localCy})`);
    });
    group.querySelectorAll(".node").forEach((node) => {
      if (node.dataset.family !== family) return;
      node.classList.toggle("taxonomy-family-paper-hover", active);
      if (!active) {
        node.setAttribute("transform", node.dataset.baseTransform || node.getAttribute("transform") || "");
        return;
      }
      node.dataset.baseTransform ||= node.getAttribute("transform") || "";
      const x = Number(node.dataset.targetX || 0);
      const y = Number(node.dataset.targetY || 0);
      const sx = absCx + (x - absCx) * scale;
      const sy = absCy + (y - absCy) * scale;
      node.setAttribute("transform", `translate(${sx} ${sy}) scale(${scale})`);
    });
  };
  group.querySelectorAll(".taxonomy-family").forEach((item) => {
    item.addEventListener("mouseenter", (event) => {
      setFamilyHover(item.dataset.family, true, event);
    });
    item.addEventListener("mousemove", positionFamilyHoverCard);
    item.addEventListener("mouseleave", () => {
      if (state.taxonomyHoveredFamily === item.dataset.family) {
        setFamilyHover(item.dataset.family, false);
      }
    });
  });
  group.querySelectorAll(".node").forEach((node) => {
    if (!node.dataset.family) return;
    node.addEventListener("mouseenter", () => setFamilyHover(node.dataset.family, true));
    node.addEventListener("mouseleave", () => {
      if (state.taxonomyHoveredFamily === node.dataset.family) setFamilyHover(node.dataset.family, false);
    });
  });
}

function showFamilyHoverCard(family, event) {
  const card = $("#familyHoverCard");
  if (!card) return;
  const insight = familyInsights[family];
  const models = state.models.filter((model) => model.family === family);
  const color = problemColorForFamily(family);
  const compact = isCompactViewport();
  const examples = (compact ? models : models.slice(0, 5)).map((model) => {
    if (!compact) return `<span>${escapeHtml(model.name)}</span>`;
    const inst = institutionFor(model);
    const logo = inst.logoUrl || institutionLogoUrl(inst.domain);
    return `<span class="family-card-example"><img src="${escapeHtml(logo)}" alt="" aria-hidden="true"><span>${escapeHtml(model.name)}</span></span>`;
  }).join("");
  card.hidden = false;
  card.style.setProperty("--family-card-color", color);
  card.innerHTML = `
    <div class="family-card-kicker">${escapeHtml(taxonomyGroupForFamily(family)?.label || "Family")}</div>
    <h3>${escapeHtml(familyLabels[family] || family)}</h3>
    <p>${escapeHtml(insight?.thesis || familyProblemQuestions[family] || "")}</p>
    <dl>
      <div><dt>Signal</dt><dd>${escapeHtml(insight?.signal || "Survey family defined by recurring architecture and training pattern.")}</dd></div>
      <div><dt>Watch</dt><dd>${escapeHtml(insight?.caution || "Compare claims against runtime path, benchmark scope, and source evidence.")}</dd></div>
      <div><dt>Question</dt><dd>${escapeHtml(insight?.direction || familyProblemQuestions[family] || "")}</dd></div>
    </dl>
    <div class="family-card-examples">${examples}</div>
  `;
  positionFamilyHoverCard(event);
}

function hideFamilyHoverCard() {
  const card = $("#familyHoverCard");
  if (card) card.hidden = true;
}

function positionFamilyHoverCard(event) {
  const card = $("#familyHoverCard");
  if (!card || card.hidden) return;
  if (isCompactViewport()) {
    card.style.removeProperty("top");
    card.style.removeProperty("left");
    return;
  }
  if (!event) return;
  const rect = card.getBoundingClientRect();
  const gap = 16;
  let left = event.clientX + gap;
  let top = event.clientY + gap;
  if (left + rect.width > window.innerWidth - 12) left = event.clientX - rect.width - gap;
  if (top + rect.height > window.innerHeight - 12) top = event.clientY - rect.height - gap;
  card.style.left = `${Math.max(12, left)}px`;
  card.style.top = `${Math.max(78, top)}px`;
}

function taxonomyGroupForFamily(family) {
  return taxonomyGroups.find((group) => group.families.includes(family));
}

function taxonomyContainers(bounds) {
  const margin = clamp(bounds.width * 0.035, 34, 76);
  const top = bounds.width >= 1500 ? 104 : 116;
  const bottom = 28;
  const gap = bounds.width >= 1500 ? 34 : 28;
  const h = Math.max(390, bounds.height - top - bottom);
  const available = Math.min(bounds.width - margin * 2, 1740);
  const x0 = (bounds.width - available) / 2;
  if (bounds.width <= 620) {
    const mobileMargin = 22;
    const mobileTop = 100;
    const mobileGap = 44;
    const mobileWidth = bounds.width - mobileMargin * 2;
    const heights = { architecture: 520, enhancement: 260 };
    let y = mobileTop;
    return taxonomyGroups.map((group) => {
      const container = {
        ...group,
        x: mobileMargin,
        y,
        w: mobileWidth,
        h: heights[group.id] || 400
      };
      y += container.h + mobileGap;
      return container;
    });
  }
  const stack = bounds.width < 900;
  if (stack) {
    const half = (h - gap) / 2;
    return taxonomyGroups.map((group, index) => ({
      ...group,
      x: x0,
      y: top + index * (half + gap),
      w: available,
      h: half
    }));
  }
  const enhancementW = clamp(available * 0.34, 420, 540);
  const architectureW = available - enhancementW - gap;
  return taxonomyGroups.map((group) => {
    if (group.id === "enhancement") {
      return { ...group, x: x0 + architectureW + gap, y: top, w: enhancementW, h };
    }
    return { ...group, x: x0, y: top, w: architectureW, h };
  });
}

function drawQuestionNode(point, text, cls, color, width, level, eyebrow = "") {
  const layout = questionTextLayout(text, width, level, eyebrow);
  const { lines, h, fontSize, lineHeight, top, weight, boxWidth } = layout;
  const startX = Number.isFinite(point.startX) ? point.startX : point.x;
  const startY = Number.isFinite(point.startY) ? point.startY : point.y;
  const boxed = level === "leaf";
  const fill = problemQuestionTextColor(level, color);
  const collision = problemQuestionCollision(level, boxWidth, h);
  const groupId = level === "root" ? "root" : point.groupId || point.id || "";
  return `
    <g class="${cls} problem-pop" transform="translate(${point.x} ${point.y})" data-node-id="${escapeHtml(point.id || "")}" data-group-id="${escapeHtml(groupId)}" data-level="${level}" data-width="${collision.w}" data-height="${collision.h}" data-start-x="${startX}" data-start-y="${startY}" data-final-x="${point.x}" data-final-y="${point.y}">
      <g class="problem-scale-target">
        ${boxed ? `<rect x="${-boxWidth / 2}" y="${-h / 2}" width="${boxWidth}" height="${h}" fill="${color}"></rect>` : ""}
        ${boxed && eyebrow ? `<text class="problem-eyebrow" x="0" y="${-h / 2 + 13}" text-anchor="middle">${escapeHtml(eyebrow)}</text>` : ""}
        <text class="problem-question" x="0" y="${boxed ? -h / 2 + top : top}" text-anchor="middle" style="fill:${escapeHtml(fill)};font-size:${fontSize}px;font-weight:${weight}">
          ${lines.map((line, index) => `<tspan x="0" dy="${index ? lineHeight : 0}">${escapeHtml(line)}</tspan>`).join("")}
        </text>
      </g>
    </g>
  `;
}

function problemQuestionWidth(level, portrait = false) {
  if (level === "root") return 780;
  if (level === "branch") return 470;
  return 178;
}

function problemQuestionTextColor(level, color) {
  if (level === "root") return "#172024";
  if (level === "leaf") return "#263238";
  return {
    "#a8d8ef": "#2f7f91",
    "#cdb8e6": "#7656a6",
    "#b6dfc2": "#2d7c59",
    "#f2cf93": "#9a690f",
    "#efb8b1": "#a4493f"
  }[color] || "#3f4a50";
}

function problemQuestionCollision(level, boxWidth, h) {
  if (level === "root") return { w: 980, h: h + 260 };
  if (level === "branch") return { w: boxWidth + 42, h: h + 58 };
  return { w: boxWidth + 12, h: h + 8 };
}

function questionTextLayout(text, width, level, eyebrow = "") {
  const configs = {
    root: { font: 62, minFont: 56, line: 68, minH: 216, maxLines: 3, top: -74, weight: 950 },
    branch: { font: 34, minFont: 28, line: 38, minH: 122, maxLines: 3, top: -42, weight: 930 },
    leaf: { font: 12.5, minFont: 9.6, line: 13.7, minH: 48, maxLines: 6, top: 14, weight: 880 }
  };
  const cfg = configs[level] || configs.leaf;
  let fontSize = cfg.font;
  let lines = [];
  while (fontSize >= cfg.minFont) {
    const chars = Math.max(8, Math.floor((width - 32) / (fontSize * 0.68)));
    lines = wrapText(text, chars);
    if (lines.length <= cfg.maxLines) break;
    fontSize -= 0.7;
  }
  const lineHeight = Math.max(cfg.line - (cfg.font - fontSize) * 0.3, fontSize + 2);
  const top = cfg.top;
  const bottom = level === "leaf" ? 4 : 0;
  const h = level === "leaf"
    ? Math.max(cfg.minH, top + lines.length * lineHeight + bottom)
    : Math.max(cfg.minH, lines.length * lineHeight);
  const contentWidth = Math.max(
    ...lines.map((line) => line.length * fontSize * 0.6),
    eyebrow ? eyebrow.length * 4.6 : 0
  );
  const boxWidth = level === "leaf" ? Math.round(clamp(contentWidth + 14, 88, width)) : width;
  return { lines, h, boxWidth, fontSize: Number(fontSize.toFixed(1)), lineHeight: Number(lineHeight.toFixed(1)), top, weight: cfg.weight };
}

function drawFadingConnector(layer, defs, id, from, to, color, curved = true) {
  const safeId = id.replace(/[^a-z0-9_-]/gi, "-");
  const style = connectorStyle(from, to);
  const endpoints = connectorEndpoints(from, to, 6, style.arrow);
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", `${safeId}-fade`);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", endpoints.from.x);
  gradient.setAttribute("y1", endpoints.from.y);
  gradient.setAttribute("x2", endpoints.to.x);
  gradient.setAttribute("y2", endpoints.to.y);
  gradient.innerHTML = `
    <stop offset="0%" stop-color="${color}" stop-opacity="0"></stop>
    <stop offset="3%" stop-color="${color}" stop-opacity=".02"></stop>
    <stop offset="7%" stop-color="${color}" stop-opacity=".08"></stop>
    <stop offset="13%" stop-color="${color}" stop-opacity=".2"></stop>
    <stop offset="22%" stop-color="${color}" stop-opacity=".38"></stop>
    <stop offset="36%" stop-color="${color}" stop-opacity=".58"></stop>
    <stop offset="70%" stop-color="${color}" stop-opacity=".72"></stop>
    <stop offset="100%" stop-color="${color}" stop-opacity=".82"></stop>
  `;
  defs.appendChild(gradient);

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", `${safeId}-arrow`);
  marker.setAttribute("viewBox", "0 0 14 14");
  marker.setAttribute("refX", "0");
  marker.setAttribute("refY", "7");
  marker.setAttribute("markerWidth", style.arrow);
  marker.setAttribute("markerHeight", style.arrow);
  marker.setAttribute("markerUnits", "userSpaceOnUse");
  marker.setAttribute("orient", "auto-start-reverse");
  marker.innerHTML = `<path d="M0,0 L14,7 L0,14 z" fill="${color}" opacity=".86"></path>`;
  defs.appendChild(marker);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "problem-link");
  path.dataset.from = from.id || "";
  path.dataset.to = to.id || "";
  path.setAttribute("d", curved ? curvedPath(endpoints.from, endpoints.to) : `M ${endpoints.from.x} ${endpoints.from.y} L ${endpoints.to.x} ${endpoints.to.y}`);
  path.setAttribute("stroke", `url(#${safeId}-fade)`);
  path.style.strokeWidth = `${style.stroke}px`;
  path.style.strokeLinecap = "butt";
  path.setAttribute("marker-end", `url(#${safeId}-arrow)`);
  layer.appendChild(path);
}

function connectorStyle(from, to) {
  if (from.id === "root" || from.id === "taxonomy-root") return { stroke: 14, arrow: 27 };
  if (String(from.id || "").startsWith("taxonomy-")) return { stroke: 6, arrow: 16 };
  if (to.family) return { stroke: 7, arrow: 18 };
  return { stroke: 10, arrow: 21 };
}

function connectorEndpoints(from, to, gap = 12, arrowLength = 0) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const fromBox = connectorBox(from);
  const toBox = connectorBox(to);
  const fromDistance = rectEdgeDistance(fromBox, unit) + gap;
  const toDistance = rectEdgeDistance(toBox, { x: -unit.x, y: -unit.y }) + gap + arrowLength;
  return {
    from: {
      x: from.x + unit.x * fromDistance,
      y: from.y + unit.y * fromDistance
    },
    to: {
      x: to.x - unit.x * toDistance,
      y: to.y - unit.y * toDistance
    }
  };
}

function connectorBox(node) {
  if (Number.isFinite(node.w) && Number.isFinite(node.h)) {
    return { w: node.w, h: node.h };
  }
  if (node.id === "root") {
    const layout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
    return visualTextBox(layout, 18);
  }
  if (node.family) {
    const layout = questionTextLayout(node.question, problemQuestionWidth("leaf"), "leaf", node.label);
    return { w: layout.boxWidth, h: layout.h };
  }
  const layout = questionTextLayout(node.question, problemQuestionWidth("branch"), "branch");
  return visualTextBox(layout, 14);
}

function visualTextBox(layout, pad) {
  const textWidth = Math.max(...layout.lines.map((line) => line.length * layout.fontSize * 0.6));
  return {
    w: textWidth + pad * 2,
    h: layout.lines.length * layout.lineHeight + pad * 2
  };
}

function rectEdgeDistance(box, unit) {
  const xDistance = Math.abs(unit.x) > 0.001 ? box.w / 2 / Math.abs(unit.x) : Infinity;
  const yDistance = Math.abs(unit.y) > 0.001 ? box.h / 2 / Math.abs(unit.y) : Infinity;
  return Math.min(xDistance, yDistance);
}

function atlasAnnotationLayer(name) {
  const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.classList.add("atlas-annotation", "is-entering", name);
  return layer;
}

function drawPaperNode(model, radius, color, hasLiteral, labelSide = "right") {
  const inst = institutionFor(model);
  const logo = inst.logoUrl || institutionLogoUrl(inst.domain);
  const labelX = labelSide === "left" ? -(radius + 9) : labelSide === "bottom" ? 0 : radius + 9;
  const labelY = labelSide === "bottom" ? radius + 13 : 4;
  const labelAnchor = labelSide === "left" ? "end" : labelSide === "bottom" ? "middle" : "start";
  return `
    <circle class="node-halo" r="${radius + 5}" fill="${color}" opacity=".16"></circle>
    <circle class="node-ring" r="${radius}" fill="${color}"></circle>
    <circle class="node-logo-bg" r="9.5" fill="#fff"></circle>
    <image class="node-logo-image" href="${escapeHtml(logo)}" x="-8" y="-8" width="16" height="16" preserveAspectRatio="xMidYMid meet"></image>
    ${hasLiteral ? `<circle class="node-literal-dot" cx="${radius - 2}" cy="${-radius + 2}" r="3.3"></circle>` : ""}
    <text class="node-name" x="${labelX}" y="${labelY}" text-anchor="${labelAnchor}">${escapeHtml(shortPaperName(model.name))}</text>
    <title>${escapeHtml(`${model.name} - ${inst.label}`)}</title>
  `;
}

function institutionFor(model) {
  const [label, domain, options = {}] = institutionMeta[model.id] || ["Institution", "arxiv.org"];
  const words = label.replace(/\([^)]*\)/g, "").split(/\s+/).filter(Boolean);
  const initials = words.length === 1
    ? words[0].slice(0, 2)
    : words.slice(0, 2).map((word) => word[0]).join("");
  return { label, domain, initials: initials.toUpperCase(), ...options };
}

function shortPaperName(name) {
  if (state.mode === "timeline") return shortText(name, 15);
  if (state.mode === "taxonomy") return shortText(name, state.taxonomyTree ? 15 : 12);
  return shortText(name, state.mode === "problem" ? 12 : 24);
}

function modelDateLabel(model) {
  return `${model.year}-${String(model.month || "06").padStart(2, "0")}-${String(model.day || "15").padStart(2, "0")}`;
}

function institutionLogoUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setAtlasTransform(group) {
  group.setAttribute("transform", `translate(${state.zoom.x} ${state.zoom.y}) scale(${state.zoom.k})`);
}

function renderAtlas() {
  const svg = $("#atlasSvg");
  const width = svg.clientWidth || 1000;
  const height = svg.clientHeight || 690;
  const bounds = { width, height };
  const previousPositions = new Map(state.lastAtlasPositions || []);
  const nextPositions = new Map();
  const animatedNodes = [];
  const problemGeo = state.mode === "problem" ? problemGeometry(state.models, bounds) : null;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = "";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="atlasArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="rgba(23,32,36,0.42)"></path>
    </marker>`;
  svg.appendChild(defs);

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.id = "atlasGroup";
  setAtlasTransform(group);
  svg.appendChild(group);

  drawAtlasBackdrop(group, defs, bounds, problemGeo);

  const visible = new Set(filteredModels().map((model) => model.id));
  const useProblemIntro = state.mode === "problem" && state.lastRenderedMode !== "problem";
  const introCenter = problemGeo?.root || { x: bounds.width / 2, y: bounds.height * 0.48 + 36 };
  const renderPaperNodes = !(state.mode === "taxonomy" && (state.taxonomyGallery || isCompactViewport()));
  if (renderPaperNodes) state.models.forEach((model, index) => {
    const target = problemGeo?.positions.get(model.id) || positionModel(model, index, state.models, bounds) || { x: width / 2, y: height / 2 };
    const leaf = problemGeo?.leafAssignments.get(model.id);
    nextPositions.set(model.id, target);
    const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hasLiteral = Boolean(model.literalArchitecture || state.arch[model.id]);
    node.classList.add("node");
    const filteredOut = (state.mode === "metrics" || state.mode === "timeline") && !visible.has(model.id);
    if (!visible.has(model.id)) node.classList.add("is-muted");
    if (filteredOut) node.classList.add("is-filtered-out");
    if (state.selectedId === model.id || state.hoveredId === model.id) node.classList.add("is-active");
    node.dataset.id = model.id;
    node.dataset.family = model.family;
    node.dataset.targetX = String(target.x);
    node.dataset.targetY = String(target.y);
    node.style.transition = useProblemIntro ? "none" : "transform 720ms cubic-bezier(.22,.61,.36,1), opacity 360ms ease";
    const start = previousPositions.get(model.id);
    if (useProblemIntro) {
      node.setAttribute("transform", `translate(${introCenter.x} ${introCenter.y}) scale(.72)`);
      node.style.opacity = visible.has(model.id) ? "1" : "0.18";
    } else if (start) {
      node.setAttribute("transform", `translate(${start.x} ${start.y})`);
      node.style.opacity = visible.has(model.id) ? "1" : "0.18";
    } else {
      node.setAttribute("transform", `translate(${target.x} ${target.y}) scale(.78)`);
      node.style.opacity = "0";
    }

    const radius = state.mode === "problem" ? (hasLiteral ? 14 : 10.5) : state.mode === "taxonomy" ? (hasLiteral ? 7.5 : 6) : hasLiteral ? 12 : 9;
    const color = state.mode === "taxonomy" || state.mode === "timeline" || state.mode === "metrics"
      ? problemColorForModel(model)
      : familyColors[model.family] || "#61717a";
    const labelSide = target.labelSide || (state.mode === "taxonomy" || state.mode === "timeline" || state.mode === "metrics" ? "bottom" : target.x > width - 180 ? "left" : "right");
    let paperRadius = radius;
    let taxonomyStyle = "";
    if (state.mode === "taxonomy") {
      if (state.taxonomyTree) {
        paperRadius = hasLiteral ? 13 : 10.8;
        taxonomyStyle = "--taxonomy-label-size:15.5px;--taxonomy-logo-radius:9.8px;--taxonomy-logo-size:16px;";
      } else {
        const layout = taxonomyFamilyLayouts(bounds).get(model.family);
        paperRadius = hasLiteral ? layout?.paperLiteralRadius || 7.5 : layout?.paperRadius || 6;
        const logoRadius = layout?.paperLogoRadius || 5.8;
        taxonomyStyle = `--taxonomy-label-size:${layout?.paperLabelSize || 7.2}px;--taxonomy-logo-radius:${logoRadius}px;--taxonomy-logo-size:${logoRadius * 1.65}px;`;
      }
    }
    const bodyClass = [
      "node-body",
      state.mode === "problem" ? "problem-node-body" : "",
      target.portrait ? "portrait-problem-node-body" : "",
      state.mode === "taxonomy" ? "taxonomy-node-body" : "",
      state.mode === "timeline" ? "timeline-node-body" : "",
      state.mode === "metrics" ? "metrics-node-body" : ""
    ].filter(Boolean).join(" ");
    node.innerHTML = `<g class="${bodyClass}" style="${taxonomyStyle}">${drawPaperNode(model, paperRadius, color, hasLiteral, labelSide)}</g>`;
    node.addEventListener("mouseenter", (event) => showPreview(model.id, event));
    node.addEventListener("mousemove", positionPreview);
    node.addEventListener("mouseleave", hidePreview);
    node.addEventListener("focus", () => showPreview(model.id));
    node.addEventListener("blur", hidePreview);
    node.addEventListener("click", () => openModel(model.id));
    node.setAttribute("tabindex", "0");
    group.appendChild(node);
    animatedNodes.push({ node, target, visible: visible.has(model.id), leafId: leaf?.id || "", groupId: leaf?.groupId || "" });
  });

  if (state.mode === "taxonomy" && !state.taxonomyGallery) bindTaxonomyFamilyHover(group);

  bindZoom(svg, group);
  requestAnimationFrame(() => {
    group.querySelectorAll(".atlas-annotation.is-entering").forEach((item) => item.classList.remove("is-entering"));
    if (useProblemIntro) {
      animateProblemIntro(group, animatedNodes, bounds);
    } else {
      animatedNodes.forEach(({ node, target, visible: isVisible }) => {
        node.setAttribute("transform", `translate(${target.x} ${target.y})`);
        node.dataset.baseTransform = `translate(${target.x} ${target.y})`;
        node.style.opacity = isVisible ? "1" : "0.18";
      });
    }
  });
  state.lastAtlasPositions = nextPositions;
  state.lastRenderedMode = state.mode;
  state.lastAtlasPortrait = isPortraitAtlas(bounds);
  renderTimelineLegend();
}

function animateProblemIntro(group, animatedNodes, bounds) {
  if (state.mode !== "problem") return;
  const rootNode = group.querySelector(".problem-root.problem-pop");
  const center = rootNode
    ? { x: Number(rootNode.dataset.finalX), y: Number(rootNode.dataset.finalY) }
    : { x: bounds.width / 2, y: bounds.height * 0.48 + 36 };
  const problemItems = Array.from(group.querySelectorAll(".problem-pop")).map((node, index) => introItem({
    node,
    index,
    center,
    target: {
      x: Number(node.dataset.finalX),
      y: Number(node.dataset.finalY)
    },
    groupId: node.dataset.groupId || "",
    visible: true,
    scaleStart: node.dataset.level === "root" ? 0.96 : 0.72
  }));
  const paperItems = animatedNodes.map((item, index) => introItem({
    node: item.node,
    index: index + problemItems.length,
    center,
    target: item.target,
    groupId: item.groupId,
    leafId: item.leafId,
    visible: item.visible,
    scaleStart: 0.72
  }));
  const items = [...problemItems, ...paperItems];
  const links = Array.from(group.querySelectorAll(".problem-link"));
  const tethers = Array.from(group.querySelectorAll(".paper-tether"));

  links.forEach((link) => {
    link.style.opacity = "0";
  });
  tethers.forEach((tether) => {
    tether.style.opacity = "0";
    tether.setAttribute("d", `M ${center.x} ${center.y} C ${center.x} ${center.y}, ${center.x} ${center.y}, ${center.x} ${center.y}`);
  });
  items.forEach((item) => {
    item.node.style.transition = "none";
    item.node.setAttribute("transform", `translate(${center.x} ${center.y}) scale(${item.scaleStart})`);
    item.node.style.opacity = item.visible ? "0.16" : "0.06";
  });

  const start = performance.now();
  const duration = 1450;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    items.forEach((item) => {
      item.node.style.transition = "";
      item.node.setAttribute("transform", `translate(${item.target.x} ${item.target.y})`);
      item.node.style.opacity = item.visible ? "1" : "0.18";
      item.current = item.target;
    });
    links.forEach((link) => {
      link.style.opacity = "";
    });
    updatePaperTethers(tethers, problemItems, paperItems);
    tethers.forEach((tether) => {
      tether.style.opacity = "";
    });
  };

  const step = (now) => {
    const t = clamp((now - start) / duration, 0, 1);
    const eased = easeOutCubic(t);
    items.forEach((item) => {
      const point = quadraticPoint(center, item.control, item.target, eased);
      item.current = point;
      const scale = item.scaleStart + (1 - item.scaleStart) * eased;
      item.node.setAttribute("transform", `translate(${point.x} ${point.y}) scale(${scale})`);
      item.node.style.opacity = String((item.visible ? 0.16 : 0.06) + (item.visible ? 0.84 : 0.12) * eased);
    });
    links.forEach((link) => {
      link.style.opacity = String(0.72 * Math.max(0, (t - 0.22) / 0.78));
    });
    updatePaperTethers(tethers, problemItems, paperItems);
    tethers.forEach((tether) => {
      tether.style.opacity = String(0.28 * Math.max(0, (t - 0.28) / 0.72));
    });
    if (t < 1) requestAnimationFrame(step);
    else finish();
  };
  requestAnimationFrame(step);
  window.setTimeout(finish, duration + 260);
}

function introItem({ node, index, center, target, groupId, leafId = "", visible, scaleStart }) {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const length = Math.hypot(dx, dy) || 1;
  const curve = ((problemBranchAngle(groupId) || index * 0.41) % Math.PI) > Math.PI / 2 ? -1 : 1;
  const arc = clamp(length * 0.22, 34, 118) * curve;
  return {
    id: node.dataset.nodeId || node.dataset.id || "",
    node,
    target,
    current: center,
    leafId,
    visible,
    scaleStart,
    control: {
      x: center.x + dx * 0.46 - (dy / length) * arc,
      y: center.y + dy * 0.46 + (dx / length) * arc
    }
  };
}

function updatePaperTethers(tethers, problemItems, paperItems) {
  const leaves = new Map(problemItems.map((item) => [item.id, item.current || item.target]));
  const papers = new Map(paperItems.map((item) => [item.id, item.current || item.target]));
  tethers.forEach((tether) => {
    const leafPoint = leaves.get(tether.dataset.leafId);
    const paperPoint = papers.get(tether.dataset.paperId);
    if (!leafPoint || !paperPoint) return;
    tether.setAttribute("d", simplePaperTetherPath(leafPoint, paperPoint));
  });
}

function simplePaperTetherPath(leaf, point) {
  const dx = point.x - leaf.x;
  const dy = point.y - leaf.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const start = {
    x: leaf.x + unit.x * 30,
    y: leaf.y + unit.y * 30
  };
  const end = {
    x: point.x - unit.x * 14,
    y: point.y - unit.y * 14
  };
  return `M ${start.x} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x} ${end.y}`;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function quadraticPoint(a, b, c, t) {
  const one = 1 - t;
  return {
    x: one * one * a.x + 2 * one * t * b.x + t * t * c.x,
    y: one * one * a.y + 2 * one * t * b.y + t * t * c.y
  };
}

function curvedPath(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unit = { x: dx / length, y: dy / length };
  const normal = { x: -unit.y, y: unit.x };
  const startHandle = clamp(length * 0.38, 48, 190);
  const endHandle = clamp(length * 0.28, 40, 150);
  const bend = clamp(length * 0.22, 34, 132);
  const direction = dx * dy >= 0 ? 1 : -1;
  const c1 = {
    x: from.x + unit.x * startHandle + normal.x * bend * direction,
    y: from.y + unit.y * startHandle + normal.y * bend * direction
  };
  const c2 = {
    x: to.x - unit.x * endHandle,
    y: to.y - unit.y * endHandle
  };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

function problemBranchAngle(groupId) {
  const branch = problemBranches.find((item) => item.id === groupId);
  return degToRad(branch?.angle ?? 0);
}

function bindZoom(svg, group) {
  svg.onwheel = (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scale = event.deltaY < 0 ? 1.1 : 0.9;
    const base = state.zoomBase || state.zoom.k || 1;
    const nextK = Math.max(base * 0.42, Math.min(base * 4.2, state.zoom.k * scale));
    state.zoom.x = mx - ((mx - state.zoom.x) / state.zoom.k) * nextK;
    state.zoom.y = my - ((my - state.zoom.y) / state.zoom.k) * nextK;
    state.zoom.k = nextK;
    setAtlasTransform(group);
  };

  svg.onpointerdown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    state.dragging = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      ox: state.zoom.x,
      oy: state.zoom.y,
      moved: false
    };
    svg.setPointerCapture(event.pointerId);
  };
  svg.onpointermove = (event) => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.dragging.x;
    const dy = event.clientY - state.dragging.y;
    if (Math.hypot(dx, dy) > 4) state.dragging.moved = true;
    if (!state.dragging.moved) return;
    event.preventDefault();
    state.zoom.x = state.dragging.ox + dx;
    state.zoom.y = state.dragging.oy + dy;
    setAtlasTransform(group);
  };
  const finishDrag = (event) => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const moved = state.dragging.moved;
    if (svg.hasPointerCapture?.(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    state.dragging = null;
    if (moved) {
      state.suppressAtlasClickUntil = performance.now() + 450;
    }
  };
  svg.onpointerup = finishDrag;
  svg.onpointercancel = finishDrag;
  svg.onlostpointercapture = (event) => {
    if (state.dragging?.pointerId === event.pointerId) state.dragging = null;
  };
}

function showPreview(id, event) {
  const model = state.models.find((item) => item.id === id);
  if (!model) return;
  const spec = getArchitectureSpec(model);
  const profile = state.diagramProfiles?.[model.id];
  state.hoveredId = id;
  $("#previewPanel").hidden = false;
  $("#previewPanel").classList.toggle("is-metric", state.mode === "metrics");
  $("#previewPanel").style.setProperty("--preview-outline", problemColorForModel(model));
  $("#previewEmpty").hidden = true;
  $("#previewContent").hidden = false;
  $("#previewFamily").textContent = profile
    ? `${profile.core.label} / paper-specific diagram`
    : `${model.category}${spec ? " / source-backed diagram" : " / survey-level diagram"}`;
  $("#previewTitle").textContent = model.name;
  $("#previewInsight").textContent = model.insights?.novelty || model.oneLine;
  $("#previewOpen").onclick = () => openModel(id);
  if (state.mode === "metrics") {
    $("#previewFamily").textContent = metricConfig().label;
    $("#previewInsight").textContent = "";
    $("#previewMetricAudit").hidden = false;
    $("#previewDiagram").hidden = true;
    renderMetricAudit($("#previewMetricAudit"), model);
  } else {
    $("#previewMetricAudit").hidden = true;
    $("#previewDiagram").hidden = false;
    renderDiagram($("#previewDiagram"), model, { mini: true });
  }
  positionPreview(event);
  updateActiveNodes();
}

function hidePreview() {
  state.hoveredId = null;
  $("#previewPanel").hidden = true;
  $("#previewPanel").classList.remove("is-metric");
  updateActiveNodes();
}

function positionPreview(event) {
  if (!event) return;
  const panel = $("#previewPanel");
  if (!panel || panel.hidden) return;
  const rect = panel.getBoundingClientRect();
  const gap = 18;
  let left = event.clientX + gap;
  let top = event.clientY + gap;
  if (left + rect.width > window.innerWidth - 12) left = event.clientX - rect.width - gap;
  if (top + rect.height > window.innerHeight - 12) top = event.clientY - rect.height - gap;
  panel.style.left = `${Math.max(12, left)}px`;
  panel.style.top = `${Math.max(82, top)}px`;
}

function activeMetricAudit(model) {
  const audit = model.metrics?.comparative?.metricAudit || {};
  if (state.metricView === "accuracy") {
    if (state.accuracyBenchmark !== "estimated") {
      return audit.benchmarkAccuracy?.[state.accuracyBenchmark] || audit.accuracy;
    }
    return audit.accuracy;
  }
  if (state.metricView === "compute") {
    return state.computeMetric === "finetuning" ? audit.computeFinetuning : audit.computePretraining;
  }
  if (state.metricView === "inference") return audit.inference;
  if (state.metricView === "generalization") return audit.generalization;
  return audit.accuracy;
}

function renderMetricAudit(container, model) {
  const audit = activeMetricAudit(model);
  if (!audit) {
    container.innerHTML = `<p>No metric audit available.</p>`;
    return;
  }
  const secondaryAudit = comparisonMetricAudit(model);
  const source = audit.sourceExcerpts?.[0];
  const sourceLabel = source ? `${source.source}:${source.line}` : "atlas estimate";
  const sourceText = source?.excerpt ? shortText(source.excerpt, 118) : "No direct source excerpt available.";
  const calculation = shortText(audit.calculation || audit.formula || "Estimated from atlas metric assumptions.", 132);
  container.innerHTML = `
    <div class="metric-audit-head">
      <strong>${escapeHtml(metricPointAxisLabel())}</strong>
      <span>${escapeHtml(formatAuditValue(audit))}</span>
    </div>
    <p class="metric-audit-summary">${escapeHtml(metricAuditSummary(audit, model))}</p>
    ${secondaryAudit ? `
      <div class="metric-audit-secondary">
        <b>Y axis</b>
        <span>${escapeHtml(`${formatAuditValue(secondaryAudit)} estimated accuracy`)}</span>
      </div>
    ` : ""}
    <div class="metric-audit-source">
      <b>${escapeHtml(sourceLabel)}</b>
      <span>${escapeHtml(sourceText)}</span>
    </div>
    <div class="metric-audit-formula">
      <b>Calc</b>
      <span>${escapeHtml(calculation)}</span>
    </div>
  `;
}

function metricPointAxisLabel() {
  if (state.mode === "metrics" && metricChartMode() === "compare" && state.metricView !== "accuracy") {
    return `X axis: ${metricConfig().label}`;
  }
  return metricConfig().label;
}

function comparisonMetricAudit(model) {
  if (state.mode !== "metrics" || metricChartMode() !== "compare" || state.metricView === "accuracy") return null;
  return model.metrics?.comparative?.metricAudit?.accuracy || null;
}

function metricAuditSummary(audit, model, options = {}) {
  const value = formatAuditValue(audit);
  const sourceText = "";
  const benchmark = audit.assumptions?.benchmark;
  const explainAccuracy = options.forceAccuracy || state.metricView === "accuracy";
  if (explainAccuracy && !options.forceAccuracy && state.accuracyBenchmark !== "estimated") {
    return shortText(`${model.name}: ${value} from the ${benchmarkLabel(benchmark || state.accuracyBenchmark)} result.${sourceText}`, 190);
  }
  if (explainAccuracy) {
    const keys = audit.assumptions?.benchmarkKeys || model.metrics?.comparative?.accuracy?.defaultBenchmarkKeys || [];
    const label = keys.length ? keys.map(benchmarkLabel).join(", ") : "the eligible target benchmarks";
    const contributions = metricContributionSummary(audit.assumptions?.normalizedBenchmarkContributions);
    return shortText(`${model.name}: ${value} from target benchmarks anchored to SimplerEnv/RoboCasa: ${label}.${contributions}${sourceText}`, 190);
  }
  if (state.metricView === "compute") {
    const scope = state.computeMetric === "finetuning" ? "standardized 5h task fine-tuning cost" : "pretraining or generalist-training cost";
    return shortText(`${model.name}: ${value} ${scope}, using reported GPU-hours where available and otherwise estimator assumptions.${sourceText}`, 190);
  }
  if (state.metricView === "inference") {
    return shortText(`${model.name}: ${value} estimated RTX 4090 action-level throughput, from reported latency/FPS or architecture assumptions.${sourceText}`, 190);
  }
  if (state.metricView === "generalization") {
    return shortText(`${model.name}: ${value} from real-world unseen-task evidence, normalized against a reported or nearest shared baseline.${sourceText}`, 190);
  }
  return `${model.name} is plotted at ${value} using the metric audit below.${sourceText}`;
}

function metricContributionSummary(contributions) {
  if (!Array.isArray(contributions) || !contributions.length) return "";
  const text = contributions.slice(0, 3).map((item) => {
    const label = benchmarkLabel(item.benchmark);
    return `${label} ${item.reportedScore} -> ${item.normalizedScore} (${item.weight}x)`;
  }).join("; ");
  const suffix = contributions.length > 3 ? "; ..." : "";
  return ` Calibration: ${text}${suffix}.`;
}

function formatAuditValue(audit) {
  const value = audit.displayedValue;
  if (audit.unit?.includes("FPS")) return `${value} FPS`;
  if (audit.unit?.includes("GPU")) return `${value} GPUh`;
  if (audit.unit?.includes("percent")) return `${value}%`;
  return `${value} ${audit.unit || ""}`.trim();
}

function metricAssumptionLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function formatAssumptionValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function updateActiveNodes() {
  $$("#atlasSvg .node").forEach((node) => {
    const id = node.dataset.id;
    node.classList.toggle("is-active", id === state.hoveredId || id === state.selectedId);
  });
}

function openModel(id) {
  state.selectedId = id;
  location.hash = `model/${id}`;
  routeFromHash();
}

function showPage(name) {
  $("#atlasPage").hidden = name !== "atlas";
  $("#modelPage").hidden = name !== "model";
  $("#learnPage").hidden = name !== "learn";
  $("#sourcesPage").hidden = name !== "sources";
  $$(".nav-tab").forEach((tab) => {
    const route = tab.dataset.route;
    tab.classList.toggle("is-active", route === name || (name === "model" && route === "atlas"));
  });
  const originalDiagramToggle = $("#originalDiagramToggle");
  if (originalDiagramToggle) originalDiagramToggle.hidden = name === "model";
  if (name === "model") hideOriginalDiagramHint();
  setMobileMenuOpen(false);
}

function setMobileMenuOpen(open) {
  const toggle = $("#mobileMenuToggle");
  const panel = $("#topbarMenuPanel");
  if (!toggle || !panel) return;
  panel.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
}

function syncModeButtons() {
  $$(".mode-button").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === state.mode));
  $$(".metric-button").forEach((item) => item.classList.toggle("is-active", item.dataset.metric === state.metricView));
  if (state.metricView === "accuracy" && state.metricChart === "compare") state.metricChart = "bar";
  $$(".metric-chart-button").forEach((item) => {
    const disabled = state.metricView === "accuracy" && item.dataset.metricChart === "compare";
    item.disabled = disabled;
    item.classList.toggle("is-disabled", disabled);
    item.classList.toggle("is-active", item.dataset.metricChart === metricChartMode());
  });
  const metricsControls = $("#metricsControls");
  if (metricsControls) metricsControls.hidden = state.mode !== "metrics";
  const originalDiagramToggle = $("#originalDiagramToggle");
  if (originalDiagramToggle) {
    originalDiagramToggle.classList.toggle("is-active", Boolean(state.showOriginalDiagrams));
    originalDiagramToggle.setAttribute("aria-pressed", state.showOriginalDiagrams ? "true" : "false");
  }
  const taxonomyGalleryToggle = $("#taxonomyGalleryToggle");
  if (taxonomyGalleryToggle) {
    taxonomyGalleryToggle.hidden = state.mode !== "taxonomy";
    taxonomyGalleryToggle.classList.toggle("is-active", Boolean(state.taxonomyGallery));
    taxonomyGalleryToggle.setAttribute("aria-pressed", state.taxonomyGallery ? "true" : "false");
  }
  const taxonomyTreeToggle = $("#taxonomyTreeToggle");
  if (taxonomyTreeToggle) {
    taxonomyTreeToggle.hidden = state.mode !== "taxonomy";
    taxonomyTreeToggle.classList.toggle("is-active", Boolean(state.taxonomyTree));
    taxonomyTreeToggle.setAttribute("aria-pressed", state.taxonomyTree ? "true" : "false");
  }
  const accuracyBenchmark = $("#accuracyBenchmark");
  if (accuracyBenchmark) {
    accuracyBenchmark.hidden = state.mode !== "metrics" || state.metricView !== "accuracy";
    accuracyBenchmark.value = state.accuracyBenchmark;
  }
  const computeMetric = $("#computeMetric");
  if (computeMetric) {
    computeMetric.hidden = state.mode !== "metrics" || state.metricView !== "compute";
    computeMetric.value = state.computeMetric;
  }
  const metricAccuracyFilter = $("#metricAccuracyFilter");
  if (metricAccuracyFilter) metricAccuracyFilter.hidden = !metricAccuracyFilterApplies();
  const metricAccuracyFilterEnabled = $("#metricAccuracyFilterEnabled");
  if (metricAccuracyFilterEnabled) metricAccuracyFilterEnabled.checked = Boolean(state.metricAccuracyFilterEnabled);
  const metricAccuracyThreshold = $("#metricAccuracyThreshold");
  if (metricAccuracyThreshold) {
    metricAccuracyThreshold.value = String(state.metricAccuracyThreshold);
    metricAccuracyThreshold.disabled = !state.metricAccuracyFilterEnabled;
  }
  renderTimelineLegend();
}

function setAtlasMode(mode, render = true) {
  if (mode === "speed") mode = "metrics";
  state.mode = modeDescriptions[mode] ? mode : "problem";
  hideFamilyHoverCard();
  setDefaultZoomForMode(state.mode);
  syncModeButtons();
  if (render) renderAtlas();
}

function setDefaultZoomForMode(mode) {
  state.zoom = defaultZoomForMode(mode);
  state.zoomBase = state.zoom.k;
}

function defaultZoomForMode(mode) {
  const svg = $("#atlasSvg");
  const width = svg?.clientWidth || 1440;
  const height = svg?.clientHeight || 900;
  if (mode === "problem") {
    if (!state.models.length) return { k: 0.5, x: width * 0.25, y: 86 };
    const geometry = problemGeometry(state.models, { width, height });
    const box = problemVisibleGeometryBounds(geometry, state.models, { width, height });
    const padding = {
      left: 18,
      right: 18,
      top: 78,
      bottom: 12
    };
    const zoom = zoomToFitBox(box, { width, height }, padding);
    if (geometry.portrait) {
      const k = Math.max(zoom.k, 0.27);
      return {
        k,
        x: width / 2 - box.x * k,
        y: height * 0.52 - geometry.root.y * k
      };
    }
    return zoom;
  }
  if (mode === "timeline") {
    const geometry = timelineGeometry(timelineVisibleModels(), { width, height });
    if (geometry.orientation === "vertical") {
      const k = 0.9;
      return {
        k,
        x: (width * (1 - k)) / 2,
        y: 54 - geometry.top * k
      };
    }
    const k = width < 760 ? 0.62 : 0.76;
    const timelineWidth = Math.max(width * 1.72, 1680);
    return {
      k,
      x: width - timelineWidth * k - 34,
      y: (height * (1 - k)) / 2
    };
  }
  if (mode === "metrics") {
    const k = width < 760 ? 0.82 : 0.94;
    return { k, x: (width * (1 - k)) / 2, y: (height * (1 - k)) / 2 + 10 };
  }
  if (mode === "taxonomy" && state.taxonomyTree) {
    const box = taxonomyTreeSceneBounds({ width, height });
    const padding = {
      left: width < 900 ? 8 : 12,
      right: width < 900 ? 8 : 12,
      top: 54,
      bottom: 10
    };
    const zoom = zoomToFitBox(box, { width, height }, padding);
    const k = clamp(zoom.k, width < 900 ? 0.45 : 0.62, width < 900 ? 1.05 : 1.22);
    const targetCenter = {
      x: padding.left + Math.max(1, width - padding.left - padding.right) / 2,
      y: padding.top + Math.max(1, height - padding.top - padding.bottom) / 2
    };
    return {
      k,
      x: targetCenter.x - box.x * k,
      y: targetCenter.y - box.y * k
    };
  }
  if (mode === "taxonomy" && state.taxonomyGallery) {
    const box = taxonomyGallerySceneBounds({ width, height });
    const k = clamp((width - 56) / Math.max(1, box.w), width < 900 ? 0.38 : 0.58, width < 900 ? 0.72 : 0.86);
    return {
      k,
      x: (width - box.w * k) / 2 - box.x * k,
      y: 92 - box.y * k
    };
  }
  if (mode === "taxonomy" && width <= 620) {
    const containers = taxonomyContainers({ width, height });
    const minX = Math.min(...containers.map((container) => container.x));
    const minY = Math.min(...containers.map((container) => container.y));
    const maxX = Math.max(...containers.map((container) => container.x + container.w));
    const maxY = Math.max(...containers.map((container) => container.y + container.h));
    return zoomToFitBox({
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      w: maxX - minX,
      h: maxY - minY
    }, { width, height }, { left: 10, right: 10, top: 52, bottom: 8 });
  }
  const k = width < 760 ? 0.72 : 0.8;
  return { k, x: (width * (1 - k)) / 2, y: (height * (1 - k)) / 2 - (mode === "taxonomy" ? 24 : 0) };
}

function taxonomyTreeSceneBounds(bounds) {
  const geometry = taxonomyTreeGeometry(bounds);
  return geometry.fit || {
    x: geometry.sceneWidth / 2,
    y: geometry.sceneHeight / 2,
    w: geometry.sceneWidth,
    h: geometry.sceneHeight
  };
}

function taxonomyGallerySceneBounds(bounds) {
  const boxes = taxonomyGalleryContainers(bounds).map((container) => {
    const layouts = taxonomyGalleryFamilyLayouts(container);
    return taxonomyGalleryContainerBounds(container, layouts);
  });
  if (!boxes.length) return { x: 0, y: 0, w: bounds.width, h: bounds.height };
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function zoomToFitBox(box, bounds, padding) {
  const availableWidth = Math.max(1, bounds.width - padding.left - padding.right);
  const availableHeight = Math.max(1, bounds.height - padding.top - padding.bottom);
  const minScale = bounds.width <= 620 ? 0.08 : 0.25;
  const k = clamp(Math.min(availableWidth / Math.max(1, box.w), availableHeight / Math.max(1, box.h)), minScale, 1.35);
  const targetCenter = {
    x: padding.left + availableWidth / 2,
    y: padding.top + availableHeight / 2
  };
  return {
    k,
    x: targetCenter.x - box.x * k,
    y: targetCenter.y - box.y * k
  };
}

function routeFromHash() {
  const hash = location.hash.replace(/^#/, "");
  const parts = hash.split("/");
  if (hash.startsWith("model/")) {
    const id = parts[1];
    renderModelCard(id);
    showPage("model");
    return;
  }
  if (hash === "learn") {
    showPage("learn");
    return;
  }
  if (hash === "sources") {
    showPage("sources");
    return;
  }
  if (hash.startsWith("atlas/")) {
    showPage("atlas");
    state.taxonomyGallery = parts[1] === "taxonomy" && parts[2] === "gallery";
    state.taxonomyTree = parts[1] === "taxonomy" && parts[2] === "tree";
    setAtlasMode(parts[1] || "problem");
    return;
  }
  showPage("atlas");
  syncModeButtons();
  renderAtlas();
}

function renderModelCard(id) {
  const model = state.models.find((item) => item.id === id) || state.models[0];
  const spec = getArchitectureSpec(model);
  const profile = state.diagramProfiles?.[model.id];
  state.selectedId = model.id;
  $("#modelFamily").textContent = profile
    ? `${profile.core.label} / reviewed paper-specific architecture`
    : `${model.category}${spec ? " / source-backed literal architecture" : " / survey-level placeholder"}`;
  $("#modelFamily").style.setProperty("--family-color", problemColorForModel(model));
  $("#modelName").textContent = model.title;
  $("#modelDiagramTitle").textContent = `${model.name} architecture`;
  $("#modelOneLine").textContent = model.oneLine;
  $("#modelPaperLink").href = model.paperUrl;
  $("#modelYear").textContent = `${model.month ? `${model.month}/` : ""}${model.year}`;
  $("#modelRuntime").textContent = model.metrics?.comparative?.inferenceCost?.fps4090
    ? `${formatMetricValue(model.metrics.comparative.inferenceCost.fps4090, { unit: "FPS" })} FPS`
    : scoreLabel(model.metrics?.runtimeCost);
  $("#modelCompute").textContent = model.metrics?.comparative?.computeCost?.pretrainingGpuHours
    ? `${formatMetricValue(model.metrics.comparative.computeCost.pretrainingGpuHours, { unit: "GPUh" })} GPUh`
    : scoreLabel(model.metrics?.computeScale);
  $("#modelParams").innerHTML = renderParameterSummary(model, state.arch[model.id]);
  $("#modelEvidence").textContent = model.metrics?.comparative?.confidence || scoreLabel(model.metrics?.evidence);
  renderDiagram($("#modelDiagram"), model, { mini: false });
  const modelDiagramToggle = $("#modelDiagramToggle");
  if (modelDiagramToggle) {
    modelDiagramToggle.classList.toggle("is-active", Boolean(state.showOriginalDiagrams));
    modelDiagramToggle.setAttribute("aria-pressed", state.showOriginalDiagrams ? "true" : "false");
    modelDiagramToggle.title = state.showOriginalDiagrams ? "Show generated diagram" : "Show original paper diagram";
    modelDiagramToggle.setAttribute("aria-label", modelDiagramToggle.title);
  }

  const insightLabels = ["problem", "method", "novelty", "limitation", "related"];
  $("#modelInsights").innerHTML = insightLabels.map((key) => `
    <div>
      <dt>${key}</dt>
      <dd>${renderInsightValue(model, key)}</dd>
    </div>
  `).join("");

  const stages = profile?.training?.length
    ? profile.training
    : (model.diagram?.trainingStages || []).map((stage) => ({ label: stage.name, detail: `${stage.objective}${stage.data ? ` Data: ${stage.data}.` : ""}` }));
  $("#trainingStages").innerHTML = stages.map((stage) => `
    <li><strong>${escapeHtml(stage.label || stage.name)}</strong><span>${escapeHtml(stage.detail || stage.objective || "")}</span></li>
  `).join("");

  const runtime = profile?.runtime || spec?.inferenceRecipe || model.diagram?.runtimePath || [];
  $("#runtimePath").textContent = Array.isArray(runtime) ? `Runtime path: ${runtime.join(" -> ")}` : String(runtime);
  const data = model.diagram?.data || [];
  $("#dataSources").innerHTML = data.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  $("#modelUncertainty").textContent = profile
    ? `${profile.review.uncertainty || model.uncertainty} Source coverage: ${profile.review.sourceCoverage || "method-level"}. Source: ${profile.review.sourceExtract}; lines ${(profile.review.sourceLines || []).join(", ")}.`
    : spec
    ? `${model.uncertainty} Literal diagram source: ${spec.sourceExtract}; lines ${(spec.sourceLines || []).join(", ")}.`
    : `${model.uncertainty} Literal architecture curation is pending; current diagram is a survey-level scaffold.`;
  updateActiveNodes();
}

function modelParameterSummary(model, arch = {}) {
  const reviewed = MODEL_PARAMETER_OVERRIDES[model.id];
  const pools = [
    model.name,
    model.title,
    model.oneLine,
    ...(model.diagram?.components || []),
    ...(arch.inputTokens || []),
    ...(arch.tokenization || []),
    ...(arch.backbone || []),
    ...(arch.branches || []),
    ...(arch.heads || []),
    ...(arch.trainingRecipe || []),
    ...(arch.inferenceRecipe || []),
    ...(model.literalArchitecture?.backbone || []),
    ...(model.literalArchitecture?.branches || []),
    ...(model.literalArchitecture?.heads || []),
    ...(model.literalArchitecture?.trainingRecipe || []),
    ...(model.literalArchitecture?.inferenceRecipe || [])
  ].filter(Boolean).map(String);
  const text = pools.join(" ");
  const dit = firstParamMatch(text, [
    /(?:wan|cosmos|cogvideox|video|diffusion|flow|base|pretrained)[^.;,]{0,80}?(\d+(?:\.\d+)?)\s*B(?:\s|-)?(?:video\s*)?(?:DiT|diffusion transformer|model|backbone)/ig,
    /(\d+(?:\.\d+)?)\s*B[^.;,]{0,80}?(?:DiT|diffusion transformer|video backbone|video model|wan|cosmos|cogvideox)/ig,
    /(?:RDT|Emu3|Qwen|Chameleon|VLM)[^.;,]{0,40}?(\d+(?:\.\d+)?)\s*B/ig
  ], { skip: /action expert|action head/i });
  const explicitTotal = firstParamMatch(text, [
    /(?:reported\s+)?total model size is\s+(\d+(?:\.\d+)?)\s*B/ig,
    /(?:full|total|overall)[^.;,]{0,40}?(\d+(?:\.\d+)?)\s*B/ig,
    /(\d+(?:\.\d+)?)\s*B[^.;,]{0,50}?(?:WAM|VLA|model)/ig
  ]);
  const assumptions = model.metrics?.comparative?.inferenceCost?.assumptions?.parameterB || [];
  const plausible = assumptions.filter((value) => Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 20);
  const total = explicitTotal || (plausible.length ? Math.max(...plausible) : null);
  const resolvedDit = reviewed?.centralB ?? reviewed?.ditB ?? dit;
  const resolvedTotal = reviewed?.totalB ?? total;
  return {
    dit: resolvedDit ? `${formatParamB(resolvedDit)}B` : "",
    total: resolvedTotal ? `${formatParamB(resolvedTotal)}B` : ""
  };
}

const MODEL_PARAMETER_OVERRIDES = {
  "gr-1": { centralB: 0.195, totalB: 0.195 },
  "gr-2": { centralB: 0.719, totalB: 0.719 },
  lapa: { centralB: 7, totalB: 7.3 },
  vpp: { centralB: 1.5, totalB: 1.5 },
  uva: { centralB: 0.5, totalB: 0.5 },
  uwm: { centralB: 0.086, totalB: 0.18 },
  dreamgen: { centralB: 14, totalB: 14 },
  flare: { centralB: 0.3, totalB: 2 },
  clam: { centralB: 0.0122, totalB: 0.0146 },
  videorepa: { centralB: 5, totalB: 5 },
  univla: { centralB: 7, totalB: 7 },
  "geometry-forcing": { centralB: 1.3, totalB: 1.3 },
  trivla: { centralB: 1.5, totalB: 3.39 },
  "video-generators-robot-policies": { centralB: 1.5, totalB: 1.6 },
  "villa-x": { centralB: 3, totalB: 3.6 },
  mowm: { centralB: 0.4, totalB: 0.4 },
  dust: { centralB: 1, totalB: 3.1 },
  "ud-vla": { centralB: 8, totalB: 8 },
  "rynnvla-002": { centralB: 7, totalB: 7 },
  motus: { centralB: 5, totalB: 7 },
  videovla: { centralB: 5, totalB: 5 },
  act2goal: { centralB: 1.6, totalB: 1.76 },
  "mimic-video": { centralB: 2, totalB: 2 },
  clap: { centralB: 4, totalB: 5 },
  "cosmos-policy": { centralB: 2, totalB: 2 },
  wog: { centralB: 7.54, totalB: 7.54 },
  "vla-jepa": { centralB: 0.6, totalB: 3.1 },
  frappe: { centralB: 1, totalB: 1 },
  ldamodel: { centralB: 1, totalB: 1.6 },
  adaworldpolicy: { centralB: 2, totalB: 2.8 },
  "say-dream-act": { centralB: 2, totalB: 2 },
  cowvla: { centralB: 8.5, totalB: 8.5 },
  "fast-wam": { centralB: 5, totalB: 6 },
  svam: { centralB: 1.5, totalB: 1.5 },
  "sim-distill": { centralB: 0.00015, totalB: 0.012 },
  vampo: { centralB: 1.53, totalB: 1.6 },
  eva: { centralB: 14, totalB: 14 },
  vtam: { centralB: 2, totalB: 2.16 },
  "gigaworld-policy": { centralB: 5, totalB: 5 },
  aim: { centralB: 5, totalB: 5 },
  wav: { centralB: 2.2, totalB: 2.2 },
  dexworldmodel: { centralB: 5, totalB: 5.09 },
  "x-wam": { centralB: 5, totalB: 5 },
  motubrain: { centralB: 1, totalB: 1 },
  vidar: { centralB: 5, totalB: 5.092 },
  "genie-envisioner": { centralB: 2, totalB: 2.16 },
  "xr-1": { centralB: 4, totalB: 4 },
  vipra: { centralB: 7, totalB: 7 },
  "lingbot-va": { centralB: 5.3, totalB: 5.3 },
  dreamzero: { centralB: 14, totalB: 14 },
  "rhoda-dva": { centralB: 1.5, totalB: 1.55 },
  dit4dit: { centralB: 2.2, totalB: 2.2 }
};

function renderParameterSummary(model, arch = {}) {
  const params = modelParameterSummary(model, arch);
  if (!params.dit && !params.total) return "not stated";
  if (!params.dit) return `${escapeHtml(params.total)} <span class="param-total">total</span>`;
  if (params.total && params.total !== params.dit) {
    return `${escapeHtml(params.dit)} <span class="param-total">(${escapeHtml(params.total)} total)</span>`;
  }
  return escapeHtml(params.dit);
}

function firstParamMatch(text, patterns, options = {}) {
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (options.skip?.test(match[0])) continue;
      const value = Number(match[1]);
      if (!Number.isFinite(value) || value <= 0 || value > 80) continue;
      if (value > 20 && !/parameters?|params?|model size/i.test(match[0])) continue;
      return value;
    }
  }
  return null;
}

function formatParamB(value) {
  const numeric = Number(value);
  const maximumFractionDigits = numeric < 0.01 ? 4 : numeric < 0.1 ? 3 : numeric < 10 ? 1 : 0;
  return numeric.toLocaleString(undefined, { maximumFractionDigits });
}

function renderInsightValue(model, key) {
  const value = model.insights?.[key] || "";
  if (key !== "related") return escapeHtml(value);
  return renderRelatedLinks(value, model.id);
}

function renderRelatedLinks(value, currentId) {
  const parts = String(value || "").split(/\s*,\s*/).filter(Boolean);
  if (!parts.length) return "";
  return `<span class="related-link-list">${parts.map((part) => {
    const related = findModelByLooseName(part);
    if (!related || related.id === currentId) return `<span>${escapeHtml(part)}</span>`;
    return `<a href="#model/${escapeHtml(related.id)}">${escapeHtml(part)}</a>`;
  }).join("")}</span>`;
}

function findModelByLooseName(name) {
  const target = normalizeRelatedName(name);
  return state.models.find((model) => {
    const aliases = [
      model.id,
      model.name,
      model.title,
      model.name?.replace(/\s+/g, "-"),
      model.name?.replace(/-/g, " ")
    ].filter(Boolean).map(normalizeRelatedName);
    return aliases.includes(target);
  });
}

function normalizeRelatedName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function renderLearn() {
  const grammar = [
    ["Inputs", "Language, RGB, multiview RGB-D, proprioception, tactile images, force, goal images, or action history.", "input"],
    ["Tokenizers", "VAE/VQ encoders, DINO/SigLIP features, MLP action projections, FAST/action codebooks, and latent action quantizers.", "tokenizer"],
    ["Backbone", "The core temporal model: GPT, DiT, MMDiT, MoT, shared Transformer, world diffusion model, or VLA backbone.", "backbone"],
    ["Attention", "The part that determines leakage and coupling: causal masks, cross-attention, stream fusion, bidirectional blocks, and unilateral depth attention.", "attention"],
    ["Heads", "Action denoisers, cVAE decoders, IDM heads, future latent heads, value heads, depth/tactile/force branches.", "head"],
    ["Objectives", "Flow matching, diffusion denoising, future latent alignment, VQ reconstruction, contrastive codebook alignment, depth MSE, or RL-style post-training rewards.", "objective"]
  ];
  $("#learnFlow").innerHTML = `
    <div class="learn-flow-step is-input">observations</div>
    <div class="learn-flow-arrow"></div>
    <div class="learn-flow-step is-core">world model</div>
    <div class="learn-flow-arrow"></div>
    <div class="learn-flow-step is-action">action head</div>
    <div class="learn-flow-note">the survey question is which future variable survives into this path</div>
  `;
  $("#grammarGrid").innerHTML = grammar.map(([title, body, type], index) => `
    <div class="grammar-item grammar-${escapeHtml(type)}">
      <div class="grammar-glyph" aria-hidden="true">${learnGrammarGlyph(type, index)}</div>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `).join("");

  const families = taxonomyGroups.flatMap((group) => group.families).map((id) => ({
    id,
    label: familyLabels[id] || id,
    diagramThesis: familyInsights[id]?.thesis || familyProblemQuestions[id] || ""
  }));
  $("#familyGrid").innerHTML = families.map((family) => `
    <div class="family-item" style="--family-color:${problemColorForFamily(family.id)}">
      <svg class="learn-family-diagram" viewBox="0 0 160 88" aria-hidden="true">
        <defs>${atlasArrowDef()}</defs>
        ${drawTaxonomyFamilyGlyph(family.id, { diagramX: 8, diagramY: 7, diagramW: 144, diagramH: 60 }, problemColorForFamily(family.id))}
      </svg>
      <strong>${escapeHtml(family.label)}</strong>
      <p>${escapeHtml(family.diagramThesis)}</p>
      <span>${escapeHtml(familyInsights[family.id]?.direction || familyProblemQuestions[family.id] || "")}</span>
    </div>
  `).join("");

  const researchDirections = [
    ["Causal use of future state", "Show that the action head uses the predicted world variable, not merely a correlated auxiliary loss."],
    ["Benchmark transfer", "Separate saturated simulated scores from harder SimplerEnv, RoboCasa, RoboTwin, and real unseen-task transfer."],
    ["Contact and drift", "Measure whether world models preserve contact geometry, calibration, and object permanence through long-horizon control."],
    ["Action-code grounding", "Test whether world-derived latent actions remain executable across embodiments rather than becoming dataset-local tokens."],
    ["Runtime frontier", "Map the accuracy/latency frontier when foresight is rendered, latent, cached, distilled, or skipped entirely."],
    ["Sensor robustness", "Understand how depth, touch, and force help when they are noisy, missing, or unavailable at deployment."]
  ];
  $("#researchGrid").innerHTML = researchDirections.map(([title, body], index) => `
    <div class="research-item" style="--research-accent:${problemBranches[index % problemBranches.length].color}">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `).join("");
}

function atlasArrowDef() {
  return `<marker id="atlasArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgba(23,32,36,0.42)"></path></marker>`;
}

function learnGrammarGlyph(type, index) {
  const n = `<text class="grammar-glyph-number" x="108" y="24">${index + 1}</text>`;
  const glyphs = {
    input: `
      <rect class="grammar-glyph-block" x="8" y="12" width="34" height="26" rx="5"></rect>
      <path class="grammar-glyph-line" d="M15 30c5-9 12 7 20-6"></path>
      <rect class="grammar-glyph-block" x="52" y="10" width="38" height="30" rx="5"></rect>
      <path class="grammar-glyph-line" d="M59 18h24M59 25h18M59 32h22"></path>`,
    tokenizer: `
      <path class="grammar-glyph-funnel" d="M8 10h46l-12 30H20Z"></path>
      <rect class="grammar-glyph-token" x="66" y="12" width="10" height="10" rx="2"></rect>
      <rect class="grammar-glyph-token" x="80" y="12" width="10" height="10" rx="2"></rect>
      <rect class="grammar-glyph-token" x="66" y="26" width="10" height="10" rx="2"></rect>
      <rect class="grammar-glyph-token" x="80" y="26" width="10" height="10" rx="2"></rect>`,
    backbone: `
      <rect class="grammar-glyph-block" x="18" y="12" width="64" height="30" rx="6"></rect>
      <path class="grammar-glyph-line" d="M31 17v20M43 17v20M55 17v20M67 17v20"></path>
      <path class="grammar-glyph-line" d="M8 27h10M82 27h14"></path>`,
    attention: `
      <rect class="grammar-glyph-token" x="12" y="12" width="12" height="12" rx="3"></rect>
      <rect class="grammar-glyph-token" x="42" y="12" width="12" height="12" rx="3"></rect>
      <rect class="grammar-glyph-token" x="72" y="12" width="12" height="12" rx="3"></rect>
      <path class="grammar-glyph-line" d="M18 34C30 22 38 22 48 34S72 46 80 28"></path>`,
    head: `
      <rect class="grammar-glyph-block" x="10" y="14" width="36" height="26" rx="5"></rect>
      <path class="grammar-glyph-line" d="M46 27h16"></path>
      <path class="grammar-glyph-action" d="M66 20c8 13 15-9 24 4M66 30c8 13 15-9 24 4M66 40c8 13 15-9 24 4"></path>`,
    objective: `
      <rect class="grammar-glyph-block" x="10" y="13" width="34" height="26" rx="5"></rect>
      <path class="grammar-glyph-line" d="M52 34c8-20 19 8 36-12"></path>
      <path class="grammar-glyph-line dashed" d="M50 24h42"></path>`
  };
  return `<svg viewBox="0 0 124 54" role="img">${glyphs[type] || glyphs.input}${n}</svg>`;
}

const PAPER_AUTHOR_SUMMARIES = {
  "gr-1": "Hongtao Wu, Ya Jing, Chilam Cheang",
  "gr-2": "Chi-Lam Cheang, Guangzeng Chen, Ya Jing",
  lapa: "Seonghyeon Ye, Joel Jang, Byeongguk Jeon",
  vpp: "Yucheng Hu, Yanjiang Guo, Pengchao Wang",
  uva: "Shuang Li, Yihuai Gao, Dorsa Sadigh",
  uwm: "Chuning Zhu, Raymond Yu, Siyuan Feng",
  dreamgen: "Joel Jang, Seonghyeon Ye, Zongyu Lin",
  flare: "Ruijie Zheng, Jing Wang, Scott Reed",
  clam: "Anthony Liang, Pavel Czempin, Matthew Hong",
  videorepa: "Xiangdong Zhang, Jiaqi Liao, Shaofeng Zhang",
  univla: "Qingwen Bu, Yanting Yang, Jisong Cai",
  "geometry-forcing": "Haoyu Wu, Diankun Wu, Tianyu He",
  trivla: "Zhenyang Liu, Yongchong Gu, Sixiao Zheng",
  "video-generators-robot-policies": "Junbang Liang, Pavel Tokmakov, Ruoshi Liu",
  "villa-x": "Xiaoyu Chen, Hangxing Wei, Pushi Zhang",
  mowm: "Yangcheng Yu, Xin Jin, Yu Shang",
  dust: "John Won, Kyungmin Lee, Huiwon Jang",
  "ud-vla": "Jiayi Chen, Wenxuan Song, Pengxiang Ding",
  "rynnvla-002": "Jun Cen, Siteng Huang, Yuqian Yuan",
  motus: "Hongzhe Bi, Hengkai Tan, Shenghao Xie",
  videovla: "Yichao Shen, Fangyun Wei, Zhiying Du",
  act2goal: "Pengfei Zhou, Liliang Chen, Shengcong Chen",
  "mimic-video": "Jonas Pai, Liam Achenbach, Victoriano Montesinos",
  clap: "Chubin Zhang, Jianan Wang, Zifeng Gao",
  "cosmos-policy": "Moo Jin Kim, Yihuai Gao, Tsung-Yi Lin",
  wog: "Yue Su, Sijin Chen, Haixin Shi",
  "vla-jepa": "Jingwen Sun, Wenyao Zhang, Zekun Qi",
  frappe: "Han Zhao, Jingbo Wang, Wenxuan Song",
  ldamodel: "Jiangran Lyu, Kai Liu, Xuheng Zhang",
  adaworldpolicy: "Ge Yuan, Qiyuan Qiao, Jing Zhang",
  "say-dream-act": "Songen Gu, Yunuo Cai, Tianyu Wang",
  cowvla: "Fuxiang Yang, Donglin Di, Lulu Tang",
  "fast-wam": "Tianyuan Yuan, Zibin Dong, Yicheng Liu",
  svam: "Haodong Yan, Zhide Zhong, Jiaguan Zhu",
  "sim-distill": "Jacob Levy, Tyler Westenbroek, Kevin Huang",
  vampo: "Zirui Ge, Pengxiang Ding, Baohua Yin",
  eva: "Ruixiang Wang, Qingming Liu, Yueci Deng",
  vtam: "Haoran Yuan, Weigang Yi, Zhenyu Zhang",
  "gigaworld-policy": "Angen Ye, Boyuan Wang, Chaojun Ni",
  aim: "Liaoyuan Fan, Zetian Xu, Chen Cao",
  wav: "Runze Li, Hongyin Zhang, Junxi Jin",
  dexworldmodel: "Yueci Deng, Guiliang Liu, Kui Jia",
  "x-wam": "Jun Guo, Qiwei Li, Peiyan Li",
  motubrain: "MotuBrain Team, Chendong Xiang, Fan Bao",
  vidar: "Yao Feng, Hengkai Tan, Xinyi Mao",
  "genie-envisioner": "Yue Liao, Pengfei Zhou, Siyuan Huang",
  "xr-1": "Shichao Fan, Kun Wu, Zhengping Che",
  vipra: "Sandeep Routray, Hengkai Pan, Unnat Jain",
  "lingbot-va": "Lin Li, Qihang Zhang, Yiming Luo",
  dreamzero: "Seonghyeon Ye, Yunhao Ge, Kaiyuan Zheng",
  "rhoda-dva": "Rhoda AI",
  dit4dit: "Teli Ma, Jia Zheng, Zifan Wang"
};

function renderSources() {
  const methodology = [
    "Start from the literature survey, BibTeX records, downloaded papers, and extracted method sections.",
    "Include only methods where forward dynamics, future-state prediction, or a world-model latent directly informs action learning or control.",
    "Normalize each paper into the same schema: inputs, encoders, backbone, heads, objectives, runtime path, evidence, and uncertainty.",
    "Place papers by exact release date where available, using arXiv timestamps for timeline ordering.",
    "Report uncertainty explicitly when a card depends on survey notes, partial extracts, public pages, or inferred metrics."
  ];
  $("#methodologyList").innerHTML = methodology.map((item, index) => `
    <div><strong>${index + 1}</strong><p>${escapeHtml(item)}</p></div>
  `).join("");

  const rows = state.models
    .slice()
    .sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name))
    .map((model) => `
      <tr>
        <td>${escapeHtml(modelDateLabel(model))}</td>
        <td><a href="${escapeHtml(model.paperUrl)}" target="_blank" rel="noreferrer">${escapeHtml(model.name)}</a></td>
        <td><span class="paper-family-pill" style="--paper-color:${problemColorForModel(model)}">${escapeHtml(model.category)}</span></td>
        <td>${escapeHtml(model.localText || "downloaded/extraction pending or survey-only")}</td>
        <td>${escapeHtml(PAPER_AUTHOR_SUMMARIES[model.id] || "Author metadata pending")}</td>
      </tr>
    `).join("");
  $("#paperTable").innerHTML = `
    <table>
      <thead><tr><th>Released</th><th>Paper</th><th>Family</th><th>Local Text</th><th>Authors</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function bindEvents() {
  $("#atlasSvg").addEventListener("click", (event) => {
    if (performance.now() >= Number(state.suppressAtlasClickUntil || 0)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  $("#mobileMenuToggle").addEventListener("click", (event) => {
    event.stopPropagation();
    const panel = $("#topbarMenuPanel");
    setMobileMenuOpen(!panel.classList.contains("is-open"));
  });
  $$(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      setMobileMenuOpen(false);
      const route = tab.dataset.route;
      location.hash = route === "atlas" ? "atlas" : route;
    });
  });
  $$(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      setAtlasMode(button.dataset.mode);
    });
  });
  $("#originalDiagramToggle").addEventListener("click", () => {
    toggleOriginalDiagrams();
  });
  $("#modelDiagramToggle").addEventListener("click", () => {
    toggleOriginalDiagrams();
  });
  $("#taxonomyGalleryToggle").addEventListener("click", () => {
    state.taxonomyGallery = !state.taxonomyGallery;
    if (state.taxonomyGallery) state.taxonomyTree = false;
    setDefaultZoomForMode(state.mode);
    syncModeButtons();
    renderAtlas();
  });
  $("#taxonomyTreeToggle").addEventListener("click", () => {
    state.taxonomyTree = !state.taxonomyTree;
    if (state.taxonomyTree) state.taxonomyGallery = false;
    setDefaultZoomForMode(state.mode);
    syncModeButtons();
    renderAtlas();
  });
  $$(".metric-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.metricView = button.dataset.metric;
      syncModeButtons();
      renderAtlas();
    });
  });
  $$(".metric-chart-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      state.metricChart = button.dataset.metricChart;
      syncModeButtons();
      renderAtlas();
    });
  });
  $("#accuracyBenchmark").addEventListener("change", (event) => {
    state.accuracyBenchmark = event.target.value;
    renderAtlas();
  });
  $("#computeMetric").addEventListener("change", (event) => {
    state.computeMetric = event.target.value;
    renderAtlas();
  });
  $("#metricAccuracyFilterEnabled").addEventListener("change", (event) => {
    state.metricAccuracyFilterEnabled = event.target.checked;
    syncModeButtons();
    renderAtlas();
  });
  $("#metricAccuracyThreshold").addEventListener("input", (event) => {
    state.metricAccuracyThreshold = clamp(Number(event.target.value) || 0, 0, 100);
    renderAtlas();
  });
  $("#globalSearch").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderAtlas();
  });
  $("#resetZoom").addEventListener("click", () => {
    setDefaultZoomForMode(state.mode);
    renderAtlas();
  });
  $("#backToAtlas").addEventListener("click", () => {
    location.hash = "atlas";
  });
  $("#atlasSvg").addEventListener("click", (event) => {
    if (!isCompactViewport() || event.target.closest(".taxonomy-family, .node")) return;
    hideFamilyHoverCard();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".topbar")) return;
    setMobileMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMobileMenuOpen(false);
  });
  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => {
      const svg = $("#atlasSvg");
      const bounds = { width: svg?.clientWidth || window.innerWidth, height: svg?.clientHeight || window.innerHeight };
      if (Boolean(state.lastAtlasPortrait) !== isPortraitAtlas(bounds)) setDefaultZoomForMode(state.mode);
      renderAtlas();
    });
  });
}

function toggleOriginalDiagrams() {
  state.showOriginalDiagrams = !state.showOriginalDiagrams;
  localStorage.setItem("wam-original-diagrams", state.showOriginalDiagrams ? "1" : "0");
  sessionStorage.setItem("wam-original-diagrams-interacted-v2", "1");
  syncModeButtons();
  hideOriginalDiagramHint();
  const route = location.hash.replace(/^#/, "");
  if (route.startsWith("model/")) {
    renderModelCard(route.split("/")[1]);
  } else {
    renderAtlas();
  }
}

function hasInteractedWithOriginalDiagramToggle() {
  return sessionStorage.getItem("wam-original-diagrams-interacted-v2") === "1";
}

function showOriginalDiagramHint() {
  if (hasInteractedWithOriginalDiagramToggle()) return;
  const toggle = $("#originalDiagramToggle");
  const hint = $("#originalDiagramHint");
  if (!toggle || !hint || toggle.hidden) return;
  const bubble = hint.querySelector(".original-diagram-hint-bubble");
  if (bubble) bubble.textContent = state.showOriginalDiagrams ? "Switch to generated diagrams" : "Switch to original diagrams";
  toggle.classList.remove("is-pulsing");
  void toggle.offsetWidth;
  toggle.classList.add("is-pulsing");
  hint.classList.add("is-visible");
  hint.setAttribute("aria-hidden", "false");
  window.clearTimeout(showOriginalDiagramHint.timer);
  showOriginalDiagramHint.timer = window.setTimeout(hideOriginalDiagramHint, 4000);
}

function hideOriginalDiagramHint() {
  const toggle = $("#originalDiagramToggle");
  const hint = $("#originalDiagramHint");
  if (toggle) toggle.classList.remove("is-pulsing");
  if (hint) {
    hint.classList.remove("is-visible");
    hint.setAttribute("aria-hidden", "true");
  }
}

function startOriginalDiagramHintLoop() {
  if (hasInteractedWithOriginalDiagramToggle()) return;
  window.setInterval(() => {
    if (hasInteractedWithOriginalDiagramToggle()) return;
    showOriginalDiagramHint();
  }, 8000);
}

bindEvents();
startOriginalDiagramHintLoop();
loadData().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("afterbegin", `<pre style="padding:16px;color:#a00">${escapeHtml(error.stack || error.message)}</pre>`);
});
