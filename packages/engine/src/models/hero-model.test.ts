import { describe, expect, it } from 'vitest';
import { HeroModel, MAX_HERO_HEALTH } from './hero-model';

function hero(max: number, current: number): HeroModel {
  return new HeroModel().setMaxHealth(max).setHealth(current);
}

describe('HeroModel max health bonus', () => {
  it('raises only the allowed maximum and never heals', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    expect(model.maxHealth).toBe(3);
    expect(model.getEffectiveMaxHealth()).toBe(4);
    expect(model.currentHealth).toBe(3);
  });

  it('keeps the current health when the bonus goes away below it', () => {
    const model = hero(5, 4.5).setMaxHealthBonus(1);
    expect(model.getEffectiveMaxHealth()).toBe(6);
    expect(model.currentHealth).toBe(4.5);
    model.setMaxHealthBonus(0);
    expect(model.getEffectiveMaxHealth()).toBe(5);
    expect(model.currentHealth).toBe(4.5);
  });

  it('cuts the current health down to the new maximum when the bonus goes away above it', () => {
    const model = hero(5, 5).setMaxHealthBonus(1);
    model.setHealth(6);
    model.setMaxHealthBonus(0);
    expect(model.currentHealth).toBe(5);
  });

  it('cannot be used to heal by equipping and unequipping', () => {
    const model = hero(3, 1.5);
    model.setMaxHealthBonus(1).setMaxHealthBonus(0).setMaxHealthBonus(1).setMaxHealthBonus(0);
    expect(model.currentHealth).toBe(1.5);
  });

  it('lets healing reach the raised maximum', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    model.setHealth(model.currentHealth + 5);
    model.adjustHealthOnStatChange();
    expect(model.currentHealth).toBe(4);
  });

  it('never lets the effective maximum pass the hero health cap', () => {
    const model = hero(10, 9.5).setMaxHealthBonus(5);
    expect(model.getEffectiveMaxHealth()).toBe(MAX_HERO_HEALTH);
    expect(model.currentHealth).toBe(9.5);
    expect(hero(100, 100).getEffectiveMaxHealth()).toBe(MAX_HERO_HEALTH);
  });

  it('ignores a negative bonus', () => {
    expect(hero(3, 3).setMaxHealthBonus(-2).getEffectiveMaxHealth()).toBe(3);
  });
});
