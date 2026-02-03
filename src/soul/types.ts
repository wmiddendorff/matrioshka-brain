/**
 * Soul Module Types
 *
 * Type definitions for the soul/identity persistence system.
 */

/** Soul file types that can be read and managed */
export type SoulFileType = 'soul' | 'identity' | 'agents' | 'user';

/** Soul files that the agent can propose updates to (not user or identity) */
export type ProposableSoulFile = 'soul' | 'agents';

/** Result from reading a soul file */
export interface SoulReadResult {
  file: SoulFileType;
  content: string;
  lastModified: number;
}

/** Map from SoulFileType to the actual filename in workspace/ */
export const SOUL_FILE_MAP: Record<SoulFileType, string> = {
  soul: 'SOUL.md',
  identity: 'IDENTITY.md',
  agents: 'AGENTS.md',
  user: 'USER.md',
};
