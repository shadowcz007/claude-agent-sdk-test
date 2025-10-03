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
            console.log(`🔍 开始爬取: ${url}`);
            const response = await fetch(`https://r.jina.ai/${url}`, {
                headers: {
                    'X-Return-Format': 'markdown'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
            }

            const content = await response.text();
            console.log(`✅ 爬取成功，内容长度: ${content.length} 字符`);

            return {
                content: [{
                    type: 'text',
                    text: content.substring(0, 1000) + (content.length > 1000 ? '...(内容已截断)' : '')
                }],
                isError: false
            };
        } catch (error) {
            console.error(`❌ 爬取失败 ${url}:`, error);
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
    name: 'test-jina-server',
    version: '1.0.0',
    tools: [jinaReader]
});

async function testJinaReader() {
    const targetDir = join(__dirname, 'test');
    
    const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || envLocal.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || envLocal.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || envLocal.ANTHROPIC_MODEL,
    };

    console.log('🧪 开始测试 jinaReader...');

    const messageStream = query({
        prompt: '请使用jinaReader工具爬取这个网页的内容：https://example.com',
        options: {
            env,
            cwd: targetDir,
            systemPrompt: '你是一个网页爬取助手。请使用jinaReader工具爬取用户指定的网页，然后简要总结内容。',
            permissionMode: 'bypassPermissions',
            includePartialMessages: true,
            mcpServers: {
                'test-jina-server': mcpServer
            },
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

testJinaReader().catch(console.error);
