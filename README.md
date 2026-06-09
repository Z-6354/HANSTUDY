# 寒的学习助手

**AI 对话 + 笔记本** 学习桌面应用，VS Code / Cursor 风格布局。  
当前版本：**0.1.0**（预览版）

## 功能概览

### 阅读

| 格式 | 说明 |
|------|------|
| `.txt` | Monaco 只读 |
| `.md` | 预览 / 源码双模式 |
| `.pdf` | pdf.js 分页，Ctrl+滚轮缩放 |
| `.docx` | Word 简化 HTML |
| 网页 | 内置 WebViewer |

### 笔记本（记笔记模式）

- **多笔记本**：条目与文档解耦，自动关联已打开文档
- 层级树、拖动排序、锚点跳转（PDF 页码 / TXT·MD 行号）
- `/` 命令与格式工具栏；笔记本 **导出 / 导入 JSON**

### AI 助手

- 流式多会话；**历史对话** 与当前对话页内切换
- 笔记 / 文档 **上下文 chip**（发送后显示在消息下，可跳转）
- **Skill** 菜单与设置页管理；Agent + MCP
- 回复或历史 **加入笔记**（自动包含提问与引用）
- AI 笔记可 **跳回对应对话**

### 工作区模式

- **浏览 / 笔记 / 生成 / 反馈** 四种模式（生成模式：全屏 Markdown 草稿，实时渲染）
- 浏览模式下 AI「加入笔记」不强制切换笔记模式

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+Shift+A` | 显示/隐藏 AI 面板 |
| `Ctrl+Shift+V` | Markdown 预览/源码切换 |

## 开发

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run test
```

## 打包（Windows）

在项目目录执行：

```bash
npm run dist:win
```

或双击 **`打包.bat`**（控制台输出，完成后按任意键关闭）。

产物：`release/寒的学习助手-Setup-0.1.0.exe`（程序本体为 `HanStudyAssistant.exe`）

首次打包会下载 JRE、Electron 等依赖，耗时较长；之后再次打包会快很多。

## 技术栈

- Electron + electron-vite + React + TypeScript + Zustand
- Monaco、marked、pdf.js、mammoth
- 可选捆绑 Java 后端 + JRE

## 数据目录

`%APPDATA%/hanstudy-reader/data/`

- 笔记本：`notebooks/`
- 侧栏 Markdown 笔记：`notes/`
- AI 设置、Skill、对话历史（localStorage + JSON）

## 文档

- [实现计划](docs/PLAN.md)
- [变更日志](CHANGELOG.md)

## 仓库

[Z-6354/HANSTUDY](https://github.com/Z-6354/HANSTUDY)
