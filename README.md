# HAN Study Reader

VS Code / Cursor 风格的文档阅读器，支持 TXT、Markdown、PDF、Word 阅读，标注笔记与 AI 助手。

## 功能

### 阅读器

| 格式 | 说明 |
|------|------|
| `.txt` | 纯文本，Monaco 只读 |
| `.md` / `README.md` | **预览 / 文本双模式**，默认预览 |
| `.pdf` | pdf.js 分页，Ctrl+滚轮缩放 |
| `.docx` | Word 简化 HTML 视图 |

### 标注与笔记（Phase 2）

- 选中文本 → 浮动工具条：**高亮**、**下划线**、**便签**、**Ask AI**
- 左侧 **标注** 面板：查看当前文档全部标注，点击跳转
- PDF：工具栏「添加便签」→ 点击页面放置便签
- 导出标注为 Markdown（标注面板 ⬇ 按钮）

### AI 助手（Phase 3）

- 右侧 AI 面板：对话、流式回复
- 选中文本 → **Ask AI** 自动带入上下文
- AI 回复可 **插入便签**
- **帮助 → AI 设置**：配置 API Base URL、Model、API Key（本机加密存储）
- 兼容 OpenAI 格式 API（含国内中转）

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+Shift+V` | Markdown 预览/文本切换 |
| `Ctrl+Shift+A` | 显示/隐藏 AI 面板 |
| `Ctrl+Shift+N` | 打开标注面板 |

## 开发

```bash
npm install
npm run dev
```

若 Electron 下载失败：

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

## 打包（Windows）

```bash
npm run dist:win
```

## 技术栈

- Electron + electron-vite + React + TypeScript
- Monaco Editor（文本 / MD 源码）
- marked + DOMPurify（MD 预览）
- pdf.js（PDF）
- mammoth（DOCX）
- JSON 本地持久化（标注）+ safeStorage（API Key）

## 数据存储

- 标注：`%APPDATA%/hanstudy-reader/data/annotations.json`
- AI 设置：`%APPDATA%/hanstudy-reader/data/ai-settings.json`
- 对话历史：浏览器 localStorage（按文档路径）
