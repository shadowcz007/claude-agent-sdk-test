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

async function createSimpleNewsBriefing(urls) {
    const targetDir = join(__dirname, 'test');
    
    const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || envLocal.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || envLocal.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || envLocal.ANTHROPIC_MODEL,
    };

    // 简化的系统提示词
    const systemPrompt = `你是一个专业的信息简报制作助手。

请按照以下步骤制作简报：
1. 使用jinaReader工具获取每个URL的内容
2. 分析和整理信息
3. 制作一份结构清晰的中文简报（500字以内）

简报格式：
- 标题：信息简报 - [日期]
- 概述：简要说明主要内容
- 详细内容：按主题分类整理
- 总结：关键要点

请保持简洁专业的语言风格。`;

    const userPrompt = `请制作一份信息简报，需要处理的URL：
${urls.map((url, index) => `${index + 1}. ${url}`).join('\n')}`;

    console.log('🚀 开始制作简化版简报...');

    const messageStream = query({
        prompt: userPrompt,
        options: {
            env,
            cwd: targetDir,
            systemPrompt: systemPrompt,
            permissionMode: 'bypassPermissions',
            includePartialMessages: true,
            mcpServers: {
                'news-briefing-server': mcpServer
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
                        console.log('\n✅ 简报制作完成！');
                        console.log('⏱️ 耗时:', msg.duration_ms, 'ms');
                        console.log('💰 花费: $', msg.total_cost_usd.toFixed(6));
                    } else {
                        console.error('❌ 执行出错:', msg.subtype);
                        console.error('完整错误信息:', JSON.stringify(msg, null, 2));
                    }
                    break;
            }
        }
    } catch (error) {
        console.error('❌ 流处理过程中发生错误:', error);
        console.error('错误堆栈:', error.stack);
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    const inputUrls = args.length > 0 ? args : ['https://example.com'];

    console.log('📰 开始制作信息简报...');
    console.log('📋 待处理的URL列表:');
    inputUrls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
    });
    console.log('');

    await createSimpleNewsBriefing(inputUrls);
}

main().catch(console.error);
