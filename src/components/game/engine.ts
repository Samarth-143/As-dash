import { getHighScore, setHighScore, getName } from "./storage";

export const VW = 320;
export const VH = 180;
const GROUND_Y = 150;
const PLAYER_X = 40;
const GRAVITY = 0.42;
const JUMP_V = -5.4;
const JUMP_HOLD_BOOST = -0.15;
const MAX_HOLD_FRAMES = 10;

type Phase = "title" | "playing" | "over";

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "rock" | "crystal" | "drone" | "spikes" | "alien" | "ufo" | "missile";
  eye?: number;
  charge?: number;
  bob?: number;
  vx?: number;
  spin?: number;
}

interface Collectible {
  x: number;
  y: number;
  taken: boolean;
  pulse: number;
}

interface Star {
  x: number;
  y: number;
  s: number; // speed factor
  b: number; // brightness 0..1
  tw: number;
  tws: number;
}

interface Mountain {
  x: number;
  w: number;
  h: number;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Station {
  x: number;
  kind: 0 | 1;
}

interface State {
  phase: Phase;
  time: number;
  score: number;
  highScore: number;
  speed: number;
  py: number;
  vy: number;
  onGround: boolean;
  sliding: boolean;
  jumpHeld: boolean;
  holdFrames: number;
  runFrame: number;
  runTimer: number;
  flameFrame: number;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  stars: Star[];
  shooting: ShootingStar[];
  particles: Particle[];
  stations: Station[];
  shootingCooldown: number;
  midMountains: Mountain[];
  frontMountains: Mountain[];
  planetX: number;
  spawnCooldown: number;
  collectibleCooldown: number;
  shake: number;
  flash: number;
  name: string;
  duration: number;
  startTime: number;
}

export interface Input {
  jumpDown: boolean;
  jumpPressed: boolean;
  slide: boolean;
  start: boolean;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function makeStars(): Star[] {
  const arr: Star[] = [];
  for (let i = 0; i < 60; i++) {
    arr.push({
      x: Math.random() * VW,
      y: Math.random() * (GROUND_Y - 20),
      s: 0.1 + Math.random() * 0.4,
      b: 0.3 + Math.random() * 0.7,
      tw: Math.random() * Math.PI * 2,
      tws: 0.04 + Math.random() * 0.08,
    });
  }
  return arr;
}

function makeMountains(count: number, hMin: number, hMax: number, color: string): Mountain[] {
  const arr: Mountain[] = [];
  let x = 0;
  while (arr.length < count) {
    const w = rand(40, 90);
    arr.push({ x, w, h: rand(hMin, hMax), color });
    x += w * 0.6;
  }
  return arr;
}

export function createState(): State {
  return {
    phase: "title",
    time: 0,
    score: 0,
    highScore: getHighScore(),
    speed: 2.2,
    py: GROUND_Y - 16,
    vy: 0,
    onGround: true,
    sliding: false,
    jumpHeld: false,
    holdFrames: 0,
    runFrame: 0,
    runTimer: 0,
    flameFrame: 0,
    obstacles: [],
    collectibles: [],
    stars: makeStars(),
    shooting: [],
    particles: [],
    stations: makeStations(),
    shootingCooldown: 180 + Math.random() * 240,
    midMountains: makeMountains(8, 18, 38, "#3a1f6e"),
    frontMountains: makeMountains(6, 30, 60, "#1a0e3a"),
    planetX: 240,
    spawnCooldown: 60,
    collectibleCooldown: 120,
    shake: 0,
    flash: 0,
    name: getName(),
    duration: 0,
    startTime: 0,
  };
}

function resetForPlay(s: State) {
  s.phase = "playing";
  s.time = 0;
  s.score = 0;
  s.speed = 2.2;
  s.py = GROUND_Y - 16;
  s.vy = 0;
  s.onGround = true;
  s.sliding = false;
  s.holdFrames = 0;
  s.obstacles = [];
  s.collectibles = [];
  s.particles = [];
  s.spawnCooldown = 60;
  s.collectibleCooldown = 120;
  s.shake = 0;
  s.flash = 0;
  s.duration = 0;
  s.startTime = performance.now();
}

function playerBox(s: State) {
  const w = 10;
  const h = s.sliding && s.onGround ? 10 : 16;
  const y = s.sliding && s.onGround ? GROUND_Y - h : s.py;
  return { x: PLAYER_X, y, w, h };
}

function spawnObstacle(s: State) {
  // weighted picks; new flyers force ducking, new ground forces jumping
  const tier = Math.min(1, s.score / 1500);
  const picks: Array<{ k: Obstacle["kind"]; w: number }> = [
    { k: "rock", w: 22 },
    { k: "crystal", w: 14 },
    { k: "spikes", w: 16 },
    { k: "alien", w: 10 + tier * 8 },
    { k: "drone", w: 12 },
    { k: "ufo", w: 10 + tier * 6 },
    { k: "missile", w: 4 + tier * 12 },
  ];
  const total = picks.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  let kind: Obstacle["kind"] = "rock";
  for (const p of picks) {
    r -= p.w;
    if (r <= 0) { kind = p.k; break; }
  }
  const x = VW + 10;
  switch (kind) {
    case "rock":
      s.obstacles.push({ x, y: GROUND_Y - 10, w: 10, h: 10, kind });
      break;
    case "crystal":
      s.obstacles.push({ x, y: GROUND_Y - 16, w: 8, h: 16, kind });
      break;
    case "spikes": {
      const w = 14 + Math.floor(Math.random() * 10);
      s.obstacles.push({ x, y: GROUND_Y - 6, w, h: 6, kind });
      break;
    }
    case "alien":
      // ground walker, taller — must jump
      s.obstacles.push({ x, y: GROUND_Y - 14, w: 10, h: 14, kind, bob: 0, eye: 0 });
      break;
    case "drone":
      // hovers at head height — duck or jump
      s.obstacles.push({ x, y: GROUND_Y - 20, w: 14, h: 8, kind, eye: 0, charge: 0, bob: 0 });
      break;
    case "ufo":
      // higher flyer — must slide
      s.obstacles.push({ x, y: GROUND_Y - 20, w: 16, h: 8, kind, bob: 0, spin: 0 });
      break;
    case "missile":
      // fast incoming projectile at head height — must slide
      s.obstacles.push({ x, y: GROUND_Y - 18, w: 12, h: 4, kind, vx: 1.6 + tier * 1.2, spin: 0 });
      break;
  }
}

function spawnCollectible(s: State) {
  const y = GROUND_Y - 30 - Math.random() * 30;
  s.collectibles.push({ x: VW + 10, y, taken: false, pulse: 0 });
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function update(s: State, input: Input) {
  s.time++;
  updateAmbient(s);
  updateParticles(s);

  if (s.phase === "title") {
    // gentle parallax even on title
    scrollParallax(s, 1.2);
    if (input.start) {
      resetForPlay(s);
    }
    return;
  }

  if (s.phase === "over") {
    scrollParallax(s, 0.6);
    if (input.start) {
      resetForPlay(s);
    }
    return;
  }

  // playing
  s.speed = 2.2 + Math.min(8, s.score / 500);
  s.duration = Math.floor((performance.now() - s.startTime) / 1000);
  scrollParallax(s, s.speed);

  // input
  s.sliding = input.slide;
  if (input.jumpPressed && s.onGround) {
    s.vy = JUMP_V;
    s.onGround = false;
    s.holdFrames = 0;
    s.jumpHeld = true;
  }
  if (!input.jumpDown) s.jumpHeld = false;
  if (s.jumpHeld && s.holdFrames < MAX_HOLD_FRAMES && s.vy < 0) {
    s.vy += JUMP_HOLD_BOOST;
    s.holdFrames++;
  }

  // physics
  s.vy += GRAVITY;
  s.py += s.vy;
  if (s.py >= GROUND_Y - 16) {
    s.py = GROUND_Y - 16;
    s.vy = 0;
    s.onGround = true;
  }

  // anim
  s.runTimer++;
  if (s.runTimer > 6) {
    s.runTimer = 0;
    s.runFrame = (s.runFrame + 1) % 2;
  }
  s.flameFrame = (s.flameFrame + 1) % 4;

  if (!s.onGround && s.time % 2 === 0) {
    s.particles.push({
      x: PLAYER_X + 1,
      y: s.py + 13,
      vx: -s.speed * 0.6 - Math.random() * 0.4,
      vy: 0.2 + Math.random() * 0.3,
      life: 16,
      maxLife: 16,
      color: Math.random() < 0.5 ? "#ff2e88" : "#ffd23e",
      size: 1,
    });
  }

  for (const o of s.obstacles) {
    if (o.kind === "drone") {
      o.eye = ((o.eye ?? 0) + 1) % 40;
      o.bob = (o.bob ?? 0) + 0.12;
      if (o.x < VW * 0.75) o.charge = Math.min(30, (o.charge ?? 0) + 1);
    } else if (o.kind === "ufo") {
      o.bob = (o.bob ?? 0) + 0.1;
      o.spin = ((o.spin ?? 0) + 1) % 8;
    } else if (o.kind === "alien") {
      o.bob = (o.bob ?? 0) + 0.2;
      o.eye = ((o.eye ?? 0) + 1) % 50;
    } else if (o.kind === "missile") {
      o.spin = ((o.spin ?? 0) + 1) % 4;
      if (s.time % 2 === 0) {
        s.particles.push({
          x: o.x + o.w,
          y: o.y + 2,
          vx: 1 + Math.random(),
          vy: (Math.random() - 0.5) * 0.3,
          life: 14,
          maxLife: 14,
          color: Math.random() < 0.5 ? "#ffd23e" : "#ff2e88",
          size: 1,
        });
      }
    }
  }

  // spawn obstacles
  s.spawnCooldown--;
  if (s.spawnCooldown <= 0) {
    spawnObstacle(s);
    const base = Math.max(38, 90 - s.score / 40);
    s.spawnCooldown = base + Math.random() * 50;
  }

  s.collectibleCooldown--;
  if (s.collectibleCooldown <= 0) {
    spawnCollectible(s);
    s.collectibleCooldown = 140 + Math.random() * 180;
  }

  // move + cull obstacles (some have extra self-velocity)
  for (const o of s.obstacles) o.x -= s.speed + (o.vx ?? 0);
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -4);

  for (const c of s.collectibles) {
    c.x -= s.speed;
    c.pulse += 0.15;
  }
  s.collectibles = s.collectibles.filter((c) => c.x > -8 && !c.taken);

  // collisions
  const pb = playerBox(s);
  for (const o of s.obstacles) {
    if (rectsOverlap(pb, { x: o.x + 1, y: o.y + 1, w: o.w - 2, h: o.h - 2 })) {
      s.phase = "over";
      s.shake = 10;
      s.flash = 6;
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.6 + Math.random() * 1.6;
        s.particles.push({
          x: PLAYER_X + 5,
          y: s.py + 8,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 30,
          maxLife: 30,
          color: i % 2 ? "#ff2e88" : "#ffd23e",
          size: 1,
        });
      }
      s.highScore = setHighScore(Math.floor(s.score));
      return;
    }
  }
  for (const c of s.collectibles) {
    if (!c.taken && rectsOverlap(pb, { x: c.x - 3, y: c.y - 3, w: 6, h: 6 })) {
      c.taken = true;
      s.score += 50;
      s.flash = 2;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 0.5 + Math.random() * 1.2;
        s.particles.push({
          x: c.x,
          y: c.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 18,
          maxLife: 18,
          color: i % 2 ? "#3ef0ff" : "#ffffff",
          size: 1,
        });
      }
    }
  }

