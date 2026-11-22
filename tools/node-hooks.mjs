// Lets Node load the site's browser modules: "zod" → vendor/zod.js, "@/x" → src/x (same as the import map in index.html).
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "zod") return { url: new URL("../vendor/zod.js", import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith("@/")) return { url: new URL("../src/" + specifier.slice(2), import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
}
