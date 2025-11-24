import {IHexTile} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {useOverlayStore} from "@/stores/overlay-store";
import router, {RouteName} from "@/router";

export function useTileClick() {
    const overlayStore = useOverlayStore();

    function handleTileClick(tile: IHexTile) {
        // if (tile.isLocked) {
        //     overlayStore.openOverlay("tile-locked-hint", {coord: tile.coordinates});
        //     return;
        // }

        const urlPathEndpoint: RouteName = tile.tileKey;
        if (tile.tileKey) {
            router.push({name: urlPathEndpoint});
            return;
        }

        overlayStore.openOverlay("hex-tile-details", {coordinates: tile.coordinates});
    }

    return {handleTileClick};
}