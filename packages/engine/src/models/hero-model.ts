import { IHero } from '../abstraction/hero-abstraction';
import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { normalizeHealthValue, roundToSingleDecimal } from '../utils/combat/health-format';

export const MAX_HERO_HEALTH = 10;

export class HeroModel implements IHero {
  id = '';
  name = '';
  currentHealth = 0;
  maxHealth: number;
  maxHealthBonus = 0;
  private bonusHealthDebt = 0;
  attack = 0;
  defense = 0;
  coins = 0;
  kills = 0;
  currentEnergy = 0;
  maxEnergy: number;
  imgPath = '';
  heroLocation: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };
  heroSteps: number;

  constructor() {
    this.maxHealth = 100;
    this.maxEnergy = 100;
    this.heroSteps = 0;
  }

  public getName(): string {
    return this.name;
  }

  public setName(name: string): HeroModel {
    this.name = name;
    return this;
  }

  public setMaxHealth(amount: number): HeroModel {
    this.maxHealth = normalizeHealthValue(amount, 0.1);
    return this;
  }

  public getEffectiveMaxHealth(): number {
    return Math.min(
      MAX_HERO_HEALTH,
      normalizeHealthValue(this.maxHealth + this.maxHealthBonus, 0.1),
    );
  }

  /**
   * A full hero who gains maximum health stays full; a hurt hero keeps the health he has. Losing the
   * bonus remembers how many hearts were missing, so unequipping and re-equipping cannot heal.
   */
  public setMaxHealthBonus(bonus: number): HeroModel {
    const before = this.getEffectiveMaxHealth();
    const wasFull = this.currentHealth >= before;
    const missing = roundToSingleDecimal(Math.max(0, before - this.currentHealth));

    this.maxHealthBonus = Math.max(0, bonus);
    const after = this.getEffectiveMaxHealth();

    if (after > before) {
      if (wasFull) {
        const regained = roundToSingleDecimal(after - this.bonusHealthDebt);
        this.currentHealth = Math.max(this.currentHealth, regained);
      }
      this.bonusHealthDebt = 0;
    } else if (after < before) {
      this.bonusHealthDebt = Math.min(missing, roundToSingleDecimal(before - after));
    }
    this.adjustHealthOnStatChange();
    return this;
  }

  public setHealth(health: number): HeroModel {
    const next = normalizeHealthValue(health);
    if (next !== this.currentHealth) this.bonusHealthDebt = 0;
    this.currentHealth = next;
    return this;
  }

  public setAttack(attack: number): HeroModel {
    this.attack = attack;
    return this;
  }

  public setDefense(defense: number): HeroModel {
    this.defense = defense;
    return this;
  }

  public setKills(kills: number): HeroModel {
    this.kills = kills;
    return this;
  }

  public setMaxEnergy(maxEnergyValue: number): HeroModel {
    this.maxEnergy = maxEnergyValue;
    return this;
  }

  public setCurrentEnergy(currentEnergyValue: number): HeroModel {
    this.currentEnergy = currentEnergyValue;
    return this;
  }

  public setCoins(coins: number): HeroModel {
    this.coins = coins;
    return this;
  }

  public setSteps(steps: number): HeroModel {
    this.heroSteps = steps;
    return this;
  }

  public makeStep(): void {
    this.heroSteps += 1;
  }

  public getHealth(): number {
    return this.currentHealth;
  }

  public getCurrentEnergy(): number {
    return this.currentEnergy;
  }

  public getHeroMyriads(): number {
    return Math.round((this.heroSteps / 10) * 10) / 10;
  }

  public addKilled(): void {
    this.kills += 1;
    this.experienceCollector();
  }

  public collectEnergy(energyValue = 1): void {
    this.currentEnergy = Math.min(this.currentEnergy + energyValue, this.maxEnergy);
  }

  public useEnergy(energyValue = 1): void {
    this.currentEnergy = Math.max(this.currentEnergy - energyValue, 0);
  }

  public experienceCollector(): void {
    if (this.kills % 5 === 0) {
      this.attack += 1;
    }
  }

  public takeDamage(damage: number): void {
    this.currentHealth = normalizeHealthValue(this.currentHealth - damage);
    if (this.currentHealth < 1) {
      this.currentHealth = 0;
    }
  }

  public healthIncreaser(): void {
    this.currentHealth = normalizeHealthValue(this.currentHealth + 1);
  }

  public adjustHealthOnStatChange(): void {
    const cap = this.getEffectiveMaxHealth();
    if (this.currentHealth > cap) {
      this.currentHealth = cap;
    }
    this.currentHealth = roundToSingleDecimal(this.currentHealth);
  }
}
