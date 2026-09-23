import { z } from 'zod';

/**
 * A board's topology graph is built and linted (G1) entirely before any hex
 * exists (docs/WORLD-MAP-GENERATOR-V2-PLAN.md D1, §2.4). `PATH_SEGMENT` is a
 * legal role — a narrow link between two areas — but the graph linter caps
 * how much of a board's node count it may occupy (D15): a board dominated by
 * `PATH_SEGMENT` nodes is a trail, not a board, and must be rejected.
 */
export const RegionGraphNodeRoleSchema = z.enum([
  'ENTRY',
  'TRANSIT',
  'FORK',
  'MERGE',
  'LANDMARK',
  'POI',
  'OBSTRUCTION',
  'PATH_SEGMENT',
  'PORTAL',
]);
export type RegionGraphNodeRole = z.infer<typeof RegionGraphNodeRoleSchema>;

export const RegionGraphNodeSchema = z.object({
  id: z.string(),
  role: RegionGraphNodeRoleSchema,
});
export type RegionGraphNode = z.infer<typeof RegionGraphNodeSchema>;

/** `BLOCKED` marks an edge reserved by the grammar but not walkable — a wall, not a route. */
export const RegionGraphEdgeTraversalSchema = z.enum(['OPEN', 'BLOCKED']);
export type RegionGraphEdgeTraversal = z.infer<typeof RegionGraphEdgeTraversalSchema>;

export const RegionGraphEdgeSemanticRoleSchema = z.enum(['MAIN', 'DETOUR', 'APPROACH', 'RETURN']);
export type RegionGraphEdgeSemanticRole = z.infer<typeof RegionGraphEdgeSemanticRoleSchema>;

export const RegionGraphEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  traversal: RegionGraphEdgeTraversalSchema,
  semanticRole: RegionGraphEdgeSemanticRoleSchema,
  /** Provisional hex-path length, filled in by the grammar builder (G1) before any embedder exists. */
  weight: z.number().nonnegative(),
});
export type RegionGraphEdge = z.infer<typeof RegionGraphEdgeSchema>;

export const RegionTopologyGraphSchema = z
  .object({
    nodes: z.array(RegionGraphNodeSchema).min(1),
    edges: z.array(RegionGraphEdgeSchema),
  })
  .superRefine((graph, ctx) => {
    const ids = new Set<string>();
    for (const node of graph.nodes) {
      if (ids.has(node.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate node id "${node.id}"` });
      }
      ids.add(node.id);
    }
    for (const edge of graph.edges) {
      if (!ids.has(edge.from)) {
        ctx.addIssue({
          code: 'custom',
          message: `edge "${edge.id}" references unknown node "${edge.from}"`,
        });
      }
      if (!ids.has(edge.to)) {
        ctx.addIssue({
          code: 'custom',
          message: `edge "${edge.id}" references unknown node "${edge.to}"`,
        });
      }
    }
  });
export type RegionTopologyGraph = z.infer<typeof RegionTopologyGraphSchema>;

/**
 * What the G1 grammar selector hands to the graph linter: a candidate graph
 * plus the provenance the linter's rejection reason and G2's embedder both
 * need. `grammarIds` is a list, not a single id, because one board may
 * compose more than one grammar into a single connected graph (§2.5).
 */
export const RegionPropositionSchema = z.object({
  boardSeed: z.string(),
  attemptIndex: z.number().int().nonnegative(),
  profile: z.enum(['WORLD', 'DUNGEON']),
  grammarIds: z.array(z.string()).min(1),
  graph: RegionTopologyGraphSchema,
});
export type RegionProposition = z.infer<typeof RegionPropositionSchema>;
