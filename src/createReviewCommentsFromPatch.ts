import * as core from '@actions/core';
import * as github from '@actions/github';

import {parseGitPatch} from './parseGitPatch';
import {deleteOldReviewComments} from './deleteOldReviewComments';

type Octokit = ReturnType<typeof github.getOctokit>;

type Params = {
  octokit: Octokit;
  owner: string;
  repo: string;
  commentBody: string;
  gitDiff: string;
  pullRequest: number;
  commitId: string;
};

export async function createReviewCommentsFromPatch({
  octokit,
  owner,
  repo,
  commentBody,
  gitDiff,
  pullRequest,
  commitId,
}: Params) {
  if (!gitDiff) {
    return;
  }

  const patches = parseGitPatch(gitDiff);

  if (!patches.length) {
    return;
  }

  // Delete existing review comments from this bot
  await deleteOldReviewComments({
    octokit,
    owner,
    repo,
    commentBody,
    pullRequest,
  });

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullRequest,
      body: commentBody,
      commit_id: commitId,
      event: 'COMMENT',
      comments: patches.map(patch => ({
        body: `\`\`\`suggestion
${patch.added.lines.join('\n')}
\`\`\`
`,
        path: patch.removed.file,
        side: 'RIGHT',
        start_side: 'RIGHT',
        start_line:
          patch.removed.start !== patch.removed.end
            ? patch.removed.start
            : undefined,
        line: patch.removed.end,
      })),
      mediaType: {
        previews: ['comfort-fade'],
      },
    });
  } catch (err) {
    core.error(err as Error);
    throw err;
  }
}
