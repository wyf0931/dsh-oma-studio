/**
 * dsh-oma-studio — Host half.
 *
 * OMA Studio (Oh My Agent) turns a short, declarative description of an agent
 * team member into a live DeepSeek Harness Agent Preset.
 *
 * One JSON file (`<stateDir>/presets.json`) is the source of truth. Each
 * record compiles to a Cordis entry list — persona, tool rows, an isolated
 * skills group, a delegation group — and is mounted through the public
 * `agentPresets` registry, so a preset created here is the same object the
 * preset registry lists, mounts for a session, and diffs against the profile.
 *
 * The registry does not persist, so this module owns durability: a record is
 * written to disk only after its composition mounted, and a re-mount that
 * fails is rolled back to the previous composition before anything is written.
 *
 * The service methods are the single source of truth for both faces: the
 * `oma_studio` agent tool and the authenticated `/api/oma-studio/*` routes the
 * Settings section talks to. The same call that a user makes in Settings is
 * the call the model makes, so the two cannot diverge.
 *
 * @module dsh-oma-studio
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { Service } from '@deepseek-ai/cordis';
import { approveEscalation } from '@deepseek-ai/dsh-sandbox';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import z from '@deepseek-ai/schemastery';

/** Cordis service name; also the Remote wire namespace. */
const SERVICE = 'omaStudio';

/** Agent tool name the model calls. */
const TOOL_NAME = 'oma_studio';

/** Version of the on-disk document. */
const STORE_VERSION = 1;

/** Where the document lives, as a path relative to the DSH home. */
const DEFAULT_STATE = 'state/oma-studio';

/** Accepted filesystem dispositions. */
const FS_MODES = ['read-only', 'read-write', 'none'];

/** Accepted skill-root dispositions. */
const SKILL_MODES = ['none', 'default', 'isolated'];

/** Accepted delegation providers; `null` mounts no delegation group. */
const SUBAGENT_PROVIDERS = [null, 'spawn', 'pi'];

/**
 * The `pi` provider (`dsh-subagent-pi`) registers
 * `NO_START_CAPABILITIES` — no agent presets, no child model selection, no
 * depth limit. Its row is therefore limited to provider + tool name; the UI
 * disables the three unsupported fields for that choice.
 */
const PI_SUPPORTED_FIELDS = ['provider', 'toolName'];

/** Lowercase identifier the registry accepts as a preset id. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Presets the shipped `@deepseek-ai/dsh-web-app` bundle declares for every
 * profile. They are nobody's custom role, so the roster hides them unless the
 * caller opts in. The filter is this fixed list, never `source`: a preset a
 * user declared in their own patch layer (coordinator, researcher, …) is a
 * profile preset too, and it must always be visible.
 */
const SHIPPED_PRESET_IDS = ['standard', 'ptc', 'minimal', 'cordis'];

/** Row ids used inside one compiled composition. */
const ROW = {
	persona: 'persona',
	web: 'tool-web',
	fs: 'tool-fs',
	bash: 'tool-bash',
	jobs: 'tool-jobs',
	todo: 'tool-todo',
	askUser: 'tool-ask-user',
	present: 'tool-present',
	time: 'time-context',
	skills: 'skills',
	skillFs: 'skill-fs',
	skillRegistry: 'skill-registry',
	toolSkill: 'tool-skill',
	delegation: 'delegation',
	subagent: 'tool-subagent'
};

/** The one-line capability matrix the tool description quotes. */
const TOOL_MATRIX = `A record (all fields optional except id):
- name / description / order: display metadata; order sorts the preset roster.
- persona.prefix: the system-prompt paragraph prepended to every turn.
- tools.web: fetch tool (network).
- tools.fs: "read-only" (read + readImage, no write/edit) | "read-write" (full fs) | "none".
- tools.bash: shell tool (disabled on win32).
- tools.jobs / tools.todo / tools.askUser / tools.present: background jobs, todo list, user questions, present tool.
- skills.mode: "none" | "default" (host default roots) | "isolated" (only skills.dirs, in its own isolate group).
- subagent.provider: null | "spawn" (independent agent preset, model selection, depth limit) | "pi" (the local Pi coding agent; provider + toolName only).
- subagent.toolName: the delegation tool name, default "subagent".
- subagent.allowedAgentPresets: role whitelist for "spawn"; subagent.maxDepth: recursion budget for "spawn".`;

