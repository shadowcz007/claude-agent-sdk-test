# Claude Agent SDK 代码示例

> 由 [MixLab AI编程](https://codenow.wiki) 出品的 Claude Agent SDK 实践项目

## 📖 项目简介

这是一个基于 Anthropic Claude Agent SDK 的完整代码示例项目，展示了如何使用 Claude Agent SDK 进行 AI 编程开发。项目包含了从基础使用到高级功能（如自定义 MCP 工具）的完整示例。

## ✨ 主要功能

### 🔧 基础功能示例
- **简单查询**: 基础的 Claude 对话功能
- **自定义系统提示**: 设置专业角色和任务指令
- **工作目录控制**: 指定文件操作的工作目录
- **权限管理**: 灵活的权限控制模式

### 🛠️ 高级功能示例
- **自定义 MCP 工具**: 创建网页内容爬取工具
- **信息简报制作**: 自动化多源信息整合和简报生成
- **流式消息处理**: 实时显示 AI 思考和响应过程
- **Hook 系统**: 监控和拦截工具调用过程

## 📁 项目结构

```
claude-agent-sdk-test/
├── README.md                 # 项目说明文档
├── package.json             # 项目依赖配置
├── create.js                # 基础功能示例
├── news.js                  # 信息简报制作示例
├── test.js                  # 简单测试示例
├── news_prompt.md           # 简报制作系统提示
├── docs/                    # 文档目录
│   ├── agent-sdk.md         # SDK 完整 API 文档
│   └── custom-tool.md       # 自定义工具开发指南
└── test/                    # 测试输出目录
    ├── PPT_Agent_Intro.md
    └── PPT_Agent_Introduction.md
```

## 🚀 快速开始

### 1. 环境准备

确保您的系统已安装：
- Node.js (版本 16 或更高)
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

创建 `.env.local` 文件并配置必要的环境变量：

```bash
# Anthropic API 配置
ANTHROPIC_AUTH_TOKEN=your_api_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# 可选：指定工作目录
TARGET_DIR=/path/to/your/working/directory
```

### 4. 运行示例

#### 基础功能示例
```bash
node create.js
```

#### 信息简报制作
```bash
node news.js
```

#### 简单测试
```bash
node test.js
```

## 📚 核心示例解析

### 1. 基础查询 (`create.js`)

展示了 Claude Agent SDK 的基本用法：

```javascript
import { query } from '@anthropic-ai/claude-agent-sdk';

const messageStream = query({
    prompt: "帮我创建一个md文档，关于PPT Agent的介绍,100字",
    options: {
        env,
        cwd: targetDir,
        systemPrompt: "你是一个专业的产品设计师...",
        permissionMode: 'bypassPermissions',
        includePartialMessages: true,
        hooks: {
            // Hook 配置...
        }
    }
});
```

**关键特性**：
- 自定义系统提示词
- 工作目录控制
- 流式消息处理
- Hook 事件监听

### 2. 自定义 MCP 工具 (`news.js`)

展示了如何创建和使用自定义 MCP 工具：

```javascript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

// 定义自定义工具
const jinaReader = tool(
    'jinaReader',
    '爬取网页内容并返回markdown格式的正文',
    {
        url: z.string().describe('要爬取的网页URL')
    },
    async({ url }, extra) => {
        // 工具实现逻辑
        const response = await fetch(`https://r.jina.ai/${url}`, {
            headers: { 'X-Return-Format': 'markdown' }
        });
        const content = await response.text();
        
        return {
            content: [{ type: 'text', text: content }],
            isError: false
        };
    }
);

// 创建 MCP 服务器
const mcpServer = createSdkMcpServer({
    name: 'news-briefing-server',
    version: '1.0.0',
    tools: [jinaReader]
});
```

**关键特性**：
- 使用 Zod 进行参数验证
- 标准化的 MCP 工具返回格式
- 错误处理机制
- 服务器注册和配置

### 3. 信息简报制作系统

项目包含一个完整的信息简报制作系统，能够：

- **多源信息整合**: 自动爬取多个 URL 的内容
- **智能分类**: 根据主题相关性对信息进行分组
- **结构化输出**: 生成符合简报格式的文档
- **质量控制**: 确保内容准确性和格式规范

## 🔧 技术栈

- **@anthropic-ai/claude-agent-sdk**: Claude Agent SDK 核心库
- **zod**: 数据验证和类型安全
- **dotenv**: 环境变量管理
- **Node.js**: JavaScript 运行时环境

## 📖 详细文档

### API 文档
- [完整 SDK API 参考](docs/agent-sdk.md)
- [自定义工具开发指南](docs/custom-tool.md)

### 核心概念

#### 1. 权限模式 (PermissionMode)
- `default`: 标准权限行为
- `acceptEdits`: 自动接受文件编辑
- `bypassPermissions`: 绕过所有权限检查
- `plan`: 规划模式，不执行实际操作

#### 2. Hook 系统
支持多种事件监听：
- `SessionStart`: 会话开始
- `PreToolUse`: 工具调用前
- `PostToolUse`: 工具调用后
- `SessionEnd`: 会话结束

#### 3. 消息类型
- `system`: 系统消息
- `assistant`: AI 助手回复
- `stream_event`: 流式事件
- `result`: 执行结果

## 🎯 使用场景

### 1. 内容创作
- 自动化文档生成
- 多源信息整合
- 专业报告制作

### 2. 开发辅助
- 代码生成和优化
- 项目文档自动生成
- 测试用例编写

### 3. 数据分析
- 网页内容抓取和分析
- 信息简报制作
- 趋势分析报告

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

### 开发流程
1. Fork 本仓库
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [MixLab AI编程](https://codenow.wiki) - 项目出品方
- [Claude Agent SDK 官方文档](https://docs.anthropic.com/claude/docs/agent-sdk)
- [Anthropic API 文档](https://docs.anthropic.com/)

## 📞 支持

如果您在使用过程中遇到问题，可以通过以下方式获取帮助：

- 提交 [GitHub Issue](https://github.com/your-repo/issues)
- 访问 [MixLab AI编程社区](https://codenow.wiki)
- 查看项目文档和示例代码

---

**注意**: 使用本项目前请确保您已获得有效的 Anthropic API 密钥，并遵守相关的使用条款和限制。
