import fs from 'fs';
import path from 'path';
import visualizerData from '@/public/data/visualizers.json';

export interface FallbackProblemItem {
  id: string;
  frontendId?: number;
  slug: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  difficulty: string;
  topicTags: string[];
  companyTags: string[];
  editorial: string;
  timeLimit: number;
  memoryLimit: number;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isSample: boolean;
    explanation?: string;
  }>;
  codeTemplates?: Record<string, string>;
  createdAt?: string;
  solved?: boolean;
}

let cachedDataset: FallbackProblemItem[] | null = null;
let datasetIndexMap: Map<string, FallbackProblemItem> | null = null;

function loadDataset(): FallbackProblemItem[] {
  if (cachedDataset) return cachedDataset;

  try {
    const datasetPath = path.join(process.cwd(), 'prisma', 'seedData', 'leetcode400.json');
    if (fs.existsSync(datasetPath)) {
      const raw = fs.readFileSync(datasetPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedDataset = parsed.map((item, index) => ({
          ...item,
          id: item.id || `prob-${index + 1}`,
          createdAt: item.createdAt || new Date(Date.now() - index * 60000).toISOString(),
        }));

        datasetIndexMap = new Map();
        for (const prob of cachedDataset) {
          if (prob.id) datasetIndexMap.set(prob.id.toLowerCase(), prob);
          if (prob.slug) datasetIndexMap.set(prob.slug.toLowerCase(), prob);
        }
        return cachedDataset;
      }
    }
  } catch (error) {
    console.error('Failed to load fallback leetcode400 dataset:', error);
  }

  cachedDataset = [];
  datasetIndexMap = new Map();
  return cachedDataset;
}

export function getFallbackProblems(options: {
  difficulty?: string;
  topic?: string;
  company?: string;
  search?: string;
  ids?: string[];
  page?: number;
  limit?: number;
  prioritizeVisualizers?: boolean;
}) {
  const allProblems = loadDataset();
  const {
    difficulty,
    topic,
    company,
    search,
    ids = [],
    page = 1,
    limit = 20,
    prioritizeVisualizers = false,
  } = options;

  let filtered = allProblems;

  if (ids.length > 0) {
    const idSet = new Set(ids.map((id) => id.toLowerCase()));
    filtered = filtered.filter(
      (p) => idSet.has(p.id.toLowerCase()) || idSet.has(p.slug.toLowerCase())
    );
  }

  if (difficulty && ['EASY', 'MEDIUM', 'HARD'].includes(difficulty.toUpperCase())) {
    filtered = filtered.filter((p) => p.difficulty.toUpperCase() === difficulty.toUpperCase());
  }

  if (topic) {
    const searchTopic = topic.toLowerCase();
    filtered = filtered.filter((p) =>
      p.topicTags.some((t) => t.toLowerCase().includes(searchTopic))
    );
  }

  if (company) {
    const searchCompany = company.toLowerCase();
    filtered = filtered.filter((p) =>
      p.companyTags.some((c) => c.toLowerCase().includes(searchCompany))
    );
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(searchLower) ||
        p.statement.toLowerCase().includes(searchLower) ||
        p.slug.toLowerCase().includes(searchLower)
    );
  }

  if (prioritizeVisualizers && ids.length === 0) {
    const visualizerIds = new Set(Object.keys(visualizerData).map((k) => k.toLowerCase()));
    const visualized = filtered.filter(
      (p) => visualizerIds.has(p.id.toLowerCase()) || visualizerIds.has(p.slug.toLowerCase())
    );
    const regular = filtered.filter(
      (p) => !visualizerIds.has(p.id.toLowerCase()) && !visualizerIds.has(p.slug.toLowerCase())
    );
    filtered = [...visualized, ...regular];
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  const problems = paginated.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    statement: p.statement,
    inputFormat: p.inputFormat,
    outputFormat: p.outputFormat,
    constraints: p.constraints,
    difficulty: p.difficulty,
    topicTags: p.topicTags,
    companyTags: p.companyTags,
    timeLimit: p.timeLimit,
    memoryLimit: p.memoryLimit,
    createdAt: p.createdAt,
    solved: false,
  }));

  return {
    problems,
    total,
    page,
    limit,
    totalPages,
  };
}

export function getFallbackProblemByIdOrSlug(
  idOrSlug: string,
  includeEditorial = false
) {
  loadDataset();
  if (!datasetIndexMap) return null;

  const key = idOrSlug.trim().toLowerCase();
  const problem = datasetIndexMap.get(key);
  if (!problem) return null;

  const sampleTestCases = (problem.testCases || [])
    .filter((tc) => tc.isSample)
    .map((tc, idx) => ({
      id: `sample-${idx + 1}`,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isSample: true,
      explanation: tc.explanation || null,
    }));

  const codeTemplates = Object.entries(problem.codeTemplates || {}).map(
    ([language, code], idx) => ({
      id: `template-${idx + 1}`,
      language,
      code,
    })
  );

  return {
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    statement: problem.statement,
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    constraints: problem.constraints,
    difficulty: problem.difficulty,
    topicTags: problem.topicTags,
    companyTags: problem.companyTags,
    timeLimit: problem.timeLimit,
    memoryLimit: problem.memoryLimit,
    editorial: includeEditorial ? problem.editorial : null,
    testCases: sampleTestCases,
    codeTemplates: codeTemplates,
    createdAt: problem.createdAt || new Date().toISOString(),
  };
}
