import { IHero } from '../abstraction/hero-abstraction';
import { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { normalizeHealthValue, roundToSingleDecimal } from '../utils/combat/health-format';

export class HeroModel implements IHero {
  id = '';
  name = '';
  currentHealth = 0;
  maxHealth: number;
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

  public setHealth(health: number): HeroModel {
    this.currentHealth = normalizeHealthValue(health);
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

  // public setEquipment(equipment: EquipmentModel): HeroModel {
  //     this.equipment = equipment;
  //     return this;
  // }

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

  // public getMaxEnergy(): number {
  //     return this.maxEnergy;
  // }

  // public getAttack(): number {
  //     return this.attack;
  // }
  //
  // public getDefense(): number {
  //     return this.defense;
  // }
  //
  // public getCoins(): number {
  //     return this.coins;
  // }

  // public getId(): number {
  //     return this.id;
  // }
  //
  // public getEnemiesKilled(): number {
  //     return this.kills;
  // }

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
    if (this.currentHealth > this.maxHealth) {
      this.currentHealth = this.maxHealth;
    }
    this.currentHealth = roundToSingleDecimal(this.currentHealth);
  }
}
