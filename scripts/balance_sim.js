const fs = require('fs');

// --- Game Logic Constants & Functions (Re-implemented for performance) ---

function calculateDamage(baseMin, baseMax, attackerPower, targetDefense) {
  const baseDamage = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  const rawDamage = baseDamage + attackerPower;
  return Math.max(1, rawDamage - targetDefense);
}

function calculateHeal(baseMin, baseMax, mag) {
  const baseHeal = baseMin + Math.floor(Math.random() * (baseMax - baseMin + 1));
  return baseHeal + Math.floor(mag * 0.5);
}

function calculateInitiative(ini) {
  return ini + Math.floor(Math.random() * 10);
}

// --- Player Builds ---

const BUILDS = {
  WARRIOR: {
    name: 'Warrior',
    stats: { vit: 185, atk: 30, mag: 10, def: 15, res: 5, ini: 100, pa: 7, pm: 3 },
    spells: [{ name: 'Frappe', cost: 3, range: [1, 1], dmg: [35, 45], type: 'PHYSICAL' }],
  },
  MAGE: {
    name: 'Mage',
    stats: { vit: 140, atk: 10, mag: 35, def: 5, res: 20, ini: 100, pa: 7, pm: 3 },
    spells: [
      { name: 'Fireball', cost: 3, range: [1, 7], dmg: [25, 35], type: 'MAGICAL' },
      { name: 'Heal', cost: 3, range: [0, 4], heal: [15, 25], type: 'HEAL' },
    ],
  },
  NINJA: {
    name: 'Ninja',
    stats: { vit: 150, atk: 25, mag: 15, def: 5, res: 5, ini: 150, pa: 7, pm: 4 },
    spells: [{ name: 'Kunai', cost: 3, range: [1, 6], dmg: [15, 20], type: 'PHYSICAL' }],
  },
};

// --- AISimulation Logic ---

class Fighter {
  constructor(build, pos) {
    this.name = build.name;
    this.stats = { ...build.stats };
    this.spells = build.spells;
    this.pos = pos;
    this.currentVit = this.stats.vit;
  }

  reset(pos) {
    this.currentVit = this.stats.vit;
    this.pos = pos;
  }

  getDist(other) {
    return Math.abs(this.pos - other.pos);
  }

  takeTurn(other) {
    let pa = this.stats.pa;
    let pm = this.stats.pm;

    // Movement: Simply get as close as needed for spells
    const targetRange = this.name === 'Warrior' ? 1 : this.name === 'Mage' ? 7 : 6;
    let dist = this.getDist(other);

    if (dist > targetRange) {
      const move = Math.min(pm, dist - targetRange);
      if (this.pos < other.pos) this.pos += move;
      else this.pos -= move;
      dist = this.getDist(other);
    } else if (this.name !== 'Warrior' && dist < targetRange) {
      // Ranged classes try to keep distance if possible?
      // For simplicity, let's just move towards the sweet spot if moving is free
    }

    // Action Logic
    while (pa >= 2) {
      if (this.name === 'Mage' && this.currentVit < this.stats.vit * 0.6 && pa >= 2) {
        // Heal
        const healSpell = this.spells.find((s) => s.type === 'HEAL');
        this.currentVit = Math.min(
          this.stats.vit,
          this.currentVit + calculateHeal(healSpell.heal[0], healSpell.heal[1], this.stats.mag),
        );
        pa -= healSpell.cost;
        continue;
      }

      const attackSpell = this.spells.find((s) => s.type !== 'HEAL');
      if (pa >= attackSpell.cost && dist >= attackSpell.range[0] && dist <= attackSpell.range[1]) {
        const power = attackSpell.type === 'MAGICAL' ? this.stats.mag : this.stats.atk;
        const defense = attackSpell.type === 'MAGICAL' ? other.stats.res : other.stats.def;
        const dmg = calculateDamage(attackSpell.dmg[0], attackSpell.dmg[1], power, defense);
        other.currentVit -= dmg;
        pa -= attackSpell.cost;
      } else {
        break; // Can't do more
      }
    }
  }
}

