
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { ReviewReport } from './types/report-types.js';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
} from './types/report-types.js';
import { mcpServersConfig } from './config/mcp.config.js';
import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester,
} from './agents/index.js';
import { ORCHESTRATOR_PROMPT } from './prompts/orchestrator.prompt.js';
import { withRetry, withAbortTimeout } from './utils/error-handler.js';

/**
 * Orchestrator configuration options.
 */
export interface OrchestratorOptions {
  model?: string;
  cwd?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Main Code Review Orchestrator.
 *
 * Coordinates the specialized agents through Claude Agent SDK's
 * Task-based subagent system and aggregates their results into a
 * validated ReviewReport.
 */
export class CodeReviewOrchestrator {
  private readonly options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  /**
   * Review a pull request using the three specialized review agents.
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!owner.trim()) {
      throw new Error('Repository owner is required.');
    }

    if (!repo.trim()) {
      throw new Error('Repository name is required.');
    }

    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error('Pull request number must be a positive integer.');
    }

    const prompt = `
${ORCHESTRATOR_PROMPT}

Repository owner: ${owner}
Repository name: ${repo}
Pull request number: ${prNumber}

Begin by fetching pull request #${prNumber} from ${owner}/${repo}.
Analyze the actual changed files and repository contents before invoking
the specialized agents.

Produce the final ReviewReport for exactly this pull request.
`;

    try {
      return await withRetry(
        () =>
          withAbortTimeout(
            (abortController) =>
              this.executeReview(prompt, abortController),
            this.options.timeoutMs ?? 360000,
            `Review timed out after ${
              this.options.timeoutMs ?? 360000
            } milliseconds`
          ),
        this.options.maxRetries ?? 2,
        this.options.retryDelayMs ?? 1000
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to review ${owner}/${repo}#${prNumber}: ${error.message}`,
          { cause: error }
        );
      }

      throw new Error(
        `Failed to review ${owner}/${repo}#${prNumber}: Unknown error`
      );
    }
  }

  private async executeReview(
    prompt: string,
    abortController: AbortController
  ): Promise<ReviewReport> {
    const response = query({
      prompt,
      options: {
        model: this.options.model ?? process.env.ANTHROPIC_MODEL,
        cwd: this.options.cwd ?? process.env.PROJECT_ROOT ?? process.cwd(),

        abortController,

        mcpServers: mcpServersConfig,

        agents: {
          codeQualityAnalyzer,
          testCoverageAnalyzer,
          refactoringSuggester,
        },

        allowedTools: [
          'Task',
          'mcp__github__get_pull_request',
          'mcp__github__get_pull_request_files',
          'mcp__github__get_file_contents',
        ],

        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },

        maxTurns: this.options.maxTurns ?? 50,
        maxBudgetUsd: this.options.maxBudgetUsd,
      },
    });

    for await (const message of response) {
      if (message.type !== 'result') {
        continue;
      }

      if (message.subtype !== 'success') {
        throw new Error(
          `Review failed with SDK result subtype: ${message.subtype}`
        );
      }

      if (!message.structured_output) {
        throw new Error(
          'Review completed but no structured ReviewReport was returned.'
        );
      }

      const parsed = ReviewReportSchema.safeParse(
        message.structured_output
      );

      if (!parsed.success) {
        throw new Error(
          `Invalid ReviewReport returned by orchestrator: ${parsed.error.message}`
        );
      }

      return parsed.data;
    }

    throw new Error('Claude Agent SDK returned no result message.');
  }
}
