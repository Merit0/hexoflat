import { HealPortion } from "./../enums/HealPortion";
export class HealPortionModel {
  name = "Heal Potion";
  amount: number;

  constructor(portionType: HealPortion) {
    if (portionType === HealPortion.SMALL) {
      this.amount = 10;
    } else {
      this.amount = 50;
    }
  }
}
