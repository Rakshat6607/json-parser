import { PositionTracker } from './position.js';

/**
 * Custom SyntaxError thrown when JSON parsing encounters an invalid token or structure.
 * Includes precise 1-based line and column numbers, 0-based offset, and a formatted code snippet.
 */
export class JSONSyntaxError extends SyntaxError {
  constructor(message, source, offset) {
    const tracker = new PositionTracker(source);
    const pos = tracker.getPosition(offset);
    const snippet = tracker.formatSnippet(offset);
    const formatted = `${message} at line ${pos.line}, column ${pos.column} (offset ${pos.offset}):\n\n${snippet}\n`;

    super(formatted);

    this.name = 'JSONSyntaxError';
    this.rawMessage = message;
    this.line = pos.line;
    this.column = pos.column;
    this.position = pos.offset;
    this.snippet = snippet;
    this.formattedMessage = formatted;

    Object.setPrototypeOf(this, JSONSyntaxError.prototype);
  }
}
