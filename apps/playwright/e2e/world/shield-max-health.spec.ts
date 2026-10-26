import { test } from '@fixtures';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { ShieldMaxHealthFeature } from '@features/world/shield-max-health.feature';

test('A full hero who equips a +1 heart shield becomes 4/4 and drops to 3/3 when it comes off', async () => {
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag();
  await shield.verifyHealth(3, 3);

  await shield.equipShield();
  await shield.verifyHealth(4, 4);

  await shield.takeShieldOffWithTheHandIcon();
  await shield.verifyHealth(3, 3);
});

test('A hurt hero keeps his health when the shield raises the maximum', async () => {
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag(2);
  await shield.verifyHealth(2, 3);

  await shield.equipShield();
  await shield.verifyHealth(2, 4);

  await shield.takeShieldOffWithTheHandIcon();
  await shield.verifyHealth(2, 3);
});

test('Taking the shield off and on cannot heal a hero who was hurt', async () => {
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag();
  await shield.equipShield();
  await shield.verifyHealth(4, 4);

  await shield.setHealth(3);
  await shield.verifyHealth(3, 4);
  await shield.takeShieldOffWithTheHandIcon();
  await shield.verifyHealth(3, 3);

  await shield.equipShield();
  await shield.verifyHealth(3, 4);
});

test('A full hero can swap the shield off and on without losing the heart', async () => {
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag();
  await shield.equipShield();
  await shield.takeShieldOffWithTheHandIcon();
  await shield.verifyHealth(3, 3);

  await shield.equipShield();
  await shield.verifyHealth(4, 4);
});

test('The raised maximum survives a reload without healing the hero', async () => {
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag(2);
  await shield.equipShield();
  await shield.verifyHealth(2, 4);

  await new ReloadCampingMapFeature().reload();
  await shield.verifyHealth(2, 4);
});

test('A hero at the old maximum still heals at the fireplace up to the raised maximum', async () => {
  test.setTimeout(120_000);
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag();
  await shield.equipShield();
  await shield.setHealth(3);
  await shield.verifyHealth(3, 4);

  await shield.useFireplace();
  await shield.verifyHealthEventually(4, 4);
});

test('A full shielded hero is told health is already full at the fireplace', async () => {
  test.setTimeout(120_000);
  const shield = new ShieldMaxHealthFeature();
  await shield.startWithShieldInBag();
  await shield.equipShield();
  await shield.verifyHealth(4, 4);

  await shield.verifyFireplaceRefusesAsFull();
});
