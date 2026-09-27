import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code for security, performance, maintainability, style, bug risks, and best-practice issues.',

  model: 'inherit',

  prompt: CODE_QUALITY_ANALYZER_PROMPT,

  tools: [
    'mcp__github__get_pull_request',
    'mcp__github__get_pull_request_files',
    'mcp__github__get_file_contents',
    'Skill',
  ],
};
