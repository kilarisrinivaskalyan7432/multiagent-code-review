import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies practical refactoring opportunities for improving code structure, readability, maintainability, and modern coding practices.',

  model: 'inherit',

  prompt: REFACTORING_SUGGESTER_PROMPT,

  tools: [
    'mcp__github__get_pull_request',
    'mcp__github__get_pull_request_files',
    'mcp__github__get_file_contents',
    'Skill',
  ],
};
