# dsh-oma-studio

**OMA Studio (Oh My Agent)** builds custom agent roles for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): you describe one role as a small record, the plugin compiles it into a Cordis composition and registers it as an **Agent Preset** — the same object the preset picker lists, a session mounts, and a subagent can be delegated with.

No YAML editing, no restart, no hand-written plugin rows: a role becomes live the moment you save it, from the Settings page or from the agent itself.

```
record  →  entry list (persona / tools / skills / delegation)  →  agentPresets.register()  →  presets.json
```

## DSH compatibility

Built for DeepSeek Harness **0.2.2-rc.5 and later 0.2.x** (declared as `engines.dsh: "^0.2.2-rc.5"`, matched with prerelease semantics) on Node 22.19.0+. Older 0.2.2-rc.1-era `@deepseek-ai/dsh-*` builds are no longer used.

## Why

An agent team is only useful when every member is *deterministic*: the researcher never writes files, the reviewer never runs destructive commands, the coder never browses the web. That determinism lives in the composition — which tools, which skills, which persona, which delegation rights — not in a prompt sentence asking the model to behave.

OMA Studio makes that composition a first-class, editable artifact:

- **One record, one role.** Persona prefix, tool switches, skill roots, delegation rights.
- **Live mount.** Saving a record mounts the composition immediately; no profile restart, no patch file.
- **Two identical faces.** The `oma_studio` agent tool and the Settings section call the same Host service methods, so what the user clicks and what the model writes cannot diverge.
- **Crash-safe persistence.** A record reaches disk only after its composition mounted *and* was audited as usable; a failed re-mount rolls the previous composition back.

