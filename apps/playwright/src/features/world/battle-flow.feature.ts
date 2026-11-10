import { expect } from '@playwright/test';
import { BaseFeature } from '@framework/base-feature';
import { CampingMapPage } from '@pages/camping-map.page';
import { OpenCampingMapFeature } from '@features/world/open-camping-map.feature';
import { ReloadCampingMapFeature } from '@features/world/reload-camping-map.feature';
import { SquadActionsFeature } from '@features/world/squad-actions.feature';
import { SwitchHeroBoardTabFeature } from '@features/world/switch-hero-board-tab.feature';
import { DragInventoryItemFeature } from '@features/world/drag-inventory-item.feature';
import { EquipSlot } from '@config/equip-slot';
import { UseEquippedToolFeature } from '@features/world/use-equipped-tool.feature';
import { VerifyActionAlertFeature } from '@features/world/verify-action-alert.feature';
import { HexobjectKeys } from '@config/test-data';

const WINDOW_RESOLVES_MS = 20_000;

type Snapshot = NonNullable<Awaited<ReturnType<CampingMapPage['hexBoard']['readBattleSnapshot']>>>;

/**
 * Battle scenarios that go through the real command pipeline: the block window,
 * the aim stage, the order of initiative. State the game reaches only by luck
 * (who moves first, where the enemy stands) is granted by test hooks.
 */
export class BattleFlowFeature extends BaseFeature {
  private readonly campingMap = new CampingMapPage();
  private before: Snapshot | null = null;
  private shownCost = 0;
  private walkTo: { q: number; r: number } | null = null;
  private tappedShields: { q: number; r: number }[] = [];
  private attackerId: string | null = null;

  private async snapshot(): Promise<Snapshot> {
    const snapshot = await this.campingMap.hexBoard.readBattleSnapshot();
    if (!snapshot) throw new Error('No battle is open.');
    return snapshot;
  }

  private hero(snapshot: Snapshot) {
    return snapshot.creatures.find((creature) => creature.side === 'heroes')!;
  }

  private creature(snapshot: Snapshot, id: string) {
    return snapshot.creatures.find((creature) => creature.id === id)!;
  }

  async startBattleNextToTheSquad(
    options: {
      withShield?: boolean;
      squad?: string;
      hurtHero?: boolean;
      withScroll?: boolean;
    } = {},
  ): Promise<void> {
    await this.step('Open a battle against a squad', async () => {
      const squad = new SquadActionsFeature();
      await new OpenCampingMapFeature().open();
      if (options.withShield) await this.equipAShieldOnTheMap();
      if (options.hurtHero) await this.hurtTheHero();
      if (options.withScroll) await this.putAReturnScrollInTheHand();
      await squad.placeSquadNextToHero(options.squad ?? HexobjectKeys.skeletonPack);
      await squad.aimHandAtSquad();
      await squad.attack();
      await squad.startBattle();
      await this.campingMap.battleTab.waitForBoardStill();
    });
  }

