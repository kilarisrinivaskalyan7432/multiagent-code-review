import { describe, expect, it } from 'vitest';
import {
  CodeQualityResultJSONSchema,
  CodeQualityResultSchema,
  RefactoringSuggestionJSONSchema,
  RefactoringSuggestionSchema,
  TestCoverageResultJSONSchema,
  TestCoverageResultSchema,
} from '../src/types/analysis-results.js';
import {
  ReviewReportJSONSchema,
  ReviewReportSchema,
} from '../src/types/report-types.js';

const validCodeQuality = {
  file: 'src/example.js',
  issues: [],
  overallScore: 100,
  summary: 'No confirmed issues found.',
};

const validTestCoverage = {
  file: 'src/example.js',
  hasTests: false,
  testFiles: [],
  untestedPaths: [],
  coverageEstimate: 0,
  summary: 'No corresponding tests were found.',
};

const validRefactoring = {
  file: 'src/example.js',
  suggestions: [],
  summary: 'No refactoring suggestions.',
};

const validReviewReport = {
  pullRequest: {
    owner: 'damisparks',
    repo: 'todo-app-review-fixture',
    number: 1,
  },
  fileReviews: [],
  summary: {
    totalFiles: 0,
    overallScore: 100,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 0,
    agentVersions: {},
  },
};

describe('CodeQualityResultSchema', () => {
  it('accepts valid data', () => {
    expect(CodeQualityResultSchema.safeParse(validCodeQuality).success).toBe(true);
  });

  it('accepts score boundaries 0 and 100', () => {
    expect(
      CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: 0 }).success,
    ).toBe(true);
    expect(
      CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: 100 }).success,
    ).toBe(true);
  });

  it('rejects an invalid severity', () => {
    const invalid = {
      ...validCodeQuality,
      issues: [
        {
          line: 1,
          severity: 'urgent',
          category: 'security',
          description: 'Invalid severity',
          suggestion: 'Fix it',
        },
      ],
    };

    expect(CodeQualityResultSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts valid data', () => {
    expect(TestCoverageResultSchema.safeParse(validTestCoverage).success).toBe(true);
  });

  it('accepts coverage boundaries 0 and 100', () => {
    expect(
      TestCoverageResultSchema.safeParse({ ...validTestCoverage, coverageEstimate: 0 }).success,
    ).toBe(true);
    expect(
      TestCoverageResultSchema.safeParse({ ...validTestCoverage, coverageEstimate: 100 }).success,
    ).toBe(true);
  });

  it('rejects an invalid priority', () => {
    const invalid = {
      ...validTestCoverage,
      untestedPaths: [
        {
          type: 'function',
          location: 'line 10',
          priority: 'urgent',
          reasoning: 'Missing coverage',
          suggestedTest: 'Add a test',
        },
      ],
    };

    expect(TestCoverageResultSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts valid data and empty suggestions', () => {
    expect(RefactoringSuggestionSchema.safeParse(validRefactoring).success).toBe(true);
  });

  it('rejects an invalid refactoring type', () => {
    const invalid = {
      ...validRefactoring,
      suggestions: [
        {
          type: 'delete-everything',
          location: 'line 1',
          impact: 'high',
          description: 'Invalid type',
          before: 'before',
          after: 'after',
          benefits: 'benefits',
        },
      ],
    };

    expect(RefactoringSuggestionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('ReviewReportSchema', () => {
  it('accepts a valid minimal report', () => {
    expect(ReviewReportSchema.safeParse(validReviewReport).success).toBe(true);
  });

  it('accepts empty arrays and boundary score 100', () => {
    expect(ReviewReportSchema.safeParse(validReviewReport).success).toBe(true);
  });

  it('accepts a populated file review', () => {
    const populated = {
      ...validReviewReport,
      fileReviews: [
        {
          file: 'src/example.js',
          codeQuality: validCodeQuality,
          testCoverage: validTestCoverage,
          refactorings: validRefactoring,
        },
      ],
    };

    expect(ReviewReportSchema.safeParse(populated).success).toBe(true);
  });

  it('rejects missing required fields', () => {
    expect(ReviewReportSchema.safeParse({ pullRequest: {} }).success).toBe(false);
  });

  it('rejects the wrong PR number type', () => {
    const invalid = {
      ...validReviewReport,
      pullRequest: { ...validReviewReport.pullRequest, number: '1' },
    };

    expect(ReviewReportSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('JSON schema exports', () => {
  it('exports object schemas with properties and required fields', () => {
    const schemas = [
      CodeQualityResultJSONSchema,
      TestCoverageResultJSONSchema,
      RefactoringSuggestionJSONSchema,
      ReviewReportJSONSchema,
    ];

    for (const schema of schemas) {
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeTypeOf('object');
      expect(Array.isArray(schema.required)).toBe(true);
    }
  });

  it('marks all ReviewReport top-level fields as required', () => {
    expect(ReviewReportJSONSchema.required).toEqual(
      expect.arrayContaining([
        'pullRequest',
        'fileReviews',
        'summary',
        'recommendations',
        'metadata',
      ]),
    );
    expect(ReviewReportJSONSchema.required).toHaveLength(5);
  });
});
