// Readable documents: models at their anchors, the interaction that opens them, and the read-journal.
import * as THREE from 'three';
import { DOCUMENTS, DOC_BY_ID } from './story.js';
import { createDocumentModel } from './DocumentModels.js';

/** @param {{scene, world, bus, interaction}} deps */
export function createDocuments({ scene, world, bus, interaction }) {
  const read = []; // ids in the order they were first read
  const root = new THREE.Group();
  root.name = 'documents';
  scene.add(root);
  let lastOpened = null;

  function open(id) {
    const def = DOC_BY_ID[id];
    if (!def) return false;
    if (!read.includes(id)) read.push(id);
    lastOpened = id;
    bus.emit('sfx', { name: def.kind === 'terminal' ? 'ui_click' : 'page' });
    bus.emit('document:open', { id: def.id, title: def.title, body: def.body, kind: def.kind });
    return true;
  }

  for (const def of DOCUMENTS) {
    if (!def.anchor || !def.model) continue;
    const anchor = world.anchors.get(def.anchor);
    if (!anchor) { console.warn(`[gameplay] missing anchor ${def.anchor}`); continue; }
    const model = createDocumentModel(def.model);
    model.position.copy(anchor.position);
    model.rotation.y += anchor.rotationY || 0;
    root.add(model);
    interaction.register({ id: def.anchor, object: model, position: anchor.position, radius: 0.3, prompt: def.prompt, onInteract: () => open(def.id) });
  }

  return {
    open,
    hasRead: (id) => read.includes(id),
    get lastOpened() { return lastOpened; },
    list: () => read.map((id) => ({ id, title: DOC_BY_ID[id].title, body: DOC_BY_ID[id].body, kind: DOC_BY_ID[id].kind })),
    get: (id) => (read.includes(id) ? { id, title: DOC_BY_ID[id].title, body: DOC_BY_ID[id].body, kind: DOC_BY_ID[id].kind } : null),
    reset() { read.length = 0; lastOpened = null; },
    serialize: () => [...read],
    restore(ids) { read.length = 0; lastOpened = null; if (Array.isArray(ids)) for (const id of ids) if (DOC_BY_ID[id] && !read.includes(id)) read.push(id); },
  };
}
