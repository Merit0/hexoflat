import { HEXOBJECT_KEYS, type THexobjectKey } from "@/registry/hexobjects-registry";
import { CONTENT } from "./content-map";
import { ContentDefinitionSchema } from "./content-schema";

export function validateContent(): void {
    const keys = Object.values(HEXOBJECT_KEYS) as THexobjectKey[];
    const failures: string[] = [];

    for (const key of keys) {
        const entry = CONTENT[key];
        if (!entry) {
            failures.push(`[${key}] missing content entry`);
            continue;
        }

        const result = ContentDefinitionSchema.safeParse(entry);
        if (!result.success) {
            failures.push(`[${key}] ${result.error.message}`);
        }
    }

    if (failures.length > 0) {
        throw new Error(`Hexobject content validation failed:\n${failures.join("\n")}`);
    }
}
