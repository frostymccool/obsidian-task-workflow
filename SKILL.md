---
name: obsidian-task-workflow
description: Install or update a portable Obsidian Tasks workflow with distinct large status icons for in-progress, blocked, deferred, cancelled, clarification, urgent, scheduled, and done tasks. Use when setting up or sharing this task workflow across Obsidian vaults.
---

# Obsidian Task Workflow

This is a standard Agent Skill: it contains only `SKILL.md`, CSS, and a Node.js script. It has no dependency on Codex, Claude Code, Cursor, Obsidian CLI, Git, or a particular operating system beyond Node.js and an Obsidian vault. A first install needs internet access to download the official Tasks and Task Status plugin releases.

Install the workflow with:

```sh
node "/absolute/path/to/obsidian-task-workflow/install-task-workflow.mjs" "/absolute/path/to/Obsidian vault"
```

Use the absolute path to the copy of this skill currently loaded by the harness. The installer finds its CSS file relative to itself, so it can be installed in any skills directory or run from a cloned repository.

## Vault selection

Always prefer an explicit vault path. To remember a personal default for direct script use:

```sh
node install-task-workflow.mjs --set-default "/absolute/path/to/Obsidian vault"
node install-task-workflow.mjs --use-default --yes
```

The default is stored outside the skill repository in `~/.obsidian-task-workflow.json`, so it cannot be accidentally committed or shared. The `--yes` safeguard is required when installing into the saved default.

## Before installing

1. Ask the user to close Obsidian before running the installer, so its settings cannot overwrite the update.
2. Explain that on a fresh vault the installer downloads and enables the **Tasks** and **Task Status** community plugins from their official GitHub releases, and installs the bundled **Task Workflow Sorter**. It does not automatically upgrade third-party plugins that already exist.
3. Explain that the installer updates only its managed statuses, Task Status picker, sorter, and CSS snippet. It backs up settings files before changing them.

## MCP-only fallback

An Obsidian MCP server can usually read or create notes, but it cannot be assumed to have permission to write `.obsidian/plugins/`, `.obsidian/snippets/`, or Obsidian's settings files. It also cannot be assumed to have internet access for the community-plugin downloads.

If the harness has no filesystem write access to those paths:

1. Do not claim the workflow was installed.
2. Explain that MCP-only access cannot safely install the plugins or apply the configuration and CSS.
3. Use the MCP only to create an optional installation note, then give the user the exact `node install-task-workflow.mjs` command to run locally.

## Workflow installed

| Markdown | Meaning | Next click | Icon |
| --- | --- | --- | --- |
| `[ ]` | To do | `[/]` | default empty box |
| `[/]` | In progress | `[x]` | 🔄 |
| `[b]` | Blocked | `[/]` | ⛔ |
| `[>]` | Deferred | `[ ]` | ⏳ |
| `[-]` | Cancelled | `[ ]` | large red × |
| `[?]` | Needs clarification | `[/]` | ❓ |
| `[!]` | Urgent | `[/]` | ⚡ |
| `[<]` | Scheduled | `[/]` | 📅 |
| `[x]` | Done | `[ ]` | ✅ |

The Task Status picker is configured with these same nine labelled options. Right-click a checkbox (or hold it for 500 ms) to open **Select Task Type**. Each row shows the real Markdown marker, emoji, status, and next normal-click state—for example, `[/] 🔄 In progress — Next: ✅ Done`. Its CSS hides the generic green picker ticks and keeps the popup centered at the width of its longest row.

When a task becomes deferred (`[>]`), the bundled Task Workflow Sorter moves it to the bottom of its current Markdown list. Child tasks stay attached; separate lists, blank-line boundaries, and fenced code blocks are not crossed.

## Updating the visual set

- Edit `task-workflow.css`; status glyphs are in the **Your selected icon set** section.
- Keep custom status symbols synchronized with `install-task-workflow.mjs`.
- Run `node --check install-task-workflow.mjs` before applying an update.
- Re-run the installer in every vault after an update, then restart Obsidian.

## Safety rules

- Do not overwrite a vault's entire Tasks configuration.
- Preserve custom statuses not managed by this workflow.
- Never remove backup files automatically.
