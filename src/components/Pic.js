import { html, Fragment } from "@/lib/html.js";
import { ApiImg } from "@/components/ApiImg.js";
import { createContext, useContext } from "react";
import { lookupPicture } from "@/lib/pictures.js";
const PicturesContext = createContext(null);
/** Gives every <Pic> below it the book pictures of the current unit. */
export function PicturesProvider({ pictures, children }) {
    return html`<${PicturesContext.Provider} value=${pictures ?? null}>${children}<//>`;
}
export function usePicture(word, emoji) {
    return lookupPicture(useContext(PicturesContext), word, emoji);
}
/**
 * The book's own picture of a word when there is one, otherwise the emoji.
 * Sized in `em`, so it follows the surrounding text size (`text-7xl` etc.) exactly like the emoji did.
 */
export function Pic({ emoji, word, className = "", scale = 1.15 }) {
    const url = usePicture(word, emoji);
    if (!url)
        return html`<${Fragment}>${emoji}<//>`;
    // The picture is cut from the book page stored in this browser; without it the emoji stays.
    return html`<${ApiImg} src=${url} fallback=${emoji ?? null} alt=${word ?? ""} draggable=${false} style=${{ width: `${scale}em`, height: `${scale}em` }} className=${`inline-block rounded-[0.14em] bg-white object-contain align-middle ${className}`} />`;
}