  s.score += 0.15 * s.speed;
  if (s.shake > 0) s.shake--;
  if (s.flash > 0) s.flash--;
}

function scrollParallax(s: State, speed: number) {
  for (const star of s.stars) {
    star.x -= speed * star.s;
    star.tw += star.tws;
    if (star.x < 0) {
      star.x = VW;
      star.y = Math.random() * (GROUND_Y - 20);
    }
  }
  for (const st of s.stations) {
    st.x -= speed * 0.18;
    if (st.x < -60) st.x += s.stations.length * 140;
  }
  for (const m of s.midMountains) {
    m.x -= speed * 0.35;
    if (m.x + m.w < 0) m.x += s.midMountains.length * m.w * 0.6 + 20;
  }
  for (const m of s.frontMountains) {
    m.x -= speed * 0.7;
    if (m.x + m.w < 0) m.x += s.frontMountains.length * m.w * 0.6 + 20;
  }
  s.planetX -= speed * 0.08;
  if (s.planetX < -50) s.planetX = VW + 50;
}

function makeStations(): Station[] {
  const arr: Station[] = [];
  for (let i = 0; i < 3; i++) {
    arr.push({ x: i * 140 + 60, kind: (i % 2) as 0 | 1 });
  }
  return arr;
}

function updateAmbient(s: State) {
  s.shootingCooldown--;
  if (s.shootingCooldown <= 0) {
    s.shooting.push({
      x: VW + 10,
      y: 10 + Math.random() * 50,
      vx: -3 - Math.random() * 1.5,
      vy: 1 + Math.random() * 0.8,
      life: 30,
    });
    s.shootingCooldown = 220 + Math.random() * 360;
  }
  for (const sh of s.shooting) {
    sh.x += sh.vx;
    sh.y += sh.vy;
    sh.life--;
  }
  s.shooting = s.shooting.filter((sh) => sh.life > 0 && sh.x > -20);
}

