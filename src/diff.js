export function renderUnifiedDiff({ path, oldContent, newContent }) {
  if (oldContent === newContent) {
    return `--- ${path}\n+++ ${path}\n`;
  }
  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);
  const prefix = commonPrefixLength(oldLines, newLines);
  const suffix = commonSuffixLength(oldLines, newLines, prefix);
  const oldChanged = oldLines.slice(prefix, oldLines.length - suffix);
  const newChanged = newLines.slice(prefix, newLines.length - suffix);
  const start = Math.max(prefix - 3, 0);
  const oldEnd = Math.min(oldLines.length - suffix + 3, oldLines.length);
  const newEnd = Math.min(newLines.length - suffix + 3, newLines.length);
  const before = oldLines.slice(start, prefix);
  const after = oldLines.slice(oldLines.length - suffix, oldEnd);
  const oldRange = `${start + 1},${Math.max(oldEnd - start, 1)}`;
  const newRange = `${start + 1},${Math.max(newEnd - start, 1)}`;
  const lines = [`--- ${path}`, `+++ ${path}`, `@@ -${oldRange} +${newRange} @@`];
  for (const line of before) {
    lines.push(` ${line}`);
  }
  for (const line of oldChanged) {
    lines.push(`-${line}`);
  }
  for (const line of newChanged) {
    lines.push(`+${line}`);
  }
  for (const line of after) {
    lines.push(` ${line}`);
  }
  return `${lines.join("\n")}\n`;
}

function splitLines(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").split("\n");
}

function commonPrefixLength(left, right) {
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }
  return count;
}

function commonSuffixLength(left, right, prefix) {
  const limit = Math.min(left.length, right.length) - prefix;
  for (let count = 0; count < limit; count += 1) {
    if (left[left.length - count - 1] !== right[right.length - count - 1]) {
      return count;
    }
  }
  return limit;
}
