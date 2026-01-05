import type { HexObjectModel, HexObjectKind } from "@/models/hexobject-model";
import { coordinateKey } from "@/utils/hex-utils";
import type { IHexTile } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";


export function objectFromTile(tile: IHexTile): HexObjectModel | null {
    if (tile.tileType !== "resource") return null;

    const res: any = (tile as any).resource;
    if (!res) return null;

    const kind = tile.resource?.kind as HexObjectKind | undefined;
    if (!kind) return null;

    const spritePath =
        typeof res.imagePath === "string"
            ? res.imagePath
            : Array.isArray(res.imagePaths) && res.imagePaths.length
                ? res.imagePaths[0]
                : undefined;

    const baseId = `${coordinateKey(tile.coordinates)}:${kind}`;

    if (kind === "tree") {
        return {
            id: baseId,
            kind: "tree",
            isInteractable: true,
            traits: { collectable: true, cuttable: true },
            description: "A tree that can be chopped",
            spritePath,
        };
    }

    if (kind === "coin") {
        return {
            id: baseId,
            kind: "coin",
            isInteractable: true,
            traits: { collectable: true, pickupable: true },
            description: "A coin you can pick up",
            spritePath,
        };
    }

    if (kind === "rock") {
        return {
            id: baseId,
            kind: "rock",
            isInteractable: true,
            traits: { mineable: true },
            description: "A rock (needs proper tool)",
            spritePath,
        };
    }

    return null;
}