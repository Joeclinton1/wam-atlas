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
  institutionMeta,
  $,
  $$,
  escapeHtml,
  slugDate,
  scoreLabel,
  wrapText,
  shortText
} from './shared.js?v=timeline-legend-4';
import { renderDiagram, getArchitectureSpec } from './diagrams.js?v=timeline-legend-4';
function filteredModels() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.models;
  return state.models.filter((model) => {
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
  const [modelsRes, schemaRes, archRes] = await Promise.all([
    fetch("data/wam-models.json"),
    fetch("data/schema.json"),
    fetch("data/architecture-specs.json")
  ]);
  const modelsData = await modelsRes.json();
  state.schema = await schemaRes.json();
  const archData = await archRes.json();
  state.models = modelsData.models;
  state.methodology = modelsData.methodology;
  state.arch = archData.models || {};

  $("#modelCount").textContent = state.models.length;
  $("#familyCount").textContent = new Set(state.models.map((m) => m.family)).size;
  setDefaultZoomForMode(state.mode);
  renderLearn();
  renderSources();
  routeFromHash();
}

function familyOrder() {
  return [...new Set(state.models.map((model) => model.family))];
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

  if (state.mode === "speed") {
    const x = 90 + ((Number(model.metrics?.runtimeCost) || 1) - 1) * ((w - 180) / 4);
    const y = h - 90 - ((Number(model.metrics?.computeScale) || 1) - 1) * ((h - 180) / 4);
    return { x: x + jitter, y: y - jitter };
  }

  if (state.mode === "timeline") {
    return timelineGeometry(models, bounds).positions.get(model.id);
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
    drawTimelineBackdrop(group, timelineGeometry(state.models, bounds));
    return;
  }
  if (state.mode === "speed") {
    drawSpeedBackdrop(group, bounds);
    return;
  }
  if (state.mode === "taxonomy") {
    drawTaxonomyBackdrop(group, bounds);
  }
}

function problemGeometry(models, bounds) {
  const root = { id: "root", x: bounds.width / 2, y: bounds.height * 0.46 + 36, fixed: true };
  const branchRx = clamp(bounds.width * 0.29, 360, 520);
  const branchRy = clamp(bounds.height * 0.28, 228, 340);
  const familyRx = clamp(bounds.width * 0.165, 210, 310);
  const familyRy = clamp(bounds.height * 0.175, 142, 220);
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
  return { root, branchNodes, familyNodes, edges, positions, leafAssignments: leafByModelId };
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
    const tangent = { x: -outward.y, y: outward.x };
    const branchBox = problemNodeBox(branch, "branch");
    leaves.forEach((leaf, index) => {
      const leafBox = problemNodeBox(leaf, "leaf");
      const offset = (index - (leaves.length - 1) / 2) * Math.max(82, leafBox.w + 24);
      const radial = Math.max(190, branchBox.w * 0.5 + leafBox.w * 0.5 + 76);
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
    const outward = radialVectorFromRoot(leaf, geometry.root);
    const tangent = { x: -outward.y, y: outward.x };
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
          index
        });
        paper.point.x = candidate.x;
        paper.point.y = candidate.y;
        groupPlaced.push({ ref: paper.point, w: paper.box.w, h: paper.box.h });
        placedByGroup.set(leaf.groupId, groupPlaced);
      });
  });
}

