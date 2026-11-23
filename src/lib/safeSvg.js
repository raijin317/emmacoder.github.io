/**
 * Pictures Claude draws for the unit words (lesson rule 2, Import_Book.md) are small SVG files.
 * Only drawing parts are allowed: shapes, groups, gradients, clip paths and soft filters, plus <text>
 * holding digits only (for number words). No scripts, links, embedded images, styles sheets or
 * outside references — the app shows them as <img> from the family's own data.
 * Pure string checks, so the same code runs in the browser and in tools/book-package.mjs.
 */
export const SVG_MAX_CHARS = 20000;

const ALLOWED = new Set([
  "svg", "g", "path", "circle", "ellipse", "rect", "polygon", "polyline", "line", "defs",
  "lineargradient", "radialgradient", "stop", "clippath", "mask", "text", "tspan",
  "filter", "fegaussianblur", "feoffset", "fedropshadow", "feflood", "fecomposite", "femerge", "femergenode", "feblend",
]);

/** Problems found in an SVG drawing ([] = safe). */
export function svgProblems(svg) {
  const out = [];
  if (typeof svg !== "string") return ["not text"];
  const s = svg.trim();
  if (s.length > SVG_MAX_CHARS) out.push(`too big (${s.length} characters, max ${SVG_MAX_CHARS})`);
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>$/i.test(s)) out.push("must start with <svg and end with </svg>");
  if (!/\sviewBox\s*=\s*["'][\d.\s-]+["']/.test(s)) out.push("needs a viewBox");
  if (/<!|<\?/.test(s)) out.push("no <!DOCTYPE>, <!ENTITY>, comments or <?…?>");
  if (/\son[a-z]+\s*=/i.test(s)) out.push("no event handlers (on…=)");
  if (/(?:^|[\s:])href\s*=/i.test(s)) out.push("no links (href)");
  if (/url\(\s*['"]?\s*(?!#)/i.test(s)) out.push("url(…) may only point inside the drawing (url(#id))");
  if (/javascript:|data:|@import|expression\(/i.test(s)) out.push("no javascript:, data:, @import");
  for (const m of s.matchAll(/<\/?\s*([a-zA-Z][\w:.-]*)/g)) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED.has(tag)) {
      out.push(`<${m[1]}> is not allowed`);
      break;
    }
  }
  // The only visible text allowed: digits inside <text>/<tspan> (number words).
  const loose = s.replace(/<[^>]*>/g, " ").replace(/&#?\w+;/g, " ");
  if (/[^\s\d]/.test(loose)) out.push("no letters or words in the picture (digits only, for numbers)");
  if (/<text\b/i.test(s) && !/<text\b[^>]*>\s*(?:<tspan\b[^>]*>)?\s*\d{1,3}\s*(?:<\/tspan>)?\s*<\/text>/i.test(s)) out.push("<text> may only hold a number");
  return [...new Set(out)];
}

/** The drawing ready to show: xmlns and a size are added when they are missing. */
export function normalizeSvg(svg) {
  let s = svg.trim();
  if (!/\sxmlns\s*=/.test(s.slice(0, 300))) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/^<svg[^>]*\swidth\s*=/i.test(s)) s = s.replace(/^<svg/i, '<svg width="256"');
  if (!/^<svg[^>]*\sheight\s*=/i.test(s)) s = s.replace(/^<svg/i, '<svg height="256"');
  return s;
}
