// Drawing kit for the word pictures Claude draws for a book package (Import_Book.md, step 4 / lesson rule 2).
//
// One look for every picture — a cute, chunky "sticker" cartoon that young children like:
//   • one warm dark-brown outline (INK), round joins, 4–5 px outside, 2.5–3 px for inside lines;
//   • soft gradients instead of flat colour (soft(), ball()), a white gloss on shiny things (gloss(), shine());
//   • a soft shadow on the ground under things that stand (shadow());
//   • every animal and person: big head, small round body, big shiny eyes (eye()), rosy cheeks (cheek()),
//     a small smile (smile(), catMouth(), openSmile()) — friendly, looking at the child;
//   • bubble numbers drawn as paths (digits()), so they look the same on every device;
//   • tube() for tails, arms, ropes; merged() for curly hair, clouds, popcorn (one outline around many shapes).
//
// Usage in resources/.work/<bookId>/draw-pictures.mjs:
//   import { svg, soft, ball, O, O3, INK, eye, cheek, smile, shadow, ... } from "../../../tools/draw-kit.mjs";
//   P.apple = svg(shadow(128, 228, 70) + `<circle cx="128" cy="140" r="80" fill="${ball("#e53935")}" ${O}/>` + eye(100, 130, 12));
// Every helper that needs a gradient or a clip path adds it to the picture being built; svg() writes them
// into <defs> and starts the next picture. Build one picture per svg() call (the SVG stays inside the
// allowed elements of src/lib/safeSvg.js: no text except digits, no images, no links, no scripts).

export const INK = "#3b2a20";
export const line = (w = 4.5, c = INK) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
/** Outside outline. */
export const O = line(4.5);
/** Inside lines and small parts. */
export const O3 = line(3);
export const O2 = line(2.2);

let defs = [];
let count = 0;
const nextId = (p) => `${p}${++count}`;

/** Wraps a picture: 256 × 256, with the gradients / clip paths its parts asked for. */
export function svg(body) {
  const d = defs.join("");
  defs = [];
  count = 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${d ? `<defs>${d}</defs>` : ""}${body}</svg>`.replace(/\s+\/>/g, "/>");
}

/* ----------------------------------------- colour ----------------------------------------- */

const hex = (c) => {
  const h = c.replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};
/** Mixes two colours (t = 0 → a, 1 → b). */
export function mix(a, b, t) {
  const [x, y] = [hex(a), hex(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
export const light = (c, t = 0.3) => mix(c, "#ffffff", t);
export const dark = (c, t = 0.2) => mix(c, "#1a0f08", t);

/** Linear gradient from `a` to `b` (top → bottom unless dir = [x1, y1, x2, y2]); returns the fill value. */
export function lin(a, b, dir = [0, 0, 0, 1], mid) {
  const id = nextId("g");
  const [x1, y1, x2, y2] = dir;
  defs.push(`<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/>${mid ? `<stop offset=".5" stop-color="${mid}"/>` : ""}<stop offset="1" stop-color="${b}"/></linearGradient>`);
  return `url(#${id})`;
}
/** Radial gradient: light spot (up-left by default) → colour → darker edge; returns the fill value. */
export function rad(a, b, c = b, o = {}) {
  const id = nextId("g");
  defs.push(`<radialGradient id="${id}" cx="${o.cx ?? 0.38}" cy="${o.cy ?? 0.3}" r="${o.r ?? 0.78}"><stop offset="0" stop-color="${a}"/><stop offset="${o.at ?? 0.55}" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`);
  return `url(#${id})`;
}
/**
 * Overlay that makes a flat round shape look round (shine up-left, shade at the edge):
 * draw the same circle/ellipse again on top with fill="${roundShade()}".
 */
export function roundShade(o = {}) {
  const id = nextId("g");
  defs.push(`<radialGradient id="${id}" cx="${o.cx ?? 0.36}" cy="${o.cy ?? 0.3}" r="${o.r ?? 0.8}"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1a0f08" stop-opacity=".25"/></radialGradient>`);
  return `url(#${id})`;
}
/** A wobbly round outline (cheese, cream, bushes): radius r ± amp, n bumps. */
export function blob(cx, cy, r, amp = 6, n = 12, phase = 0, ry = r) {
  const N = n * 2;
  const pts = Array.from({ length: N }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / N;
    const k = i % 2 ? 1 - amp / r : 1 + amp / r;
    return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * ry * k];
  });
  const mid = (p, q) => `${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  let d = `M${mid(pts[N - 1], pts[0])}`;
  for (let i = 0; i < N; i++) d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mid(pts[i], pts[(i + 1) % N])}`;
  return d + " Z";
}
/** A leaf (length len, turned rot degrees, base at x, y). */
export function leaf(x, y, len, rot, c = "#43a047") {
  const w = len * 0.36;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 C${len * 0.3} ${-w} ${len * 0.75} ${-w} ${len} 0 C${len * 0.75} ${w} ${len * 0.3} ${w} 0 0 Z" fill="${soft(c)}" ${O2}/><path d="M3 0 H${len * 0.8}" stroke="${dark(c, 0.3)}" stroke-width="2" stroke-linecap="round"/></g>`;
}
/** The usual fill: one colour, a little lighter at the top. */
export const soft = (c, t = 0.3) => lin(light(c, t), dark(c, 0.04));
/** For round, shiny things (balls, fruit, heads): light spot up-left, darker edge. */
export const ball = (c, o) => rad(light(c, 0.45), c, dark(c, 0.18), o);

