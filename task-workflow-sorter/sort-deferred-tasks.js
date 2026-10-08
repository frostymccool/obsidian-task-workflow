function taskAtIndent(line, indent) {
  const match = /^(\s*)[-*+]\s+\[([^\]])\]/.exec(line);
  return match && match[1].length === indent ? match : null;
}

function moveDeferredTasks(source) {
  const lines = source.split('\n');
  let inCodeFence = false;

  for (let index = 0; index < lines.length;) {
    if (/^\s*```/.test(lines[index])) {
      inCodeFence = !inCodeFence;
      index += 1;
      continue;
    }
    if (inCodeFence) {
      index += 1;
      continue;
    }

    const firstTask = /^(\s*)[-*+]\s+\[([^\]])\]/.exec(lines[index]);
    if (!firstTask) {
      index += 1;
      continue;
    }

    const indent = firstTask[1].length;
    const blocks = [];
    let cursor = index;
    while (cursor < lines.length) {
      const task = taskAtIndent(lines[cursor], indent);
      if (!task) break;

      const start = cursor;
      cursor += 1;
      while (cursor < lines.length) {
        const nextTask = taskAtIndent(lines[cursor], indent);
        if (nextTask) break;
        if (!lines[cursor].trim()) break;
        if (lines[cursor].trim() && /^\s*/.exec(lines[cursor])[0].length <= indent) break;
        cursor += 1;
      }
      blocks.push({ lines: lines.slice(start, cursor), deferred: task[2] === '>' });
    }

    const firstDeferred = blocks.findIndex((block) => block.deferred);
    if (firstDeferred !== -1 && blocks.slice(firstDeferred).some((block) => !block.deferred)) {
      const ordered = [...blocks.filter((block) => !block.deferred), ...blocks.filter((block) => block.deferred)];
      lines.splice(index, cursor - index, ...ordered.flatMap((block) => block.lines));
    }
    // Continue through every line so nested lists receive the same treatment.
    index += 1;
  }

  return lines.join('\n');
}

module.exports = { moveDeferredTasks };