## Install

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-oma-studio
```

Or add it to a profile manifest by hand:

```jsonc
{
  "dependencies": { "dsh-oma-studio": "link:/absolute/path/to/dsh-oma-studio" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-oma-studio"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install && dsh <profile>
```

The Host half needs `@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-sandbox` and `@deepseek-ai/dsh-typert-protocol`; they are declared as dependencies, so a plain `pnpm install` inside the package directory (or the profile's install of the linked package) resolves them.

## The record

```json
{
  "id": "researcher",
  "name": "研究员",
  "description": "只做检索、阅读与综述；只读文件系统，不联网写入。",
  "order": 10,
  "persona": { "prefix": "你是一名严谨的研究员。结论必须标注来源。" },
  "tools": { "web": true, "fs": "read-only", "bash": false, "jobs": false, "todo": true, "askUser": true, "present": true },
  "skills": { "mode": "isolated", "dirs": ["/abs/path/role-skills/researcher"] },
  "subagent": { "provider": "spawn", "toolName": "subagent", "allowedAgentPresets": ["researcher", "implementer"], "maxDepth": 1 }
}
```

| Field | Meaning |
| --- | --- |
| `id` | Preset id: lowercase letters, digits, hyphens. Immutable, must not collide with a profile preset. |
| `name` / `description` / `order` | Roster metadata; `order` sorts the preset picker. |
| `persona.prefix` | The system-prompt paragraph prepended to every turn. Empty mounts no persona row. |
| `tools.web` | `@deepseek-ai/dsh-tool-web` with fetch enabled. |
| `tools.fs` | `read-only` → read + readImage only, no write/edit. `read-write` → the full fs tool. `none` → no fs row at all. |
| `tools.bash` | `@deepseek-ai/dsh-tool-bash`, disabled on Windows by the same `!!js` expression the shipped compositions use. |
| `tools.jobs` / `todo` / `askUser` / `present` | The matching tool rows. |
| `skills.mode` | `none` mounts nothing. `default` mounts the host skill roots plus the skill loader. `isolated` mounts a `cordis:group` with `isolate.skills` whose filesystem provider sees **only** `skills.dirs`. |
| `subagent.provider` | `null` mounts nothing. `spawn` mounts a `cordis:group` (isolated workflow engine) with `@deepseek-ai/dsh-tool-subagent` for an independent preset, model selection and a depth budget. `pi` mounts the same tool against the local Pi coding agent. |

Every preset also carries a `@deepseek-ai/dsh-time-context` row, so a role always knows the current time.

### The `pi` provider is narrower, on purpose

`dsh-subagent-pi` registers `NO_START_CAPABILITIES`: no agent presets, no child model selection, no depth limit, no output schema. `tool-subagent` refuses those fields at mount time, so OMA Studio compiles a `pi` delegation as provider + tool name only, and the Settings form disables the other three fields with that explanation. Use `spawn` when a role must delegate to a *named role*.

## The two faces

**Agent tool `oma_studio`** — `list`, `get`, `create`, `update`, `remove`, `set_chat_visible`. Results are JSON: `{ok: true, value}` or `{ok: false, error: {code, message}, nextStep}`. `list` merges this package's presets with the profile's own declarations and marks each `active` or reports its registry diagnostic.

**Settings → OMA Studio** — the same roster as cards (name, id, source badge, mounted/error badge, tool count, diagnostic), a search field over name/id/description, and a form for every field of the record. Profile presets appear read-only: they are edited in the profile patch file, and the page says so.

The four presets the shipped `@deepseek-ai/dsh-web-app` bundle declares (`standard`, `ptc`, `minimal`, `cordis`) are hidden by default, so the page opens on your own roles; tick **Show system presets** to include them. The filter is that fixed id list, never the preset source, so a role you declared in your own patch layer (for example `coordinator`) always appears. The `oma_studio` tool takes the same `includeSystem` flag, and an explicit `get` by id reads a system preset even while the list hides it.

Every owned card carries a switch on its right: turn it off to take that role out of the chat agent picker. An off preset stays listed and editable on this page, but is unmounted — the chat picker reads the mounted roster, so an off preset is simply not offered to new sessions; turning it back on remounts it without re-entering anything. The choice is stored on each preset as `chat` in `presets.json`, so it survives a restart. Profile presets are not owned here and cannot be switched off. The `oma_studio` tool exposes the same state through `set_chat_visible`.

Every mutation (from either face) asks for `danger-full-access` approval first: it registers Host plugin rows, mounts them inside every session that selects the preset, and persists the record under the DSH home. `list`/`get` are read-only and need no approval. Without an approval channel a mutation fails closed and nothing is written.

## State and safety

- Document: `$DSH_HOME/state/oma-studio/presets.json` (default `~/.dsh/state/oma-studio/presets.json`), overridable with the `stateDir` config.
- Writes are atomic: full temp file, then one `rename`.
- A record is persisted **after** its composition mounted and audited; a failed audit unmounts it and leaves the document alone.
- An update that cannot mount restores the previous composition before reporting the failure.
- Startup mounts each stored preset independently: one broken record is reported in its card and never stops the others from mounting.

## How the Remote methods are declared without a build step

The shipped plugins are compiled from TypeScript, so their sources use `@Remote("x")` and their output carries `__esDecorate` boilerplate. This package has no build step; it applies the protocol's own public decorator to the class prototype at load time (`markRemote` in `lib/index.js`), which writes exactly the frozen version-1 method descriptor the compiler emits. The Host gateway's source-mode discovery then claims `omaStudio/list`, `omaStudio/get`, `omaStudio/create`, `omaStudio/update` and `omaStudio/remove`.

The browser half talks to the same service methods over the profile's authenticated `/api/oma-studio/{list,get,save,remove}` connection routes, the same channel the other first-party plugins use, because the Client's Remote mount table is a build-time artifact of `@deepseek-ai/dsh-api-remotes` that a hand-written package cannot extend. One service, two transports, no duplicated logic.

## Development

```bash
pnpm install
pnpm run check        # node --check on both halves
```

Layout: `lib/index.js` (service, compiler, agent tool, routes), `lib/client.js` (Settings section), `cordis.patch.yml` (one Host row), `locale/*.json` (roster metadata).

## License

MIT.
