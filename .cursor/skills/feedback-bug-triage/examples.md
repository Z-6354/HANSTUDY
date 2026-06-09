# 使用示例

## 查看 bug

**用户**：服务器上有多少 bug？

**Agent**：
1. 读 `/data/feedback-server/data/issues.json`
2. 回复：共 N 条 bug，pending X / fixed Y，并附表格

---

## 修复 bug

**用户**：修复服务器上的 bug

**Agent**：
1. 列出未修复 bug，AskQuestion 让用户选 `fb_20260609_003`
2. 展示标题「显示有问题」、描述「具体部分」
3. 问：「能否补充是哪个界面、什么操作下出现？」
4. 用户补充后改代码
5. 用户：「修好了，可以标记完成」
6. 更新 JSON：`status: fixed`, `solution: "修复 xxx 布局"`，写回文件

---

## 清除无效 bug

**用户**：清除无效 bug

**Agent**：
1. 扫描后输出候选：`fb_20260609_002`（标题 `1`，R1/R2/R4）
2. 「以下 1 条将被永久删除，是否确认？」
3. 用户确认后写回 JSON，汇报已删 id
