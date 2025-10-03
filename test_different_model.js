import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取 dotenv 解析结果
const dotenvResult = dotenv.config({ path: join(__dirname, '.env.local') });
const envLocal = dotenvResult.parsed || {};

// jinaReader工具
const jinaReader = tool(
    'jinaReader',
    '爬取网页内容并返回markdown格式的正文', {
        url: z.string().describe('要爬取的网页URL')
    },
    async({ url }, extra) => {
        try {
            const response = await fetch(`https://r.jina.ai/${url}`, {
                headers: {
                    'X-Return-Format': 'markdown'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }

            const content = await response.text();

            return {
                content: [{
                    type: 'text',
                    text: content
                }],
                isError: false
            };
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);
            return {
                content: [{
                    type: 'text',
                    text: `无法获取网页内容: ${error.message}`
                }],
                isError: true
            };
        }
    }
);

// 创建 MCP 服务器
const mcpServer = createSdkMcpServer({
    name: 'news-briefing-server',
    version: '1.0.0',
    tools: [jinaReader]
});

async function testDifferentModel() {
    const targetDir = join(__dirname, 'test');
    
    const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || envLocal.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: "https://router.shengsuanyun.com/api",
        ANTHROPIC_MODEL: "google/gemini-2.5-flash-lite",
    };

    console.log('🧪 测试不同模型...');
    console.log('🔧 使用模型:', env.ANTHROPIC_MODEL);
    console.log('🌐 API地址:', env.ANTHROPIC_BASE_URL);

    const messageStream = query({
        prompt: '请使用jinaReader工具获取 https://example.com 的内容，然后简要总结。',
        options: {
            env,
            cwd: targetDir,
            systemPrompt: '你是一个网页内容分析助手。使用jinaReader工具获取网页内容，然后提供简要总结。',
            permissionMode: 'bypassPermissions',
            includePartialMessages: true,
            mcpServers: {
                'news-briefing-server': mcpServer
            },
            disallowedTools: [
                'Task', 'Bash', 'Glob', 'Grep', 'ExitPlanMode', 
                'Read', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 
                'TodoWrite', 'WebSearch', 'BashOutput', 'KillShell', 'SlashCommand'
            ],
        }
    });

    try {
        for await (const msg of messageStream) {
            switch (msg.type) {
                case 'system':
                    if (msg.subtype === 'init') {
                        console.log('✅ 会话已启动,模型:', msg.model);
                        console.log('✅ 工具:', msg.tools);
                        console.log('✅ MCP服务器:', msg.mcp_servers);
                    }
                    break;

                case 'stream_event':
                    if (msg.event.type === 'content_block_delta') {
                        const text = msg.event.delta?.text || '';
                        if (text) {
                            process.stdout.write(text);
                        }
                    }
                    break;

                case 'result':
                    if (msg.subtype === 'success') {
                        console.log('\n✅ 测试成功！');
                        console.log('⏱️ 耗时:', msg.duration_ms, 'ms');
                        console.log('💰 花费: $', msg.total_cost_usd.toFixed(6));
                    } else {
                        console.error('❌ 测试失败:', msg.subtype);
                        console.error('完整错误信息:', JSON.stringify(msg, null, 2));
                    }
                    break;
            }
        }
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        console.error('错误堆栈:', error.stack);
    }
}

testDifferentModel().catch(console.error);