/** Everything the model needs to use the tool without guessing. */
const TOOL_DESCRIPTION = `Create, edit, list and delete OMA Studio agent presets: named agent-team members whose tools, skills, persona and delegation rights are compiled into a Cordis composition and mounted through the agent-preset registry.

Use it when the user asks for a custom agent role ("add a reviewer that can only read files", "give me a Pi-backed coder"), for the current roster, or to change one. The Settings page (OMA Studio) drives these same methods, so an edit from either face is identical.

${TOOL_MATRIX}

Every mutation registers Host plugin rows, mounts them, and persists the record under the DSH home; it therefore needs danger-full-access approval for this call and applies to every new session that selects the preset. Preset ids are lowercase-hyphenated and must not collide with a profile preset. list/get are read-only and need no approval.

Results are JSON: {ok:true, value} or {ok:false, error:{code,message}, nextStep}.`;

/** Turn any thrown value into a single diagnostic line. */
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}

/** The DSH home directory, honouring `DSH_HOME` for tests and shared homes. */
function dshHome() {
	const explicit = process.env.DSH_HOME;
	if (typeof explicit === 'string' && explicit.trim() !== '') return resolve(explicit.trim());
	return join(homedir(), '.dsh');
}

/** Resolve `stateDir` (absolute, or relative to the DSH home) to the document path. */
function storeFileOf(stateDir) {
	const base = typeof stateDir === 'string' && stateDir.trim() !== '' ? stateDir.trim() : DEFAULT_STATE;
	const dir = isAbsolute(base) ? resolve(base) : resolve(dshHome(), base);
	return join(dir, 'presets.json');
}

/** A fresh, empty document. */
function emptyStore() {
	return { version: STORE_VERSION, presets: [] };
}

/** Read the document; a missing file is an empty store, a damaged one is an error. */
async function readStore(file) {
	let text;
	try {
		text = await readFile(file, 'utf8');
	} catch (error) {
		if (error?.code === 'ENOENT') return emptyStore();
		throw error;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`${file}: not valid JSON (${messageOf(error)})`);
	}
	if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.presets)) {
		throw new Error(`${file}: expected {version, presets: []}`);
	}
	return { version: STORE_VERSION, presets: parsed.presets.filter((row) => row !== null && typeof row === 'object' && typeof row.id === 'string') };
}

/** Write the document atomically: a complete temp file, then one rename. */
async function writeStore(file, store) {
	await mkdir(dirname(file), { recursive: true });
	const temp = `${file}.${String(process.pid)}.${String(Date.now())}.tmp`;
	await writeFile(temp, `${JSON.stringify({ version: STORE_VERSION, presets: store.presets }, null, 2)}\n`, 'utf8');
	await rename(temp, file);
}

/** A refusal the model must read as data, not as a crash. */
function refusal(code, message, nextStep) {
	const error = new Error(message);
	error.code = code;
	if (nextStep !== undefined) error.nextStep = nextStep;
	return error;
}

/** Normalize a boolean field. */
function boolOf(value) {
	return value === true;
}

