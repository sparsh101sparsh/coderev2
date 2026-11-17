import fs from 'node:fs';
import { prisma } from '../lib/prisma';

type Entry = {
  problemId: string;
  lessonPath: string;
  hasVisualizer: boolean;
};

type ProblemRef = {
  id: string;
  slug: string;
};

async function loadProblemRefs(ids: string[]): Promise<ProblemRef[]> {
  try {
    return await prisma.problem.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });
  } catch (error) {
    console.warn('Visualizer catalog DB lookup failed; falling back to prisma/seedData/leetcode400.json.');
    const seedProblems = JSON.parse(fs.readFileSync('prisma/seedData/leetcode400.json', 'utf8')) as ProblemRef[];
    const seedBySlug = new Map(seedProblems.map((p) => [p.slug, p]));
    const entries = Object.values(JSON.parse(fs.readFileSync('public/data/visualizers.json', 'utf8'))) as Entry[];
    const entrySlugMap = new Map(entries.map((e) => [e.problemId, e.lessonPath.split('/').filter(Boolean).pop() || '']));
    
    return ids.map((id) => {
      const slug = entrySlugMap.get(id);
      if (slug && seedBySlug.has(slug)) {
        return { id, slug };
      }
      return null;
    }).filter(Boolean) as ProblemRef[];
  }
}

async function main() {
  const entries = Object.values(JSON.parse(fs.readFileSync('public/data/visualizers.json', 'utf8'))) as Entry[];
  const ids = entries.map((entry) => entry.problemId);
  const problems = await loadProblemRefs(ids);
  const byId = new Map(problems.map((problem) => [problem.id, problem.slug]));
  const failures = entries.flatMap((entry) => {
    const expectedSlug = entry.lessonPath.split('/').filter(Boolean).pop();
    const actualSlug = byId.get(entry.problemId);
    return actualSlug && actualSlug === expectedSlug && entry.hasVisualizer
      ? []
      : [`${entry.problemId}: expected ${expectedSlug}, found ${actualSlug || 'missing'}`];
  });

  if (failures.length > 0) {
    throw new Error(`Visualizer catalog integrity failed:\n${failures.join('\n')}`);
  }

  console.log(`Visualizer catalog integrity: ${entries.length} entries resolve to canonical problem records.`);
}

main().finally(() => prisma.$disconnect());