/** A clip path made of the given shapes; returns the attribute to put on a <g>. */
export function clip(shapes) {
  const id = nextId("c");
  defs.push(`<clipPath id="${id}">${shapes}</clipPath>`);
  return `clip-path="url(#${id})"`;
}

/* ------------------------------------------ parts ------------------------------------------ */

/** Thick line with an outline (tails, ropes, arms, legs, tubes of a bike). */
export const tube = (d, c, w = 10) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Several shapes outlined as ONE silhouette (curly hair, clouds, popcorn): outline pass, then fill pass — no lines inside. */
export const merged = (shapes, fill, w = 9) => `<g fill="none" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round">${shapes}</g><g fill="${fill}">${shapes}</g>`;
/** Circles from [x, y, r] triples (no fill: put them in a <g fill=…> or merged()). */
export const circles = (pts) => pts.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");

/* --------------------------------------- finishing --------------------------------------- */

/** Soft shadow on the ground. */
export const shadow = (cx, cy, rx, ry = Math.max(6, rx * 0.14)) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}" opacity=".13"/>`;
/** A white gloss line along a path. */
export const gloss = (d, w = 6, op = 0.7) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
/** A white shine spot. */
export const shine = (cx, cy, rx, ry = rx * 0.6, rot = -30, op = 0.75) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${op}" transform="rotate(${rot} ${cx} ${cy})"/>`;
/** A four-point twinkle (for magic, shine, "new!"). */
export function sparkle(cx, cy, r, fill = "#fff59d", outline = true) {
  const k = r * 0.28;
  return `<path d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z" fill="${fill}"${outline ? ` ${O2}` : ""}/>`;
}
/** A five-point star with rounded corners. */
export function star(cx, cy, r, fill = "#ffd43b", o = O3) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}" ${o}/>`;
}

/* ----------------------------------------- faces ----------------------------------------- */

/** A big shiny cartoon eye: dark brown, two white sparkles. */
export function eye(cx, cy, r = 10, o = {}) {
  const ry = r * (o.tall ?? 1.15);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="${rad("#8a5a3c", "#2b1a10", "#140b06", { cx: 0.5, cy: 0.72, r: 0.75, at: 0.5 })}"/>` +
    `<circle cx="${cx + r * 0.3}" cy="${cy - ry * 0.4}" r="${r * 0.4}" fill="#fff"/>` +
    `<circle cx="${cx - r * 0.38}" cy="${cy + ry * 0.38}" r="${r * 0.17}" fill="#fff" opacity=".9"/>`;
}
/** A happy closed eye (^). */
export const happyEye = (cx, cy, w = 9) => `<path d="M${cx - w} ${cy + w * 0.35} Q${cx} ${cy - w * 0.8} ${cx + w} ${cy + w * 0.35}" fill="none" ${line(3.4)}/>`;
/** Rosy cheek. */
export const cheek = (cx, cy, r = 9) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.62}" fill="#ff7b9c" opacity=".45"/>`;
/** Small smile (u). */
export const smile = (cx, cy, w = 9) => `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * 0.95} ${cx + w} ${cy}" fill="none" ${line(3)}/>`;
/** Cat / fox mouth (ω) under the nose. */
export const catMouth = (cx, cy, w = 8) => `<path d="M${cx - w} ${cy + 1} Q${cx - w / 2} ${cy + w * 0.8} ${cx} ${cy} Q${cx + w / 2} ${cy + w * 0.8} ${cx + w} ${cy + 1}" fill="none" ${line(2.8)}/>`;
/** Open happy mouth with a tongue (D). */
export function openSmile(cx, cy, w = 12) {
  const h = w * 0.95;
  const m = `M${cx - w} ${cy} Q${cx} ${cy + 2} ${cx + w} ${cy} Q${cx + w * 0.9} ${cy + h} ${cx} ${cy + h} Q${cx - w * 0.9} ${cy + h} ${cx - w} ${cy} Z`;
  return `<path d="${m}" fill="#8e2a2a"/><g ${clip(`<path d="${m}"/>`)}><ellipse cx="${cx}" cy="${cy + h}" rx="${w * 0.62}" ry="${h * 0.5}" fill="#ff8a8a"/></g><path d="${m}" fill="none" ${line(2.8)}/>`;
}
/** Eyebrow arc. */
export const brow = (cx, cy, w = 8, tilt = 0) => `<path d="M${cx - w} ${cy + tilt} Q${cx} ${cy - w * 0.5} ${cx + w} ${cy - tilt}" fill="none" ${line(3)}/>`;