/** Normalize a trimmed string field. */
function textOf(value) {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validate and normalize one record. Unknown enum values are errors, never
 * silent fallbacks: a typo in `tools.fs` must not quietly produce a read-write
 * agent.
 *
 * @param input - raw record from the UI, the model, or the document.
 * @param options - `requireId: false` keeps the caller's path id authoritative.
 * @returns the normalized record and every validation problem.
 */
function normalizeRecord(input, options = {}) {
	const problems = [];
	const source = input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {};
	const id = textOf(source.id);
	if (options.requireId !== false) {
		if (id === '') problems.push('id is required');
		else if (ID_PATTERN.test(id) !== true) problems.push(`id "${id}" must be lowercase letters, digits and hyphens, starting with a letter or digit`);
	}

	const tools = source.tools !== null && typeof source.tools === 'object' ? source.tools : {};
	const fs = typeof tools.fs === 'string' ? tools.fs.trim() : 'none';
	if (FS_MODES.includes(fs) !== true) problems.push(`tools.fs "${String(tools.fs)}" must be one of ${FS_MODES.join(' | ')}`);

	const skills = source.skills !== null && typeof source.skills === 'object' ? source.skills : {};
	const mode = typeof skills.mode === 'string' ? skills.mode.trim() : 'none';
	if (SKILL_MODES.includes(mode) !== true) problems.push(`skills.mode "${String(skills.mode)}" must be one of ${SKILL_MODES.join(' | ')}`);
	const rawDirs = Array.isArray(skills.dirs) ? skills.dirs : [];
	const dirs = [];
	for (const entry of rawDirs) {
		const dir = textOf(entry);
		if (dir === '') continue;
		if (isAbsolute(dir) !== true) {
			problems.push(`skills.dirs entry "${dir}" must be an absolute path`);
			continue;
		}
		if (dirs.includes(dir) !== true) dirs.push(dir);
	}
	if (mode === 'isolated' && dirs.length === 0) problems.push('skills.mode "isolated" needs at least one absolute directory in skills.dirs');

	const subagent = source.subagent !== null && typeof source.subagent === 'object' ? source.subagent : {};
	const rawProvider = subagent.provider === undefined || subagent.provider === null ? '' : String(subagent.provider).trim();
	const provider = rawProvider === '' || rawProvider === 'none' ? null : rawProvider;
	if (SUBAGENT_PROVIDERS.includes(provider) !== true) problems.push(`subagent.provider "${rawProvider}" must be one of none | spawn | pi`);
	const allowedAgentPresets = [];
	if (Array.isArray(subagent.allowedAgentPresets)) {
		for (const entry of subagent.allowedAgentPresets) {
			const presetId = textOf(entry);
			if (presetId !== '' && allowedAgentPresets.includes(presetId) !== true) allowedAgentPresets.push(presetId);
		}
	}
	const rawDepth = subagent.maxDepth;
	let maxDepth;
	if (rawDepth !== undefined && rawDepth !== null && rawDepth !== '') {
		const depth = Number(rawDepth);
		if (Number.isSafeInteger(depth) !== true || depth < 1) problems.push('subagent.maxDepth must be a positive integer');
		else maxDepth = depth;
	}
	const rawOrder = source.order;
	let order;
	if (rawOrder !== undefined && rawOrder !== null && rawOrder !== '') {
		const value = Number(rawOrder);
		if (Number.isFinite(value) !== true) problems.push('order must be a number');
		else order = value;
	}

	const record = {
		id,
		name: textOf(source.name),
		description: textOf(source.description),
		persona: { prefix: typeof source.persona?.prefix === 'string' ? source.persona.prefix : '' },
		tools: {
			web: boolOf(tools.web),
			fs,
			bash: boolOf(tools.bash),
			jobs: boolOf(tools.jobs),
			todo: boolOf(tools.todo),
			askUser: boolOf(tools.askUser),
			present: boolOf(tools.present)
		},
		skills: { mode, dirs },
		subagent: {
			provider,
			toolName: textOf(subagent.toolName) === '' ? 'subagent' : textOf(subagent.toolName),
			allowedAgentPresets: provider === 'spawn' ? allowedAgentPresets : [],
			maxDepth: maxDepth ?? null
		}
	};
	if (order !== undefined) record.order = order;
	return { record, problems };
}

/** One plugin row. */
function row(id, name, extra) {
	return { id, name, ...(extra === undefined ? {} : extra) };
}

/**
 * Compile one record into a Cordis entry list.
 *
 * The order is deliberate and stable: identity (persona), then capability,
 * then ambient context, then the two groups that own their own services.
 * Every row carries the ids the profile patch layer uses, so a composition
 * this module mounts reads the same as one a human wrote in YAML.
 *
 * @param record - a normalized record.
 * @returns the `agentPresets.register` definition.
 */
function compilePreset(record) {
	const plugins = [];
	const prefix = record.persona.prefix.trim();
	if (prefix !== '') plugins.push(row(ROW.persona, '@deepseek-ai/dsh-persona', { config: { prefix } }));

	if (record.tools.web === true) plugins.push(row(ROW.web, '@deepseek-ai/dsh-tool-web', { config: { fetch: true } }));
	if (record.tools.fs === 'read-only') {
		plugins.push(row(ROW.fs, '@deepseek-ai/dsh-tool-fs', { config: { read: true, readImage: true, write: false, edit: false } }));
	} else if (record.tools.fs === 'read-write') {
		plugins.push(row(ROW.fs, '@deepseek-ai/dsh-tool-fs', { config: { applyPatch: false } }));
	}
	if (record.tools.bash === true) {
		// The same `!!js` expression the reference compositions use: the row is
		// inert on Windows instead of failing to import a POSIX-only tool.
		plugins.push(row(ROW.bash, '@deepseek-ai/dsh-tool-bash', { disabled: { __jsExpr: "process.platform === 'win32'" } }));
	}
	if (record.tools.jobs === true) plugins.push(row(ROW.jobs, '@deepseek-ai/dsh-tool-jobs'));
	if (record.tools.todo === true) plugins.push(row(ROW.todo, '@deepseek-ai/dsh-tool-todo', { config: { allowParallelInProgress: true } }));
	if (record.tools.askUser === true) plugins.push(row(ROW.askUser, '@deepseek-ai/dsh-tool-ask-user'));
	if (record.tools.present === true) plugins.push(row(ROW.present, '@deepseek-ai/dsh-tool-present'));

	plugins.push(row(ROW.time, '@deepseek-ai/dsh-time-context'));

	if (record.skills.mode === 'isolated') {
		plugins.push(row(ROW.skills, 'cordis:group', {
			group: true,
			isolate: { skills: true },
			config: [
				row(ROW.skillRegistry, '@deepseek-ai/dsh-skill'),
				row(ROW.skillFs, '@deepseek-ai/dsh-skill-filesystem', { config: { includeDefaultRoots: false, customSkillDirs: [...record.skills.dirs] } }),
				row(ROW.toolSkill, '@deepseek-ai/dsh-tool-skill')
			]
		}));
	} else if (record.skills.mode === 'default') {
		plugins.push(row(ROW.skillFs, '@deepseek-ai/dsh-skill-filesystem'));
		plugins.push(row(ROW.toolSkill, '@deepseek-ai/dsh-tool-skill'));
	}

	const subagent = record.subagent;
	if (subagent.provider === 'spawn') {
		const config = { provider: 'spawn', toolName: subagent.toolName, modelSelection: true };
		if (subagent.allowedAgentPresets.length > 0) config.allowedAgentPresets = [...subagent.allowedAgentPresets];
		if (subagent.maxDepth !== null) config.maxDepth = subagent.maxDepth;
		plugins.push(row(ROW.delegation, 'cordis:group', {
			group: true,
			isolate: { workflowEngine: true },
			config: [row(ROW.subagent, '@deepseek-ai/dsh-tool-subagent', { config })]
		}));
	} else if (subagent.provider === 'pi') {
		// `pi` declares NO_START_CAPABILITIES, so presets, child model selection
		// and maxDepth are rejected by tool-subagent at mount time; the honest
		// composition is provider + tool name. No workflow-engine isolation is
		// needed either: the child is a separate `pi` process.
		plugins.push(row(ROW.delegation, 'cordis:group', {
			group: true,
			config: [row(ROW.subagent, '@deepseek-ai/dsh-tool-subagent', { config: { provider: 'pi', toolName: subagent.toolName } })]
		}));
	}

	const definition = { id: record.id, plugins };
	if (record.name !== '') definition.name = record.name;
	if (record.description !== '') definition.description = record.description;
	if (record.order !== undefined) definition.order = record.order;
	return definition;
}

/** How many tool rows a record compiles to, counted through nested groups. */
function countTools(rows) {
	let total = 0;
	for (const entry of rows) {
		if (typeof entry?.name === 'string' && entry.name.startsWith('@deepseek-ai/dsh-tool-')) total += 1;
		if (Array.isArray(entry?.config)) total += countTools(entry.config);
	}
	return total;
}

/** Project a record to the list row the UI and the model read. */
function summaryOf(record) {
	const fallback = {
		id: typeof record?.id === 'string' ? record.id : '',
		name: textOf(record?.name) === '' ? textOf(record?.id) : textOf(record?.name),
		description: textOf(record?.description),
		order: typeof record?.order === 'number' ? record.order : null,
		toolCount: null,
		rowCount: null,
		record
	};
	try {
		const definition = compilePreset(record);
		return {
			...fallback,
			toolCount: countTools(definition.plugins),
			rowCount: definition.plugins.length
		};
	} catch {
		// A hand-edited document can hold a record this compiler rejects; the
		// roster still renders, and the card reports the unmounted diagnostic.
		return fallback;
	}
}

/**
 * Attach one Remote marker using the protocol's public decorator.
 *
 * The shipped plugins are compiled from TypeScript, so their source uses
 * `@Remote("x")` and their output carries `__esDecorate` boilerplate. This
 * package has no build step, so the decorator is applied directly: the
 * protocol's `Remote` only registers an initializer, and running that
 * initializer against a prototype-only receiver writes the same frozen
 * version-1 method descriptor the compiler emits.
 *
 * @param prototype - the service class prototype.
 * @param method - the implementation method name.
 * @param exportName - the wire method name.
 */
function markRemote(prototype, method, exportName) {
	const decorate = Remote(exportName);
	const probe = Object.create(prototype);
	decorate(prototype[method], {
		kind: 'method',
		name: method,
		static: false,
		private: false,
		access: { has: (target) => method in target, get: (target) => target[method] },
		addInitializer(initializer) {
			initializer.call(probe);
		}
	});
}

/**
 * The OMA Studio service: the persisted roster, its compiled compositions, and
 * the operations both faces call.
 */
class OmaStudio extends TypertRemoteService {
	static inject = ['agentPresets', 'tools'];

	static Config = z.object({
		stateDir: z.string()
	});

	/** Absolute path of `presets.json`. */
	file;

	/** The current document. */
	store = emptyStore();

	/** id → the registries' unregister handle for the mounted composition. */
	handles = new Map();

	/** id → why its stored composition could not mount at startup. */
	failures = new Map();

	constructor(ctx, config) {
		super(ctx, SERVICE);
		this.file = storeFileOf(config?.stateDir);
	}

	/**
	 * Read the document and mount every stored preset.
	 *
	 * One unusable record must not cost the others their rosters, so each mount
	 * failure is recorded as that preset's diagnostic and the loop continues.
	 */
	async [Service.init]() {
		try {
			this.store = await readStore(this.file);
		} catch (error) {
			this.ctx.logger.warn('oma-studio: cannot read %s: %s', this.file, messageOf(error));
			this.store = emptyStore();
		}
		for (const record of this.store.presets) {
			try {
				const { record: clean, problems } = normalizeRecord(record);
				if (problems.length > 0) throw new Error(problems.join('; '));
				this.handles.set(clean.id, await this.ctx.agentPresets.register(compilePreset(clean)));
			} catch (error) {
				this.failures.set(record.id, messageOf(error));
				this.ctx.logger.warn('oma-studio: preset %s stayed unmounted: %s', record.id, messageOf(error));
			}
		}
		// A composition the registry mounted can still carry a row that failed to
		// activate (a bad config value, a missing service). Read back once for the
		// whole roster instead of trusting registration alone.
		for (const id of [...this.handles.keys()]) {
			const broken = await this.diagnosisOf(id).catch(() => undefined);
			if (broken === undefined) {
				this.ctx.logger.info('oma-studio: mounted preset %s', id);
				continue;
			}
			await this.unmount(id);
			this.failures.set(id, broken);
			this.ctx.logger.warn('oma-studio: preset %s stayed unmounted: %s', id, broken);
		}
		this.ctx.effect(() => () => this.unmountAll(), 'oma-studio: preset handles');
		this.registerTool();
		serveRoutes(this);
	}

	/** Release every mounted composition (HMR, unload, profile stop). */
	async unmountAll() {
		const handles = [...this.handles.values()];
		this.handles.clear();
		for (const unregister of handles) {
			try {
				await unregister();
			} catch (error) {
				this.ctx.logger.warn('oma-studio: unmount failed: %s', messageOf(error));
			}
		}
	}

	/** Mount one record, replacing nothing: the caller owns the old handle. */
	async mount(record) {
		const unregister = await this.ctx.agentPresets.register(compilePreset(record));
		this.handles.set(record.id, unregister);
		this.failures.delete(record.id);
		return unregister;
	}

	/**
	 * Mount one record and require it to be usable.
	 *
	 * Registration succeeds when the definition is accepted, even if a row
	 * inside it cannot activate; that diagnostic is exactly what a user would see
	 * as a broken preset in the picker, so a mutation refuses it and leaves the
	 * document untouched instead of persisting a preset nobody can select.
	 */
	async mountChecked(record) {
		await this.mount(record);
		const broken = await this.diagnosisOf(record.id);
		if (broken === undefined) return;
		await this.unmount(record.id);
		throw refusal('mount-failed', broken, 'Fix the reported row (its plugin and config field) and retry; nothing was written.');
	}

	/** The registry's activation diagnostic for one id, or undefined when it is usable. */
	async diagnosisOf(id) {
		const rows = await this.ctx.agentPresets.list();
		const row = rows.find((entry) => entry.id === id);
		return typeof row?.broken === 'string' ? row.broken : undefined;
	}

	/** Drop one mounted composition if it is mounted. */
	async unmount(id) {
		const unregister = this.handles.get(id);
		this.handles.delete(id);
		if (unregister !== undefined) await unregister();
	}

	/**
	 * One row per preset: this package's records first (source `oma-studio`),
	 * then the profile's own declarations (source `profile`) so the page tells
	 * the whole truth about what a session can select.
	 *
	 * The shipped system presets are hidden unless `includeSystem` is set, by
	 * their fixed ids rather than by source, so a role declared in the user's
	 * own patch layer still appears.
	 *
	 * @param includeSystem - include `standard`/`ptc`/`minimal`/`cordis`.
	 * @returns the roster rows and their count.
	 */
	async list(includeSystem = false) {
		const registry = await this.ctx.agentPresets.list();
		const declared = new Map(registry.map((entry) => [entry.id, entry]));
		const hide = includeSystem === true ? new Set() : new Set(SHIPPED_PRESET_IDS);
		const entries = [];
		const seen = new Set();
		for (const record of this.store.presets) {
			if (seen.has(record.id) || hide.has(record.id)) continue;
			seen.add(record.id);
			const declaredRow = declared.get(record.id);
			const diagnostic = (typeof declaredRow?.broken === 'string' ? declaredRow.broken : undefined) ?? this.failures.get(record.id);
			entries.push({
				...summaryOf(record),
				source: 'oma-studio',
				active: this.handles.has(record.id) && diagnostic === undefined,
				diagnostic: diagnostic ?? null
			});
		}
		for (const entry of registry) {
			if (seen.has(entry.id) || hide.has(entry.id)) continue;
			seen.add(entry.id);
			entries.push({
				id: entry.id,
				name: entry.name ?? entry.id,
				description: entry.description ?? '',
				order: entry.order ?? null,
				toolCount: null,
				rowCount: null,
				record: null,
				source: 'profile',
				active: entry.broken === undefined,
				diagnostic: entry.broken ?? null
			});
		}
		entries.sort((left, right) => (left.order ?? Number.POSITIVE_INFINITY) - (right.order ?? Number.POSITIVE_INFINITY) || left.id.localeCompare(right.id));
		return { entries, total: entries.length };
	}

	/** One entry by id, from this package's document or the registry.
	 * An explicit id reads a shipped system preset too, so this call is never filtered.
	 * @param id - preset identity.
	 * @returns the roster row.
	 */
	async get(id) {
		const wanted = textOf(id);
		if (wanted === '') throw refusal('invalid-id', 'id is required');
		const listing = await this.list(true);
		const found = listing.entries.find((entry) => entry.id === wanted);
		if (found === undefined) throw refusal('unknown-preset', `No preset "${wanted}" is mounted or declared`, 'Call list to read the current roster.');
		return found;
	}

	/**
	 * Create a preset: validate, mount, then persist.
	 *
	 * Persisting last is the whole crash-safety story: a record reaches the file
	 * only after its composition mounted, so a restart never re-reads a preset
	 * that was never usable. A write failure unmounts again.
	 */
	async create(input) {
		const { record, problems } = normalizeRecord(input);
		if (problems.length > 0) throw refusal('invalid-record', problems.join('; '), 'Fix the reported fields and retry.');
		if (this.store.presets.some((entry) => entry.id === record.id)) {
			throw refusal('duplicate-id', `OMA Studio already owns a preset "${record.id}"`, 'Call update to change it, or pick another id.');
		}
		try {
			await this.mountChecked(record);
		} catch (error) {
			if (error?.code === 'mount-failed') throw error;
			throw refusal('mount-failed', messageOf(error), 'A profile preset may already use this id; call list to see the current roster.');
		}
		const next = { version: STORE_VERSION, presets: [...this.store.presets, record] };
		try {
			await writeStore(this.file, next);
		} catch (error) {
			await this.unmount(record.id);
			throw refusal('write-failed', messageOf(error), `Check write access to ${this.file}.`);
		}
		this.store = next;
		return this.get(record.id);
	}

	/**
	 * Replace a preset: unmount, mount the new composition, and roll the old one
	 * back if the new one cannot activate. The document is written only after
	 * the new composition is live.
	 */
	async update(id, patch) {
		const wanted = textOf(id);
		const index = this.store.presets.findIndex((entry) => entry.id === wanted);
		if (index < 0) throw refusal('unknown-preset', `OMA Studio does not own a preset "${wanted}"`, 'Call list; profile presets are edited in the profile patch file.');
		const previous = this.store.presets[index];
		const { record, problems } = normalizeRecord({ ...previous, ...(patch ?? {}), id: wanted }, { requireId: false });
		if (problems.length > 0) throw refusal('invalid-record', problems.join('; '), 'Fix the reported fields and retry.');

		await this.unmount(wanted);
		try {
			await this.mountChecked(record);
		} catch (error) {
			const failure = messageOf(error);
			try {
				await this.mount(previous);
			} catch (rollbackError) {
				this.handles.delete(wanted);
				this.failures.set(wanted, messageOf(rollbackError));
				this.ctx.logger.warn('oma-studio: rollback of %s failed: %s', wanted, messageOf(rollbackError));
				throw refusal('mount-failed', `${failure}; rollback also failed: ${messageOf(rollbackError)}`, 'The preset is unmounted until its composition is fixed.');
			}
			this.failures.set(wanted, failure);
			throw refusal('mount-failed', failure, 'The previous composition is mounted again; fix the reported row and retry.');
		}

		await this.writeOrRollback(wanted, record, previous);
		return this.get(wanted);
	}

	/**
	 * Persist `next`, or undo the mounted composition when the write fails.
	 * A preset whose record could not be written must not outlive the process.
	 */
	async writeOrRollback(id, record, previous) {
		const index = this.store.presets.findIndex((entry) => entry.id === id);
		const presets = [...this.store.presets];
		presets[index] = record;
		const next = { version: STORE_VERSION, presets };
		try {
			await writeStore(this.file, next);
		} catch (error) {
			await this.unmount(id);
			try {
				await this.mount(previous);
			} catch (rollbackError) {
				this.failures.set(id, messageOf(rollbackError));
			}
			throw refusal('write-failed', messageOf(error), `Check write access to ${this.file}.`);
		}
		this.store = next;
	}

	/** Delete a preset: unmount, then persist the shorter document. */
	async remove(id) {
		const wanted = textOf(id);
		const index = this.store.presets.findIndex((entry) => entry.id === wanted);
		if (index < 0) throw refusal('unknown-preset', `OMA Studio does not own a preset "${wanted}"`, 'Call list; profile presets are removed in the profile patch file.');
		await this.unmount(wanted);
		const presets = this.store.presets.filter((entry) => entry.id !== wanted);
		const next = { version: STORE_VERSION, presets };
		try {
			await writeStore(this.file, next);
		} catch (error) {
			try {
				await this.mount(this.store.presets[index]);
			} catch (remountError) {
				this.failures.set(wanted, messageOf(remountError));
			}
			throw refusal('write-failed', messageOf(error), `Check write access to ${this.file}.`);
		}
		this.store = next;
		this.failures.delete(wanted);
		return { id: wanted, removed: true };
	}

	/** Register the model-facing tool once the service is live. */
	registerTool() {
		const service = this;
		const dispose = this.ctx.tools.register(defineTool({
			name: TOOL_NAME,
			description: TOOL_DESCRIPTION,
			parameters: {
				action: {
					type: 'string',
					required: true,
					enum: ['list', 'get', 'create', 'update', 'remove'],
					description: 'Read the roster (list, get) or change it (create, update, remove).'
				},
				id: { type: 'string', description: 'Preset id: required for get/update/remove, and for create.' },
				includeSystem: {
					type: 'boolean',
					description: `For list: also return the shipped system presets (${SHIPPED_PRESET_IDS.join(', ')}), which are hidden by default. User-declared profile roles are always returned.`
				},
				name: { type: 'string', description: 'Display name shown in the preset picker.' },
				description: { type: 'string', description: 'One sentence on what this role is for.' },
				personaPrefix: { type: 'string', description: 'The persona paragraph prepended to every turn.' },
				order: { type: 'number', description: 'Sort position in the preset roster, lower first.' },
				tools: {
					type: 'object',
					additionalProperties: false,
					description: 'Capability switches.',
					properties: {
						web: { type: 'boolean', description: 'Web fetch tool (network access).' },
						fs: { type: 'string', enum: [...FS_MODES], description: 'Filesystem disposition: read-only, read-write, or none.' },
						bash: { type: 'boolean', description: 'Shell tool (POSIX hosts only).' },
						jobs: { type: 'boolean', description: 'Background jobs tool.' },
						todo: { type: 'boolean', description: 'Todo-list tool.' },
						askUser: { type: 'boolean', description: 'Ask-the-user tool.' },
						present: { type: 'boolean', description: 'Present tool.' }
					}
				},
				skills: {
					type: 'object',
					additionalProperties: false,
					description: 'Skill roots for this role.',
					properties: {
						mode: { type: 'string', enum: [...SKILL_MODES], description: 'none, the host default roots (default), or only these dirs in an isolate group (isolated).' },
						dirs: { type: 'array', items: { type: 'string' }, description: 'Absolute skill directories; required when mode is isolated.' }
					}
				},
				subagent: {
					type: 'object',
					additionalProperties: false,
					description: 'Delegation rights. spawn supports presets/model selection/maxDepth; pi supports provider and toolName only.',
					properties: {
						provider: { type: 'string', enum: ['none', 'spawn', 'pi'], description: 'Delegation provider; none mounts no delegation group.' },
						toolName: { type: 'string', description: 'Delegation tool name, default subagent.' },
						allowedAgentPresets: { type: 'array', items: { type: 'string' }, description: 'Role whitelist for spawn.' },
						maxDepth: { type: 'number', description: 'Recursion budget for spawn.' }
					}
				}
			},
			output: {
				schema: { type: 'string' },
				render: (_args, value) => [{ type: 'text', text: value }]
			},
			isConcurrencySafe: () => false,
			async execute(args, exec) {
				const action = textOf(args?.action);
				try {
					switch (action) {
						case 'list':
							return JSON.stringify({ ok: true, value: await service.list(args?.includeSystem === true) });
						case 'get':
							return JSON.stringify({ ok: true, value: await service.get(args?.id) });
						case 'create':
						case 'update':
						case 'remove': {
							await service.escalate(args, exec);
							if (action === 'create') return JSON.stringify({ ok: true, value: await service.create(service.recordOf(args)) });
							if (action === 'update') return JSON.stringify({ ok: true, value: await service.update(args?.id, service.recordOf(args)) });
							return JSON.stringify({ ok: true, value: await service.remove(args?.id) });
						}
						default:
							return JSON.stringify({
								ok: false,
								error: { code: 'invalid-action', message: `Unknown action "${action}"` },
								nextStep: 'Call list, get, create, update or remove.'
							});
					}
				} catch (error) {
					return JSON.stringify({
						ok: false,
						error: { code: error?.code ?? 'operation-error', message: messageOf(error) },
						nextStep: error?.nextStep ?? 'Read the message; list shows the current roster and diagnostics.'
					});
				}
			}
		}));
		this.ctx.effect(() => () => {
			dispose();
		}, 'oma-studio: oma_studio tool');
	}

	/** The record fields carried by tool arguments. */
	recordOf(args) {
		const record = { id: args?.id };
		for (const field of ['name', 'description', 'order']) {
			if (args?.[field] !== undefined) record[field] = args[field];
		}
		if (args?.personaPrefix !== undefined) record.persona = { prefix: args.personaPrefix };
		for (const field of ['tools', 'skills', 'subagent']) {
			if (args?.[field] !== undefined) record[field] = args[field];
		}
		return record;
	}

	/**
	 * Ask for the host-widest sandbox mode before a mutation.
	 *
	 * Mounting a preset runs Host plugin code and the record outlives the
	 * session, so a mutation is never cheaper to approve than one bash call.
	 * Read-only actions skip this entirely.
	 */
	async escalate(args, exec) {
		const policy = this.ctx.get('sandboxPolicy');
		const resolved = typeof policy?.resolve === 'function'
			? policy.resolve(exec?.agent === undefined ? {} : { session: exec.agent.session })
			: undefined;
		await approveEscalation({
			requestedMode: 'danger-full-access',
			effectiveMode: resolved?.mode ?? 'workspace-write',
			subject: 'OMA Studio preset change',
			justification: `oma_studio ${JSON.stringify(args)}. The call registers and mounts Host plugin rows that run inside every session selecting this preset, and it persists the record under the DSH home.`
		}, {
			approver: this.ctx.get('approval'),
			agent: exec?.agent,
			callId: exec?.callId,
			toolName: TOOL_NAME,
			signal: exec?.signal
		});
		exec?.signal?.throwIfAborted();
	}
}

for (const [method, wire] of [['list', 'list'], ['get', 'get'], ['create', 'create'], ['update', 'update'], ['remove', 'remove']]) {
	markRemote(OmaStudio.prototype, method, wire);
}

/** Wrap a service result in the panel's envelope. */
function envelope(promise) {
	return promise.then(
		(value) => Response.json({ ok: true, value }, { headers: { 'cache-control': 'no-store' } }),
		(error) => Response.json({
			ok: false,
			error: { code: error?.code ?? 'operation-error', message: messageOf(error) },
			nextStep: error?.nextStep ?? null
		}, { headers: { 'cache-control': 'no-store' } })
	);
}

/** Read a JSON body without trusting it to be an object. */
async function bodyOf(request) {
	try {
		const body = await request.json();
		return body !== null && typeof body === 'object' && Array.isArray(body) !== true ? body : {};
	} catch {
		return {};
	}
}

/** Serve the four Settings operations over the authenticated connection channel. */
function serveRoutes(service) {
	service.ctx.inject(['connection'], (scope) => {
		const register = (route, handler) => {
			const dispose = scope.connection.fetch.register({
				path: route,
				methods: ['POST'],
				requestBody: 'buffered',
				fetch: handler
			});
			scope.effect(() => () => {
				void dispose();
			}, `oma-studio: route ${route}`);
		};

		register('/api/oma-studio/list', async (request) => envelope(service.list((await bodyOf(request)).includeSystem === true)));
		register('/api/oma-studio/get', async (request) => envelope(service.get((await bodyOf(request)).id)));
		register('/api/oma-studio/save', async (request) => {
			const body = await bodyOf(request);
			const exists = typeof body.id === 'string' && service.store.presets.some((entry) => entry.id === body.id);
			return envelope(exists ? service.update(body.id, body.record ?? body) : service.create(body.record ?? body));
		});
		register('/api/oma-studio/remove', async (request) => envelope(service.remove((await bodyOf(request)).id)));
	});
}

/** Cordis plugin: the service, its agent tool, and its Settings routes. */
export default OmaStudio;

export { OmaStudio, compilePreset, normalizeRecord, storeFileOf, PI_SUPPORTED_FIELDS };
