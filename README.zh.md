# dsh-oma-studio

**OMA Studio（Oh My Agent）** 为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供自定义 agent 角色的创建与管理：你把「一个角色」写成一小段记录，插件把它编译成 Cordis 组合，并注册为 **Agent Preset**——和 preset 选择器里列出的、会话挂载的、subagent 可以按名委派的，是同一个对象。

不写 YAML、不重启、不手写插件行：保存即生效，Settings 页面和 agent 工具两条入口等价。

```
记录  →  entry list（persona / 工具 / skills / 委派）  →  agentPresets.register()  →  presets.json
```

## 为什么需要它

agent 团队只有在每个成员都**确定**时才有用：研究员永远不写文件，评审者永远不跑破坏性命令，实现者永远不联网。这种确定性来自组合——挂哪些工具、哪些 skill、什么人格、什么委派权限——而不是 prompt 里一句「请不要」。

OMA Studio 把这份组合变成可编辑的一等产物：

- **一条记录一个角色**：人格前缀、工具开关、skill 目录、委派权限。
- **即时挂载**：保存即挂载，不需要重启 profile，不改 patch 文件。
- **两个入口同一份实现**：`oma_studio` agent 工具与 Settings 页面调用同一批 Host 服务方法，用户点的和模型写的不会分叉。
- **崩溃安全**：记录只有在组合挂载**并**通过可用性审计后才落盘；重新挂载失败会回滚到上一个组合。

## 安装

```bash
dsh plugin --profile <profile> add /absolute/path/to/dsh-oma-studio
```

或手写进 profile 清单：

```jsonc
{
  "dependencies": { "dsh-oma-studio": "link:/absolute/path/to/dsh-oma-studio" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-oma-studio"] } }
}
```

```bash
cd ~/.dsh/profiles/<profile> && pnpm install && dsh <profile>
```

Host 侧需要 `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-sandbox`、`@deepseek-ai/dsh-typert-protocol`，均已声明为 dependencies；在包目录里 `pnpm install`（或 profile 安装该 link 包时）即可解析。

## 记录格式

```json
{
  "id": "researcher",
  "name": "研究员",
  "description": "只做检索、阅读与综述；只读文件系统。",
  "order": 10,
  "persona": { "prefix": "你是一名严谨的研究员。结论必须标注来源。" },
  "tools": { "web": true, "fs": "read-only", "bash": false, "jobs": false, "todo": true, "askUser": true, "present": true },
  "skills": { "mode": "isolated", "dirs": ["/abs/path/role-skills/researcher"] },
  "subagent": { "provider": "spawn", "toolName": "subagent", "allowedAgentPresets": ["researcher", "implementer"], "maxDepth": 1 }
}
```

| 字段 | 含义 |
| --- | --- |
| `id` | preset id：小写字母、数字、连字符。创建后不可改，不能与 profile 现有 preset 重名。 |
| `name` / `description` / `order` | 名册元信息；`order` 决定选择器里的排序。 |
| `persona.prefix` | 每轮前置的人格段落。留空则不挂 persona 行。 |
| `tools.web` | `@deepseek-ai/dsh-tool-web`，开启 fetch。 |
| `tools.fs` | `read-only` → 只读 + readImage，禁写禁编辑；`read-write` → 完整 fs 工具；`none` → 完全不挂。 |
| `tools.bash` | `@deepseek-ai/dsh-tool-bash`，用与官方组合相同的 `!!js` 表达式在 Windows 上禁用。 |
| `tools.jobs` / `todo` / `askUser` / `present` | 对应工具行。 |
| `skills.mode` | `none` 不挂；`default` 挂宿主默认根 + skill 加载器；`isolated` 挂带 `isolate.skills` 的 `cordis:group`，其文件系统 provider **只**看到 `skills.dirs`。 |
| `subagent.provider` | `null` 不挂；`spawn` 挂隔离 workflowEngine 的 `cordis:group` + `@deepseek-ai/dsh-tool-subagent`（独立 preset、模型选择、深度预算）；`pi` 把同一工具指向本地 Pi coding agent。 |

每个 preset 另带一行 `@deepseek-ai/dsh-time-context`，角色永远知道当前时间。

### `pi` provider 的能力边界

`dsh-subagent-pi` 注册的是 `NO_START_CAPABILITIES`：不支持 agent preset、子模型选择、深度限制、输出 schema。`tool-subagent` 会在挂载时拒绝这些字段，因此 OMA Studio 把 `pi` 委派编译成「provider + 工具名」，Settings 表单会禁用另外三个字段并说明原因。需要「按名委派给某个角色」时用 `spawn`。

## 两个入口

**agent 工具 `oma_studio`**：`list`、`get`、`create`、`update`、`remove`。结果为 JSON：`{ok: true, value}` 或 `{ok: false, error: {code, message}, nextStep}`。`list` 合并本插件的 preset 与 profile 自带声明，并标注 `active` 或附上注册表诊断。

**Settings → OMA Studio**：同一份名册以卡片呈现（名称、id、来源徽标、已挂载/异常徽标、工具数、诊断），顶部搜索框按名称/id/描述过滤，表单覆盖记录的全部字段。profile 自带的 preset 以只读方式出现——它们属于 profile 的 patch 文件，页面会直接说明。

任何写操作（两个入口都一样）都先请求 `danger-full-access` 审批：它会注册并挂载 Host 插件行、在选中该 preset 的每个会话里生效、并把记录持久化到 DSH home。`list`/`get` 只读免审批。没有审批通道时写操作会 fail closed，什么也不会写。

## 状态与安全

- 文档：`$DSH_HOME/state/oma-studio/presets.json`（默认 `~/.dsh/state/oma-studio/presets.json`），可用 `stateDir` 配置覆盖。
- 写入是原子的：先写完整临时文件，再单次 `rename`。
- 记录在组合挂载**并审计通过后**才落盘；审计失败会卸载它，且不动文档。
- 更新挂不上时会先恢复上一个组合，再报告失败。
- 启动时逐条挂载：某条记录坏了只在它自己的卡片里报出诊断，不会拖垮其他记录。

## 没有构建步骤时如何声明 Remote 方法

官方插件由 TypeScript 编译，源码用 `@Remote("x")`，产物里是 `__esDecorate` 样板。本包没有构建步骤，因此在加载时用协议**公开的** decorator 直接标注类原型（`lib/index.js` 里的 `markRemote`），写出的正是编译器产出的那份冻结的 version-1 方法描述符。Host 网关的 source-mode 发现随后会认领 `omaStudio/list`、`omaStudio/get`、`omaStudio/create`、`omaStudio/update`、`omaStudio/remove`。

浏览器侧通过 profile 的认证通道 `/api/oma-studio/{list,get,save,remove}` 调用同一批服务方法（与其他官方插件同一条通道）：Client 的 Remote 挂载表是 `@deepseek-ai/dsh-api-remotes` 的构建期产物，手写包无法扩充它。一个服务、两种传输、逻辑不重复。

## 开发

```bash
pnpm install
pnpm run check        # 对两个半边做 node --check
```

结构：`lib/index.js`（服务、编译器、agent 工具、路由）、`lib/client.js`（Settings 分区）、`cordis.patch.yml`（一行 Host entry）、`locale/*.json`（名册元信息）。

## 许可

MIT。
