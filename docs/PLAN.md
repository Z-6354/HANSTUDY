# 寒的学习助手 · 实现计划

> 仓库：[Z-6354/HANSTUDY](https://github.com/Z-6354/HANSTUDY)  
> 当前基线：**v0.1.0**（2026-06-08）  
> 文档更新：**2026-06-09**

**智能体最终计划（定稿）：** [knowledge/05-agent-final-plan.md](./knowledge/05-agent-final-plan.md)

---

## 阶段总览

| 阶段 | 主题 | 目标版本 | 状态 |
|------|------|----------|------|
| **P0** | 阅读 + 笔记本 + AI 对话基础 | v0.1.0 | ✅ 已发布 |
| **P1** | 体验优化与能力补全 | — | 🔄 收尾中 |
| **A** | 理解 — 读懂当前文档、引用、Skill | v0.2.0 | ⏭ 下一步 |
| **B** | 知库 — list/search/range 读本地库 | v0.2.0 | ⏭ 与 A 并行 |
| **C** | 成文 — Plan + 写入生成模式 | v0.3.0 | 📋 已规划 |
| **D** | 沉淀 — append_note、苏格拉底阅读 | v0.3.0 | 📋 已规划 |
| **E** | 创作 — 小说/角色/Skill authoring | v0.4.0 | 📋 远期 |
| **P3** | 生成模式编辑器体验 | 贯穿 C+ | 📋 已纳入 |

**产品主线：** 读 → 懂 → 帮 → 写 → 创（详见 [04-reading-knowledge-writing-agent-vision.md](./knowledge/04-reading-knowledge-writing-agent-vision.md)）

---

## P0 · 已发布（v0.1.0）

- 多格式阅读：TXT / MD / PDF / DOCX / 内置网页
- 笔记本：多本、层级树、锚点跳转、导出导入
- AI：流式多会话、上下文 chip、Skill、MCP、加入笔记
- Agent 雏形：ReAct + 5 内置工具 + HITL（MCP）
- Windows 安装包与单元测试基线

详见 [CHANGELOG.md](../CHANGELOG.md) `[0.1.0]`。

---

## P1 · 体验优化（收尾，~1 周）

| 模块 | 内容 | 状态 |
|------|------|------|
| 设置 · Skill | 图标按钮样式 | ✅ |
| AI · 笔记 | 浏览/生成模式加入笔记不强制切换 | ✅ |
| 阅读 · 缩放 | 布局组合分别记忆 PDF/TXT 缩放 | ✅ |
| 截图 / 网页缩放 / 反馈 | 见 CHANGELOG Unreleased | ✅ |
| 生成模式 · 雏形 | 全屏 Markdown 实时渲染 | ✅ |
| 打包与测试 | typecheck + test 全绿 | ☐ |
| CHANGELOG | `[0.2.0]` 定稿 | ☐ |

---

## A · 理解（v0.2.0）

**目标：** reading / agent 回答有据、可引用、Skill 自动匹配。

- [x] A.1 reading / agent system prompt 重写（事实 vs 推断、引用格式）
- [x] A.2 Skill 自动匹配优化（摘要 / 术语 / 思维导图触发词）
- [x] A.3 引用格式与 context chip 跳转（文档 chip 回阅读区；进度 hint 含页码/行号）
- [x] A.4 Agent 流式输出（completeWithTools + stream）

**里程碑 M-A：** 对当前 PDF 提问 → 结构化回答 + 引用意识。

---

## B · 知库（v0.2.0）

**目标：** Agent 能列举、搜索、分段读取 **整个本地库**。

- [x] B.1 工具 `list_library`
- [x] B.2 工具 `read_document_range`
- [x] B.3 工具 `search_in_library` + `libraryBrowseService`
- [x] B.4 工具 `get_reading_progress`
- [x] B.5 PathGuard 覆盖本地库根（启动时 setWorkspaceRoot）
- [x] B.6 Agent prompt：跨文件任务先 list/search
- [x] B.7 单元测试（`libraryBrowseService.test.ts`、`documentRangeService.test.ts`）
- [x] 工具注册分组（hancli 模式：`ToolRegistry.registerBuiltins()` + `builtins/*Tools.ts`）

**里程碑 M-B：** 「库里关于 X 的几篇有何异同」→ 自动定位并对比。

**→ 发布 v0.2.0：** M-A + M-B

---

## C · 成文（v0.3.0）

**目标：** Plan 读多篇 → 用户确认 → `write_generate_draft` → 生成模式。

- [ ] C.1 `PlanExecuteAgent` + `Planner` + `ExecutionPlan`
- [ ] C.2 阅读 Task 类型（READ / SEARCH / ANALYSIS / WRITE / VERIFY）
- [ ] C.3 计划审阅 UI + IPC
- [ ] C.4 工具 `write_generate_draft`（HITL）
- [ ] C.5 Skill `article-from-sources`
- [ ] C.6 生成模式与 Agent 联动
- [ ] C.7 AgentBudget + 对话压缩
- [ ] C.8 集成测试

**里程碑 M-C：** 库内材料 → 确认计划 → 生成模式出现带引用的成稿。

---

## D · 沉淀（v0.3.0）

- [ ] D.1 工具 `append_note`（HITL）
- [ ] D.2 compose 模式联动
- [ ] D.3 Skill `socratic-reading`

**→ 发布 v0.3.0：** M-C + M-D

---

## E · 创作（v0.4.0 · 远期）

- [ ] E.1 MemoryManager + `save_writing_memory`
- [ ] E.2 Skill `chapter-outline`、`character-voice`
- [ ] E.3 工具 `create_skill_draft`（HITL）
- [ ] E.4 Team 模式（可选，长篇审校）

---

## P3 · 生成模式编辑器（贯穿 C+）

- [ ] 光标与渲染层对齐
- [ ] 多草稿 / 导出 md
- [ ] AI 协同（续写、润色）— 与 C.4 衔接
- [ ] 暗色主题

---

## 里程碑总表

| 版本 | 内容 |
|------|------|
| v0.1.0 | P0 ✅ |
| **v0.2.0** | A 理解 + B 知库 |
| **v0.3.0** | C 成文 + D 沉淀 |
| **v0.4.0** | E 创作 |

---

## 变更记录（计划层）

| 日期 | 说明 |
|------|------|
| 2026-06-08 | v0.1.0 发布；P0 关闭 |
| 2026-06-09 | P2 重写为 A–E 阅读智能体路线；定稿 [05-agent-final-plan.md](./knowledge/05-agent-final-plan.md) |

---

## 相关文档

- [05-agent-final-plan.md](./knowledge/05-agent-final-plan.md) — **最终计划（定稿）**
- [04-reading-knowledge-writing-agent-vision.md](./knowledge/04-reading-knowledge-writing-agent-vision.md) — 愿景与架构
- [03-hancli-agent-framework-and-hanstudy.md](./knowledge/03-hancli-agent-framework-and-hanstudy.md) — hancli 技术对照
- [README.md](../README.md) — 功能概览
