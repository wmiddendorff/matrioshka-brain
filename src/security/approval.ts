import * as readline from 'readline';

/**
 * Approval System
 *
 * Handles user approval prompts in the terminal.
 */

export interface ApprovalRequest {
  title: string;
  description: string;
  details?: Record<string, string>;
}

export class ApprovalManager {
  private rl?: readline.Interface;

  /**
   * Prompt user for approval
   *
   * @returns true if approved, false if denied
   */
  public async requestApproval(request: ApprovalRequest): Promise<boolean> {
    console.log('\n┌──────────────────────────────────────────────────┐');
    console.log('│ APPROVAL REQUIRED                                │');
    console.log('├──────────────────────────────────────────────────┤');
    console.log(`│ ${request.title.padEnd(48)} │`);
    console.log('├──────────────────────────────────────────────────┤');
    console.log(`│ ${request.description.padEnd(48)} │`);

    if (request.details) {
      console.log('├──────────────────────────────────────────────────┤');
      for (const [key, value] of Object.entries(request.details)) {
        const line = `${key}: ${value}`;
        console.log(`│ ${line.padEnd(48)} │`);
      }
    }

    console.log('├──────────────────────────────────────────────────┤');
    console.log('│ [A]pprove  [D]eny                                │');
    console.log('└──────────────────────────────────────────────────┘\n');

    const answer = await this.prompt('Your choice (A/D): ');
    const normalized = answer.trim().toLowerCase();

    return normalized === 'a' || normalized === 'approve';
  }

  /**
   * Prompt user for input
   */
  private async prompt(question: string): Promise<string> {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }

    return new Promise((resolve) => {
      this.rl!.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  /**
   * Close readline interface
   */
  public close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
  }
}
