import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes source and test files to identify test coverage gaps, untested paths, and actionable test recommendations.',

  model: 'inherit',

  prompt: TEST_COVERAGE_ANALYZER_PROMPT,

  tools: [
    'mcp__github__get_pull_request',
    'mcp__github__get_pull_request_files',
    'mcp__github__get_file_contents',
    'Skill',
  ],
};
