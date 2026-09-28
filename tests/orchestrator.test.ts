import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { CodeReviewOrchestrator } from '../src/orchestrator.js';

const validReport = {
  pullRequest: {
    owner: 'damisparks',
    repo: 'todo-app-review-fixture',
    number: 2,
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
    duration: 10,
    agentVersions: {},
  },
};

async function* successResponse(report: unknown) {
  yield { type: 'system', subtype: 'init' };
  yield {
    type: 'result',
    subtype: 'success',
    structured_output: report,
  };
}

async function* failedResponse() {
  yield {
    type: 'result',
    subtype: 'error_during_execution',
  };
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReturnValue(successResponse(validReport));
  });

  describe('input validation', () => {
    it('rejects an empty repository owner without calling the SDK', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('', 'repo', 1)
      ).rejects.toThrow('Repository owner is required.');

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('rejects an empty repository name without calling the SDK', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('owner', '', 1)
      ).rejects.toThrow('Repository name is required.');

      expect(queryMock).not.toHaveBeenCalled();
    });

    it('rejects a non-positive or non-integer PR number without calling the SDK', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('owner', 'repo', 0)
      ).rejects.toThrow('Pull request number must be a positive integer.');

      await expect(
        orchestrator.reviewPullRequest('owner', 'repo', 1.5)
      ).rejects.toThrow('Pull request number must be a positive integer.');

      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  describe('reviewPullRequest', () => {
    it('configures the SDK with Task, all three agents, MCP tools, and structured output', async () => {
      const orchestrator = new CodeReviewOrchestrator({
        model: 'test-model',
        cwd: '/tmp/project',
        maxTurns: 8,
        maxRetries: 0,
        timeoutMs: 5000,
      });

      const report = await orchestrator.reviewPullRequest(
        'damisparks',
        'todo-app-review-fixture',
        2
      );

      expect(report).toEqual(validReport);
      expect(queryMock).toHaveBeenCalledTimes(1);

      const request = queryMock.mock.calls[0]?.[0];
      expect(request.options.model).toBe('test-model');
      expect(request.options.cwd).toBe('/tmp/project');
      expect(request.options.allowedTools).toEqual(
        expect.arrayContaining([
          'Task',
          'mcp__github__get_pull_request',
          'mcp__github__get_pull_request_files',
          'mcp__github__get_file_contents',
        ])
      );
      expect(Object.keys(request.options.agents)).toEqual(
        expect.arrayContaining([
          'codeQualityAnalyzer',
          'testCoverageAnalyzer',
          'refactoringSuggester',
        ])
      );
      expect(request.options.outputFormat).toMatchObject({
        type: 'json_schema',
      });
      expect(request.prompt).toContain(
        'Use the code-quality-analyzer agent'
      );
      expect(request.prompt).toContain(
        'Use the test-coverage-analyzer agent'
      );
      expect(request.prompt).toContain(
        'Use the refactoring-suggester agent'
      );
    });

    it('validates the SDK structured output with ReviewReportSchema', async () => {
      queryMock.mockReturnValue(
        successResponse({ pullRequest: { owner: 'invalid' } })
      );

      const orchestrator = new CodeReviewOrchestrator({
        maxRetries: 0,
        timeoutMs: 5000,
      });

      try {
        await orchestrator.reviewPullRequest('owner', 'repo', 1);
        throw new Error('Expected reviewPullRequest to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);

        const cause = (error as Error & { cause?: unknown }).cause;

        expect(cause).toMatchObject({
          code: 'RETRY_EXHAUSTED',
          metadata: expect.objectContaining({
            cause: expect.stringContaining(
              'Invalid ReviewReport returned by orchestrator'
            ),
          }),
        });
      }
    });

    it('surfaces a clear SDK failure when the result subtype is not success', async () => {
      queryMock.mockReturnValue(failedResponse());

      const orchestrator = new CodeReviewOrchestrator({
        maxRetries: 0,
        timeoutMs: 5000,
      });

      try {
        await orchestrator.reviewPullRequest('owner', 'repo', 1);
        throw new Error('Expected reviewPullRequest to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);

        const cause = (error as Error & { cause?: unknown }).cause;

        expect(cause).toMatchObject({
          code: 'RETRY_EXHAUSTED',
          metadata: expect.objectContaining({
            cause: expect.stringContaining(
              'Review failed with SDK result subtype'
            ),
          }),
        });
      }
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Manual smoke test only; requires live API credentials and MCP access.
      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
    });
  });
});
