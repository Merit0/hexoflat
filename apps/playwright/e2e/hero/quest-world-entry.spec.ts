import { test } from '@fixtures';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { QuestWorldEntryFeature } from '@features/world/quest-world-entry.feature';

test(
  'Treasure Seeker preserves its field through three camping portal and re-entry cycles with reloads',
  { tag: ['@hero'] },
  async () => {
    test.setTimeout(240_000);
    await new OpenCampingMapFeature().open();
    const quest = new QuestWorldEntryFeature();
    await quest.accept();
    await quest.enterFromSilesia();
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await quest.walkTrailAndReloadBeforeReturningToPortal();
      const before = await quest.pauseThroughPortal();
      await quest.reloadAtCamp();
      await quest.enterFromSilesia();
      await quest.verifySameRun(before);
    }
  },
);
