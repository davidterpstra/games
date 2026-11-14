// Location discovery: a location counts as discovered once the player comes within its radius (2D).

/** @param {{world, player, bus}} deps */
export function createLocations({ world, player, bus }) {
  const discovered = new Set();
  const locs = () => world.locations || [];
  return {
    list: () => locs().map((l) => ({ id: l.id, name: l.name, x: l.x, z: l.z, discovered: discovered.has(l.id) })),
    isDiscovered: (id) => discovered.has(id),
    update() {
      const p = player.state.position;
      for (const l of locs()) {
        if (discovered.has(l.id)) continue;
        if (Math.hypot(p.x - l.x, p.z - l.z) <= l.radius) {
          discovered.add(l.id);
          bus.emit('sfx', { name: 'discover' });
          bus.emit('notify', { text: `Locatie ontdekt: ${l.name}`, type: 'info' });
          bus.emit('location:discovered', { id: l.id, name: l.name });
        }
      }
    },
    reset() { discovered.clear(); },
    serialize: () => [...discovered],
    restore(ids) { discovered.clear(); if (Array.isArray(ids)) { const known = new Set(locs().map((l) => l.id)); for (const id of ids) if (known.has(id)) discovered.add(id); } },
  };
}
