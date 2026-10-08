#!/usr/bin/env node
/** Install the portable Obsidian Tasks workflow into one vault. */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import process from 'node:process';

const argumentsAfterNode = process.argv.slice(2);
const defaultConfig = join(homedir(), '.obsidian-task-workflow.json');
const usage = `Usage:\n  node install-task-workflow.mjs "/path/to/Obsidian vault"\n  node install-task-workflow.mjs --set-default "/path/to/Obsidian vault"\n  node install-task-workflow.mjs --use-default --yes\n\nThe installer downloads, enables, and configures the Tasks and Task Status community plugins.\nEnvironment fallback: OBSIDIAN_TASK_WORKFLOW_VAULT="/path/to/Obsidian vault"`;

if (argumentsAfterNode.includes('--help') || argumentsAfterNode.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

if (argumentsAfterNode[0] === '--set-default') {
  const defaultVault = argumentsAfterNode[1];
  if (!defaultVault) {
    console.error(usage);
    process.exit(1);
  }
  const resolvedDefaultVault = resolve(defaultVault);
  writeFileSync(defaultConfig, `${JSON.stringify({ vaultPath: resolvedDefaultVault }, null, 2)}\n`);
  console.log(`Saved default vault: ${resolvedDefaultVault}`);
  process.exit(0);
}

const requestedDefault = argumentsAfterNode[0] === '--use-default';
const vaultArgument = requestedDefault ? undefined : argumentsAfterNode[0];
let defaultVault;
if (!vaultArgument) {
  try {
    defaultVault = JSON.parse(readFileSync(defaultConfig, 'utf8')).vaultPath;
  } catch {
    defaultVault = process.env.OBSIDAN_TASK_WORKFLOW_VAULT;
  }
  if (!defaultVault) {
    console.error(`${usage}\n\nNo default vault is configured.`);
    process.exit(1);
  }
  if (!argumentsAfterNode.includes('--yes')) {
    console.error(`Default vault resolved to: ${defaultVault}\nRe-run with --use-default --yes to install there.`);
    process.exit(1);
  }
}

const vault = resolve(vaultArgument ?? defaultVault);
if (!existsSync(vault) || !existsSync(join(vault, '.obsidian'))) {
  console.error(`Not an Obsidian vault: ${vault}\nChoose the folder that contains its .obsidian directory.`);
  process.exit(1);
}
const skillDirectory = dirname(fileURLToPath(import.meta.url));
const tasksConfig = join(vault, '.obsidian', 'plugins', 'obsidian-tasks-plugin', 'data.json');
const appearanceConfig = join(vault, '.obsidian', 'appearance.json');
const snippetSource = join(skillDirectory, 'task-workflow.css');
const snippetDestination = join(vault, '.obsidian', 'snippets', 'task-workflow.css');
const communityPluginsConfig = join(vault, '.obsidian', 'community-plugins.json');

const pluginRegistryUrl = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';
const managedPlugins = [
  { id: 'obsidian-tasks-plugin', name: 'Tasks' },
  { id: 'task-status', name: 'Task Status' },
];
const bundledSorter = {
  id: 'task-workflow-sorter',
  name: 'Task Workflow Sorter',
  files: ['main.js', 'manifest.json'],
};

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchBytes(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function installMissingPlugins() {
  let registry;
  for (const plugin of managedPlugins) {
    const pluginDirectory = join(vault, '.obsidian', 'plugins', plugin.id);
    if (existsSync(join(pluginDirectory, 'main.js')) && existsSync(join(pluginDirectory, 'manifest.json'))) {
      console.log(`${plugin.name} is already installed.`);
      continue;
    }

    registry ??= await fetchJson(pluginRegistryUrl);
    const registryEntry = registry.find((entry) => entry.id === plugin.id);
    if (!registryEntry?.repo) throw new Error(`${plugin.name} was not found in Obsidian's community-plugin registry.`);
    const release = await fetchJson(`https://api.github.com/repos/${registryEntry.repo}/releases/latest`);
    const assets = new Map(release.assets.map((asset) => [asset.name, asset.browser_download_url]));
    for (const fileName of ['main.js', 'manifest.json']) {
      const downloadUrl = assets.get(fileName);
      if (!downloadUrl) throw new Error(`${plugin.name} latest release does not provide ${fileName}.`);
      mkdirSync(pluginDirectory, { recursive: true });
      writeFileSync(join(pluginDirectory, fileName), await fetchBytes(downloadUrl));
    }
    if (assets.has('styles.css')) writeFileSync(join(pluginDirectory, 'styles.css'), await fetchBytes(assets.get('styles.css')));
    console.log(`Installed ${plugin.name} ${release.tag_name}.`);
  }
}

function installBundledSorter() {
  const sourceDirectory = join(skillDirectory, bundledSorter.id);
  const destinationDirectory = join(vault, '.obsidian', 'plugins', bundledSorter.id);
  mkdirSync(destinationDirectory, { recursive: true });
  for (const fileName of bundledSorter.files) {
    copyFileSync(join(sourceDirectory, fileName), join(destinationDirectory, fileName));
  }
  console.log(`Installed ${bundledSorter.name}.`);
}

function enableManagedPlugins() {
  let enabledPlugins = [];
  if (existsSync(communityPluginsConfig)) {
    try {
      enabledPlugins = JSON.parse(readFileSync(communityPluginsConfig, 'utf8'));
    } catch (error) {
      throw new Error(`Could not read community plugin settings: ${error.message}`);
    }
    copyFileSync(communityPluginsConfig, `${communityPluginsConfig}.before-task-workflow-pack.bak`);
  }
  if (!Array.isArray(enabledPlugins)) enabledPlugins = [];
  for (const { id } of [...managedPlugins, bundledSorter]) if (!enabledPlugins.includes(id)) enabledPlugins.push(id);
  writeFileSync(communityPluginsConfig, `${JSON.stringify(enabledPlugins, null, 2)}\n`);
}

try {
  await installMissingPlugins();
  installBundledSorter();
  enableManagedPlugins();
} catch (error) {
  console.error(`Could not install or enable required community plugins: ${error.message}`);
  console.error('Connect to the internet and run the installer again, or install the plugins manually in Obsidian.');
  process.exit(1);
}

let settings = {};
if (existsSync(tasksConfig)) {
  try {
    settings = JSON.parse(readFileSync(tasksConfig, 'utf8'));
    copyFileSync(tasksConfig, `${tasksConfig}.before-task-workflow-pack.bak`);
  } catch (error) {
    console.error(`Could not read the Tasks configuration: ${error.message}`);
    process.exit(1);
  }
}

const status = (symbol, name, nextStatusSymbol, type) => ({ symbol, name, nextStatusSymbol, availableAsCommand: true, type });
const coreStatuses = [status(' ', 'To do', '/', 'TODO'), status('x', 'Done', ' ', 'DONE')];
const workflowStatuses = [
  status('/', 'In progress', 'x', 'IN_PROGRESS'),
  status('b', 'Blocked', '/', 'ON_HOLD'),
  status('>', 'Deferred', ' ', 'ON_HOLD'),
  status('-', 'Cancelled', ' ', 'CANCELLED'),
  status('?', 'Needs clarification', '/', 'TODO'),
  status('!', 'Urgent', '/', 'TODO'),
  status('<', 'Scheduled', '/', 'TODO'),
];

settings.statusSettings ??= {};
settings.statusSettings.coreStatuses = coreStatuses;
const managedSymbols = new Set(workflowStatuses.map(({ symbol }) => symbol));
const existingCustomStatuses = Array.isArray(settings.statusSettings.customStatuses) ? settings.statusSettings.customStatuses : [];
settings.statusSettings.customStatuses = [
  ...existingCustomStatuses.filter(({ symbol }) => !managedSymbols.has(symbol)),
  ...workflowStatuses,
];

writeFileSync(tasksConfig, `${JSON.stringify(settings, null, 2)}\n`);

const taskStatusConfig = join(vault, '.obsidian', 'plugins', 'task-status', 'data.json');
const pickerSettings = {
  checkboxOptions: [
    { title: '○ To do — Next: 🔄 In progress', character: ' ' },
    { title: '🔄 In progress — Next: ✅ Done', character: '/' },
    { title: '⛔ Blocked — Next: 🔄 In progress', character: 'b' },
    { title: '⏳ Deferred — Next: ○ To do', character: '>' },
    { title: '❌ Cancelled — Next: ○ To do', character: '-' },
    { title: '❓ Needs clarification — Next: 🔄 In progress', character: '?' },
    { title: '⚡ Urgent — Next: 🔄 In progress', character: '!' },
    { title: '📅 Scheduled — Next: 🔄 In progress', character: '<' },
    { title: '✅ Done — Next: ○ To do', character: 'x' },
  ],
  enableReadingModeLongPress: true,
  longPressDurationMs: 500,
};
if (existsSync(taskStatusConfig)) copyFileSync(taskStatusConfig, `${taskStatusConfig}.before-task-workflow-pack.bak`);
writeFileSync(taskStatusConfig, `${JSON.stringify(pickerSettings, null, 2)}\n`);

mkdirSync(dirname(snippetDestination), { recursive: true });
copyFileSync(snippetSource, snippetDestination);

let appearanceSettings = {};
if (existsSync(appearanceConfig)) {
  try {
    appearanceSettings = JSON.parse(readFileSync(appearanceConfig, 'utf8'));
    copyFileSync(appearanceConfig, `${appearanceConfig}.before-task-workflow-pack.bak`);
  } catch (error) {
    console.error(`Could not read Obsidian appearance settings: ${error.message}`);
    process.exit(1);
  }
}
const enabledSnippets = Array.isArray(appearanceSettings.enabledCssSnippets) ? appearanceSettings.enabledCssSnippets : [];
if (!enabledSnippets.includes('task-workflow')) enabledSnippets.push('task-workflow');
appearanceSettings.enabledCssSnippets = enabledSnippets;
writeFileSync(appearanceConfig, `${JSON.stringify(appearanceSettings, null, 2)}\n`);

console.log('Installed the task workflow pack.');
console.log(`Tasks backup: ${tasksConfig}.before-task-workflow-pack.bak`);
console.log(`CSS snippet: ${snippetDestination}`);
console.log('Restart Obsidian. Tasks, Task Status, Task Workflow Sorter, and the CSS snippet have already been enabled.');