function simulateCombat(build1, build2) {
  const f1 = new Fighter(build1, 1);
  const f2 = new Fighter(build2, 10);

  const init1 = calculateInitiative(f1.stats.ini);
  const init2 = calculateInitiative(f2.stats.ini);

  let turn = 0;
  let players = init1 >= init2 ? [f1, f2] : [f2, f1];

  while (f1.currentVit > 0 && f2.currentVit > 0 && turn < 100) {
    for (const p of players) {
      const other = p === f1 ? f2 : f1;
      p.takeTurn(other);
      if (other.currentVit <= 0) break;
    }
    turn++;
  }

  return { winner: f1.currentVit > 0 ? build1.name : build2.name, turns: turn };
}

function simulateSession(build1, build2) {
  let p1Wins = 0;
  let p2Wins = 0;
  for (let i = 0; i < 5; i++) {
    const res = simulateCombat(build1, build2);
    if (res.winner === build1.name) p1Wins++;
    else p2Wins++;
    if (p1Wins === 3 || p2Wins === 3) break;
  }
  return p1Wins > p2Wins ? build1.name : build2.name;
}

// --- Main Simulation Loop ---

const TOTAL_SESSIONS = 100000;
const results = {
  Manche: {},
  Session: {},
  Counts: {},
};

const pairs = [
  ['WARRIOR', 'MAGE'],
  ['WARRIOR', 'NINJA'],
  ['MAGE', 'NINJA'],
  ['WARRIOR', 'WARRIOR'],
  ['MAGE', 'MAGE'],
  ['NINJA', 'NINJA'],
];

pairs.forEach(([p1, p2]) => {
  const key = `${p1} vs ${p2}`;
  results.Counts[key] = 0;
  results.Manche[key] = { [p1]: 0, [p2]: 0 };
  results.Session[key] = { [p1]: 0, [p2]: 0 };
});

console.log(`Starting ${TOTAL_SESSIONS} combat sessions...`);

for (let i = 0; i < TOTAL_SESSIONS; i++) {
  const [p1Key, p2Key] = pairs[Math.floor(Math.random() * pairs.length)];
  const key = `${p1Key} vs ${p2Key}`;
  const build1 = BUILDS[p1Key];
  const build2 = BUILDS[p2Key];

  // Manches
  let p1Wins = 0;
  let p2Wins = 0;
  for (let j = 0; j < 5; j++) {
    const res = simulateCombat(build1, build2);
    if (res.winner === build1.name) {
      results.Manche[key][p1Key]++;
      p1Wins++;
    } else {
      results.Manche[key][p2Key]++;
      p2Wins++;
    }
    if (p1Wins === 3 || p2Wins === 3) break;
  }

  // Session
  if (p1Wins > p2Wins) results.Session[key][p1Key]++;
  else results.Session[key][p2Key]++;

  results.Counts[key]++;

  if (i % 10000 === 0 && i > 0) console.log(`${i} sessions completed...`);
}

// --- Post-Processing & Output ---

console.log('\n--- SIMULATION RESULTS ---');
pairs.forEach(([p1, p2]) => {
  const key = `${p1} vs ${p2}`;
  const count = results.Counts[key];
  const winP1 = results.Session[key][p1];
  const winP2 = results.Session[key][p2];

  console.log(`\nMatchup: ${key} (${count} matches)`);
  console.log(`  Session Win Rate ${p1}: ${((winP1 / count) * 100).toFixed(2)}%`);
  console.log(`  Session Win Rate ${p2}: ${((winP2 / count) * 100).toFixed(2)}%`);
});

fs.writeFileSync('balance_results.json', JSON.stringify(results, null, 2));
console.log('\nResults saved to balance_results.json');