function updateParticles(s: State) {
  for (const p of s.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.life--;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
}

// ---------- RENDER ----------

export function render(ctx: CanvasRenderingContext2D, s: State) {
  // sky gradient (procedural bands)
  ctx.fillStyle = "#0b0b2a";
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = "#1a0d3a";
  ctx.fillRect(0, 60, VW, 50);
  ctx.fillStyle = "#2a1450";
  ctx.fillRect(0, 110, VW, GROUND_Y - 110);

  // nebula glow blob
  ctx.fillStyle = "rgba(255,46,136,0.10)";
  ctx.fillRect(40, 20, 120, 50);
  ctx.fillStyle = "rgba(62,240,255,0.07)";
  ctx.fillRect(180, 10, 110, 40);

  // planet
  drawPlanet(ctx, Math.round(s.planetX), 38, 18);

  // stars
  for (const star of s.stars) {
    const a = star.b * (0.55 + 0.45 * Math.sin(star.tw));
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    ctx.fillRect(Math.round(star.x), Math.round(star.y), 1, 1);
  }

  // shooting stars
  for (const sh of s.shooting) {
    const x = Math.round(sh.x);
    const y = Math.round(sh.y);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x, y, 2, 1);
    ctx.fillStyle = "rgba(62,240,255,0.55)";
    ctx.fillRect(x + 2, y, 3, 1);
    ctx.fillStyle = "rgba(62,240,255,0.25)";
    ctx.fillRect(x + 5, y, 4, 1);
  }

  // distant station silhouettes
  for (const st of s.stations) drawStation(ctx, Math.round(st.x), GROUND_Y - 6, st.kind, s.time);

  // mid mountains
  for (const m of s.midMountains) {
    drawMountain(ctx, Math.round(m.x), GROUND_Y, m.w, m.h, m.color);
  }
  // front mountains
  for (const m of s.frontMountains) {
    drawMountain(ctx, Math.round(m.x), GROUND_Y, m.w, m.h, m.color);
  }

  // ground
  ctx.fillStyle = "#2a1b4a";
  ctx.fillRect(0, GROUND_Y, VW, VH - GROUND_Y);
  ctx.fillStyle = "#7a3cff";
  ctx.fillRect(0, GROUND_Y, VW, 1);
  // ground stripes scrolling
  ctx.fillStyle = "#3e2470";
  const off = Math.floor(s.time * s.speed) % 12;
  for (let x = -off; x < VW; x += 12) {
    ctx.fillRect(x, GROUND_Y + 6, 6, 1);
    ctx.fillRect(x + 3, GROUND_Y + 14, 4, 1);
  }

  // obstacles
  for (const o of s.obstacles) drawObstacle(ctx, o);
  // collectibles
  for (const c of s.collectibles) drawCollectible(ctx, c);

  // particles
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // player
  if (s.phase !== "title") drawPlayer(ctx, s);
  else drawPlayer(ctx, s);

  // HUD
  drawHUD(ctx, s);

  // flash
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(s.flash / 6) * 0.6})`;
    ctx.fillRect(0, 0, VW, VH);
  }

  // scanlines
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < VH; y += 2) ctx.fillRect(0, y, VW, 1);

  // overlays
  if (s.phase === "title") drawTitle(ctx, s);
  if (s.phase === "over") drawGameOver(ctx, s);
}

function drawPlanet(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // simple filled circle via pixel scan
  ctx.fillStyle = "#ff2e88";
  for (let y = -r; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - dx, cy + y, dx * 2, 1);
  }
  // ring
  ctx.fillStyle = "#3ef0ff";
  ctx.fillRect(cx - r - 4, cy, (r + 4) * 2, 1);
  ctx.fillStyle = "#0b0b2a";
  for (let y = -r; y <= r; y++) {
    if (y === 0) continue;
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    if (Math.abs(y) <= 1) ctx.fillRect(cx - dx, cy + y, dx * 2, 1);
  }
  // re-draw planet body bottom half subtle shade
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let y = 0; y <= r; y++) {
    const dx = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - dx, cy + y, dx * 2, 1);
  }
}

function drawMountain(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  // triangle approx with horizontal lines
  for (let i = 0; i < h; i++) {
    const t = i / h;
    const rowW = Math.round(w * (1 - t));
    ctx.fillRect(x + Math.round((w - rowW) / 2), baseY - i - 1, rowW, 1);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Obstacle) {
  const x = Math.round(o.x);
  const bobY = o.kind === "drone" || o.kind === "ufo"
    ? Math.round(Math.sin(o.bob ?? 0) * 1.5)
    : 0;
  const y = Math.round(o.y) + bobY;
  if (o.kind === "rock") {
    ctx.fillStyle = "#5a3a8a";
    ctx.fillRect(x, y + 2, o.w, o.h - 2);
    ctx.fillStyle = "#7a5abc";
    ctx.fillRect(x + 1, y, o.w - 2, 3);
    ctx.fillStyle = "#3ef0ff";
    ctx.fillRect(x + 2, y + 4, 1, 1);
  } else if (o.kind === "crystal") {
    ctx.fillStyle = "#3ef0ff";
    ctx.fillRect(x + 2, y, 4, o.h);
    ctx.fillStyle = "#a8f8ff";
    ctx.fillRect(x + 3, y + 1, 2, o.h - 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 3, y + 2, 1, 1);
  } else if (o.kind === "spikes") {
    // base
    ctx.fillStyle = "#1a0e3a";
    ctx.fillRect(x, y + 4, o.w, 2);
    // triangle teeth
    for (let i = 0; i < o.w; i += 4) {
      ctx.fillStyle = "#c0c0d8";
      ctx.fillRect(x + i, y + 3, 3, 1);
      ctx.fillRect(x + i + 1, y + 1, 1, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + i + 1, y + 1, 1, 1);
    }
  } else if (o.kind === "alien") {
    // 4-legged ground walker
    const step = Math.floor((o.bob ?? 0) * 0.8) % 2;
    // body
    ctx.fillStyle = "#6cff7a";
    ctx.fillRect(x + 1, y + 4, 8, 6);
    // head
    ctx.fillStyle = "#9cff9c";
    ctx.fillRect(x + 2, y, 6, 5);
    // eye
    const blink = (o.eye ?? 0) < 4;
    ctx.fillStyle = blink ? "#0e0726" : "#ffffff";
    ctx.fillRect(x + 3, y + 2, 4, 2);
    if (!blink) {
      ctx.fillStyle = "#ff2e88";
      ctx.fillRect(x + 4, y + 2, 2, 2);
      ctx.fillStyle = "#0e0726";
      ctx.fillRect(x + 5, y + 2, 1, 1);
    }
    // teeth
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 3, y + 4, 1, 1);
    ctx.fillRect(x + 6, y + 4, 1, 1);
    // legs
    ctx.fillStyle = "#2d8a3a";
    if (step === 0) {
      ctx.fillRect(x + 1, y + 10, 2, 4);
      ctx.fillRect(x + 7, y + 10, 2, 3);
      ctx.fillRect(x + 4, y + 10, 1, 4);
    } else {
      ctx.fillRect(x + 1, y + 10, 2, 3);
      ctx.fillRect(x + 7, y + 10, 2, 4);
      ctx.fillRect(x + 5, y + 10, 1, 4);
    }
  } else if (o.kind === "ufo") {
    // saucer with rotating lights
    ctx.fillStyle = "#3ef0ff";
    ctx.fillRect(x + 3, y, 10, 3); // dome
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 5, y + 1, 3, 1);
    ctx.fillStyle = "#c0c0d8";
    ctx.fillRect(x + 1, y + 3, 14, 3); // disc body
    ctx.fillStyle = "#7a7aa0";
    ctx.fillRect(x, y + 5, 16, 2);
    // rotating underside lights
    const sp = o.spin ?? 0;
    for (let i = 0; i < 4; i++) {
      const on = ((i + Math.floor(sp / 2)) % 2) === 0;
      ctx.fillStyle = on ? "#ffd23e" : "#7a0030";
      ctx.fillRect(x + 2 + i * 4, y + 6, 2, 1);
    }
    // beam
    ctx.fillStyle = "rgba(62,240,255,0.15)";
    ctx.fillRect(x + 6, y + 7, 4, 4);
  } else if (o.kind === "missile") {
    // body
    ctx.fillStyle = "#c0c0d8";
    ctx.fillRect(x, y, o.w - 2, 4);
    // nose cone
    ctx.fillStyle = "#ff2e88";
    ctx.fillRect(x, y + 1, 2, 2);
    // tip flash
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y + 1, 1, 1);
    // fin
    ctx.fillStyle = "#7a7aa0";
    ctx.fillRect(x + o.w - 4, y - 1, 2, 1);
    ctx.fillRect(x + o.w - 4, y + 4, 2, 1);
    // thruster flame
    const f = (o.spin ?? 0) % 2;
    ctx.fillStyle = "#ffd23e";
    ctx.fillRect(x + o.w - 2, y + 1, 2 + f, 2);
    ctx.fillStyle = "#ff2e88";
    ctx.fillRect(x + o.w, y + 1, 1 + f, 2);
  } else {
    // drone
    ctx.fillStyle = "#c0c0d8";
    ctx.fillRect(x, y + 2, o.w, 4);
    ctx.fillStyle = "#7a7aa0";
    ctx.fillRect(x, y + 6, o.w, 2);
    ctx.fillStyle = "#ff2e88";
    ctx.fillRect(x + 5, y, 4, 2);
    const blink = (o.eye ?? 0) < 4;
    ctx.fillStyle = blink ? "#7a0030" : "#ff2e88";
    ctx.fillRect(x + 3, y + 3, 2, 2);
    if (!blink) {
      ctx.fillStyle = "#ffd23e";
      ctx.fillRect(x + 3, y + 3, 1, 1);
    }
    const ch = o.charge ?? 0;
    if (ch > 0) {
      const charging = ch < 22;
      if (charging) {
        if ((ch >> 1) % 2 === 0) {
          ctx.fillStyle = "#ffd23e";
          ctx.fillRect(x + 6, y + 8, 2, 2);
        }
      } else {
        ctx.fillStyle = "#ff2e88";
        ctx.fillRect(x + 6, y + 8, 2, 8);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x + 6, y + 8, 2, 2);
      }
    }
  }
}

function drawStation(ctx: CanvasRenderingContext2D, x: number, baseY: number, kind: 0 | 1, time: number) {
  ctx.fillStyle = "#0e0726";
  if (kind === 0) {
    ctx.fillRect(x, baseY - 18, 2, 18);
    ctx.fillRect(x - 3, baseY - 6, 8, 6);
    ctx.fillRect(x - 1, baseY - 22, 4, 4);
    if (Math.floor(time / 20) % 2 === 0) {
      ctx.fillStyle = "#ff2e88";
      ctx.fillRect(x, baseY - 23, 2, 1);
    }
  } else {
    ctx.fillRect(x - 6, baseY - 8, 14, 8);
    ctx.fillRect(x - 4, baseY - 12, 10, 4);
    ctx.fillRect(x - 2, baseY - 14, 6, 2);
    ctx.fillRect(x, baseY - 20, 2, 6);
    if (Math.floor(time / 24) % 2 === 0) {
      ctx.fillStyle = "#3ef0ff";
      ctx.fillRect(x, baseY - 21, 2, 1);
    }
  }
}

function drawCollectible(ctx: CanvasRenderingContext2D, c: Collectible) {
  const x = Math.round(c.x);
  const y = Math.round(c.y + Math.sin(c.pulse) * 1.5);
  ctx.fillStyle = "#3ef0ff";
  ctx.fillRect(x - 2, y - 3, 4, 6);
  ctx.fillRect(x - 3, y - 1, 6, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 1, y - 2, 2, 1);
  // glow
  ctx.fillStyle = "rgba(62,240,255,0.25)";
  ctx.fillRect(x - 4, y - 4, 8, 8);
}

function drawPlayer(ctx: CanvasRenderingContext2D, s: State) {
  const sliding = s.sliding && s.onGround;
  const x = PLAYER_X;
  const y = sliding ? GROUND_Y - 10 : Math.round(s.py);
  const SUIT = "#e8ecff";
  const SUIT_SHADE = "#9aa0d8";
  const ARMOR = "#7a3cff";
  const ARMOR_DARK = "#3a1f6e";
  const VISOR = "#3ef0ff";
  const VISOR_LIGHT = "#a8f8ff";
  const ACCENT = "#ff2e88";

  if (sliding) {
    // sleek slide pose, head forward
    // body
    ctx.fillStyle = SUIT;
    ctx.fillRect(x - 1, y + 3, 11, 5);
    ctx.fillStyle = SUIT_SHADE;
    ctx.fillRect(x - 1, y + 7, 11, 1);
    // chest light
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x + 3, y + 5, 1, 1);
    // helmet (front)
    ctx.fillStyle = ARMOR;
    ctx.fillRect(x + 7, y + 1, 4, 5);
    ctx.fillStyle = VISOR;
    ctx.fillRect(x + 8, y + 2, 3, 2);
    ctx.fillStyle = VISOR_LIGHT;
    ctx.fillRect(x + 8, y + 2, 1, 1);
    // backpack/tank
    ctx.fillStyle = ARMOR_DARK;
    ctx.fillRect(x - 3, y + 3, 3, 4);
    // jet flame back
    const f = s.flameFrame;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x - 6 - (f & 1), y + 4, 3 + (f & 1), 2);
    ctx.fillStyle = "#ffd23e";
    ctx.fillRect(x - 5, y + 5, 2, 1);
    return;
  }

  // standing/running astronaut
  // backpack (behind body)
  ctx.fillStyle = ARMOR_DARK;
  ctx.fillRect(x, y + 6, 2, 6);
  ctx.fillStyle = ARMOR;
  ctx.fillRect(x, y + 7, 1, 4);

  // torso (suit with armor plate)
  ctx.fillStyle = SUIT;
  ctx.fillRect(x + 2, y + 6, 6, 7);
  ctx.fillStyle = ARMOR;
  ctx.fillRect(x + 2, y + 6, 6, 2); // shoulder armor
  ctx.fillStyle = SUIT_SHADE;
  ctx.fillRect(x + 7, y + 8, 1, 5); // body shade right
  // chest reactor
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x + 4, y + 9, 2, 2);
  ctx.fillStyle = "#ffd23e";
  ctx.fillRect(x + 4, y + 9, 1, 1);

  // belt
  ctx.fillStyle = ARMOR_DARK;
  ctx.fillRect(x + 2, y + 12, 6, 1);

  // helmet
  ctx.fillStyle = ARMOR;
  ctx.fillRect(x + 2, y, 6, 1);
  ctx.fillStyle = SUIT;
  ctx.fillRect(x + 2, y + 1, 6, 5);
  // visor with parallax highlight
  ctx.fillStyle = VISOR;
  ctx.fillRect(x + 3, y + 2, 4, 3);
  ctx.fillStyle = VISOR_LIGHT;
  ctx.fillRect(x + 3, y + 2, 1, 1);
  ctx.fillRect(x + 6, y + 4, 1, 1);
  // antenna
  ctx.fillStyle = SUIT_SHADE;
  ctx.fillRect(x + 4, y - 2, 1, 2);
  ctx.fillStyle = ACCENT;
  if (((s.time >> 3) & 1) === 0) ctx.fillRect(x + 4, y - 2, 1, 1);

  // arm (static, tucked)
  ctx.fillStyle = SUIT;
  ctx.fillRect(x + 7, y + 7, 2, 4);

  // legs (4-frame look via runFrame + onGround)
  ctx.fillStyle = ARMOR;
  if (s.onGround) {
    if (s.runFrame === 0) {
      ctx.fillRect(x + 2, y + 13, 2, 3);
      ctx.fillRect(x + 6, y + 13, 2, 2);
      ctx.fillStyle = ARMOR_DARK;
      ctx.fillRect(x + 2, y + 15, 2, 1);
    } else {
      ctx.fillRect(x + 2, y + 13, 2, 2);
      ctx.fillRect(x + 6, y + 13, 2, 3);
      ctx.fillStyle = ARMOR_DARK;
      ctx.fillRect(x + 6, y + 15, 2, 1);
    }
  } else {
    // tucked jump pose
    ctx.fillRect(x + 2, y + 13, 3, 2);
    ctx.fillRect(x + 5, y + 12, 3, 2);
  }

  // jet flame when jumping
  if (!s.onGround && s.vy < 0) {
    const f = s.flameFrame;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(x, y + 12, 2, 3 + (f % 2));
    ctx.fillStyle = "#ffd23e";
    ctx.fillRect(x, y + 13, 2, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y + 13, 1, 1);
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, s: State) {
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textBaseline = "top";
  ctx.fillStyle = "#3ef0ff";
  ctx.fillText(`SCORE ${String(Math.floor(s.score)).padStart(5, "0")}`, 4, 4);
  ctx.textAlign = "right";
  ctx.fillStyle = "#ff2e88";
  ctx.fillText(`HI ${String(s.highScore).padStart(5, "0")}`, VW - 4, 4);
  ctx.textAlign = "left";
}

function drawTitle(ctx: CanvasRenderingContext2D, s: State) {
  ctx.fillStyle = "rgba(11,11,42,0.55)";
  ctx.fillRect(0, 0, VW, VH);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = '14px "Press Start 2P", monospace';
  ctx.fillStyle = "#ff2e88";
  ctx.fillText("ASS", VW / 2 + 1, 56 + 1);
  ctx.fillStyle = "#3ef0ff";
  ctx.fillText("ASS", VW / 2, 56);

  ctx.fillStyle = "#ff2e88";
  ctx.fillText("DASH", VW / 2 + 1, 76 + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("DASH", VW / 2, 76);

  ctx.font = '5px "Press Start 2P", monospace';
  ctx.fillStyle = "#9a9ac8";
  ctx.fillText("SPACE / TAP TO JUMP", VW / 2, 110);
  ctx.fillText("DOWN / SWIPE TO SLIDE", VW / 2, 122);

  if (Math.floor(s.time / 30) % 2 === 0) {
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = "#3ef0ff";
    ctx.fillText("PRESS SPACE TO START", VW / 2, 142);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawGameOver(ctx: CanvasRenderingContext2D, s: State) {
  ctx.fillStyle = "rgba(11,11,42,0.7)";
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = '12px "Press Start 2P", monospace';
  ctx.fillStyle = "#ff2e88";
  ctx.fillText("GAME OVER", VW / 2 + 1, 60 + 1);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("GAME OVER", VW / 2, 60);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = "#3ef0ff";
  ctx.fillText(`SCORE ${Math.floor(s.score)}`, VW / 2, 88);
  ctx.fillStyle = "#ff2e88";
  ctx.fillText(`BEST  ${s.highScore}`, VW / 2, 102);

  if (Math.floor(s.time / 30) % 2 === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PRESS SPACE TO RETRY", VW / 2, 130);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}