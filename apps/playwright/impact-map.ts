import { z } from 'zod';

const glob = z.string().min(1);
const globs = z.array(glob).min(1);

const groupSchema = z.object({
  roots: globs,
  specs: glob,
});

export const impactMapSchema = z
  .object({
    smokeTag: z.literal('@smoke'),
    smokeOn: globs,
    global: globs,
    ignore: globs,
    boundaries: z.array(glob),
    groups: z.record(z.string().regex(/^[a-z]+$/), groupSchema),
  })
  .superRefine((map, ctx) => {
    const names = Object.keys(map.groups);
    if (names.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'at least one group is required' });
    }
    for (const [name, group] of Object.entries(map.groups)) {
      if (name === 'smoke') {
        ctx.addIssue({ code: 'custom', message: '"smoke" is a tag, not a group' });
      }
      if (!group.specs.startsWith(`apps/playwright/e2e/${name}/`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['groups', name, 'specs'],
          message: `specs of "${name}" must live under apps/playwright/e2e/${name}/`,
        });
      }
    }
    for (const pattern of map.ignore) {
      if (map.global.includes(pattern)) {
        ctx.addIssue({ code: 'custom', message: `"${pattern}" is both global and ignored` });
      }
    }
  });

export type ImpactMap = z.infer<typeof impactMapSchema>;
export type E2EGroup = keyof typeof impactMapInput.groups;

const WEB = 'apps/web/src';
const SCENES = `${WEB}/a-game-scenes`;

