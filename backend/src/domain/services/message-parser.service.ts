/**
 * Message Parser Service
 *
 * Parses admin approval/rejection commands from WhatsApp messages.
 * Supports commands like "y 12345", "yes 12345", "n 12345", "no 12345".
 */

import type { ParsedCommand } from '../../infrastructure/whatsapp/types.js';

/**
 * Message Parser Service
 *
 * Parses incoming WhatsApp messages to extract approval/rejection commands.
 */
export class MessageParserService {
  /**
   * Approval patterns: y, yes (case-insensitive)
   */
  private readonly approvalPattern = /^(y|yes)\s+(.+)$/i;

  /**
   * Rejection patterns: n, no (case-insensitive)
   */
  private readonly rejectionPattern = /^(n|no)\s+(.+)$/i;

  /**
   * Parse a message body to extract an approval/rejection command
   *
   * Supported formats:
   * - "y <ID>" or "yes <ID>" → approve
   * - "n <ID>" or "no <ID>" → reject
   * - anything else → unknown
   *
   * @param rawBody - The raw message text
   * @returns Parsed command with action and request ID
   */
  parseCommand(rawBody: string): ParsedCommand {
    // Normalize: trim and collapse multiple spaces
    const normalized = rawBody.trim().replace(/\s+/g, ' ');

    if (!normalized) {
      return {
        action: 'unknown',
        requestId: '',
        rawInput: rawBody,
      };
    }

    // Try approval patterns
    const approvalMatch = normalized.match(this.approvalPattern);
    if (approvalMatch && approvalMatch[2] !== undefined) {
      return {
        action: 'approve',
        requestId: approvalMatch[2].trim(),
        rawInput: rawBody,
      };
    }

    // Try rejection patterns
    const rejectionMatch = normalized.match(this.rejectionPattern);
    if (rejectionMatch && rejectionMatch[2] !== undefined) {
      return {
        action: 'reject',
        requestId: rejectionMatch[2].trim(),
        rawInput: rawBody,
      };
    }

    // Unknown command
    return {
      action: 'unknown',
      requestId: '',
      rawInput: rawBody,
    };
  }

  /**
   * Check if a parsed command is actionable (approve or reject)
   */
  isActionable(command: ParsedCommand): boolean {
    return command.action === 'approve' || command.action === 'reject';
  }

  /**
   * Check if a parsed command has a valid request ID
   */
  hasValidRequestId(command: ParsedCommand): boolean {
    return command.requestId.length > 0;
  }

  /**
   * Validate that a command is complete and actionable
   */
  isValidCommand(command: ParsedCommand): boolean {
    return this.isActionable(command) && this.hasValidRequestId(command);
  }
}