function bestPaperSlot({ paper, leaf, outward, tangent, edgeDistance, obstacles, placed, index }) {
  const tangentSteps = [0, -1, 1, -2, 2, -3, 3, -4, 4];
  const radialSteps = [0, 1, 2, 3, 4];
  const tangentGap = Math.max(46, paper.box.w * 0.46);
  const radialGap = 26;
  let fallback = null;

  for (const radialIndex of radialSteps) {
    for (const tangentIndex of tangentSteps) {
      const localX = tangentIndex * tangentGap + (index % 2 ? tangentGap * 0.12 : 0);
      const radialPush = edgeDistance + 10 + radialIndex * radialGap + Math.abs(localX) * 0.025;
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
    w: Math.min(bounds.width * 0.48, 730),
    h: rootLayout.h + 150
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
    futures: { x: root.x - w * 0.2, y: root.y - h * 0.16 },
    coupling: { x: root.x + w * 0.2, y: root.y - h * 0.17 },
    speed: { x: root.x + w * 0.24, y: root.y + h * 0.12 },
    grounding: { x: root.x + w * 0.035, y: root.y + h * 0.22 },
    physics: { x: root.x - w * 0.22, y: root.y + h * 0.16 }
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

function rootProblemBox() {
  const layout = questionTextLayout(rootProblemQuestion, problemQuestionWidth("root"), "root");
  return problemQuestionCollision("root", layout.boxWidth, layout.h);
}

function problemPaperBox(model, point) {
  return {
    x: point.x,
    y: point.y,
    w: Math.min(132, Math.max(82, shortPaperName(model.name).length * 6.2 + 38)),
    h: 42
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
  const sorted = models.slice().sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name));
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
  geometry.edges.forEach((edge, index) => {
    drawFadingConnector(layer, defs, `problem-${index}-${edge.id}`, edge.from, edge.to, edge.color, true);
  });
  geometry.positions.forEach((point, modelId) => {
    const leaf = geometry.leafAssignments.get(modelId);
    if (!leaf) return;
    drawPaperTether(layer, leaf, point, modelId);
  });
  layer.insertAdjacentHTML("beforeend", drawQuestionNode(geometry.root, rootProblemQuestion, "problem-root", "#172024", problemQuestionWidth("root"), "root"));
  geometry.branchNodes.forEach((branch) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(branch, branch.question, "problem-branch", branch.color, problemQuestionWidth("branch"), "branch"));
  });
  geometry.familyNodes.forEach((family) => {
    layer.insertAdjacentHTML("beforeend", drawQuestionNode(family, family.question, "problem-leaf-question", family.color, problemQuestionWidth("leaf"), "leaf"));
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
  const leafLayout = questionTextLayout(leaf.question, problemQuestionWidth("leaf"), "leaf", leaf.label);
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
    grounding: "Video grounding",
    physics: "Physical robustness"
  };
  legend.innerHTML = problemBranches.map((branch) => `
    <span class="timeline-legend-item">
      <span class="timeline-legend-dot" style="background:${branch.color}"></span>
      ${escapeHtml(labels[branch.id] || branch.question)}
    </span>
  `).join("");
}

function drawSpeedBackdrop(group, bounds) {
  const layer = atlasAnnotationLayer("speed-map");
  const left = 78;
  const bottom = bounds.height - 75;
  const right = bounds.width - 64;
  const top = 56;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const x = left + index * ((right - left) / 4);
    const y = bottom - index * ((bottom - top) / 4);
    return `
      <line class="speed-grid" x1="${x}" y1="${top}" x2="${x}" y2="${bottom}"></line>
      <line class="speed-grid" x1="${left}" y1="${y}" x2="${right}" y2="${y}"></line>
    `;
  }).join("");
  layer.innerHTML = `
    ${grid}
    <line class="speed-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" marker-end="url(#atlasArrow)"></line>
    <line class="speed-axis" x1="${left}" y1="${bottom}" x2="${left}" y2="${top}" marker-end="url(#atlasArrow)"></line>
    <text class="axis-label" x="${right - 138}" y="${bottom + 38}">runtime cost</text>
    <text class="axis-label" x="${left - 55}" y="${top + 18}" transform="rotate(-90 ${left - 55} ${top + 18})">compute scale</text>
  `;
  group.appendChild(layer);
}

