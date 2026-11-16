import { test } from '@fixtures';
import { WorldDeepLinkFeature } from '@features/world/world-deep-link.feature';

test.describe('world deep link', { tag: ['@board'] }, () => {
  test('A link to another location opens the place where the hero stands', async () => {
    await new WorldDeepLinkFeature().verifyLinkToAnotherLocationShowsTheHerosPlace();
  });
});
