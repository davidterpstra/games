// node tools/check.mjs  -> builds, syntax-checks the bundle, reports top-level name problems.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('node build.mjs', { cwd: root, stdio: 'inherit' });

const PREFIX = {
  '01_config.js': '_cf', '02_data.js': '_sd', '03_services.js': '_sv', '04_scene.js': '_sc',
  '05_animals.js': '_an', '06_machine.js': '_cm', '07_player.js': '_pl', '08_fx.js': '_fx',
  '09_audio.js': '_au', '10_ui.js': '_ui', '11_ui_panels.js': '_up', '12_main.js': '_mn',
};
const PUBLIC = {
  '01_config.js': ['RARITIES', 'RARITY_BY_ID', 'VARIANTS', 'ANIMALS', 'ANIMAL_BY_ID', 'WORLDS', 'WORLD_BY_ID', 'UPGRADES', 'UPGRADE_BY_ID', 'TRAINING_EQUIPMENT', 'EQUIPMENT_BY_ID', 'GEM_SHOP', 'ECONOMY', 'FORMULAS'],
  '02_data.js': ['PlayerData', 'SaveService'],
  '03_services.js': ['Remote', 'Services'],
  '04_scene.js': ['Scene3D'],
  '05_animals.js': ['AnimalFactory', 'PetViewer'],
  '06_machine.js': ['ClawMachine', 'Machines'],
  '07_player.js': ['Input', 'Player', 'CameraRig', 'Interact'],
  '08_fx.js': ['FX'],
  '09_audio.js': ['Sfx'],
  '10_ui.js': ['UI'],
  '11_ui_panels.js': [],
  '12_main.js': [],
};

const dir = path.join(root, 'src/js');
const seen = new Map();
let problems = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const re = /^(?:export\s+)?(?:const|let|var|function\*?|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (seen.has(name)) { console.log(`DUPLICATE top-level name '${name}' in ${f} (also in ${seen.get(name)})`); problems++; }
    seen.set(name, f);
    if (f !== '00_core.js' && PREFIX[f] && !name.startsWith(PREFIX[f]) && !(PUBLIC[f] || []).includes(name)) {
      console.log(`NAME RULE: '${name}' in ${f} must start with ${PREFIX[f]} (or be a public name from ARCHITECTURE.md)`);
      problems++;
    }
  }
  if (f !== '00_core.js' && /^\s*(import|export)\s/m.test(src)) { console.log(`${f}: import/export is not allowed outside 00_core.js`); problems++; }
}
try {
  execSync('node --check .build/bundle.mjs', { cwd: root, stdio: 'pipe' });
  console.log('Syntax OK');
} catch (e) {
  console.log('SYNTAX ERROR in bundle:\n' + String(e.stderr || e.message).slice(0, 2000));
  problems++;
}
console.log(problems ? `${problems} problem(s)` : 'No problems found');
process.exit(problems ? 1 : 0);
