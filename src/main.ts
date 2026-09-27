import * as dotenv from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError } from './utils/error-handler.js';

// Load environment variables.
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System.
 *
 * Usage:
 *   npm run dev -- <owner> <repo> <pr-number>
 */
async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);

  // ------------------------------------------------------------
  // 1. Validate command-line arguments
  // ------------------------------------------------------------
  if (!owner || !repo || !prStr) {
    console.error(
      'Usage: npm run dev -- <owner> <repo> <pr-number>'
    );
    process.exitCode = 1;
    return;
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error(
      `Invalid pull request number: "${prStr}". ` +
      'PR number must be a positive integer.'
    );
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------
  // 2. Validate authentication
  // ------------------------------------------------------------
  const hasAnthropicApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  const hasAwsCredentials =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error(
        'AWS credentials were found, but AWS_REGION is not set.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicApiKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error(
      'No Claude authentication configured.\n\n' +
      'Configure either:\n' +
      '  1. ANTHROPIC_API_KEY\n' +
      '  2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION'
    );
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------
  // 3. Validate model configuration
  // ------------------------------------------------------------
  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    console.error(
      'ANTHROPIC_MODEL is not configured.\n\n' +
      'Anthropic API example:\n' +
      '  claude-sonnet-4-5-20250929\n\n' +
      'AWS Bedrock example:\n' +
      '  us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`🤖 Model: ${model}`);
  console.log(`🔍 Reviewing ${owner}/${repo}#${prNumber}`);

  try {
    // ----------------------------------------------------------
    // 4. Create orchestrator
    // ----------------------------------------------------------
    const orchestrator = new CodeReviewOrchestrator({
      model,
      cwd: process.env.PROJECT_ROOT ?? process.cwd(),
    });

    // ----------------------------------------------------------
    // 5. Run the multi-agent review
    // ----------------------------------------------------------
    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    // ----------------------------------------------------------
    // 6. Generate all three report formats
    // ----------------------------------------------------------
    const reportGenerator = new ReportGenerator();

    const markdownReport =
      reportGenerator.generateMarkdownReport(report);

    const htmlReport =
      reportGenerator.generateHTMLReport(report);

    const jsonReport =
      reportGenerator.generateJSONReport(report);

    // ----------------------------------------------------------
    // 7. Save reports
    // ----------------------------------------------------------
    const reportsDirectory = path.resolve(
      process.env.PROJECT_ROOT ?? process.cwd(),
      'reports'
    );

    await mkdir(reportsDirectory, { recursive: true });

    const baseName =
      `${owner}_${repo}_${prNumber}`;

    const jsonPath = path.join(
      reportsDirectory,
      `${baseName}.json`
    );

    const markdownPath = path.join(
      reportsDirectory,
      `${baseName}.md`
    );

    const htmlPath = path.join(
      reportsDirectory,
      `${baseName}.html`
    );

    await Promise.all([
      writeFile(jsonPath, jsonReport, 'utf8'),
      writeFile(markdownPath, markdownReport, 'utf8'),
      writeFile(htmlPath, htmlReport, 'utf8'),
    ]);

    // ----------------------------------------------------------
    // 8. Display completion summary
    // ----------------------------------------------------------
    console.log('\n✅ Review completed successfully!');
    console.log(`📊 Overall score: ${report.summary.overallScore}/100`);
    console.log(`📁 Files reviewed: ${report.summary.totalFiles}`);
    console.log(`🚨 Critical issues: ${report.summary.criticalIssues}`);
    console.log(
      `🧪 High-priority tests: ${report.summary.highPriorityTests}`
    );
    console.log(
      `🔧 Refactoring opportunities: ${report.summary.refactoringOpportunities}`
    );

    console.log('\n📄 Reports generated:');
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${markdownPath}`);
    console.log(`  HTML: ${htmlPath}`);
  } catch (error) {
    console.error('\n❌ Review failed.');
    console.error(formatError(error));

    if (error instanceof Error && error.cause) {
      console.error(
        'Cause:',
        error.cause instanceof Error
          ? error.cause.message
          : String(error.cause)
      );
    }

    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error('Unexpected application error:');
  console.error(formatError(error));
  process.exitCode = 1;
});
