---
name: feedback-bug-triage
description: >-
  查看、修复与清理寒的学习助手反馈服务器上的 bug。数据文件固定为
  /data/feedback-server/data/issues.json，通过 MCP user-remote-server-data 读写。
  在用户提到「查看服务器 bug」「修复 bug」「清除无效 bug」「反馈看板」「issues.json」时使用。
---

# 反馈 Bug triage（服务器）

## 数据位置（固定）

| 项 | 值 |
|----|-----|
| **唯一数据文件** | `/data/feedback-server/data/issues.json` |
| **MCP 服务** | `user-remote-server-data` |
| **读取** | `read_text_file` |
| **写入** | `write_file`（整文件覆盖；改前必须先读） |

禁止猜测其它路径。若 MCP 不可用，告知用户启用 `user-remote-server-data` 后再继续。

## 数据格式速查

```json
{
  "version": 1,
  "updatedAt": "ISO-8601",
  "issues": [
    {
      "id": "fb_YYYYMMDD_NNN",
      "title": "...",
      "category": "bug|feature|question|other",
      "description": "...",
      "resolved": false,
      "status": "pending|triaged|fixed|wontfix",
      "solution": null,
      "resolvedAt": null,
      "appVersion": "...",
      "platform": "...",
      "contact": null,
      "clientId": "...",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

**Bug** = `category === "bug"`。列表默认按 `createdAt` 降序展示。

---

## 模式 A：查看 bug

**触发**：用户要查看/统计服务器 bug。

1. `read_text_file` → `/data/feedback-server/data/issues.json`
2. 解析 JSON，筛选 `category === "bug"`
3. 输出表格：`id` | `title` | `status` | `resolved` | `createdAt` | 描述摘要（≤40 字）
4. 附汇总：总数、pending / fixed 各多少

---

## 模式 B：修复 bug

**触发**：用户要求修复 bug、处理反馈、修某个 issue。

### B1 列举并让用户选择

1. 读取 `issues.json`，列出 **`category === "bug"` 且 `status !== "fixed"`** 的条目（若无则列出全部 bug 并说明均已修复）
2. 用 **AskQuestion**（或编号列表 + 请用户回复 id/序号）让用户选定 **一条**
3. 展示该 bug 的完整 `title`、`description`、`id`、`platform`、`appVersion`

### B2 补充细节并修复代码

4. 根据标题与描述在 **本仓库** 检索相关代码，形成初步修复假设
5. **主动询问用户**是否还有复现步骤、期望行为、截图说明等补充细节；信息不足时先问再改
6. 在本仓库实施修复（遵循项目既有风格，最小 diff）
7. 向用户说明改了什么、如何验证

### B3 用户确认后标记已修复

8. **仅当用户明确表示修复完成/可以标记** 后，才更新服务器 JSON：
   - 对应 issue：`resolved: true`，`status: "fixed"`
   - `solution`：一句话修复说明（含版本或改动要点）
   - `resolvedAt`、`updatedAt`：当前 UTC ISO 时间
   - 根级 `updatedAt`：同步更新
9. `write_file` 写回 `/data/feedback-server/data/issues.json`（保留其它 issue 不变，2 空格缩进 + 末尾换行）
10. 回复用户：已标记的 `id`、solution 摘要

**禁止**在用户未确认修复完成前标记 fixed。

---

## 模式 C：清除无效 bug

**触发**：用户要求清除/删除无效 bug、垃圾反馈、无意义提交。

### C1 扫描与判定

1. 读取 `issues.json`，**仅检查 `category === "bug"`**
2. 按 [invalid-heuristics.md](invalid-heuristics.md) 标记候选；每条须写 **id、title、判定理由**
3. 若无候选 → 告知用户，不写入

### C2 用户确认

4. 将候选列表完整展示，说明将**永久从 JSON 删除**
5. **必须**取得用户明确确认（Accept 列表 / 回复「确认删除」/ 勾选 id）；未确认则 **不写入**

### C3 执行删除

6. 从 `issues` 数组移除已确认的 id
7. 更新根级 `updatedAt`，`write_file` 写回
8. 汇报删除了哪些 id

**禁止**未经确认删除。拿不准的条目列入候选但不自动删除。

---

## 写入安全

- 改 JSON 前 **总是** 先 `read_text_file` 获取最新内容
- 只改目标 issue 或删除已确认 id，勿清空整个文件
- 写后可选：再次读取并核对 id 是否存在/状态是否正确

## 附加资源

- 无效 bug 判定细则：[invalid-heuristics.md](invalid-heuristics.md)
- 客户端反馈契约：`docs/feedback-server-plan.md`
