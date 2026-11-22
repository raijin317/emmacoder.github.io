/** <Link href="/learn"> for the hash router (renders <a href="#/learn">). */
import { html } from "@/lib/html.js";
import { hrefFor } from "./navigation.js";

export default function Link({ href, prefetch, replace, scroll, children, onClick, ...rest }) {
  const target = hrefFor(href);
  const click = (e) => {
    onClick?.(e);
    // Same-tab navigation to the top of the new screen (like Next.js).
    if (!e.defaultPrevented && !rest.target && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0 && scroll !== false) {
      setTimeout(() => window.scrollTo(0, 0), 0);
    }
  };
  return html`<a href=${target} onClick=${click} ...${rest}>${children}</a>`;
}