  private async equipAShieldOnTheMap(): Promise<void> {
    await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.grantInventoryItem('shield', 1));
    await new SwitchHeroBoardTabFeature().switchTo('inventory');
    await new DragInventoryItemFeature().dragToEquipSlot(HexobjectKeys.shield, EquipSlot.SHIELD);
    await new SwitchHeroBoardTabFeature().switchTo('hero');
  }

  async startBattleAgainstTheBoneCourtAndVerifyTheKingSprite(): Promise<void> {
    await this.step(
      'The skeleton king token loads its own sprite on the battle board',
      async () => {
        const verifyLoaded = await this.campingMap.battleTab.watchSprite(/skeleton-king-hex\.png/);
        await this.startBattleNextToTheSquad({ squad: HexobjectKeys.boneCourt });
        await verifyLoaded();
        const snapshot = await this.snapshot();
        expect(snapshot.creatures.filter((c) => c.side === 'enemies')).toHaveLength(3);
      },
    );
  }

  async verifyTheBattleHeartsMatchTheHeroBoard(): Promise<void> {
    await this.step('The hero hearts in the battle equal the hero board hearts', async () => {
      const board = await this.campingMap.heroBoardPanel.getHeroHealth();
      const hero = this.hero(await this.snapshot());
      expect([hero.hp, hero.maxHp]).toEqual([board.current * 2, board.max * 2]);
    });
  }

  async verifyTheHeroBoardFollowsTheDamageAtOnce(): Promise<void> {
    await this.step('The hero board shows the damage while the battle is still open', async () => {
      await expect
        .poll(async () => {
          const board = await this.campingMap.heroBoardPanel.getHeroHealth();
          return board.current * 2 === this.hero(await this.snapshot()).hp;
        })
        .toBe(true);
      const board = await this.campingMap.heroBoardPanel.getHeroHealth();
      expect(board.current * 2).toBeLessThan(this.hero(this.before!).hp);
    });
  }

  async verifyTheBattleRefusesTheScroll(): Promise<void> {
    await this.step('The alert says the scroll cannot be used in a battle', async () => {
      await new VerifyActionAlertFeature().verifyIsShownMatching(
        /cannot be used in a battle|не можна використати в бою/,
      );
    });
  }

  async hurtTheHero(): Promise<void> {
    await this.step('Hurt the hero before the fight', async () => {
      await this.page.evaluate(() => window.__HEXOFLAT_TEST__!.setHeroHealth(1.5));
    });
  }

  async putAReturnScrollInTheHand(): Promise<void> {
    await this.step('Equip a return scroll in the shield hand on the map', async () => {
      await this.page.evaluate(() =>
        window.__HEXOFLAT_TEST__!.grantInventoryItem('return-scroll', 1),
      );
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      await new DragInventoryItemFeature().dragToEquipSlot(
        HexobjectKeys.returnScroll,
        EquipSlot.SHIELD,
      );
      await new SwitchHeroBoardTabFeature().switchTo('hero');
    });
  }

  async pressUseOnTheScrollDuringTheBattle(): Promise<void> {
    await this.step('Press USE on the scroll while the battle is open', async () => {
      await new SwitchHeroBoardTabFeature().switchTo('inventory');
      await new UseEquippedToolFeature().use(HexobjectKeys.returnScroll);
    });
  }

  async verifyInitiativeRunsFromTheLowestToken(): Promise<void> {
    await this.step(
      'The order follows the tokens 1, 2, 3… and shows a chip per creature',
      async () => {
        const { order, draws } = await this.snapshot();
        const tokens = order.map((id) => draws[id]);
        expect(tokens).toEqual([...tokens].sort((a, b) => a - b));
        expect(new Set(tokens).size).toBe(order.length);
        expect(tokens[0]).toBe(1);
      },
    );
  }

  async verifyNoStageBarOrBlockButton(): Promise<void> {
    await this.step('The battle controls carry no stage bar and no BLOCK button', async () => {
      await this.campingMap.battleTab.verifyNoStageBarAndNoBlockButton();
    });
  }

  async giveEnemyTheTurn(): Promise<void> {
    await this.step('Give the first enemy the turn at two hexes from the hero', async () => {
      await this.campingMap.hexBoard.giveEnemyTheTurn();
      await this.campingMap.battleTab.waitForBoardStill();
    });
  }

  async waitForTheBlockWindow(): Promise<void> {
    await this.step('The enemy picks the hero and the block window opens', async () => {
      await expect
        .poll(async () => (await this.snapshot()).reaction?.stage ?? null, { timeout: 15_000 })
        .toBe('block');
      this.before = await this.snapshot();
      this.attackerId = this.before.reaction!.attackerId;
    });
  }

  async verifyTheEnemyStandsStillWhileTheHeroBlocks(): Promise<void> {
    await this.step(
      'The enemy has not moved, the hero holds the window, no "your turn"',
      async () => {
        const now = await this.snapshot();
        const hero = this.hero(now);
        expect(now.phase).toBe('defend');
        expect(now.activeId).toBe(hero.id);
        expect(this.creature(now, this.attackerId!)).toMatchObject({
          q: this.creature(this.before!, this.attackerId!).q,
          r: this.creature(this.before!, this.attackerId!).r,
        });
        expect(now.turnWill).toBe(0);
        await this.campingMap.battleTab.verifyHeroCardState('defend');
        await this.campingMap.battleTab.verifyReactionTimerRunning();
        await this.campingMap.battleTab.verifyYourTurnTag(false);
        await this.campingMap.battleTab.verifyNoStageBarAndNoBlockButton();
      },
    );
  }

  async takeTheHit(): Promise<void> {
    await this.step('Press TAKE HIT', async () => {
      await this.campingMap.battleTab.takeHit();
    });
  }

  async putAShieldThroughTheToolHex(): Promise<void> {
    await this.step('Raise a shield through the auto-selected tool hex', async () => {
      await this.campingMap.battleTab.verifyToolHexOffers(/Блок|Block/);
      await this.campingMap.battleTab.pressToolHexAction();
      await this.campingMap.battleTab.verifyShieldCount(1, 2);
      expect((await this.snapshot()).placedShields).toBe(1);
    });
  }

  async verifyTheTrueShieldHexIsShownAfterTheHit(): Promise<void> {
    await this.step(
      'After the strike the hex of the real shield is shown on the board',
      async () => {
        await expect
          .poll(async () => (await this.snapshot()).revealedShields, {
            timeout: WINDOW_RESOLVES_MS,
          })
          .toBeGreaterThan(0);
      },
    );
  }

  async verifyTheWindowClosedByItselfAndTheHitIsConsistent(): Promise<void> {
    await this.step('The window closes by itself and the outcome is consistent', async () => {
      await expect
        .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
        .toBeNull();
      await this.verifyOutcomeIsConsistent();
    });
  }

  async verifyTheHitLandedAndTheEnemyWalkedUp(): Promise<void> {
    await this.step(
      'The hit landed, the hero lost health and the enemy stands beside him',
      async () => {
        await expect
          .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
          .toBeNull();
        const now = await this.snapshot();
        expect(this.hero(now).hp).toBeLessThan(this.hero(this.before!).hp);
        await expect
          .poll(async () => (await this.snapshot()).heroDistances[this.attackerId!])
          .toBe(1);
      },
    );
  }

  async verifyTheBattleIsInTheEventsLog(): Promise<void> {
    await this.step('The Events tab lists the strike and the pick of the target', async () => {
      await new SwitchHeroBoardTabFeature().switchTo('events');
      await this.campingMap.eventsLog.verifyHasRowMatching(/влучає|hits|заблоковано|blocked/);
      await this.campingMap.eventsLog.verifyHasRowMatching(/атакує|attacks/);
    });
  }

  private async verifyOutcomeIsConsistent(): Promise<void> {
    const now = await this.snapshot();
    const hero = this.hero(now);
    const lost = this.hero(this.before!).hp - hero.hp;
    expect(lost).toBeGreaterThanOrEqual(0);
    await expect.poll(async () => (await this.snapshot()).heroDistances[this.attackerId!]).toBe(1);
  }

  async reloadInTheMiddleOfTheWindow(): Promise<void> {
    await this.step('Reload the page while the block window is open', async () => {
      await new ReloadCampingMapFeature().reload();
      await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(true);
    });
  }

  async verifyTheBattleDoesNotFreezeAfterTheReload(): Promise<void> {
    await this.step('The window closes or reopens and the battle keeps moving', async () => {
      await expect
        .poll(
          async () => {
            const now = await this.campingMap.hexBoard.readBattleSnapshot();
            return !!now && now.reaction === null && now.phase !== 'defend';
          },
          { timeout: 30_000 },
        )
        .toBe(true);
    });
  }

  async giveHeroTheTurn(): Promise<void> {
    await this.step('Give the hero the turn with the full Will', async () => {
      await this.campingMap.hexBoard.giveHeroTheTurn();
      await this.campingMap.battleTab.waitForBoardStill();
      this.before = await this.snapshot();
    });
  }

  async crowdTheHeroWithOneBesideAndOneFar(): Promise<void> {
    await this.step('Stand two enemies beside the hero and a third two hexes away', async () => {
      await this.campingMap.hexBoard.crowdTheHero(2, 1);
      await this.campingMap.battleTab.waitForBoardStill();
      this.before = await this.snapshot();
    });
  }

  async verifyOnlyTheEnemiesBesideTheHeroWereSwept(): Promise<void> {
    await this.step(
      'The enemy beside him is hurt, the one two hexes away is untouched',
      async () => {
        await expect
          .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
          .toBeNull();
        const now = await this.snapshot();
        const was = this.before!;
        const enemies = was.creatures.filter((c) => c.side === 'enemies');
        const far = enemies.find((c) => was.heroDistances[c.id] === 2)!;
        const bystander = enemies.find(
          (c) => was.heroDistances[c.id] === 1 && c.id !== this.attackerId,
        )!;
        expect(this.creature(now, far.id).hp).toBe(far.hp);
        expect(this.creature(now, bystander.id).hp).toBeLessThan(bystander.hp);
      },
    );
  }

  async crowdTheHeroWithTwoEnemies(): Promise<void> {
    await this.step('Stand two enemies beside the hero', async () => {
      await this.campingMap.hexBoard.crowdTheHero();
      await this.campingMap.battleTab.waitForBoardStill();
      this.before = await this.snapshot();
    });
  }

  async aimTheHandAtAnEnemyAndStrike(): Promise<void> {
    await this.step(
      'Select an enemy on the board, hover it and press ATTACK in the tool hex',
      async () => {
        const enemy = this.before!.creatures.filter((c) => c.side === 'enemies' && c.hp > 0).sort(
          (a, b) => this.before!.heroDistances[a.id] - this.before!.heroDistances[b.id],
        )[0];
        this.attackerId = enemy.id;
        const point = await this.campingMap.hexBoard.battleHexPoint({ q: enemy.q, r: enemy.r });
        if (!point) throw new Error('The battle board did not report a point for the enemy hex.');
        await this.campingMap.battleTab.clickBoardPoint(point);
        await this.campingMap.battleTab.verifyEnemySelected(enemy.id);
        await this.campingMap.battleTab.scrollTheHandsWithTheWheel();
        await this.campingMap.battleTab.hoverBoardPoint(point);
        await this.campingMap.battleTab.verifyToolHexOffers(/Атакувати|Attack/);
        await this.campingMap.battleTab.pressToolHexAction();
      },
    );
  }

  async verifyTheOtherEnemyBesideTheHeroWasHurtToo(): Promise<void> {
    await this.step('The enemy the hero did not pick lost hearts from the swing', async () => {
      await expect
        .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
        .toBeNull();
      const now = await this.snapshot();
      const bystander = this.before!.creatures.find(
        (c) =>
          c.side === 'enemies' &&
          c.hp > 0 &&
          c.id !== this.attackerId &&
          this.before!.heroDistances[c.id] === 1,
      )!;
      expect(this.creature(now, bystander.id).hp).toBeLessThan(bystander.hp);
      expect(this.hero(now).hp).toBe(this.hero(this.before!).hp);
    });
  }

  async chooseTheStrikeHexWhenAsked(): Promise<void> {
    await this.step('If the enemy raised a shield, choose the hex to strike from', async () => {
      await expect
        .poll(async () => {
          const now = await this.snapshot();
          return now.reaction === null || now.reaction.stage === 'aim';
        })
        .toBe(true);
      const now = await this.snapshot();
      if (now.reaction?.stage !== 'aim') return;
      expect(now.aimOptions.length).toBeGreaterThan(1);
      await this.campingMap.battleTab.verifyHeroCardState('aim');
      const standing = this.hero(now);
      const choice =
        now.aimOptions.find((h) => h.q === standing.q && h.r === standing.r) ??
        now.aimOptions[now.aimOptions.length - 1];
      const point = await this.campingMap.hexBoard.battleHexPoint(choice);
      if (!point) throw new Error('The battle board did not report a point for the option hex.');
      await this.campingMap.battleTab.clickBoardPoint(point);
    });
  }

  async verifyTheHeroWalkedUpAfterTheBlock(): Promise<void> {
    await this.step(
      'The hero stands beside the enemy, the Will was spent, the window is shut',
      async () => {
        await expect
          .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
          .toBeNull();
        const now = await this.snapshot();
        expect(now.heroDistances[this.attackerId!]).toBe(1);
        expect(now.turnWill).toBeLessThanOrEqual(13);
        await this.campingMap.battleTab.verifyTurnCost(0);
        expect(this.hero(now).hp).toBe(this.hero(this.before!).hp);
        expect(now.activeId).toBe(this.hero(now).id);
        const enemyHp = this.creature(now, this.attackerId!).hp;
        expect(enemyHp).toBeLessThanOrEqual(this.creature(this.before!, this.attackerId!).hp);
      },
    );
  }

  private async pointOf(hex: { q: number; r: number }) {
    const point = await this.campingMap.hexBoard.battleHexPoint(hex);
    if (!point) throw new Error('The battle board did not report a point for that hex.');
    return point;
  }

  async verifyInitiativeChipsMatchTheCreatures(): Promise<void> {
    await this.step('The initiative strip shows one chip per creature', async () => {
      await this.campingMap.battleTab.verifyInitiativeChips(
        (await this.snapshot()).creatures.length,
      );
    });
  }

  async verifyOnlyApprovedHexesOnTheField(): Promise<void> {
    await this.step('The field has floor, the border wall and one or two saws only', async () => {
      const { terrain } = await this.snapshot();
      expect(terrain.floor).toBeGreaterThan(0);
      expect(terrain.wall).toBeGreaterThan(0);
      expect(terrain.saw).toBeGreaterThanOrEqual(1);
      expect(terrain.saw).toBeLessThanOrEqual(2);
      for (const key of ['ledge', 'rubble', 'oil', 'boulder']) {
        expect(terrain[key] ?? 0, key).toBe(0);
      }
    });
  }

  async verifyNoEndTurnButtonInTheWindow(): Promise<void> {
    await this.step('The hero has no END TURN button while he defends', async () => {
      await this.campingMap.battleTab.verifyEndTurnHidden();
    });
  }

  async giveHeroTheTurnWithWill(will: number): Promise<void> {
    await this.step(`Give the hero the turn with ${will} Will`, async () => {
      await this.campingMap.hexBoard.giveHeroTheTurn(will);
      await this.campingMap.battleTab.waitForBoardStill();
      this.before = await this.snapshot();
    });
  }

  private nearestEnemy(snapshot: Snapshot) {
    return snapshot.creatures
      .filter((c) => c.side === 'enemies' && c.hp > 0)
      .sort((a, b) => snapshot.heroDistances[a.id] - snapshot.heroDistances[b.id])[0];
  }

  async hoverTheNearestEnemyWithTheWeapon(): Promise<void> {
    await this.step('Open the weapon with the wheel and hover the nearest enemy', async () => {
      const enemy = this.nearestEnemy(await this.snapshot());
      this.attackerId = enemy.id;
      await this.campingMap.battleTab.scrollTheHandsWithTheWheel();
      await this.campingMap.battleTab.hoverBoardPoint(await this.pointOf(enemy));
      await this.campingMap.battleTab.verifyToolHexOffers(/Атакувати|Attack/);
    });
  }

  async hoverAnEmptyHexWithTheWeapon(): Promise<void> {
    await this.step('Open the weapon with the wheel and hover an empty hex', async () => {
      const [hex] = (await this.snapshot()).heroFreeNeighbours;
      await this.campingMap.battleTab.scrollTheHandsWithTheWheel();
      await this.campingMap.battleTab.hoverBoardPoint(await this.pointOf(hex));
    });
  }

  async rememberTheDisplayedCost(): Promise<void> {
    await this.step('Remember the cost the panel shows', async () => {
      await expect.poll(() => this.campingMap.battleTab.readTurnCost()).toBeGreaterThan(0);
      this.shownCost = await this.campingMap.battleTab.readTurnCost();
    });
  }

  async verifyTheCostIsZero(): Promise<void> {
    await this.step('The panel shows no cost for an action that does nothing', async () => {
      await this.campingMap.battleTab.verifyTurnCost(0);
      await this.campingMap.battleTab.verifyCostTooHigh(false);
    });
  }

  async verifyTheCostIsRed(price: number): Promise<void> {
    await this.step('The cost is shown red when the Will does not cover it', async () => {
      await this.campingMap.battleTab.verifyTurnCost(price);
      await this.campingMap.battleTab.verifyCostTooHigh(true);
    });
  }

  async pressTheToolAction(): Promise<void> {
    await this.step('Press the action in the tool hex', async () => {
      await this.campingMap.battleTab.pressToolHexAction();
    });
  }

  async verifyTheWillSpentEqualsTheShownCost(): Promise<void> {
    await this.step('The Will really spent equals the cost the panel showed', async () => {
      await expect
        .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
        .toBeNull();
      const now = await this.snapshot();
      expect(this.before!.turnWill - now.turnWill).toBe(this.shownCost);
      await this.campingMap.battleTab.verifyTurnCost(0);
    });
  }

  async hoverAFreeHexToWalk(): Promise<void> {
    await this.step('Hover a free hex beside the hero in MOVE', async () => {
      const [hex] = (await this.snapshot()).heroFreeNeighbours;
      this.walkTo = hex;
      await this.campingMap.battleTab.hoverBoardPoint(await this.pointOf(hex));
    });
  }

  async tapTheHexToWalk(): Promise<void> {
    await this.step('Tap the hex to walk there', async () => {
      await this.campingMap.battleTab.clickBoardPoint(await this.pointOf(this.walkTo!));
    });
  }

  async verifyTheHeroWalkedAndPaidTheShownCost(): Promise<void> {
    await this.step('The hero stands on the hex and paid the shown cost', async () => {
      await expect
        .poll(async () => {
          const hero = this.hero(await this.snapshot());
          return hero.q === this.walkTo!.q && hero.r === this.walkTo!.r;
        })
        .toBe(true);
      const now = await this.snapshot();
      expect(this.before!.turnWill - now.turnWill).toBe(this.shownCost);
      await this.campingMap.battleTab.verifyTurnCost(0);
    });
  }

  async undoTheStep(): Promise<void> {
    await this.step('Press UNDO and get the step and the Will back', async () => {
      await this.campingMap.battleTab.pressUndo();
      await expect
        .poll(async () => {
          const now = await this.snapshot();
          const hero = this.hero(now);
          const start = this.hero(this.before!);
          return hero.q === start.q && hero.r === start.r && now.turnWill === this.before!.turnWill;
        })
        .toBe(true);
    });
  }

  async endTheTurn(): Promise<void> {
    await this.step('Press END TURN and the turn passes on', async () => {
      const heroId = this.hero(await this.snapshot()).id;
      await this.campingMap.battleTab.pressEndTurn();
      await expect.poll(async () => (await this.snapshot()).activeId !== heroId).toBe(true);
    });
  }

  async holdTheWindowOpen(): Promise<void> {
    await this.step('Give the block window a minute so the taps are not rushed', async () => {
      await this.campingMap.hexBoard.holdTheWindowOpen(60_000);
    });
  }

  async tapShieldHexes(count: number): Promise<void> {
    await this.step(`Tap ${count} free hexes around the hero to raise shields`, async () => {
      const hexes = (await this.snapshot()).heroFreeNeighbours.slice(0, count);
      this.tappedShields = hexes;
      for (const hex of hexes) {
        await this.campingMap.battleTab.clickBoardPoint(await this.pointOf(hex));
      }
    });
  }

  async tapTheFirstShieldAgain(): Promise<void> {
    await this.step('Tap a raised shield again to take it down', async () => {
      await this.campingMap.battleTab.clickBoardPoint(await this.pointOf(this.tappedShields[0]));
    });
  }

  async verifyShieldsRaised(placed: number, capacity: number): Promise<void> {
    await this.step(`${placed} of ${capacity} shields stand`, async () => {
      await this.campingMap.battleTab.verifyShieldCount(placed, capacity);
    });
  }

  async liftTheShieldWithTheToolHex(): Promise<void> {
    await this.step('The tool hex now offers Lift and takes the shield down', async () => {
      await this.campingMap.battleTab.verifyToolHexOffers(/Зняти|Lift/);
      await this.campingMap.battleTab.pressToolHexAction();
    });
  }

  async waitForTheAimToTimeOut(): Promise<void> {
    await this.step('Let the aim stage run out without choosing a hex', async () => {
      await expect
        .poll(async () => {
          const now = await this.snapshot();
          return now.reaction === null || now.reaction.stage === 'aim';
        })
        .toBe(true);
      await expect
        .poll(async () => (await this.snapshot()).reaction, { timeout: WINDOW_RESOLVES_MS })
        .toBeNull();
    });
  }

  async verifyTheHeroStandsBesideTheTargetAfterTheAim(): Promise<void> {
    await this.step('The hero stands beside the target, nothing is pending', async () => {
      const now = await this.snapshot();
      expect(now.heroDistances[this.attackerId!]).toBe(1);
      expect(now.activeId).toBe(this.hero(now).id);
      await this.campingMap.battleTab.verifyTurnCost(0);
    });
  }

  async loseTheBattleAndLeave(): Promise<void> {
    await this.step('Lose the battle and press LEAVE BATTLE', async () => {
      await this.campingMap.hexBoard.finishBattle('defeat');
      await this.campingMap.battleTab.leaveBattle();
    });
  }

  async fallInBattleAndReloadWithoutLeaving(): Promise<void> {
    await this.step(
      'Lose the battle and reload the page without pressing LEAVE BATTLE',
      async () => {
        await this.campingMap.hexBoard.finishBattle('defeat');
        await new ReloadCampingMapFeature().reload();
      },
    );
  }

  async leaveTheBattleAfterTheDefeat(): Promise<void> {
    await this.step('Press LEAVE BATTLE', async () => {
      await this.campingMap.battleTab.leaveBattle();
    });
  }

  async fallInBattleWithTheToolHexOpen(): Promise<void> {
    await this.step('Lose the battle while the weapon tool hex is open', async () => {
      await this.hoverTheNearestEnemyWithTheWeapon();
      await this.campingMap.hexBoard.finishBattle('defeat');
    });
  }

  async verifyTheDefeatClosedTheToolHexAndEveryPanel(): Promise<void> {
    await this.step('No tool hex, stash or Book of Will is left after the defeat', async () => {
      await this.campingMap.battleTab.verifyToolHexHidden();
      await this.campingMap.stashBoard.verifyIsClosed();
      await this.campingMap.knowledge.verifyClosed();
    });
  }

  async verifyTheDefeatSentTheHeroHome(): Promise<void> {
    await this.step('The battle is closed and the hero is back alive at the camp', async () => {
      await this.campingMap.battleTab.verifyBoardClosed();
      await expect.poll(() => this.campingMap.hexBoard.isBattleEngaged()).toBe(false);
      const health = await this.campingMap.heroBoardPanel.getHeroHealth();
      expect(health.current).toBeGreaterThan(0);
    });
  }
}
