import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEXOBJECT_KEYS, type THexobjectKey } from "@/registry/hexobjects-registry";
import { CONTENT } from "./content-map";
import { ContentDefinitionSchema } from "./content-schema";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
const KEYS = Object.values(HEXOBJECT_KEYS) as THexobjectKey[];

describe("hexobject content", () => {
    it("has a content entry for every HEXOBJECT_KEYS value", () => {
        for (const key of KEYS) {
            expect(CONTENT[key], `missing content entry for "${key}"`).toBeDefined();
        }
    });

    it.each(KEYS)("content for \"%s\" passes schema validation", (key) => {
        const result = ContentDefinitionSchema.safeParse(CONTENT[key]);
        if (!result.success) {
            throw new Error(`"${key}" failed content schema validation:\n${result.error.message}`);
        }
        expect(result.success).toBe(true);
    });

    it.each(KEYS)("spritePath for \"%s\" exists on disk", async (key) => {
        const spritePath = CONTENT[key]?.spritePath;
        if (!spritePath) return;

        const diskPath = path.join(PUBLIC_DIR, spritePath);
        await expect(fs.stat(diskPath), `expected asset to exist at "${diskPath}"`).resolves.toBeTruthy();
    });
});
