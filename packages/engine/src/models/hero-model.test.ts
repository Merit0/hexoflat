import { describe, expect, it } from 'vitest';
import { HeroModel, MAX_HERO_HEALTH } from './hero-model';

function hero(max: number, current: number): HeroModel {
  return new HeroModel().setMaxHealth(max).setHealth(current);
}

describe('HeroModel max health bonus', () => {
  it('keeps a full hero full when the maximum grows', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    expect(model.maxHealth).toBe(3);
    expect(model.getEffectiveMaxHealth()).toBe(4);
    expect(model.currentHealth).toBe(4);
  });

  it('does not heal a hurt hero when the maximum grows', () => {
    const model = hero(3, 2).setMaxHealthBonus(1);
    expect(model.getEffectiveMaxHealth()).toBe(4);
    expect(model.currentHealth).toBe(2);
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

  it('cannot heal a damaged shielded hero by taking the shield off and putting it on', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    model.setHealth(3);
    model.setMaxHealthBonus(0);
    expect(model.currentHealth).toBe(3);
    model.setMaxHealthBonus(1);
    expect(model.getEffectiveMaxHealth()).toBe(4);
    expect(model.currentHealth).toBe(3);
  });

  it('refills the new heart once the hero really healed to full in between', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    model.setHealth(3);
    model.setMaxHealthBonus(0);
    model.setHealth(2);
    model.setHealth(3);
    model.setMaxHealthBonus(1);
    expect(model.currentHealth).toBe(4);
  });

  it('a full shielded hero can swap the shield off and on without losing the heart', () => {
    const model = hero(3, 3).setMaxHealthBonus(1);
    model.setMaxHealthBonus(0);
    expect(model.currentHealth).toBe(3);
    model.setMaxHealthBonus(1);
    expect(model.currentHealth).toBe(4);
  });

  it('lets healing reach the raised maximum', () => {
    const model = hero(3, 2.5).setMaxHealthBonus(1);
    model.setHealth(model.currentHealth + 5);
    model.adjustHealthOnStatChange();
    expect(model.currentHealth).toBe(4);
  });

  it('never lets the effective maximum pass the hero health cap', () => {
    const model = hero(10, 9.5).setMaxHealthBonus(5);
    expect(model.getEffectiveMaxHealth()).toBe(MAX_HERO_HEALTH);
    expect(model.currentHealth).toBe(9.5);
    expect(hero(10, 10).setMaxHealthBonus(5).currentHealth).toBe(MAX_HERO_HEALTH);
    expect(hero(100, 100).getEffectiveMaxHealth()).toBe(MAX_HERO_HEALTH);
  });

  it('ignores a negative bonus', () => {
    expect(hero(3, 3).setMaxHealthBonus(-2).getEffectiveMaxHealth()).toBe(3);
  });
});
