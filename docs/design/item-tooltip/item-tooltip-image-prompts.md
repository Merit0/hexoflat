# ItemTooltip — промпти для генерації арту (форма A · Гекс-герб)

Генератори псують кирилицю — з концепту беремо лише матеріал, світіння, пропорції; текст завжди з коду. Для іншої рідкості замініть `#F2A93B` на колір рідкості.

## 1. Концепт усієї підказки

```
Game UI concept art, a single item tooltip panel for a dark-fantasy hex-based board game, front view, centered on a plain near-black background (#0D0C0A).

Shape: tall vertical panel about 360x600 px proportions. The TOP edge rises to a single central point like the roof of a hexagon (shallow 30px peak), the sides are straight vertical, the two BOTTOM corners are cut diagonally (chamfered). No rounded corners.

Frame: thin forged metal border in warm amber-gold (#F2A93B), slightly worn, with subtle engraved line detail; a faint amber inner glow along the top edge only, fading downward.

Crest: a hexagonal medallion sits ON the top peak, breaking the frame line, half outside the panel. Medallion = amber-gold hex rim, dark inner hex, with a simple line-art sword icon inside.

Body: very dark smoky brown-black (#14120E) with a soft radial amber glow behind the header. Layout, top to bottom: small spaced-caps rarity line; large item name in an elegant small-caps serif, amber; grey subtitle; a thin divider; big bold number "3–5" with a small "DAMAGE" label beside it; two short bonus lines in soft pale blue; an inset dark card with a skill name and a small teal pill-shaped cost badge; one italic flavor line in muted gold; a darker footer strip with small stats and a keyboard-key hint.

Style: clean readable modern game UI, crisp vector-like edges, subtle texture, not cluttered, no characters, no photo background. Inspired by premium ARPG item tooltips but original, with a hexagon motif. High resolution, sharp text areas.
```

## 2. Порожня рамка як ассет (3-slice: верх / середина / низ)

```
Game UI asset, an EMPTY tooltip frame only, no text, no icons inside, on a transparent background (PNG with alpha).

Shape: vertical panel, top edge rises to a single shallow central point (hexagon roof), straight vertical sides, chamfered bottom corners. A hexagonal medallion socket (empty) sits on the top point, half outside the frame.

Material: forged dark metal frame with a warm amber-gold edge (#F2A93B), subtle engraving, slightly worn; interior is a flat dark translucent fill (#14120E, ~85% opacity) with very soft texture. Even lighting, front view, no perspective, no drop shadow. Clean edges suitable for slicing into top cap, stretchable middle and bottom cap.
```
