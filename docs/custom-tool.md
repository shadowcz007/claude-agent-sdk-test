## 自定义 MCP Tool 的步骤

### 1. 导入必要的依赖
```javascript
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
```

### 2. 使用 `tool()` 函数定义工具
```javascript
const jinaReader = tool(
    'jinaReader',                    // 工具名称
    '爬取网页内容并返回markdown格式的正文',  // 工具描述
    {                                // 参数模式定义（使用 Zod schema）
        url: z.string().describe('要爬取的网页URL')
    },
    async({ url }, extra) => {       // 工具实现函数
        // 工具逻辑实现
    }
);
```

### 3. 工具实现的关键要素

**参数定义**：
- 使用 Zod schema 定义参数类型和描述
- 支持各种数据类型：`z.string()`, `z.number()`, `z.boolean()` 等
- 使用 `.describe()` 为参数添加说明

**实现函数**：
- 接收解构的参数对象和额外的 `extra` 参数
- 返回符合 MCP 标准的格式：
```javascript
return {
    content: [{
        type: 'text',
        text: content
    }],
    isError: false  // 或 true 表示错误
};
```

**错误处理**：
- 使用 try-catch 包装实现逻辑
- 错误时返回 `isError: true` 的标准格式

### 4. 创建 MCP 服务器
```javascript
const mcpServer = createSdkMcpServer({
    name: 'news-briefing-server',    // 服务器名称
    version: '1.0.0',               // 版本号
    tools: [jinaReader]             // 工具列表
});
```

### 5. 在 query 中使用 MCP 服务器
```javascript
const messageStream = query({
    prompt: userPrompt,
    options: {
        mcpServers: {
            'news-briefing-server': mcpServer
        }
    }
});
```

## 核心要点

1. **标准化返回格式**：必须返回包含 `content` 数组和 `isError` 字段的对象
2. **参数验证**：使用 Zod schema 确保参数类型正确
3. **错误处理**：提供友好的错误信息
4. **工具描述**：清晰描述工具功能和参数用途
5. **服务器注册**：通过 `createSdkMcpServer` 创建并注册工具
