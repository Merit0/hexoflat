import { test } from '@fixtures';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import {
  NO_ATTRIBUTES,
  ONE_HALF_HEART,
  ShieldMaxHealthFeature,
} from '@features/world/shield-max-health.feature';

test.describe('shield max health', { tag: ['@hero'] }, () => {
  test('A shield token without attributes adds no heart', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(NO_ATTRIBUTES);
    await shield.verifyHealth(3, 3);

    await shield.equipShield();
    await shield.verifyHealth(3, 3);

    await shield.takeShieldOffWithTheHandIcon();
    await shield.verifyHealth(3, 3);
  });

  test('A full hero who equips a heart +1 shield becomes 3.5/3.5 and drops to 3/3 when it comes off', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART);
    await shield.verifyHealth(3, 3);

    await shield.equipShield();
    await shield.verifyHealth(3.5, 3.5);

    await shield.takeShieldOffWithTheHandIcon();
    await shield.verifyHealth(3, 3);
  });

  test('A hurt hero keeps his health when the shield raises the maximum', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART, 2);
    await shield.verifyHealth(2, 3);

    await shield.equipShield();
    await shield.verifyHealth(2, 3.5);

    await shield.takeShieldOffWithTheHandIcon();
    await shield.verifyHealth(2, 3);
  });

  test('Taking the shield off and on cannot heal a hero who was hurt', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART);
    await shield.equipShield();
    await shield.verifyHealth(3.5, 3.5);

    await shield.setHealth(3);
    await shield.verifyHealth(3, 3.5);
    await shield.takeShieldOffWithTheHandIcon();
    await shield.verifyHealth(3, 3);

    await shield.equipShield();
    await shield.verifyHealth(3, 3.5);
  });

  test('A full hero can swap the shield off and on without losing the half heart', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART);
    await shield.equipShield();
    await shield.takeShieldOffWithTheHandIcon();
    await shield.verifyHealth(3, 3);

    await shield.equipShield();
    await shield.verifyHealth(3.5, 3.5);
  });

  test('The raised maximum survives a reload without healing the hero', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART, 2);
    await shield.equipShield();
    await shield.verifyHealth(2, 3.5);

    await new ReloadCampingMapFeature().reload();
    await shield.verifyHealth(2, 3.5);
  });

  test('A hero one heart below the raised maximum heals at the fireplace past the old maximum', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART);
    await shield.equipShield();
    await shield.setHealth(2.5);
    await shield.verifyHealth(2.5, 3.5);

    await shield.useFireplace();
    await shield.verifyHealthEventually(3.5, 3.5);
  });

  test('A full shielded hero is told health is already full at the fireplace', async () => {
    const shield = new ShieldMaxHealthFeature();
    await shield.startWithShieldInBag(ONE_HALF_HEART);
    await shield.equipShield();
    await shield.verifyHealth(3.5, 3.5);

    await shield.verifyFireplaceRefusesAsFull();
  });
});
