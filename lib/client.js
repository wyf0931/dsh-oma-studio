/**
 * dsh-oma-studio — browser half.
 *
 * One Settings section: the roster of custom agent roles with a card per
 * preset, a search field, and a form that edits the same record the
 * `oma_studio` agent tool writes. Nothing is duplicated between the two
 * faces: both call the Host service, which owns the document and the mounted
 * compositions.
 *
 * Profile presets appear here too, read-only, so the page answers "what can a
 * session select" instead of only "what did I build here".
 *
 * Plain React from the browser module table; own styles from the host's theme
 * tokens, so light/dark and user themes follow the app.
 */

window.__ModuleLoader__.load({
	id: 'dsh-oma-studio',
	factory(require) {
		const React = require('react');
		const h = React.createElement;
		const { useCallback, useEffect, useMemo, useState } = React;

		const NS = 'dsh-oma-studio';

		/* ------------------------------------------------------------------ */
		/* Dictionaries                                                       */
		/* ------------------------------------------------------------------ */

		const DICT = {
			zh: {
				nav: 'OMA Studio',
				title: 'OMA Studio',
				subtitle: '把「一个 agent 角色」写成记录，编译成 Cordis 组合并注册为 Agent Preset。',
				'search.placeholder': '按名称、id 或描述搜索',
				'action.new': '新建',
				'action.refresh': '刷新',
				'action.showSystem': '显示系统预设',
				'switch.label': '在 chat 中可选；关闭后仍在列表里',
				'badge.chat.on': 'chat 可选',
				'badge.chat.off': 'chat 已关闭',
				'action.edit': '编辑',
				'action.delete': '删除',
				'action.close': '关闭',
				'action.save': '保存',
				'action.saving': '保存中…',
				'action.cancel': '取消',
				'action.addDir': '添加目录',
				'badge.active': '已挂载',
				'badge.error': '异常',
				'badge.owned': 'OMA',
				'badge.profile': 'profile',
				'meta.tools': '工具',
				'meta.rows': '行',
				'editor.create': '新建 agent 角色',
				'editor.edit': '编辑 agent 角色',
				'field.id': 'id',
				'field.name': '名称',
				'field.description': '描述',
				'field.persona': '人格前缀（persona.prefix）',
				'field.guideMode': '模式说明',
				'field.guideUsage': '如何使用',
				'field.tools': '工具',
				'field.skills': 'skill 来源',
				'field.subagent': '委派',
				'tools.web': '联网（web）',
				'tools.bash': '命令（bash）',
				'tools.jobs': '后台任务（jobs）',
				'tools.todo': '待办（todo）',
				'tools.askUser': '提问（askUser）',
				'tools.present': '演示（present）',
				'fs.none': '无文件系统',
				'fs.read-only': '只读',
				'fs.read-write': '读写',
				'skills.none': '不挂载',
				'skills.default': '宿主默认根',
				'skills.isolated': '仅下列目录（隔离）',
				'skills.dirs': 'skill 目录（绝对路径）',
				'subagent.provider': '委派 provider',
				'subagent.none': '不委派',
				'subagent.spawn': 'spawn（独立 preset）',
				'subagent.pi': 'pi（本地 Pi agent）',
				'subagent.toolName': '工具名',
				'subagent.presets': '可委派角色（逗号分隔）',
				'subagent.maxDepth': '最大递归深度',
				'subagent.piNote': 'pi provider 只支持 provider 与工具名：它不声明 agentPreset / agentOptions / depthLimit 能力。',
				'hint.id': '小写字母、数字与连字符，创建后不可修改',
				'hint.persona': '每轮对话都会前置这段人格描述；留空则不挂载 persona。',
				'hint.guide': '可选。填写后会以「模式说明 / 如何使用」两个标签显示在卡片上；留空则不显示。',
				'guide.mode': '模式说明',
				'guide.usage': '如何使用',
				'guide.empty': '这一栏还没有内容。',
				'hint.profile': '来自 profile 的 preset，请在 profile 的 patch 文件中修改。',
				'empty.title': '还没有自定义角色',
				'empty.body': '点「新建」创建第一个 agent 角色，或让 AI 调用 oma_studio 工具生成。',
				'empty.filtered': '没有匹配的角色。',
				'error.load': '读取 preset 列表失败',
				'error.save': '保存失败',
				'error.id': 'id 必须是小写字母、数字与连字符，且以字母或数字开头',
				'error.dirs': '隔离模式至少需要一个绝对路径目录',
				'confirm.remove': '删除 preset「{name}」？该组合会立即卸载。',
				'diag.label': '诊断',
				'loading': '加载中…'
			},
			en: {
				nav: 'OMA Studio',
				title: 'OMA Studio',
				subtitle: 'Describe one agent role as a record; it compiles into a Cordis composition and registers as an Agent Preset.',
				'search.placeholder': 'Search by name, id or description',
				'action.new': 'New',
				'action.refresh': 'Refresh',
				'action.showSystem': 'Show system presets',
				'switch.label': 'Selectable in chat; off keeps it in this list',
				'badge.chat.on': 'in chat',
				'badge.chat.off': 'off for chat',
				'action.edit': 'Edit',
				'action.delete': 'Delete',
				'action.close': 'Close',
				'action.save': 'Save',
				'action.saving': 'Saving…',
				'action.cancel': 'Cancel',
				'action.addDir': 'Add directory',
				'badge.active': 'mounted',
				'badge.error': 'error',
				'badge.owned': 'OMA',
				'badge.profile': 'profile',
				'meta.tools': 'tools',
				'meta.rows': 'rows',
				'editor.create': 'New agent role',
				'editor.edit': 'Edit agent role',
				'field.id': 'id',
				'field.name': 'Name',
				'field.description': 'Description',
				'field.persona': 'Persona prefix (persona.prefix)',
				'field.guideMode': 'Mode details',
				'field.guideUsage': 'How to use',
				'field.tools': 'Tools',
				'field.skills': 'Skill roots',
				'field.subagent': 'Delegation',
				'tools.web': 'Web fetch',
				'tools.bash': 'Shell (bash)',
				'tools.jobs': 'Background jobs',
				'tools.todo': 'Todo list',
				'tools.askUser': 'Ask user',
				'tools.present': 'Present',
				'fs.none': 'No filesystem',
				'fs.read-only': 'Read only',
				'fs.read-write': 'Read/write',
				'skills.none': 'None',
				'skills.default': 'Host default roots',
				'skills.isolated': 'Only these dirs (isolated)',
				'skills.dirs': 'Skill directories (absolute)',
				'subagent.provider': 'Delegation provider',
				'subagent.none': 'No delegation',
				'subagent.spawn': 'spawn (independent preset)',
				'subagent.pi': 'pi (local Pi agent)',
				'subagent.toolName': 'Tool name',
				'subagent.presets': 'Delegatable roles (comma separated)',
				'subagent.maxDepth': 'Max depth',
				'subagent.piNote': 'The pi provider supports provider and tool name only: it declares neither agentPreset, agentOptions nor depthLimit.',
				'hint.id': 'Lowercase letters, digits and hyphens; immutable after creation',
				'hint.persona': 'Prepended to every turn; leave empty to mount no persona.',
				'hint.guide': 'Optional. When filled in, shown as “Mode details / How to use” tabs on the card; leave empty to hide them.',
				'guide.mode': 'Mode details',
				'guide.usage': 'How to use',
				'guide.empty': 'Nothing here yet.',
				'hint.profile': 'A profile preset; edit it in the profile patch file.',
				'empty.title': 'No custom roles yet',
				'empty.body': 'Create your first agent role, or ask the model to call the oma_studio tool.',
				'empty.filtered': 'No role matches this filter.',
				'error.load': 'Could not read the preset list',
				'error.save': 'Save failed',
				'error.id': 'id must be lowercase letters, digits and hyphens, starting with a letter or digit',
				'error.dirs': 'Isolated mode needs at least one absolute directory',
				'confirm.remove': 'Delete preset "{name}"? Its composition unmounts immediately.',
				'diag.label': 'Diagnostic',
				'loading': 'Loading…'
			}
		};

		/* ------------------------------------------------------------------ */
		/* Styles                                                             */
		/* ------------------------------------------------------------------ */

		const CSS = `
.oma-section{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55}
.oma-head{display:flex;flex-direction:column;gap:2px}
.oma-title{margin:0;font-size:16px;font-weight:650;letter-spacing:-.01em}
.oma-subtitle{margin:0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.oma-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.oma-search{flex:1;min-width:180px;height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;outline:none}
.oma-search:focus-visible{border-color:var(--dsw-alias-border-l4)}
.oma-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s,color .12s}
.oma-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.oma-btn:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}
.oma-btn:disabled{opacity:.45;cursor:not-allowed}
.oma-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);font-weight:600}
.oma-btn-primary:hover:not(:disabled){background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);opacity:.92}
.oma-btn-sm{height:26px;padding:0 9px;font-size:12px}
.oma-btn-danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.oma-actions{display:inline-flex;align-items:stretch;gap:0;flex:0 0 auto}
.oma-actions .oma-btn{width:30px;padding:0;border-radius:8px}
.oma-actions .oma-btn svg{width:16px;height:16px;display:block}
.oma-switch{position:relative;flex:0 0 auto;margin-left:auto;width:34px;height:20px;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;transition:background .15s,border-color .15s}
.oma-switch:hover{border-color:var(--dsw-alias-border-l3)}
.oma-switch:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:2px}
.oma-switch-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s,background .15s}
.oma-switch-on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.oma-switch-on .oma-switch-knob{transform:translateX(14px);background:var(--dsw-alias-bg-base)}
.oma-list{display:flex;flex-direction:column;gap:8px}
.oma-guide-triggers{display:flex;gap:6px;margin-top:2px}
.oma-guide-btn{height:24px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.oma-guide-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.oma-guide-btn:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}
.oma-guide-tab{height:26px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.oma-guide-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.oma-guide-tab:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}
.oma-guide-tab-on{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);font-weight:600}

.oma-modal-scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;z-index:1000;padding:24px}
.oma-modal{width:min(680px,100%);max-height:min(78vh,720px);display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px 20px;box-shadow:0 18px 50px rgba(0,0,0,.28)}
.oma-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.oma-modal-title{font-size:15px;font-weight:600;margin:0}
.oma-modal-close{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s,color .12s}
.oma-modal-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.oma-modal-close:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}
.oma-modal-tabs{display:flex;gap:6px}
.oma-modal-body{overflow-y:auto;font-size:13px;line-height:1.6;color:var(--dsw-alias-label-primary);white-space:normal}
.oma-md-body{display:flex;flex-direction:column;gap:10px}
.oma-md-body h2,.oma-md-body h3,.oma-md-body h4{margin:6px 0 0;font-size:13.5px;font-weight:600;line-height:1.4}
.oma-md-body h2{font-size:14px}
.oma-md-body p{margin:0}
.oma-md-body ul,.oma-md-body ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px}
.oma-md-body blockquote{margin:0;padding:2px 0 2px 12px;border-left:2px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}
.oma-md-body code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:5px;padding:1px 5px}
.oma-md-body pre{margin:0;padding:10px 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow-x:auto}
.oma-md-body pre code{background:none;border:0;padding:0;font-size:12px;white-space:pre}
.oma-md-body a{color:var(--dsw-alias-brand-primary);text-decoration:underline;text-underline-offset:2px}
.oma-md-body strong{font-weight:600}
.oma-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:11px 13px;display:flex;flex-direction:column;gap:6px}
.oma-card-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.oma-card-name{font-size:13.5px;font-weight:600;margin:0}
.oma-card-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.oma-card-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;gap:10px;flex-wrap:wrap}
.oma-card-desc{font-size:12.5px;color:var(--dsw-alias-label-secondary);margin:0;white-space:pre-wrap}
.oma-card-tools{display:flex;align-items:center;gap:6px;margin-left:auto;flex:0 0 auto}
.oma-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s,border-color .12s,color .12s}
.oma-iconbtn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary)}
.oma-iconbtn:focus-visible{outline:2px solid var(--dsw-alias-border-l4);outline-offset:1px}
.oma-iconbtn-danger{color:var(--dsw-alias-state-error-primary)}
.oma-iconbtn-danger:hover{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-bg-base)}
.oma-badge{display:inline-flex;align-items:center;height:19px;padding:0 7px;border-radius:999px;font-size:10.5px;letter-spacing:.02em;border:1px solid transparent;white-space:nowrap}
.oma-badge-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.oma-badge-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.oma-badge-muted{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l2)}
.oma-diag{border-left:2px solid var(--dsw-alias-state-error-primary);padding-left:8px;font-size:11.5px;color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.oma-form{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:13px;display:flex;flex-direction:column;gap:12px}
.oma-form-title{margin:0;font-size:13px;font-weight:650}
.oma-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.oma-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.oma-field-span{grid-column:1 / -1}
.oma-label{font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.oma-input,.oma-textarea,.oma-select{width:100%;box-sizing:border-box;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;padding:6px 9px;outline:none}
.oma-input:disabled,.oma-textarea:disabled{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-base)}
.oma-input:focus-visible,.oma-textarea:focus-visible,.oma-select:focus-visible{border-color:var(--dsw-alias-border-l4)}
.oma-textarea{min-height:78px;resize:vertical;line-height:1.5}
.oma-checks{display:flex;flex-wrap:wrap;gap:6px 14px}
.oma-check{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer}
.oma-check input{accent-color:var(--dsw-alias-brand-primary);margin:0}
.oma-radios{display:flex;flex-wrap:wrap;gap:6px 14px}
.oma-radio{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer}
.oma-radio input{accent-color:var(--dsw-alias-brand-primary);margin:0}
.oma-dirs{display:flex;flex-direction:column;gap:6px}
.oma-dir-row{display:flex;gap:6px;align-items:center}
.oma-hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.oma-error{font-size:12px;color:var(--dsw-alias-state-error-primary);white-space:pre-wrap}
.oma-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:22px 16px;text-align:center;color:var(--dsw-alias-label-secondary)}
.oma-empty-title{margin:0 0 3px;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.oma-empty-body{margin:0;font-size:12px}
.oma-actions{display:flex;gap:8px;justify-content:flex-end}
`;

		/** Install the stylesheet once; returns the element to remove on unload. */
		function ensureCss() {
			if (typeof document === 'undefined') return undefined;
			const existing = document.querySelector(`style[data-plugin-css="${NS}"]`);
			if (existing !== null) return undefined;
			const style = document.createElement('style');
			style.dataset.pluginCss = NS;
			style.textContent = CSS;
			document.head.appendChild(style);
			return style;
		}

		/* ------------------------------------------------------------------ */
		/* Host API                                                           */
		/* ------------------------------------------------------------------ */

		async function post(path, body) {
			const response = await fetch(`api/oma-studio/${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body ?? {})
			});
			if (response.ok !== true) throw new Error(`HTTP ${String(response.status)}`);
			const data = await response.json();
			if (data === null || typeof data !== 'object' || data.ok !== true) {
				const error = new Error(data?.error?.message ?? 'oma studio request failed');
				if (typeof data?.error?.code === 'string') error.code = data.error.code;
				throw error;
			}
			return data.value;
		}

		/* ------------------------------------------------------------------ */
		/* Draft model                                                        */
		/* ------------------------------------------------------------------ */

		const FS_CHOICES = ['read-only', 'read-write', 'none'];
		const SKILL_CHOICES = ['none', 'default', 'isolated'];
		const PRESET_ID = /^[a-z0-9][a-z0-9-]*$/;

		/** A blank draft, used by "New". */
		function emptyDraft() {
			return {
				id: '',
				name: '',
				description: '',
				personaPrefix: '',
				guideMode: '',
				guideUsage: '',
				tools: { web: false, fs: 'read-only', bash: false, jobs: false, todo: true, askUser: true, present: true },
				skills: { mode: 'none', dirs: [] },
				subagent: { provider: 'none', toolName: 'subagent', allowedAgentPresets: '', maxDepth: '' }
			};
		}

		/** Turn a stored record into the flat form state. */
		function draftOf(record) {
			const base = emptyDraft();
			if (record === null || typeof record !== 'object') return base;
			return {
				id: record.id ?? '',
				name: record.name ?? '',
				description: record.description ?? '',
				personaPrefix: record.persona?.prefix ?? '',
				guideMode: record.guideMode ?? '',
				guideUsage: record.guideUsage ?? '',
				tools: { ...base.tools, ...(record.tools ?? {}) },
				skills: { mode: record.skills?.mode ?? 'none', dirs: [...(record.skills?.dirs ?? [])] },
				subagent: {
					provider: record.subagent?.provider ?? 'none',
					toolName: record.subagent?.toolName ?? 'subagent',
					allowedAgentPresets: (record.subagent?.allowedAgentPresets ?? []).join(', '),
					maxDepth: record.subagent?.maxDepth === null || record.subagent?.maxDepth === undefined ? '' : String(record.subagent.maxDepth)
				}
			};
		}

		/** Turn the form state back into a record the Host service validates. */
		function recordOf(draft) {
			const record = {
				id: draft.id.trim(),
				name: draft.name.trim(),
				description: draft.description.trim(),
				persona: { prefix: draft.personaPrefix },
				guideMode: draft.guideMode,
				guideUsage: draft.guideUsage,
				tools: { ...draft.tools },
				skills: { mode: draft.skills.mode, dirs: draft.skills.dirs.map((dir) => dir.trim()).filter((dir) => dir !== '') },
				subagent: {
					provider: draft.subagent.provider === 'none' ? null : draft.subagent.provider,
					toolName: draft.subagent.toolName.trim() === '' ? 'subagent' : draft.subagent.toolName.trim(),
					allowedAgentPresets: draft.subagent.allowedAgentPresets.split(',').map((entry) => entry.trim()).filter((entry) => entry !== ''),
					maxDepth: draft.subagent.maxDepth === '' ? null : Number(draft.subagent.maxDepth)
				}
			};
			return record;
		}

		/** Client-side pre-flight so a typo never reaches the Host. */
		function validate(draft) {
			if (PRESET_ID.test(draft.id.trim()) !== true) return 'error.id';
			if (draft.skills.mode === 'isolated' && draft.skills.dirs.every((dir) => dir.trim() === '')) return 'error.dirs';
			return undefined;
		}

		/* ------------------------------------------------------------------ */
		/* Small pieces                                                       */
		/* ------------------------------------------------------------------ */

		function Badge({ tone, children }) {
			return h('span', { className: `oma-badge oma-badge-${tone}` }, children);
		}

		function Check({ label, checked, onChange, disabled }) {
			return h('label', { className: 'oma-check' },
				h('input', { type: 'checkbox', checked: checked === true, disabled: disabled === true, onChange: (event) => onChange(event.target.checked) }),
				h('span', null, label));
		}

		function Radio({ name, label, checked, onChange }) {
			return h('label', { className: 'oma-radio' },
				h('input', { type: 'radio', name, checked: checked === true, onChange: () => onChange() }),
				h('span', null, label));
		}

		function Field({ label, hint, className, children }) {
			return h('div', { className: className === undefined ? 'oma-field' : `oma-field ${className}` },
				h('span', { className: 'oma-label' }, label),
				children,
				hint === undefined ? null : h('span', { className: 'oma-hint' }, hint));
		}

		/* ------------------------------------------------------------------ */
		/* Card                                                               */
		/* ------------------------------------------------------------------ */

		function Toggle({ on, onChange, label }) {
			return h('button', {
				type: 'button',
				role: 'switch',
				'aria-checked': on === true ? 'true' : 'false',
				'aria-label': label,
				title: label,
				className: on === true ? 'oma-switch oma-switch-on' : 'oma-switch',
				onClick: () => onChange(!(on === true))
			}, h('span', { className: 'oma-switch-knob' }));
		}

		function Card({ entry, t, onEdit, onRemove, onToggleChat }) {
			const owned = entry.source === 'oma-studio';
			const editable = owned && entry.record !== null;
			const chatOn = entry.chat !== false;
			const [guideOpen, setGuideOpen] = useState(null);
			const guideMode = typeof entry.guideMode === 'string' ? entry.guideMode : '';
			const guideUsage = typeof entry.guideUsage === 'string' ? entry.guideUsage : '';
			const hasGuide = guideMode.trim() !== '' || guideUsage.trim() !== '';
			return h('div', { className: 'oma-card' },
				h('div', { className: 'oma-card-head' },
					h('h3', { className: 'oma-card-name' }, entry.name),
					h('span', { className: 'oma-card-id' }, entry.id),
					chatOn === true
						? h(Badge, { tone: 'ok' }, t('badge.chat.on'))
						: h(Badge, { tone: 'muted' }, t('badge.chat.off')),
					entry.active === true ? h(Badge, { tone: 'ok' }, t('badge.active')) : h(Badge, { tone: 'error' }, t('badge.error')),
					h(Badge, { tone: 'muted' }, owned ? t('badge.owned') : t('badge.profile')),
					h('span', { className: 'oma-card-tools' },
						owned === true ? h(Toggle, { on: chatOn, onChange: () => onToggleChat(entry), label: t('switch.label') }) : null,
						editable === true ? h('button', {
							type: 'button',
							className: 'oma-iconbtn',
							title: t('action.edit'),
							'aria-label': t('action.edit'),
							onClick: () => onEdit(entry)
						}, IconPen()) : null,
						editable === true ? h('button', {
							type: 'button',
							className: 'oma-iconbtn oma-iconbtn-danger',
							title: t('action.delete'),
							'aria-label': t('action.delete'),
							onClick: () => onRemove(entry)
						}, IconTrash()) : null)),
				h('div', { className: 'oma-card-meta' },
					entry.toolCount === null ? null : h('span', null, `${t('meta.tools')} ${String(entry.toolCount)}`),
					entry.rowCount === null ? null : h('span', null, `${t('meta.rows')} ${String(entry.rowCount)}`)),
				entry.description === '' ? null : h('p', { className: 'oma-card-desc' }, entry.description),
				hasGuide === true ? h('div', { className: 'oma-guide-triggers' },
					h('button', { type: 'button', className: 'oma-guide-btn', onClick: () => setGuideOpen('mode') }, t('guide.mode')),
					guideUsage.trim() === '' ? null : h('button', { type: 'button', className: 'oma-guide-btn', onClick: () => setGuideOpen('usage') }, t('guide.usage'))) : null,
				guideOpen === null ? null : h(GuideDialog, {
					tab: guideOpen, setTab: setGuideOpen, onClose: () => setGuideOpen(null),
					guideMode, guideUsage, name: entry.name, t
				}),
				entry.diagnostic === null ? null : h('div', { className: 'oma-diag' }, `${t('diag.label')}: ${entry.diagnostic}`),
				owned !== true ? h('span', { className: 'oma-hint' }, t('hint.profile')) : null);
		}

		/** Lucide `square-pen`. Explicit size: without width/height the svg blows up to 100% and vanishes. */
		function IconPen() {
			return h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
				h('path', { d: 'M12 20h9' }),
				h('path', { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' }));
		}

		/** Lucide `trash-2`. */
		function IconTrash() {
			return h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
				h('path', { d: 'M3 6h18' }),
				h('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }),
				h('path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }),
				h('line', { x1: '10', y1: '11', x2: '10', y2: '17' }),
				h('line', { x1: '14', y1: '11', x2: '14', y2: '17' }));
		}

		/**
		 * Render the two guide texts in a modal, mirroring the built-in preset
		 * picker: tabbed (模式说明 / 如何使用), content shown as Markdown.
		 */
		function GuideDialog({ tab, setTab, onClose, guideMode, guideUsage, name, t }) {
			useEffect(() => {
				const onKey = (event) => { if (event.key === 'Escape') onClose(); };
				window.addEventListener('keydown', onKey);
				return () => window.removeEventListener('keydown', onKey);
			}, [onClose]);
			const active = tab === 'usage' ? guideUsage : guideMode;
			const usageExists = guideUsage.trim() !== '';
			return h('div', { className: 'oma-modal-scrim', onClick: onClose },
				h('div', {
					className: 'oma-modal', role: 'dialog', 'aria-modal': 'true',
					'aria-label': `${name} ${t('guide.mode')}`,
					onClick: (event) => event.stopPropagation()
				},
					h('div', { className: 'oma-modal-head' },
						h('h2', { className: 'oma-modal-title' }, name),
						h('button', {
							type: 'button', className: 'oma-modal-close',
							title: t('action.close'), 'aria-label': t('action.close'),
							onClick: onClose
						}, h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
							h('path', { d: 'M18 6 6 18' }), h('path', { d: 'm6 6 12 12' })))),
					h('div', { className: 'oma-modal-tabs', role: 'tablist' },
						h('button', {
							type: 'button', role: 'tab',
							'aria-selected': tab !== 'usage' ? 'true' : 'false',
							className: tab !== 'usage' ? 'oma-guide-tab oma-guide-tab-on' : 'oma-guide-tab',
							onClick: () => setTab('mode')
						}, t('guide.mode')),
						usageExists === false ? null : h('button', {
							type: 'button', role: 'tab',
							'aria-selected': tab === 'usage' ? 'true' : 'false',
							className: tab === 'usage' ? 'oma-guide-tab oma-guide-tab-on' : 'oma-guide-tab',
							onClick: () => setTab('usage')
						}, t('guide.usage'))),
					h('div', { className: 'oma-modal-body oma-md' },
						active.trim() === '' ? h('span', { className: 'oma-hint' }, t('guide.empty')) : h(Markdown, { text: active }))));
		}

		/**
		 * Minimal Markdown → React renderer for guide text: headings, bold,
		 * inline code, fenced code, lists, blockquotes, links, paragraphs.
		 * Builds elements directly (never innerHTML), so guide text can't
		 * inject markup into the app.
		 */
		function Markdown({ text }) {
			const lines = String(text).replace(/\r\n/g, '\n').split('\n');
			const out = [];
			let list = null;        // 'ul' | 'ol' pending list
			let listItems = [];
			let quote = null;       // pending blockquote lines
			let fence = null;       // pending fenced-code lines
			const flushList = () => { if (list !== null) { out.push(renderList(list, listItems, out.length)); list = null; listItems = []; } };
			const flushQuote = () => { if (quote !== null) { out.push(h('blockquote', { key: out.length }, h(Markdown, { text: quote.join('\n') }))); quote = null; } };
			for (const raw of lines) {
				const line = raw;
				if (fence !== null) {
					if (/^```/.test(line)) { out.push(h('pre', { key: out.length }, h('code', null, fence.join('\n')))); fence = null; }
					else fence.push(line);
					continue;
				}
				const fenceMatch = /^```\s*(\S*)\s*$/.exec(line);
				if (fenceMatch !== null) { flushList(); flushQuote(); fence = []; continue; }
				const heading = /^(#{1,6})\s+(.*)$/.exec(line);
				if (heading !== null) { flushList(); flushQuote(); out.push(h(`h${Math.min(heading[1].length + 1, 6)}`, { key: out.length }, inline(heading[2]))); continue; }
				const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
				const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
				if (ul !== null || ol !== null) { flushQuote(); const kind = ul !== null ? 'ul' : 'ol'; if (list !== kind) { flushList(); list = kind; } listItems.push(ul !== null ? ul[1] : ol[1]); continue; }
				const quoted = /^>\s?(.*)$/.exec(line);
				if (quoted !== null) { flushList(); (quote = quote ?? []).push(quoted[1]); continue; }
				if (line.trim() === '') { flushList(); flushQuote(); continue; }
				flushList(); flushQuote();
				out.push(h('p', { key: out.length }, inline(line)));
			}
			if (fence !== null) out.push(h('pre', { key: out.length }, h('code', null, fence.join('\n'))));
			flushList(); flushQuote();
			return h('div', { className: 'oma-md-body' }, out);
		}

		function renderList(kind, items, key) {
			return h(kind, { key }, items.map((item, index) => h('li', { key: index }, inline(item))));
		}

		/** Inline Markdown: `code`, **bold**, *italic*, [text](url). Returns element children. */
		function inline(text) {
			const nodes = [];
			const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)\s]+\))/g;
			let last = 0;
			let match;
			while ((match = pattern.exec(text)) !== null) {
				if (match.index > last) nodes.push(text.slice(last, match.index));
				const token = match[0];
				if (token.startsWith('`')) nodes.push(h('code', { key: nodes.length }, token.slice(1, -1)));
				else if (token.startsWith('**')) nodes.push(h('strong', { key: nodes.length }, token.slice(2, -2)));
				else if (token.startsWith('*')) nodes.push(h('em', { key: nodes.length }, token.slice(1, -1)));
				else {
					const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
					if (link !== null) nodes.push(h('a', { key: nodes.length, href: link[2], target: '_blank', rel: 'noreferrer noopener' }, link[1]));
					else nodes.push(token);
				}
				last = match.index + token.length;
			}
			if (last < text.length) nodes.push(text.slice(last));
			return nodes;
		}

		/* ------------------------------------------------------------------ */
		/* Editor                                                             */
		/* ------------------------------------------------------------------ */

		function Editor({ draft, setDraft, editing, t, onSave, onCancel, saving, error }) {
			const patch = (fields) => setDraft({ ...draft, ...fields });
			const patchTool = (key, value) => setDraft({ ...draft, tools: { ...draft.tools, [key]: value } });
			const patchSubagent = (fields) => setDraft({ ...draft, subagent: { ...draft.subagent, ...fields } });
			const patchSkills = (fields) => setDraft({ ...draft, skills: { ...draft.skills, ...fields } });
			const isPi = draft.subagent.provider === 'pi';
			return h('div', { className: 'oma-form' },
				h('h3', { className: 'oma-form-title' }, editing ? t('editor.edit') : t('editor.create')),
				h('div', { className: 'oma-grid' },
					h(Field, { label: t('field.id'), hint: editing ? undefined : t('hint.id') },
						h('input', {
							className: 'oma-input',
							value: draft.id,
							disabled: editing === true,
							placeholder: 'researcher',
							onChange: (event) => patch({ id: event.target.value })
						})),
					h(Field, { label: t('field.name') },
						h('input', {
							className: 'oma-input',
							value: draft.name,
							placeholder: '研究员',
							onChange: (event) => patch({ name: event.target.value })
						})),
					h(Field, { className: 'oma-field-span', label: t('field.description') },
						h('input', {
							className: 'oma-input',
							value: draft.description,
							onChange: (event) => patch({ description: event.target.value })
						}))),
				h(Field, { label: t('field.persona'), hint: t('hint.persona') },
					h('textarea', {
						className: 'oma-textarea',
						value: draft.personaPrefix,
						onChange: (event) => patch({ personaPrefix: event.target.value })
					})),
				h(Field, { label: t('field.guideMode'), hint: t('hint.guide') },
					h('textarea', {
						className: 'oma-textarea',
						value: draft.guideMode,
						onChange: (event) => patch({ guideMode: event.target.value })
					})),
				h(Field, { label: t('field.guideUsage'), hint: t('hint.guide') },
					h('textarea', {
						className: 'oma-textarea',
						value: draft.guideUsage,
						onChange: (event) => patch({ guideUsage: event.target.value })
					})),
				h(Field, { label: t('field.tools') },
					h('div', { className: 'oma-checks' },
						h(Check, { label: t('tools.web'), checked: draft.tools.web, onChange: (value) => patchTool('web', value) }),
						h(Check, { label: t('tools.bash'), checked: draft.tools.bash, onChange: (value) => patchTool('bash', value) }),
						h(Check, { label: t('tools.jobs'), checked: draft.tools.jobs, onChange: (value) => patchTool('jobs', value) }),
						h(Check, { label: t('tools.todo'), checked: draft.tools.todo, onChange: (value) => patchTool('todo', value) }),
						h(Check, { label: t('tools.askUser'), checked: draft.tools.askUser, onChange: (value) => patchTool('askUser', value) }),
						h(Check, { label: t('tools.present'), checked: draft.tools.present, onChange: (value) => patchTool('present', value) })),
					h('div', { className: 'oma-radios', style: { marginTop: 6 } },
						FS_CHOICES.map((choice) => h(Radio, {
							key: choice,
							name: 'oma-fs',
							label: t(`fs.${choice}`),
							checked: draft.tools.fs === choice,
							onChange: () => patchTool('fs', choice)
						})))),
				h(Field, { label: t('field.skills') },
					h('div', { className: 'oma-radios' },
						SKILL_CHOICES.map((choice) => h(Radio, {
							key: choice,
							name: 'oma-skills',
							label: t(`skills.${choice}`),
							checked: draft.skills.mode === choice,
							onChange: () => patchSkills({ mode: choice })
						}))),
					draft.skills.mode !== 'isolated' ? null : h('div', { className: 'oma-dirs', style: { marginTop: 7 } },
						h('span', { className: 'oma-label' }, t('skills.dirs')),
						draft.skills.dirs.map((dir, index) => h('div', { className: 'oma-dir-row', key: `dir-${String(index)}` },
							h('input', {
								className: 'oma-input',
								value: dir,
								placeholder: '/Users/you/skills/researcher',
								onChange: (event) => {
									const dirs = [...draft.skills.dirs];
									dirs[index] = event.target.value;
									patchSkills({ dirs });
								}
							}),
							h('button', {
								type: 'button',
								className: 'oma-btn oma-btn-sm oma-btn-danger',
								onClick: () => patchSkills({ dirs: draft.skills.dirs.filter((_entry, position) => position !== index) })
							}, t('action.delete')))),
						h('div', null,
							h('button', {
								type: 'button',
								className: 'oma-btn oma-btn-sm',
								onClick: () => patchSkills({ dirs: [...draft.skills.dirs, ''] })
							}, t('action.addDir'))))),
				h(Field, { label: t('field.subagent') },
					h('div', { className: 'oma-grid' },
						h(Field, { label: t('subagent.provider') },
							h('select', {
								className: 'oma-select',
								value: draft.subagent.provider,
								onChange: (event) => patchSubagent({ provider: event.target.value })
							},
								h('option', { value: 'none' }, t('subagent.none')),
								h('option', { value: 'spawn' }, t('subagent.spawn')),
								h('option', { value: 'pi' }, t('subagent.pi')))),
						h(Field, { label: t('subagent.toolName') },
							h('input', {
								className: 'oma-input',
								value: draft.subagent.toolName,
								disabled: draft.subagent.provider === 'none',
								onChange: (event) => patchSubagent({ toolName: event.target.value })
							})),
						h(Field, { label: t('subagent.presets') },
							h('input', {
								className: 'oma-input',
								value: draft.subagent.allowedAgentPresets,
								disabled: isPi === true || draft.subagent.provider === 'none',
								placeholder: 'researcher, implementer',
								onChange: (event) => patchSubagent({ allowedAgentPresets: event.target.value })
							})),
						h(Field, { label: t('subagent.maxDepth') },
							h('input', {
								className: 'oma-input',
								value: draft.subagent.maxDepth,
								inputMode: 'numeric',
								disabled: isPi === true || draft.subagent.provider === 'none',
								onChange: (event) => patchSubagent({ maxDepth: event.target.value })
							}))),
					isPi === true ? h('span', { className: 'oma-hint' }, t('subagent.piNote')) : null),
				error === null ? null : h('div', { className: 'oma-error' }, error),
				h('div', { className: 'oma-actions' },
					h('button', { type: 'button', className: 'oma-btn', onClick: onCancel, disabled: saving === true }, t('action.cancel')),
					h('button', { type: 'button', className: 'oma-btn oma-btn-primary', onClick: onSave, disabled: saving === true }, saving === true ? t('action.saving') : t('action.save'))));
		}

		/* ------------------------------------------------------------------ */
		/* Section                                                            */
		/* ------------------------------------------------------------------ */

		function OmaStudioSection({ t }) {
			const [entries, setEntries] = useState([]);
			const [total, setTotal] = useState(0);
			const [status, setStatus] = useState('loading');
			const [error, setError] = useState(null);
			const [query, setQuery] = useState('');
			const [showSystem, setShowSystem] = useState(false);
			const [editor, setEditor] = useState(null);
			const [saving, setSaving] = useState(false);
			const [saveError, setSaveError] = useState(null);

			/** Read the roster; `includeSystem` adds the shipped presets. Every custom
			 * preset is always returned, including ones switched off for chat. */
			const load = useCallback(async (includeSystem = false) => {
				setStatus('loading');
				try {
					const value = await post('list', { includeSystem });
					setEntries(Array.isArray(value?.entries) ? value.entries : []);
					setTotal(value?.total ?? 0);
					setStatus('ready');
					setError(null);
				} catch (failure) {
					setStatus('error');
					setError(failure.message);
				}
			}, []);

			useEffect(() => {
				load(false);
			}, [load]);

			const visible = useMemo(() => {
				const needle = query.trim().toLowerCase();
				if (needle === '') return entries;
				return entries.filter((entry) => `${entry.name}\n${entry.id}\n${entry.description}`.toLowerCase().includes(needle));
			}, [entries, query]);

			const save = async () => {
				if (editor === null) return;
				const problem = validate(editor.draft);
				if (problem !== undefined) {
					setSaveError(t(problem));
					return;
				}
				setSaving(true);
				setSaveError(null);
				try {
					await post('save', { id: editor.draft.id.trim(), record: recordOf(editor.draft) });
					setEditor(null);
					await load(showSystem);
				} catch (failure) {
					setSaveError(`${t('error.save')}: ${failure.message}`);
				} finally {
					setSaving(false);
				}
			};

			const remove = async (entry) => {
				if (typeof window !== 'undefined' && typeof window.confirm === 'function' && window.confirm(t('confirm.remove').replace('{name}', entry.name)) !== true) return;
				try {
					await post('remove', { id: entry.id });
					if (editor !== null && editor.draft.id === entry.id) setEditor(null);
					await load(showSystem);
				} catch (failure) {
					setStatus('error');
					setError(failure.message);
				}
			};

			/** Mount or unmount a preset for chat. It stays listed on the page either way. */
			const toggleChat = async (entry) => {
				try {
					await post('chat-visible', { id: entry.id, chat: entry.chat !== true });
					await load(showSystem);
				} catch (failure) {
					setStatus('error');
					setError(failure.message);
				}
			};

			return h('section', { className: 'oma-section' },
				h('div', { className: 'oma-head' },
					h('h2', { className: 'oma-title' }, t('title')),
					h('p', { className: 'oma-subtitle' }, t('subtitle'))),
				h('div', { className: 'oma-toolbar' },
					h('input', {
						className: 'oma-search',
						value: query,
						placeholder: t('search.placeholder'),
						onChange: (event) => setQuery(event.target.value)
					}),
					h('label', { className: 'oma-check', title: t('action.showSystem') },
						h('input', {
							type: 'checkbox',
							checked: showSystem,
							onChange: (event) => {
								const next = event.target.checked;
								setShowSystem(next);
								load(next);
							}
						}),
						h('span', null, t('action.showSystem'))),
					h('div', { className: 'oma-actions' },
						h('button', {
							type: 'button',
							className: 'oma-btn',
							title: t('action.refresh'),
							'aria-label': t('action.refresh'),
							onClick: () => load(showSystem)
						}, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
							h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' }),
							h('path', { d: 'M23 4 23 10 17 10' }))),
						h('button', {
							type: 'button',
							className: 'oma-btn',
							title: t('action.new'),
							'aria-label': t('action.new'),
							onClick: () => {
								setSaveError(null);
								setEditor({ draft: emptyDraft(), editing: false });
							}
						}, h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
							h('path', { d: 'M12 5v14' }),
							h('path', { d: 'M5 12h14' }))))),
				error === null ? null : h('div', { className: 'oma-error' }, `${t('error.load')}: ${error}`),
				editor === null ? null : h(Editor, {
					draft: editor.draft,
					setDraft: (draft) => setEditor({ draft, editing: editor.editing }),
					editing: editor.editing,
					t,
					onSave: save,
					onCancel: () => setEditor(null),
					saving,
					error: saveError
				}),
				status === 'loading' && entries.length === 0 ? h('div', { className: 'oma-hint' }, t('loading')) : null,
				visible.length === 0 ? h('div', { className: 'oma-empty' },
					h('p', { className: 'oma-empty-title' }, total === 0 ? t('empty.title') : t('empty.filtered')),
					h('p', { className: 'oma-empty-body' }, t('empty.body'))) : h('div', { className: 'oma-list' },
					visible.map((entry) => h(Card, {
						key: entry.id,
						entry,
						t,
						onToggleChat: toggleChat,
						onEdit: (target) => {
							setSaveError(null);
							setEditor({ draft: draftOf(target.record), editing: true });
						},
						onRemove: remove
					}))) );
		}

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				const style = ensureCss();
				if (style !== undefined) {
					ctx.effect(() => () => {
						style.remove();
					}, 'oma-studio: styles');
				}
				ctx.effect(() => ctx.locale.register(NS, DICT), 'oma-studio: dictionaries');
				const t = ctx.locale.bind(NS);
				ctx.slots.inject('settings.section', () => ctx.slots.register({
					name: 'settings.section',
					id: 'oma-studio',
					order: 30,
					label: () => t('nav'),
					locale: NS
				}, (props) => h(OmaStudioSection, { t: typeof props?.t === 'function' ? props.t : t })));
			}
		};
	}
});
