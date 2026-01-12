import {IHexTile} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {useOverlayStore} from "@/stores/overlay-store";
import router, {RouteName} from "@/router";
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

        const urlPathEndpoint: RouteName = tile.tileKey;
        if (tile.tileKey) {
            router.push({name: urlPathEndpoint});
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