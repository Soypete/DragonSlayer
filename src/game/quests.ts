/**
 * The Quest Ledger — deeds posted on the guild board.
 *
 * Quest ids are deterministic so regenerating after a fresh scan preserves
 * the status of quests the knight has already taken up (or completed).
 */

import type { Dragon, Quest, QuestObjective, RepoScan } from '../types.js';

/** Coverage milestones the realm celebrates, in ascending order. */
const COVERAGE_MILESTONES = [50, 75, 90, 100] as const;

const COVERAGE_XP: Record<number, number> = { 50: 150, 75: 300, 90: 600, 100: 1200 };

const TDD_BASELINE_PREFIX = 'tdd:baseline:';

function totalLinePct(scan: RepoScan): number {
  return scan.coverage?.totals.lines.pct ?? 0;
}

function fileLinePct(scan: RepoScan, file: string): number | null {
  const entry = scan.coverage?.files.find((f) => f.path === file);
  return entry ? entry.lines.pct : null;
}

function dragonIsSlain(target: string, scan: RepoScan, dragons: Dragon[]): boolean {
  const dragon = dragons.find((d) => d.id === target);
  if (dragon) return dragon.slain;
  // No dragon record — fall back to the coverage scrolls.
  return fileLinePct(scan, target) === 100;
}

