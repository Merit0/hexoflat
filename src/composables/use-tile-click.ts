import {IHexTile} from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {useOverlayStore} from "@/stores/overlay-store";
import {useWorldMapStore} from "@/stores/world-map-store";
import {useHeroToolStore} from "@/stores/hero-tool-store";

export function useTileClick() {
    const overlayStore = useOverlayStore();
    const worldMapStore = useWorldMapStore();
    const heroToolStore = useHeroToolStore();

    function handleTileClick(tile: IHexTile) {
        // if (tile.isLocked) {
        //     overlayStore.openOverlay("tile-locked-hint", {coord: tile.coordinates});
        //     return;
        // }

        if (heroToolStore.isDragging) {
            heroToolStore.updateHover(tile.coordinates);

            return;
        }

        if (!tile.isRevealed) {
            worldMapStore.revealTile(tile.coordinates);
            return;
        }

        if (tile.hexobject) {
            overlayStore.openOverlay("hex-tile-details", {coordinates: tile.coordinates});
            return;
        }

        const moved = worldMapStore.moveHeroTo(tile.coordinates);
        if (moved) return;

        overlayStore.openOverlay("hex-tile-details", {coordinates: tile.coordinates});
    }

    return {handleTileClick};
}