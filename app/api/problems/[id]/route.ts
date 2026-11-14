import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFallbackProblemByIdOrSlug } from '@/lib/catalogFallback';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeEditorial = searchParams.get('includeEditorial') === 'true';

  try {
    const problem = await prisma.problem.findFirst({
      where: {
        OR: [{ id: id }, { slug: id }],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        statement: true,
        inputFormat: true,
        outputFormat: true,
        constraints: true,
        difficulty: true,
        topicTags: true,
        companyTags: true,
        editorial: true,
        timeLimit: true,
        memoryLimit: true,
        createdAt: true,
        testCases: {
          where: { isSample: true },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            isSample: true,
            explanation: true,
          },
        },
        codeTemplates: {
          select: {
            id: true,
            language: true,
            code: true,
          },
        },
      },
    });

    if (problem) {
      let parsedTopicTags: string[] = [];
      let parsedCompanyTags: string[] = [];

      try {
        parsedTopicTags = JSON.parse(problem.topicTags);
      } catch {
        parsedTopicTags = [];
      }

      try {
        parsedCompanyTags = JSON.parse(problem.companyTags);
      } catch {
        parsedCompanyTags = [];
      }

      const responseData = {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        statement: problem.statement,
        inputFormat: problem.inputFormat,
        outputFormat: problem.outputFormat,
        constraints: problem.constraints,
        difficulty: problem.difficulty,
        topicTags: parsedTopicTags,
        companyTags: parsedCompanyTags,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
        editorial: includeEditorial ? problem.editorial : null,
        testCases: problem.testCases,
        codeTemplates: problem.codeTemplates,
        createdAt: problem.createdAt,
      };

      return NextResponse.json(responseData);
    }
  } catch (error: unknown) {
    console.warn(`Database single problem query failed for ${id}, falling back to static catalog:`, error);
  }

  // Graceful fallback to static dataset if problem not found in DB or DB is unseeded
  const fallback = getFallbackProblemByIdOrSlug(id, includeEditorial);
  if (fallback) {
    return NextResponse.json(fallback);
  }

  return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
}