/** Pull the test-file count recorded when a tdd quest was first posted. */
function tddBaseline(quest: Quest): number | null {
  for (const obj of quest.objectives) {
    if (obj.id.startsWith(TDD_BASELINE_PREFIX)) {
      const parsed = Number.parseInt(obj.id.slice(TDD_BASELINE_PREFIX.length), 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function objectiveDone(quest: Quest, objective: QuestObjective, scan: RepoScan, dragons: Dragon[]): boolean {
  switch (quest.kind) {
    case 'slay':
      return quest.target ? dragonIsSlain(quest.target, scan, dragons) : objective.done;
    case 'coverage': {
      const threshold = Number.parseInt(quest.id.split(':')[1] ?? '', 10);
      return Number.isFinite(threshold) && totalLinePct(scan) >= threshold;
    }
    case 'tdd': {
      const baseline = tddBaseline(quest);
      return baseline !== null && scan.testFiles.length > baseline;
    }
    case 'ci':
      if (objective.id === 'ci:workflows') return scan.ci.workflows.length > 0;
      if (objective.id === 'ci:test-job') return scan.ci.hasTestJob;
      return objective.done;
    case 'e2e':
      if (objective.id === 'e2e:configured') return scan.playwright.configured;
      if (objective.id === 'e2e:specs') return scan.playwright.specCount >= 1;
      return objective.done;
    default:
      return objective.done;
  }
}

/**
 * Re-judge every quest against a fresh scan. Completed quests stay completed
 * (the bards have already sung of them); otherwise active quests stay active
 * until done, and available quests stay available.
 */
export function refreshQuestObjectives(quests: Quest[], scan: RepoScan, dragons: Dragon[]): Quest[] {
  return quests.map((quest) => {
    if (quest.status === 'complete') return quest;
    const objectives = quest.objectives.map((obj) => ({
      ...obj,
      done: objectiveDone(quest, obj, scan, dragons),
    }));
    const allDone = objectives.length > 0 && objectives.every((o) => o.done);
    return {
      ...quest,
      objectives,
      status: allDone ? 'complete' : quest.status,
    };
  });
}

function slayQuest(dragon: Dragon): Quest {
  return {
    id: `slay:${dragon.id}`,
    kind: 'slay',
    title: `Slay ${dragon.name}`,
    description:
      `The ${dragon.species} ${dragon.name} nests in ${dragon.file} with ` +
      `${dragon.maxHp} uncovered lines for scales. Only true tests pierce its hide.`,
    objectives: [
      {
        id: `slay:${dragon.id}:full-coverage`,
        description: `Bring ${dragon.file} to 100% line coverage`,
        done: dragon.slain,
      },
    ],
    xpReward: Math.max(50, dragon.maxHp * 2),
    status: dragon.slain ? 'complete' : 'available',
    target: dragon.id,
  };
}

function coverageQuest(threshold: number, scan: RepoScan): Quest {
  const done = totalLinePct(scan) >= threshold;
  return {
    id: `coverage:${threshold}`,
    kind: 'coverage',
    title:
      threshold === 100
        ? 'The Hundred-Percent Realm'
        : `Raise the Banner at ${threshold}%`,
    description:
      threshold === 100
        ? 'Cover every line in the kingdom. No dragon may remain.'
        : `Push total line coverage to ${threshold}% and reclaim that much of the realm.`,
    objectives: [
      {
        id: `coverage:${threshold}:total`,
        description: `Total line coverage ≥ ${threshold}%`,
        done,
      },
    ],
    xpReward: COVERAGE_XP[threshold] ?? threshold * 10,
    status: done ? 'complete' : 'available',
  };
}

function tddQuest(scan: RepoScan): Quest {
  const baseline = scan.testFiles.length;
  return {
    id: 'tdd',
    kind: 'tdd',
    title: 'The Test Count Must Rise',
    description:
      `The realm holds ${baseline} test ${baseline === 1 ? 'scroll' : 'scrolls'}. ` +
      'Pen at least one more — new steel for the armory.',
    objectives: [
      {
        id: `${TDD_BASELINE_PREFIX}${baseline}`,
        description: `Grow the test files beyond ${baseline}`,
        done: false,
      },
    ],
    xpReward: 200,
    status: 'available',
  };
}

function ciQuest(scan: RepoScan): Quest {
  const hasWorkflows = scan.ci.workflows.length > 0;
  const hasTestJob = scan.ci.hasTestJob;
  const done = hasWorkflows && hasTestJob;
  return {
    id: 'ci',
    kind: 'ci',
    title: 'Raise the Watchtower',
    description:
      'A kingdom without sentries falls in the night. Stand up a CI workflow ' +
      'that runs the test suite on every march.',
    objectives: [
      {
        id: 'ci:workflows',
        description: 'A workflow stands in .github/workflows',
        done: hasWorkflows,
      },
      {
        id: 'ci:test-job',
        description: 'The watchtower runs the tests',
        done: hasTestJob,
      },
    ],
    xpReward: 300,
    status: done ? 'complete' : 'available',
  };
}

function e2eQuest(scan: RepoScan): Quest {
  const configured = scan.playwright.configured;
  const hasSpecs = scan.playwright.specCount >= 1;
  const done = configured && hasSpecs;
  return {
    id: 'e2e',
    kind: 'e2e',
    title: 'Walk the Whole Gauntlet',
    description:
      'Unit steel alone cannot guard the gates. Raise Playwright and march ' +
      'an end-to-end patrol through the realm.',
    objectives: [
      {
        id: 'e2e:configured',
        description: 'Playwright is configured',
        done: configured,
      },
      {
        id: 'e2e:specs',
        description: 'At least one e2e spec patrols the realm',
        done: hasSpecs,
      },
    ],
    xpReward: 500,
    status: done ? 'complete' : 'available',
  };
}

/**
 * Post the guild board: slay quests for the five mightiest living dragons,
 * coverage milestones, and the tdd/ci/e2e standing orders. Existing quests
 * with matching ids keep their status and objective progress.
 */
export function generateQuests(scan: RepoScan, dragons: Dragon[], existing: Quest[]): Quest[] {
  const existingById = new Map(existing.map((q) => [q.id, q]));

  const living = dragons
    .filter((d) => !d.slain)
    .sort((a, b) => b.maxHp - a.maxHp || a.id.localeCompare(b.id))
    .slice(0, 5);

  const fresh: Quest[] = [
    ...living.map(slayQuest),
    ...COVERAGE_MILESTONES.map((t) => coverageQuest(t, scan)),
    tddQuest(scan),
    ciQuest(scan),
    e2eQuest(scan),
  ];

  const merged = fresh.map((quest) => {
    const prior = existingById.get(quest.id);
    if (!prior) return quest;
    // Preserve the knight's progress: status and any recorded objectives
    // (the tdd baseline lives in its objective id and must not be re-rolled).
    return {
      ...quest,
      status: prior.status,
      objectives: prior.objectives,
    };
  });

  // Keep prior quests that fell off the board (e.g. a slain dragon's deed)
  // only if they were completed — finished sagas stay in the ledger.
  const freshIds = new Set(merged.map((q) => q.id));
  const keptSagas = existing.filter((q) => !freshIds.has(q.id) && q.status === 'complete');

  return refreshQuestObjectives([...merged, ...keptSagas], scan, dragons);
}
