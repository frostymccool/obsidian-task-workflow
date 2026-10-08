const { Plugin, TFile } = require('obsidian');

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
        if (taskAtIndent(lines[cursor], indent) || !lines[cursor].trim()) break;
        if (/^\s*/.exec(lines[cursor])[0].length <= indent) break;
        cursor += 1;
      }
      blocks.push({ lines: lines.slice(start, cursor), deferred: task[2] === '>' });
    }
    const firstDeferred = blocks.findIndex((block) => block.deferred);
    if (firstDeferred !== -1 && blocks.slice(firstDeferred).some((block) => !block.deferred)) {
      const ordered = [...blocks.filter((block) => !block.deferred), ...blocks.filter((block) => block.deferred)];
      lines.splice(index, cursor - index, ...ordered.flatMap((block) => block.lines));
    }
    index += 1;
  }
  return lines.join('\n');
}

module.exports = class TaskWorkflowSorter extends Plugin {
  onload() {
    this.processing = new Set();
    this.registerEvent(this.app.vault.on('modify', (file) => this.sortDeferredTasks(file)));
    this.registerEvent(this.app.workspace.on('editor-change', (editor) => this.sortDeferredTasksInEditor(editor)));
  }

  sortDeferredTasksInEditor(editor) {
    if (this.processing.has(editor)) return;
    const source = editor.getValue();
    const sorted = moveDeferredTasks(source);
    if (sorted === source) return;

    this.processing.add(editor);
    try {
      editor.setValue(sorted);
    } finally {
      window.setTimeout(() => this.processing.delete(editor), 100);
    }
  }

  async sortDeferredTasks(file) {
    if (!(file instanceof TFile) || file.extension !== 'md' || this.processing.has(file.path)) return;
    const source = await this.app.vault.read(file);
    const sorted = moveDeferredTasks(source);
    if (sorted === source) return;

    this.processing.add(file.path);
    try {
      await this.app.vault.modify(file, sorted);
    } finally {
      window.setTimeout(() => this.processing.delete(file.path), 100);
    }
  }
};
