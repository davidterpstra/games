/* ChallengeSystem (three daily challenges, same set for the whole day) and
 * GoalSystem (the guided goal shown in the tracker). Both listen to the
 * events the game reports through `game.track(event, key, amount)`. */
(function (MS) {
  'use strict';

  const U = MS.U;

  class ChallengeSystem {
    constructor(game) {
      this.game = game;
      this.reset();
    }

    reset() {
      this.date = null;
      this.list = [];
      this.bonusClaimed = false;
    }

    load(saved) {
      this.reset();
      if (!saved || typeof saved !== 'object' || typeof saved.date !== 'string' || !Array.isArray(saved.list)) return;
      this.date = saved.date;
      this.bonusClaimed = !!saved.bonusClaimed;
      for (const c of saved.list.slice(0, 5)) {
        if (!c || typeof c.text !== 'string' || typeof c.event !== 'string' || !U.isNum(c.target) || c.target <= 0) continue;
        this.list.push({
          id: String(c.id), text: c.text.slice(0, 120), event: c.event, key: c.key || null,
          target: c.target, progress: U.clamp(U.isNum(c.progress) ? c.progress : 0, 0, c.target),
          reward: { money: U.isNum(c.reward && c.reward.money) ? Math.max(0, Math.floor(c.reward.money)) : 0, xp: U.isNum(c.reward && c.reward.xp) ? Math.max(0, Math.floor(c.reward.xp)) : 0 },
          claimed: !!c.claimed,
        });
      }
    }

    /** Makes sure today's challenges exist (new ones every calendar day). */
    ensureToday() {
      const today = U.todayKey();
      if (this.date !== today || !this.list.length) this.generate(today);
    }

    generate(date) {
      const game = this.game;
      const rng = U.seededRng(U.hashString('ms-daily-' + date));
      const ctx = {
        level: game.level,
        assortment: game.store.assortment(),
        priceMult: game.store.def.priceMult,
      };
      const templates = MS.CHALLENGE_TEMPLATES.slice();
      const list = [];
      let guard = 0;
      while (list.length < 3 && templates.length && guard++ < 30) {
        const t = U.weightedPick(templates, (x) => x.weight, rng);
        templates.splice(templates.indexOf(t), 1);
        const made = t.make(ctx, rng);
        if (!made) continue;
        list.push({
          id: `${date}-${t.id}`, text: made.text, event: made.event, key: made.key || null,
          target: made.target, progress: 0,
          reward: MS.challengeReward(t.reward, ctx.level, ctx.priceMult),
          claimed: false,
        });
      }
      this.date = date;
      this.list = list;
      this.bonusClaimed = false;
      MS.bus.emit('challenges:new');
    }

    isDone(c) { return c.progress >= c.target; }
    claimableCount() { return this.list.filter((c) => this.isDone(c) && !c.claimed).length; }
    allClaimed() { return this.list.length > 0 && this.list.every((c) => c.claimed); }

    onEvent(event, key, amount) {
      for (const c of this.list) {
        if (c.claimed || this.isDone(c) || c.event !== event) continue;
        if (c.key && c.key !== key) continue;
        c.progress = Math.min(c.target, c.progress + amount);
        if (this.isDone(c)) MS.bus.emit('challenge:done', c);
      }
    }

    claim(id) {
      const c = this.list.find((x) => x.id === id);
      if (!c || c.claimed || !this.isDone(c)) return false;
      c.claimed = true;
      this.game.giveReward(c.reward, '🏆 Uitdaging voltooid!');
      this.game.stats.challenges++;
      if (this.allClaimed() && !this.bonusClaimed) {
        this.bonusClaimed = true;
        const bonus = { money: 0, xp: 40 + this.game.level * 10 };
        this.game.giveReward(bonus, '🎁 Dagbonus: alle uitdagingen gehaald!');
      }
      return true;
    }

    toJSON() {
      return { date: this.date, list: this.list.map((c) => ({ ...c, reward: { ...c.reward } })), bonusClaimed: this.bonusClaimed };
    }
  }

  class GoalSystem {
    constructor(game) {
      this.game = game;
      this.reset();
    }

    reset() {
      this.index = 0;
    }

    load(saved) {
      this.reset();
      if (!saved || typeof saved !== 'object') return;
      if (U.isNum(saved.index)) this.index = U.clamp(Math.floor(saved.index), 0, MS.GOALS.length);
    }

    current() { return MS.GOALS[this.index] || null; }

    progress() {
      const g = this.current();
      if (!g) return null;
      const value = g.check ? g.check(this.game) : this.game.stats[g.stat] || 0;
      return { cur: U.clamp(value, 0, g.target), target: g.target };
    }

    update() {
      const g = this.current();
      if (!g) return;
      const p = this.progress();
      if (p.cur < p.target) return;
      this.index++;
      // goal rewards are written in euros in progression.js
      this.game.giveReward({ money: (g.reward.money || 0) * 100, xp: g.reward.xp || 0 }, `🎯 Doel gehaald: ${g.text}`);
      MS.bus.emit('goal:done', g);
    }

    toJSON() { return { index: this.index }; }
  }

  MS.ChallengeSystem = ChallengeSystem;
  MS.GoalSystem = GoalSystem;
})((window.MS = window.MS || {}));
