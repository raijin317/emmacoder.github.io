/**
 * The sticker album: one page per theme. Stickers are earned in album order (one per STARS_PER_STICKER stars);
 * finishing a page wins that page's trophy, and the number of trophies is the child's level.
 * A child owns the first N stickers of the album (the `stickers` table keeps one row per sticker, in order).
 */
export const STARS_PER_STICKER = 5;
const e = (name, emoji) => ({ id: name.toLowerCase().replace(/[^a-z]+/g, "-"), name, emoji });
const robot = (name, look) => ({ id: `robot-${name.toLowerCase()}`, name, robot: look });
export const ALBUM = [
    { id: "land", title: "Animals on land", icon: "🦁", tone: "bg-orange-soft", stickers: [e("Lion", "🦁"), e("Elephant", "🐘"), e("Giraffe", "🦒"), e("Zebra", "🦓"), e("Panda", "🐼"), e("Kangaroo", "🦘"), e("Monkey", "🐒"), e("Fox", "🦊")] },
    { id: "sea", title: "Under the sea", icon: "🐠", tone: "bg-sky-soft", stickers: [e("Dolphin", "🐬"), e("Whale", "🐳"), e("Octopus", "🐙"), e("Crab", "🦀"), e("Turtle", "🐢"), e("Shark", "🦈"), e("Fish", "🐠"), e("Seal", "🦭")] },
    { id: "bugs", title: "Little bugs", icon: "🐞", tone: "bg-grass-soft", stickers: [e("Bee", "🐝"), e("Butterfly", "🦋"), e("Ladybug", "🐞"), e("Ant", "🐜"), e("Caterpillar", "🐛"), e("Cricket", "🦗"), e("Beetle", "🪲"), e("Snail", "🐌")] },
    { id: "vehicles", title: "Cars and trucks", icon: "🚗", tone: "bg-berry-soft", stickers: [e("Car", "🚗"), e("Bus", "🚌"), e("Fire truck", "🚒"), e("Ambulance", "🚑"), e("Police car", "🚓"), e("Tractor", "🚜"), e("Train", "🚂"), e("Bike", "🚲")] },
    {
        id: "robots",
        title: "Robot friends",
        icon: "🤖",
        tone: "bg-grape-soft",
        stickers: [
            robot("Beep", { color: "#4fc3f7", accent: "#ffc83d", head: "box", eyes: "round", antenna: "ball", mouth: "smile" }),
            robot("Bolt", { color: "#ff8a3d", accent: "#2b2d42", head: "box", eyes: "visor", antenna: "bolt", mouth: "grill" }),
            robot("Zippy", { color: "#66bb6a", accent: "#ff6b9a", head: "round", eyes: "round", antenna: "ball", mouth: "o", wheels: true }),
            robot("Gizmo", { color: "#9c6ade", accent: "#4fc3f7", head: "tv", eyes: "one", antenna: "none", mouth: "smile" }),
            robot("Sparky", { color: "#ffc83d", accent: "#ff6b9a", head: "round", eyes: "visor", antenna: "bolt", mouth: "smile" }),
            robot("Clank", { color: "#b0bec5", accent: "#ff8a3d", head: "box", eyes: "one", antenna: "ball", mouth: "grill", wheels: true }),
            robot("Pixel", { color: "#ff6b9a", accent: "#66bb6a", head: "tv", eyes: "round", antenna: "ball", mouth: "o" }),
            robot("Rusty", { color: "#d9480f", accent: "#ffc83d", head: "round", eyes: "one", antenna: "none", mouth: "smile", wheels: true }),
        ],
    },
    { id: "boats", title: "Boats", icon: "⛵", tone: "bg-sky-soft", stickers: [e("Sailboat", "⛵"), e("Speedboat", "🚤"), e("Motorboat", "🛥️"), e("Cruise ship", "🛳️"), e("Ferry", "⛴️"), e("Ship", "🚢"), e("Canoe", "🛶"), e("Anchor", "⚓")] },
    { id: "space", title: "Outer space", icon: "🚀", tone: "bg-grape-soft", stickers: [e("Rocket", "🚀"), e("UFO", "🛸"), e("Earth", "🌍"), e("Moon", "🌙"), e("Planet", "🪐"), e("Star", "⭐"), e("Comet", "☄️"), e("Satellite", "🛰️")] },
    { id: "farm", title: "On the farm", icon: "🐄", tone: "bg-grass-soft", stickers: [e("Cow", "🐄"), e("Pig", "🐖"), e("Sheep", "🐑"), e("Hen", "🐔"), e("Horse", "🐴"), e("Duck", "🦆"), e("Goat", "🐐"), e("Rabbit", "🐇")] },
    { id: "birds", title: "Birds", icon: "🦜", tone: "bg-sun-soft", stickers: [e("Owl", "🦉"), e("Penguin", "🐧"), e("Parrot", "🦜"), e("Flamingo", "🦩"), e("Eagle", "🦅"), e("Swan", "🦢"), e("Chick", "🐤"), e("Peacock", "🦚")] },
    { id: "fruit", title: "Yummy fruit", icon: "🍓", tone: "bg-berry-soft", stickers: [e("Strawberry", "🍓"), e("Apple", "🍎"), e("Banana", "🍌"), e("Watermelon", "🍉"), e("Grapes", "🍇"), e("Pineapple", "🍍"), e("Kiwi", "🥝"), e("Cherries", "🍒")] },
    { id: "treats", title: "Sweet treats", icon: "🍦", tone: "bg-orange-soft", stickers: [e("Ice cream", "🍦"), e("Donut", "🍩"), e("Cupcake", "🧁"), e("Cookie", "🍪"), e("Lollipop", "🍭"), e("Cake", "🍰"), e("Chocolate", "🍫"), e("Pancakes", "🥞")] },
    { id: "music", title: "Music time", icon: "🎸", tone: "bg-grape-soft", stickers: [e("Guitar", "🎸"), e("Drum", "🥁"), e("Piano", "🎹"), e("Trumpet", "🎺"), e("Violin", "🎻"), e("Saxophone", "🎷"), e("Banjo", "🪕"), e("Bell", "🔔")] },
    { id: "sports", title: "Sports", icon: "⚽", tone: "bg-grass-soft", stickers: [e("Soccer ball", "⚽"), e("Basketball", "🏀"), e("Football", "🏈"), e("Baseball", "⚾"), e("Tennis ball", "🎾"), e("Volleyball", "🏐"), e("Ping-pong", "🏓"), e("Skateboard", "🛹")] },
    { id: "weather", title: "Sky and weather", icon: "🌈", tone: "bg-sky-soft", stickers: [e("Sun", "☀️"), e("Rainbow", "🌈"), e("Cloud", "☁️"), e("Snowman", "⛄"), e("Rain", "🌧️"), e("Lightning", "⚡"), e("Snowflake", "❄️"), e("Umbrella", "☂️")] },
];
/** Every sticker id, in the order they are earned. */
export const STICKERS = ALBUM.flatMap((p) => p.stickers.map((s) => s.id));
const BY_ID = new Map(ALBUM.flatMap((p) => p.stickers.map((s) => [s.id, s])));
export const stickerById = (id) => BY_ID.get(id) ?? null;
/** Album progress for a child who owns the first `owned` stickers. */
export function albumState(owned) {
    let left = Math.max(0, Math.min(owned, STICKERS.length));
    const pages = ALBUM.map((page) => {
        const have = Math.min(left, page.stickers.length);
        left -= have;
        return { page, have, done: have === page.stickers.length };
    });
    const trophies = pages.filter((p) => p.done).map((p) => p.page.id);
    const current = Math.max(0, pages.findIndex((p) => !p.done));
    return { pages, trophies, level: trophies.length, current: pages.every((p) => p.done) ? pages.length - 1 : current, owned: Math.min(owned, STICKERS.length) };
}
/** The trophy's metal: bronze for the first pages, then silver, then gold. */
export function trophyTier(level) {
    return level >= 10 ? "gold" : level >= 5 ? "silver" : "bronze";
}
export const AVATARS = ["🐻", "🐰", "🐱", "🐶", "🐯", "🐸", "🐵", "🦊", "🐼", "🐨", "🦄", "🐥"];
