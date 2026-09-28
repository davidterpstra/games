/* Customer: walks in, fetches every product on the shopping list from its
 * shelf, queues at a checkout, pays and walks out — or leaves early when
 * something is missing or the wait gets too long. */
(function (MS) {
  'use strict';

  const TILE = () => MS.Layout.TILE;
  const U = MS.U;
  let nextId = 1;

  class Customer extends MS.Walker {
    constructor(store, type) {
      super(store, { speed: 2.1 * type.speed, jitter: 7 });
      this.id = nextId++;
      this.kind = 'customer';
      this.type = type;
      this.name = U.pick(MS.CUSTOMER_NAMES);
      this.look = {
        skin: U.pick(MS.SKIN_TONES),
        hair: U.pick(MS.HAIR_COLORS),
        shirt: U.pick(type.shirts),
        hairStyle: U.randInt(0, 3),
        hat: type.id === 'rich' && U.chance(0.6),
        glasses: type.id === 'hasty' ? U.chance(0.7) : U.chance(0.12),
      };
      this.hasCart = type.id === 'big';
      this.wishes = store.makeWishList(type);
      this.wishIndex = 0;
      this.patienceMax = 30 * type.patience;
      this.patience = this.patienceMax;
      this.mood = 100;
      this.waited = 0;
      this.timer = 0;
      this.register = null;
      this.emote = null;
      this.paidTotal = 0;
      this.outcome = null; // 'happy' | 'ok' | 'angry' | 'sad'

      // Walk in along the sidewalk from the left or the right.
      const L = store.layout;
      const T = TILE();
      this.side = U.chance(0.65) ? -1 : 1;
      const sy = (L.sidewalk + 0.5) * T + this.oy;
      const rightEdge = Math.min(L.w - 1, Math.floor(L.viewBounds().x1 / T));
      this.edgeTile = this.side < 0 ? 0 : rightEdge;
      this.rightEdge = rightEdge;
      this.x = this.side < 0 ? -1.2 * T : (rightEdge + 1.5) * T;
      this.y = sy;
      this.addWaypoint((this.edgeTile + 0.5) * T + this.ox, sy);
      this.state = 'arrive';
    }

    get game() { return this.store.game; }
    get currentWish() { return this.wishes[this.wishIndex] || null; }
    get itemsInCart() { return this.wishes.reduce((n, w) => n + w.got, 0); }
    get isInside() { return this.state !== 'arrive' && this.state !== 'exit' && this.state !== 'gone'; }
    get waiting() { return this.state === 'queue' || this.state === 'atCounter' || this.state === 'waitShelf'; }

    say(icon, dur = 2.2) { this.emote = { icon, t: 0, dur }; }

    update(dt) {
      if (this.emote) {
        this.emote.t += dt;
        if (this.emote.t > this.emote.dur) this.emote = null;
      }
      const outsideBoost = this.state === 'arrive' || this.state === 'exit' ? 1.35 : 1;
      const arrived = this.step(dt * outsideBoost);

      switch (this.state) {
        case 'arrive':
          if (arrived) {
            const d = this.store.layout.entryDoor;
            this.goTo(d.x, d.y - 1);
            this.state = 'enter';
          }
          break;
        case 'enter':
          if (arrived) this.nextWish(true);
          break;
        case 'toShelf':
          if (arrived) { this.state = 'pick'; this.timer = U.rand(0.5, 0.9); }
          break;
        case 'pick':
          this.timer -= dt;
          if (this.timer <= 0) this.pickItems();
          break;
        case 'waitShelf':
          this.drainPatience(dt);
          if (this.state !== 'waitShelf') break;
          this.timer -= dt;
          if (this.targetSlot && this.targetSlot.productId === this.currentWish.pid && this.targetSlot.stock > 0) {
            this.state = 'pick';
            this.timer = 0.4;
          } else if (this.timer <= 0) {
            this.markMissing(this.currentWish.got > 0 ? 'partial' : 'missing');
            this.nextWish();
          }
          break;
        case 'toQueue':
        case 'queue':
          this.followQueue(arrived);
          if (this.state === 'queue') this.drainPatience(dt);
          break;
        case 'atCounter':
          if (!this.register || !this.register.scanning) this.drainPatience(dt);
          break;
        case 'paying':
          break;
        case 'leave':
          if (arrived) {
            const T = TILE();
            const L = this.store.layout;
            this.state = 'exit';
            const sy = (L.sidewalk + 0.5) * T + this.oy;
            // Walk off-screen to the left or right along the sidewalk.
            const exitX = U.chance(0.55) ? -1.5 * T : (this.rightEdge + 1.5) * T;
            this.addWaypoint(this.x, sy);
            this.addWaypoint(exitX, sy);
          }
          break;
        case 'exit':
          if (arrived) this.state = 'gone';
          break;
      }

      // People sometimes drop litter while they walk around the shop.
      if (this.moving && this.isInside && this.state !== 'leave') this.store.maybeLitter(this, dt);
    }

    drainPatience(dt) {
      this.patience -= dt;
      if (this.state === 'queue' || this.state === 'atCounter') this.waited += dt;
      if (this.patience <= 0) this.leaveAngry('wait');
    }

    /** Decides where to go next: another shelf, the checkout, or home. */
    nextWish(first) {
      if (!first) this.wishIndex++;
      const wish = this.currentWish;
      if (!wish) {
        if (this.itemsInCart > 0) this.goToCheckout();
        else this.leave('sad');
        return;
      }
      const slot = this.store.slotFor(wish.pid);
      if (!slot) {
        // The store does not sell it (yet): a little disappointing, not a reason to storm out.
        const p = MS.product(wish.pid);
        this.say('❓' + p.emoji, 2.4);
        this.store.noteMissed(wish.pid);
        this.markMissing('notCarried');
        this.nextWish();
        return;
      }
      this.targetSlot = slot;
      const spots = this.store.layout.accessTiles(slot.index);
      const spot = U.pick(spots);
      this.goTo(spot.x, spot.y);
      this.state = 'toShelf';
    }

    pickItems() {
      const wish = this.currentWish;
      const slot = this.targetSlot;
      if (!wish) return this.nextWish();
      // The player may have swapped the product while we were walking.
      if (!slot || slot.productId !== wish.pid) {
        const again = this.store.slotFor(wish.pid);
        if (again && again !== slot) {
          this.targetSlot = again;
          const spot = U.pick(this.store.layout.accessTiles(again.index));
          this.goTo(spot.x, spot.y);
          this.state = 'toShelf';
          return;
        }
        this.markMissing('missing');
        return this.nextWish();
      }
      const take = Math.min(wish.qty - wish.got, slot.stock);
      if (take > 0) {
        slot.stock -= take;
        wish.got += take;
        this.store.onPicked(this, slot, take);
      }
      if (wish.got >= wish.qty) {
        wish.state = 'done';
        this.nextWish();
      } else {
        // Shelf is empty.
        const p = MS.product(wish.pid);
        this.say('😟' + p.emoji, 3);
        if (this.type.walkout) { this.leaveAngry('missing'); return; }
        this.state = 'waitShelf';
        this.timer = 5;
      }
    }

    markMissing(kind) {
      const wish = this.currentWish;
      if (!wish) return;
      wish.state = kind;
      this.mood -= { partial: 12, missing: 22, notCarried: 10 }[kind] || 15;
    }

    goToCheckout() {
      const reg = this.store.chooseRegister(this);
      if (!reg) { this.leaveAngry('queue'); return; }
      this.register = reg;
      reg.queue.push(this);
      this.state = 'toQueue';
      this.queueTile = null;
      this.followQueue(false);
    }

    /** Keeps the customer on the right spot of the checkout line. */
    followQueue(arrived) {
      const reg = this.register;
      if (!reg) return;
      const idx = reg.queue.indexOf(this);
      if (idx < 0) return;
      const spots = reg.def.queue;
      const spot = spots[Math.min(idx, spots.length - 1)];
      if (!this.queueTile || this.queueTile.x !== spot.x || this.queueTile.y !== spot.y) {
        this.queueTile = spot;
        this.goTo(spot.x, spot.y);
        if (this.state !== 'toQueue' && idx > 0) this.state = 'queue';
        return;
      }
      if (this.state === 'toQueue' && (arrived || this.arrived)) this.state = 'queue';
      if (this.state === 'queue' && idx === 0 && this.arrived) this.state = 'atCounter';
    }

    /** Called by the register when scanning is finished. */
    pay() {
      const store = this.store;
      let total = 0, cost = 0, units = 0;
      const lines = [];
      for (const w of this.wishes) {
        if (w.got <= 0) continue;
        const p = MS.product(w.pid);
        total += p.sellCents(store) * w.got;
        cost += p.buyCents(store) * w.got;
        units += w.got;
        lines.push({ product: p, qty: w.got });
      }
      const waitPenalty = (this.waited / this.patienceMax) * 40;
      const dirtPenalty = Math.min(20, store.dirt.length * 2.5);
      this.mood = U.clamp(this.mood - waitPenalty - dirtPenalty, 0, 100);
      const happy = this.mood >= 70;
      const tip = happy && this.type.tip ? Math.round(total * this.type.tip) : 0;
      this.paidTotal = total + tip;
      this.outcome = happy ? 'happy' : this.mood >= 40 ? 'ok' : 'angry';
      store.game.completeSale(this, { total, cost, tip, units, lines, happy });
      this.say(happy ? (tip ? '😍' : '😊') : this.mood >= 40 ? '🙂' : '😒', 2.5);
      this.register = null;
      this.leave(this.outcome);
    }

    leave(outcome) {
      this.outcome = this.outcome || outcome;
      const d = this.store.layout.exitDoor;
      this.goTo(d.x, d.y);
      this.state = 'leave';
    }

    /** Leaves without buying; picked products go back on the shelves. */
    leaveAngry(reason) {
      if (this.state === 'leave' || this.state === 'exit' || this.state === 'gone') return;
      if (this.register) {
        const q = this.register.queue;
        const i = q.indexOf(this);
        if (i >= 0) q.splice(i, 1);
        if (this.register.current === this) this.register.resetScan();
        this.register = null;
      }
      this.store.returnItems(this);
      this.mood = 0;
      this.outcome = 'angry';
      this.say('😡', 3);
      this.store.game.onCustomerLost(this, reason);
      this.leave('angry');
    }

    /** Called when the store deactivates: puts carried items back. */
    dispose() {
      this.store.returnItems(this);
    }
  }

  MS.Customer = Customer;
})((window.MS = window.MS || {}));
