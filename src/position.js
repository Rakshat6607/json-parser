/**
 * PositionTracker resolves character offsets to 1-based line and column numbers
 * and generates visual code frame snippets for syntax errors.
 */
export class PositionTracker {
  constructor(source) {
    this.source = source;
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i++) {
      const code = source.charCodeAt(i);
      if (code === 10) {
        // \n
        this.lineStarts.push(i + 1);
      } else if (code === 13) {
        // \r
        if (i + 1 < source.length && source.charCodeAt(i + 1) === 10) {
          this.lineStarts.push(i + 2);
          i++;
        } else {
          this.lineStarts.push(i + 1);
        }
      }
    }
  }

  /**
   * Resolves a character offset to a 1-based line and column.
   * @param {number} offset
   * @returns {{ line: number, column: number, offset: number }}
   */
  getPosition(offset) {
    const clampedOffset = Math.max(0, Math.min(offset, this.source.length));
    let low = 0;
    let high = this.lineStarts.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.lineStarts[mid] <= clampedOffset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const lineIndex = high;
    const lineStart = this.lineStarts[lineIndex];
    const column = clampedOffset - lineStart + 1;

    return {
      line: lineIndex + 1,
      column,
      offset: clampedOffset,
    };
  }

  /**
   * Generates a code snippet highlighting the error position with line numbers and a pointer (^).
   * @param {number} offset
   * @param {number} [radius=2]
   * @returns {string}
   */
  formatSnippet(offset, radius = 2) {
    const pos = this.getPosition(offset);
    const lines = this.source.split(/\r?\n/);
    const errorLineIndex = pos.line - 1;

    const startLineIndex = Math.max(0, errorLineIndex - radius);
    const endLineIndex = Math.min(lines.length - 1, errorLineIndex + radius);

    const maxLineNumLength = String(endLineIndex + 1).length;
    const output = [];

    for (let i = startLineIndex; i <= endLineIndex; i++) {
      const lineNumStr = String(i + 1).padStart(maxLineNumLength, ' ');
      const isErrorLine = i === errorLineIndex;
      const marker = isErrorLine ? '>' : ' ';
      const lineContent = lines[i] ?? '';

      output.push(`${marker} ${lineNumStr} | ${lineContent}`);

      if (isErrorLine) {
        const pointerIndent = ' '.repeat(marker.length + 1 + maxLineNumLength + 3 + (pos.column - 1));
        output.push(`${pointerIndent}^`);
      }
    }

    return output.join('\n');
  }
}
