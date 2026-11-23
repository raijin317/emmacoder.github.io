/**
 * Makes a picture the parent chose small enough to keep in this browser's data: at most `max` px on its
 * longest side, as WEBP (PNG where the browser can't make WEBP). Returns a data URL.
 */
export async function shrinkImage(file, max = 480) {
    if (!file.type.startsWith("image/"))
        throw new Error("Please choose a picture file (PNG, JPG, WEBP, GIF or SVG).");
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error("This picture can't be opened — please choose another one."));
            i.src = url;
        });
        const w0 = img.naturalWidth || max;
        const h0 = img.naturalHeight || max;
        const k = Math.min(1, max / Math.max(w0, h0));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w0 * k));
        canvas.height = Math.max(1, Math.round(h0 * k));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL("image/webp", 0.86);
        return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
    }
    finally {
        URL.revokeObjectURL(url);
    }
}
