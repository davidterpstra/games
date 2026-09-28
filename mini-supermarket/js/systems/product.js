/* Product: a catalogue entry plus price maths for a given store. */
(function (MS) {
  'use strict';

  class Product {
    constructor(def) {
      Object.assign(this, def);
    }

    get rarityInfo() { return MS.RARITY[this.rarity]; }
    get department() { return MS.DEPARTMENTS[this.dept]; }
    get fixture() { return this.department.fixture; }
    get fixtureName() { return MS.FIXTURES[this.fixture].name; }
    get isRare() { return this.rarity !== 'common'; }

    availableIn(storeId) { return !this.stores || this.stores.includes(storeId); }

    /** Purchase price per unit in cents for this store. */
    buyCents(store) {
      return Math.max(1, Math.round(this.buy * 100 * store.def.priceMult));
    }

    /** Selling price per unit in cents (includes the Productkwaliteit upgrade). */
    sellCents(store) {
      return Math.round(this.sell * 100 * store.def.priceMult * store.upgrades.value('quality'));
    }

    profitCents(store) { return this.sellCents(store) - this.buyCents(store); }

    packCost(store) { return this.buyCents(store) * this.pack; }
  }

  MS.Product = Product;
  MS.productMap = new Map(MS.PRODUCTS.map((d) => [d.id, new Product(d)]));
  MS.product = (id) => MS.productMap.get(id) || null;
  MS.allProducts = () => Array.from(MS.productMap.values());
})((window.MS = window.MS || {}));
