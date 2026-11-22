/**
 * JSX without a build step: `html` is htm bound to React.createElement, so
 *   html`<${Button} onClick=${go}>Hi<//>`  ===  <Button onClick={go}>Hi</Button>
 * (components go in ${…}, `<//>` closes a component, text and attributes work like JSX).
 */
import { createElement, Fragment } from "react";
import htm from "htm";

export const html = htm.bind(createElement);
export { Fragment };
