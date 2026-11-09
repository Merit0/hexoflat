export const AGGREGATE_KINDS = ['inventory', 'progress'] as const;
export type TAggregateKind = (typeof AGGREGATE_KINDS)[number];