/* ----------------------------------------- scenes ----------------------------------------- */

/** A picture of a place: rounded square with its own background (sky gradient by default). */
export function scene(bg, inner) {
  const box = `<rect x="10" y="10" width="236" height="236" rx="30"/>`;
  return `<g ${clip(box)}><rect width="256" height="256" fill="${bg}"/>${inner}</g><rect x="10" y="10" width="236" height="236" rx="30" fill="none" ${O}/>`;
}
/** Sky for scenes. */
export const sky = (top = "#7cc8ff", bottom = "#e3f5ff") => lin(top, bottom);
/** Fluffy white cloud (centre x, y; size s). */
export function cloud(x, y, s = 1, outline = true) {
  const c = (dx, dy, r) => `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${r * s}"/>`;
  const parts = c(-24, 4, 17) + c(-4, -8, 23) + c(20, 0, 18) + `<rect x="${x - 40 * s}" y="${y}" width="${78 * s}" height="${20 * s}" rx="${10 * s}"/>`;
  const fill = lin("#ffffff", "#e4f2ff");
  return (outline ? `<g fill="none" ${line(5 * Math.min(1, s + 0.2), "#9cc9ec")}>${parts}</g>` : "") + `<g fill="${fill}">${parts}</g>`;
}
/** Smiling sun. */
export function sun(cx, cy, r = 24, face = true) {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    const [x1, y1, x2, y2] = [cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7), cx + Math.cos(a) * (r + 17), cy + Math.sin(a) * (r + 17)];
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }).join(" ");
  return `<path d="${rays}" stroke="#ffb300" stroke-width="6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${rad("#fffbd0", "#ffd84d", "#ffb300")}" ${O3}/>` +
    (face ? `${happyEye(cx - r * 0.35, cy - r * 0.05, r * 0.16)}${happyEye(cx + r * 0.35, cy - r * 0.05, r * 0.16)}${smile(cx, cy + r * 0.3, r * 0.28)}${cheek(cx - r * 0.55, cy + r * 0.25, r * 0.17)}${cheek(cx + r * 0.55, cy + r * 0.25, r * 0.17)}` : "");
}
/** Round tree. */
export function tree(x, y, s = 1, leaf = "#4caf50") {
  return `<path d="M${x - 6 * s} ${y} L${x - 5 * s} ${y - 34 * s} H${x + 5 * s} L${x + 6 * s} ${y} Z" fill="${soft("#8d5a3b")}" ${O3}/>` +
    `<path d="M${x - 30 * s} ${y - 40 * s} C${x - 44 * s} ${y - 58 * s} ${x - 30 * s} ${y - 84 * s} ${x - 10 * s} ${y - 80 * s} C${x - 4 * s} ${y - 98 * s} ${x + 26 * s} ${y - 96 * s} ${x + 28 * s} ${y - 76 * s} C${x + 46 * s} ${y - 72 * s} ${x + 46 * s} ${y - 44 * s} ${x + 28 * s} ${y - 36 * s} C${x + 14 * s} ${y - 26 * s} ${x - 18 * s} ${y - 26 * s} ${x - 30 * s} ${y - 40 * s} Z" fill="${ball(leaf)}" ${O3}/>` +
    gloss(`M${x - 22 * s} ${y - 58 * s} Q${x - 18 * s} ${y - 74 * s} ${x - 4 * s} ${y - 76 * s}`, 4 * s, 0.55);
}
/** Grass tuft. */
export const tuft = (x, y, s = 1, c = "#5cb85c") => `<path d="M${x - 10 * s} ${y} Q${x - 9 * s} ${y - 12 * s} ${x - 14 * s} ${y - 18 * s} Q${x - 4 * s} ${y - 12 * s} ${x - 2 * s} ${y - 4 * s} Q${x} ${y - 16 * s} ${x + 2 * s} ${y - 22 * s} Q${x + 6 * s} ${y - 12 * s} ${x + 4 * s} ${y - 4 * s} Q${x + 8 * s} ${y - 12 * s} ${x + 14 * s} ${y - 16 * s} Q${x + 10 * s} ${y - 8 * s} ${x + 10 * s} ${y} Z" fill="${c}" ${O2}/>`;

