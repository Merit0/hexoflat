import {defineStore} from 'pinia';
import {OverlayPayloads, OverlayType} from "@/types/overlay-types";

type OverlayEntry<T extends OverlayType = OverlayType> = {
    name: T;
    data: OverlayPayloads[T];
};

export const useOverlayStore = defineStore("overlay-store", {
    state: () => ({
        stack: [] as OverlayEntry[], //last overlay on top
    }),

    getters: {
        activeOverlays: (s): OverlayType[] => s.stack.map(e => e.name),
        topOverlay: (s): OverlayEntry | null =>
            s.stack.length ? s.stack[s.stack.length - 1] : null,

        isOverlay:
            (s) =>
                (name: OverlayType): boolean =>
                    s.stack.some(e => e.name === name),

        getOverlayData:
            (s) =>
                <T extends OverlayType>(name: T): OverlayPayloads[T] | undefined =>
                    s.stack.find(e => e.name === name)?.data as OverlayPayloads[T] | undefined,
    },

    actions: {
        openOverlay<T extends OverlayType>(
            name: T,
            data?: OverlayPayloads[T],
            opts: { bringToFront: boolean } = {bringToFront: true}
        ) {
            const existingIndex = this.stack.findIndex((e: OverlayEntry) => e.name === name);

            if (existingIndex !== -1) {
                this.stack[existingIndex].data = data as OverlayPayloads[T];

                if (opts.bringToFront) {
                    const [entry] = this.stack.splice(existingIndex, 1);
                    this.stack.push(entry);
                }
                return;
            }

            this.stack.push({name, data} as OverlayEntry<T>);
        },

        closeOverlay(name?: OverlayType) {
            if (!name) {
                this.stack = [];
                return;
            }
            this.stack = this.stack.filter((e: OverlayEntry) => e.name !== name);
        },

        closeTop() {
            this.stack.pop();
        },

        replaceTop<T extends OverlayType>(name: T, data?: OverlayPayloads[T]) {
            if (this.stack.length) this.stack.pop();
            this.stack.push({name, data} as OverlayEntry<T>);
        },
    },
});