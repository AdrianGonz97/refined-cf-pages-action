import type { getOctokit } from '@actions/github';
import type { config } from './config';

export type Octokit = ReturnType<typeof getOctokit>;

export type ActionConfig = typeof config;