function drawTaxonomyBackdrop(group, bounds) {
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
    const columns = container.id === "enhancement"
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
  const layout = taxonomyFamilyLayouts(bounds).get(model.family);
  if (!layout) return null;
  const familyModels = state.models.filter((item) => item.family === model.family);
  const index = familyModels.findIndex((item) => item.id === model.id);
  const pitchX = layout.paperPitch || 54;
  const cols = Math.max(1, Math.floor((layout.w - 10) / pitchX));
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
  const large = width >= 1500;
  const xl = width >= 1900;
  return {
    cellGap: xl ? 56 : large ? 48 : 42,
    diagramSideInset: xl ? 10 : large ? 12 : 16,
    maxDiagramW: xl ? 230 : large ? 198 : 154,
    diagramH: xl ? 92 : large ? 80 : 66,
    paperPitch: xl ? 76 : large ? 66 : 54,
    paperRowGap: xl ? 40 : large ? 35 : 29,
    paperRadius: xl ? 8 : large ? 7 : 6,
    paperLiteralRadius: xl ? 10 : large ? 9 : 7.5,
    paperLabelSize: xl ? 9.2 : large ? 8.4 : 7.2,
    paperLogoRadius: xl ? 7.4 : large ? 6.6 : 5.8,
    paperTopGap: xl ? 32 : large ? 28 : 24
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
    joint_latent: () => `
      ${rect(6, 12, 25, 18, "glyph-sensor", "obs")}
      ${rect(6, 42, 25, 18, "glyph-action", "act")}
      ${arrow(33, 21, 59, 30)}
      ${arrow(33, 51, 59, 43)}
      <ellipse class="glyph-latent" cx="${sx(79)}" cy="${sy(36)}" rx="${32 * scaleX}" ry="${24 * scaleY}"></ellipse>
      ${dot(72, 29)}${dot(88, 39, "glyph-dot action")}${dot(76, 48, "glyph-dot state")}
      ${arrow(108, 36, 132, 36)}
      ${rect(130, 24, 19, 24, "glyph-core", "dec")}
      ${label("shared obs-action geometry")}
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
  const setFamilyHover = (family, active) => {
    state.taxonomyHoveredFamily = active ? family : null;
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
    item.addEventListener("mouseenter", () => {
      setFamilyHover(item.dataset.family, true);
    });
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

function taxonomyContainers(bounds) {
  const margin = clamp(bounds.width * 0.035, 34, 76);
  const top = bounds.width >= 1500 ? 104 : 116;
  const bottom = 28;
  const gap = bounds.width >= 1500 ? 34 : 28;
  const h = Math.max(390, bounds.height - top - bottom);
  const available = Math.min(bounds.width - margin * 2, 1740);
  const x0 = (bounds.width - available) / 2;
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

function problemQuestionWidth(level) {
  if (level === "root") return 780;
  if (level === "branch") return 420;
  return 142;
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
    branch: { font: 28, minFont: 24, line: 32, minH: 104, maxLines: 3, top: -34, weight: 900 },
    leaf: { font: 10, minFont: 8.2, line: 10.7, minH: 34, maxLines: 6, top: 11, weight: 820 }
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
  if (from.id === "root") return { stroke: 14, arrow: 27 };
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
  state.models.forEach((model, index) => {
    const target = problemGeo?.positions.get(model.id) || positionModel(model, index, state.models, bounds) || { x: width / 2, y: height / 2 };
    const leaf = problemGeo?.leafAssignments.get(model.id);
    nextPositions.set(model.id, target);
    const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const hasLiteral = Boolean(model.literalArchitecture || state.arch[model.id]);
    node.classList.add("node");
    if (!visible.has(model.id)) node.classList.add("is-muted");
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

    const radius = state.mode === "taxonomy" ? (hasLiteral ? 7.5 : 6) : hasLiteral ? 12 : 9;
    const color = state.mode === "taxonomy" || state.mode === "timeline"
      ? problemColorForModel(model)
      : familyColors[model.family] || "#61717a";
    const labelSide = state.mode === "taxonomy" || state.mode === "timeline" ? "bottom" : target.x > width - 180 ? "left" : "right";
    let paperRadius = radius;
    let taxonomyStyle = "";
    if (state.mode === "taxonomy") {
      const layout = taxonomyFamilyLayouts(bounds).get(model.family);
      paperRadius = hasLiteral ? layout?.paperLiteralRadius || 7.5 : layout?.paperRadius || 6;
      const logoRadius = layout?.paperLogoRadius || 5.8;
      taxonomyStyle = `--taxonomy-label-size:${layout?.paperLabelSize || 7.2}px;--taxonomy-logo-radius:${logoRadius}px;--taxonomy-logo-size:${logoRadius * 1.65}px;`;
    }
    const bodyClass = [
      "node-body",
      state.mode === "taxonomy" ? "taxonomy-node-body" : "",
      state.mode === "timeline" ? "timeline-node-body" : ""
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

  if (state.mode === "taxonomy") bindTaxonomyFamilyHover(group);

  $("#modeDescription").textContent = modeDescriptions[state.mode];
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
    if (event.target.closest?.(".node")) return;
    state.dragging = { x: event.clientX, y: event.clientY, ox: state.zoom.x, oy: state.zoom.y };
    svg.setPointerCapture(event.pointerId);
  };
  svg.onpointermove = (event) => {
    if (!state.dragging) return;
    state.zoom.x = state.dragging.ox + event.clientX - state.dragging.x;
    state.zoom.y = state.dragging.oy + event.clientY - state.dragging.y;
    setAtlasTransform(group);
  };
  svg.onpointerup = () => {
    state.dragging = null;
  };
  svg.onpointercancel = () => {
    state.dragging = null;
  };
}

function showPreview(id, event) {
  const model = state.models.find((item) => item.id === id);
  if (!model) return;
  const spec = getArchitectureSpec(model);
  state.hoveredId = id;
  $("#previewPanel").hidden = false;
  $("#previewPanel").style.setProperty("--preview-outline", problemColorForModel(model));
  $("#previewEmpty").hidden = true;
  $("#previewContent").hidden = false;
  $("#previewFamily").textContent = `${model.category}${spec ? " / source-backed diagram" : " / survey-level diagram"}`;
  $("#previewTitle").textContent = model.name;
  $("#previewInsight").textContent = model.insights?.novelty || model.oneLine;
  $("#previewOpen").onclick = () => openModel(id);
  renderDiagram($("#previewDiagram"), model, { mini: true });
  positionPreview(event);
  updateActiveNodes();
}

function hidePreview() {
  state.hoveredId = null;
  $("#previewPanel").hidden = true;
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
}

function syncModeButtons() {
  $$(".mode-button").forEach((item) => item.classList.toggle("is-active", item.dataset.mode === state.mode));
  renderTimelineLegend();
}

function setAtlasMode(mode, render = true) {
  state.mode = modeDescriptions[mode] ? mode : "problem";
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
    return zoomToFitBox(problemGeometryBounds(geometry, state.models), { width, height }, {
      left: 0,
      right: 0,
      top: 102,
      bottom: 18
    });
  }
  if (mode === "timeline") {
    const k = width < 760 ? 0.62 : 0.76;
    const timelineWidth = Math.max(width * 1.72, 1680);
    return {
      k,
      x: width - timelineWidth * k - 34,
      y: (height * (1 - k)) / 2
    };
  }
  const k = width < 760 ? 0.72 : 0.8;
  return { k, x: (width * (1 - k)) / 2, y: (height * (1 - k)) / 2 };
}

function zoomToFitBox(box, bounds, padding) {
  const availableWidth = Math.max(1, bounds.width - padding.left - padding.right);
  const availableHeight = Math.max(1, bounds.height - padding.top - padding.bottom);
  const k = clamp(Math.min(availableWidth / Math.max(1, box.w), availableHeight / Math.max(1, box.h)), 0.25, 1.35);
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
  if (hash.startsWith("model/")) {
    const id = hash.split("/")[1];
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
    setAtlasMode(hash.split("/")[1] || "problem");
    return;
  }
  showPage("atlas");
  syncModeButtons();
  renderAtlas();
}

function renderModelCard(id) {
  const model = state.models.find((item) => item.id === id) || state.models[0];
  const spec = getArchitectureSpec(model);
  state.selectedId = model.id;
  $("#modelFamily").textContent = `${model.category}${spec ? " / source-backed literal architecture" : " / survey-level placeholder"}`;
  $("#modelFamily").style.setProperty("--family-color", problemColorForModel(model));
  $("#modelName").textContent = model.title;
  $("#modelOneLine").textContent = model.oneLine;
  $("#modelPaperLink").href = model.paperUrl;
  $("#modelYear").textContent = `${model.month ? `${model.month}/` : ""}${model.year}`;
  $("#modelRuntime").textContent = scoreLabel(model.metrics?.runtimeCost);
  $("#modelCompute").textContent = scoreLabel(model.metrics?.computeScale);
  $("#modelEvidence").textContent = scoreLabel(model.metrics?.evidence);
  renderDiagram($("#modelDiagram"), model, { mini: false });

  const insightLabels = ["problem", "method", "novelty", "limitation", "related"];
  $("#modelInsights").innerHTML = insightLabels.map((key) => `
    <div>
      <dt>${key}</dt>
      <dd>${escapeHtml(model.insights?.[key] || "")}</dd>
    </div>
  `).join("");

  const stages = model.diagram?.trainingStages || [];
  $("#trainingStages").innerHTML = stages.map((stage) => `
    <li><strong>${escapeHtml(stage.name)}</strong><span>${escapeHtml(stage.objective)} ${stage.data ? `Data: ${stage.data}.` : ""}</span></li>
  `).join("");

  const runtime = spec?.inferenceRecipe || model.diagram?.runtimePath || [];
  $("#runtimePath").textContent = Array.isArray(runtime) ? `Runtime path: ${runtime.join(" -> ")}` : String(runtime);
  const data = model.diagram?.data || [];
  $("#dataSources").innerHTML = data.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  $("#modelUncertainty").textContent = spec
    ? `${model.uncertainty} Literal diagram source: ${spec.sourceExtract}; lines ${(spec.sourceLines || []).join(", ")}.`
    : `${model.uncertainty} Literal architecture curation is pending; current diagram is a survey-level scaffold.`;
  updateActiveNodes();
}

function renderLearn() {
  const grammar = [
    ["Inputs", "Language, RGB, multiview RGB-D, proprioception, tactile images, force, goal images, or action history."],
    ["Tokenizers", "VAE/VQ encoders, DINO/SigLIP features, MLP action projections, FAST/action codebooks, and latent action quantizers."],
    ["Backbone", "The core temporal model: GPT, DiT, MMDiT, MoT, shared Transformer, video diffusion model, or VLA backbone."],
    ["Attention", "The part that determines leakage and coupling: causal masks, cross-attention, stream fusion, bidirectional blocks, and unilateral depth attention."],
    ["Heads", "Action denoisers, cVAE decoders, IDM heads, future latent heads, value heads, depth/tactile/force branches."],
    ["Objectives", "Flow matching, diffusion denoising, future latent alignment, VQ reconstruction, contrastive codebook alignment, depth MSE, or RL-style post-training rewards."]
  ];
  $("#grammarGrid").innerHTML = grammar.map(([title, body]) => `
    <div class="grammar-item"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p></div>
  `).join("");

  const families = state.schema?.families || [];
  $("#familyGrid").innerHTML = families.map((family) => `
    <div class="family-item">
      <strong>${escapeHtml(family.label)}</strong>
      <p>${escapeHtml(family.diagramThesis)}</p>
    </div>
  `).join("");
}

function renderSources() {
  $("#methodologyList").innerHTML = (state.methodology || []).map((item) => `
    <div><p>${escapeHtml(item)}</p></div>
  `).join("");

  const rows = state.models
    .slice()
    .sort((a, b) => slugDate(a) - slugDate(b) || a.name.localeCompare(b.name))
    .map((model) => `
      <tr>
        <td>${escapeHtml(modelDateLabel(model))}</td>
        <td><a href="${escapeHtml(model.paperUrl)}" target="_blank" rel="noreferrer">${escapeHtml(model.name)}</a></td>
        <td>${escapeHtml(model.category)}</td>
        <td>${escapeHtml(model.localText || "downloaded/extraction pending or survey-only")}</td>
        <td>${model.literalArchitecture || state.arch[model.id] ? "literal spec" : "method extract pending curation"}</td>
      </tr>
    `).join("");
  $("#paperTable").innerHTML = `
    <table>
      <thead><tr><th>Released</th><th>Paper</th><th>Category</th><th>Local Text</th><th>Diagram Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function bindEvents() {
  $$(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const route = tab.dataset.route;
      location.hash = route === "atlas" ? "atlas" : route;
    });
  });
  $$(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      setAtlasMode(button.dataset.mode);
    });
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
  window.addEventListener("hashchange", routeFromHash);
  window.addEventListener("resize", () => renderAtlas());
}

bindEvents();
loadData().catch((error) => {
  console.error(error);
  document.body.insertAdjacentHTML("afterbegin", `<pre style="padding:16px;color:#a00">${escapeHtml(error.stack || error.message)}</pre>`);
});