/* ----------------------------------------- numbers ----------------------------------------- */

/** Skeleton of each digit in a 100 × 160 cell (drawn as a fat round line = bubble number). */
const DIGIT = {
  0: "M50 22 C20 22 18 60 18 82 C18 104 20 140 50 140 C80 140 82 104 82 82 C82 60 80 22 50 22 Z",
  1: "M30 46 L56 24 V140",
  2: "M22 50 C24 24 50 18 62 22 C84 28 86 54 72 72 L24 138 H84",
  3: "M24 40 C34 14 82 16 80 46 C78 70 56 76 46 78 C64 78 86 88 84 112 C82 146 34 150 20 124",
  4: "M68 140 V24 L20 104 H90",
  5: "M80 24 H36 L30 74 C42 64 86 62 86 104 C86 146 36 150 22 124",
  6: "M76 30 C60 16 24 28 22 84 C20 136 46 144 56 142 C80 140 86 122 86 108 C86 88 70 78 54 78 C38 78 24 92 22 104",
  7: "M20 24 H82 L44 140",
  8: "M50 80 C26 78 22 56 24 44 C28 24 72 24 76 44 C78 56 74 78 50 80 C24 82 18 104 20 116 C24 144 76 144 80 116 C82 104 76 82 50 80 Z",
  9: "M78 56 C76 36 62 24 48 24 C28 24 20 42 20 56 C20 72 32 86 50 86 C66 86 78 74 78 56 C78 104 72 140 34 136",
};
/**
 * A bubble number (digits only), centred in the picture: fat round strokes with an outline and a shine.
 * o.fill: colour; o.decor(maskedDraw): extra pattern inside the number — decor gets a function that
 * paints a colour only inside the number (e.g. dots, sprinkles, a lower half in another colour).
 */
export function digits(str, o = {}) {
  const w = o.width ?? 34;
  const cell = 100;
  const gap = o.gap ?? -6;
  const total = str.length * cell + (str.length - 1) * gap;
  const s = o.scale ?? Math.min(1.25, 230 / total, 1.3);
  const x0 = 128 - (total * s) / 2;
  const y0 = 128 - (160 * s) / 2 + 2;
  const paths = [...str].map((d, i) => `<path d="${DIGIT[d]}" transform="translate(${(x0 + i * (cell + gap) * s).toFixed(1)} ${y0.toFixed(1)}) scale(${s.toFixed(3)})"/>`).join("");
  const stroke = (c, wd, extra = "") => `<g fill="none" stroke="${c}" stroke-width="${wd}" stroke-linecap="round" stroke-linejoin="round" ${extra}>${paths}</g>`;
  const fill = o.fill ?? "#e53935";
  // Paint `c` inside the number, only where `shapes` are (a clip path of those shapes).
  const inside = (c, shapes) => `<g ${clip(shapes)}>${stroke(c, w)}</g>`;
  return shadow(128, 128 + 80 * s + 8, total * s * 0.42, 9) +
    stroke(INK, w + 9) +
    stroke(fill, w) +
    (o.decor ? o.decor(inside) : "") +
    `<g transform="translate(-3 -4)">${stroke("#fff", w * 0.18, `opacity=".55" stroke-dasharray="${(w * 0.9).toFixed(0)} 400"`)}</g>`;
}
/** Shapes helpers for digits() decor: dots and sprinkles spread over the picture. */
export const dotShapes = (pts, r) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("");
export const sprinkleShapes = (pts) => pts.map(([x, y, a]) => `<rect x="${x - 7}" y="${y - 2.6}" width="14" height="5.2" rx="2.6" transform="rotate(${a} ${x} ${y})"/>`).join("");