// `boundaries` are hubs that import (almost) the whole app: the router and the
// Pinia stores. Walking through them would make every file reachable from every
// group. The walk reaches a boundary but does not continue past it, unless the
// boundary is itself a root of the group being computed (hero-store is a root of
// `hero`, so `hero` still sees what hero-store imports). The price: a change deep
// under a store is attributed to the store's own group, not to its consumers;
// trunk pushes and nightly runs stay full runs as the safety net.
//
// A file is owned by a group when it matches one of the group's `roots` or is
// imported (transitively) by a file that does. A `*.spec.ts` is deliberately
// NOT ignored: in apps/playwright/e2e it is an e2e spec, and it triggers its
// own group. Unit tests are `*.test.ts`.
const impactMapInput = {
  smokeTag: '@smoke',
  smokeOn: ['apps/web/**'],
  global: [
    'packages/engine/**',
    'apps/playwright/src/framework/**',
    'apps/playwright/src/fixtures/**',
    'apps/playwright/src/config/**',
    'apps/playwright/playwright.config.*',
    'apps/playwright/global-setup.ts',
    'apps/playwright/impact-map.ts',
    'apps/playwright/scripts/**',
    `${WEB}/e2e/**`,
    'apps/web/vite.config.*',
    'apps/web/index.html',
    `${WEB}/main.ts`,
    `${WEB}/App.vue`,
    `${WEB}/router/routes.ts`,
    `${WEB}/assets/global.css`,
    '**/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig*.json',
    '**/tsconfig*.json',
    'turbo.json',
  ],
  boundaries: [`${WEB}/router/**`, `${WEB}/stores/*-store.ts`],
  ignore: [
    '**/*.md',
    'docs/**',
    '**/*.test.ts',
    '**/*.fixture.ts',
    '.github/**',
    '.husky/**',
    '.vscode/**',
    '.idea/**',
  ],
  groups: {
    auth: {
      roots: [
        `${SCENES}/login-scene/**`,
        `${WEB}/components/auth/**`,
        `${WEB}/features/auth/**`,
        `${WEB}/services/auth-gateway.ts`,
        `${WEB}/styles/auth-*.css`,
        `${WEB}/stores/user-store.ts`,
        `${WEB}/api/auth-token.ts`,
        'apps/api/src/auth/**',
      ],
      specs: 'apps/playwright/e2e/auth/**',
    },
    board: {
      roots: [
        `${WEB}/render/**`,
        `${SCENES}/map-scene/components/hex-world-map.vue`,
        `${WEB}/components/gui/board/**`,
        `${WEB}/composables/use-hex-board-input.ts`,
        `${WEB}/composables/use-tile-click.ts`,
        `${WEB}/composables/use-move-preview.ts`,
        `${WEB}/composables/use-board-*.ts`,
        `${WEB}/services/hero-movement/**`,
        `${WEB}/services/world/**`,
        `${WEB}/stores/world-map-*.ts`,
      ],
      specs: 'apps/playwright/e2e/board/**',
    },
    camp: {
      roots: [
        `${SCENES}/map-scene/components/knowledge-*`,
        `${WEB}/components/gui/will-number.vue`,
        `${WEB}/composables/use-portal*.ts`,
        `${WEB}/composables/use-will-*.ts`,
        `${WEB}/composables/use-knowledge-*.ts`,
        `${WEB}/composables/use-book-reading.ts`,
        `${WEB}/services/knowledge/**`,
        `${WEB}/render/portal-fx*.ts`,
      ],
      specs: 'apps/playwright/e2e/camp/**',
    },
    combat: {
      roots: [
        `${SCENES}/battle-scene/**`,
        `${SCENES}/map-scene/components/battle/**`,
        `${WEB}/components/battle/**`,
        `${WEB}/composables/battle-*.ts`,
        `${WEB}/composables/use-battle-*.ts`,
        `${WEB}/stores/battle-store.ts`,
        `${WEB}/services/battle/**`,
        `${WEB}/services/squads/**`,
        `${WEB}/render/battle/**`,
        `${WEB}/e2e/battle-hooks.ts`,
      ],
      specs: 'apps/playwright/e2e/combat/**',
    },
    hero: {
      roots: [
        `${SCENES}/inventory-scene/**`,
        `${SCENES}/game-events-logger/**`,
        `${SCENES}/map-scene/components/hero-board-panel.vue`,
        `${SCENES}/map-scene/components/hero-details/**`,
        `${SCENES}/map-scene/components/tool-hex-tile.vue`,
        `${SCENES}/map-scene/components/stash/**`,
        `${SCENES}/map-scene/components/shop/**`,
        `${WEB}/components/gui/board/board-close-button.vue`,
        `${WEB}/components/gui/board/board-cell.css`,
        `${WEB}/composables/board-cell-context.ts`,
        `${WEB}/composables/use-shop-*.ts`,
        `${WEB}/services/trade/**`,
        `${WEB}/composables/use-stash-*.ts`,
        `${WEB}/composables/stash-*.ts`,
        `${WEB}/composables/item-counter.ts`,
        `${WEB}/composables/use-inventory-cell-size.ts`,
        `${WEB}/services/inventory/**`,
        `${WEB}/services/player/**`,
        `${SCENES}/map-scene/components/action-alert-banner.vue`,
        `${WEB}/components/gui/item-tooltip/**`,
        `${WEB}/components/gui/tool-hex/**`,
        `${WEB}/composables/use-hero-*.ts`,
        `${WEB}/composables/use-inventory-drag.ts`,
        `${WEB}/composables/use-item-tooltip.ts`,
        `${WEB}/composables/use-equipment-health-sync.ts`,
        `${WEB}/composables/use-open-inventory-on-pickup.ts`,
        `${WEB}/composables/use-stop-tool-when-unequipped.ts`,
        `${WEB}/composables/skill-tree-view.ts`,
        `${WEB}/stores/hero-*.ts`,
        `${WEB}/stores/gathering-store.ts`,
        `${WEB}/stores/game-events-store.ts`,
      ],
      specs: 'apps/playwright/e2e/hero/**',
    },
    shell: {
      roots: [
        `${WEB}/i18n/**`,
        `${WEB}/locales/**`,
        `${WEB}/components/overlays/settings-overlay.vue`,
        `${WEB}/components/layout/**`,
        `${WEB}/composables/use-game-layout.ts`,
        `${WEB}/stores/ui-settings-store.ts`,
      ],
      specs: 'apps/playwright/e2e/shell/**',
    },
  },
} as const satisfies z.input<typeof impactMapSchema>;

export const impactMap: ImpactMap = impactMapSchema.parse(impactMapInput);
