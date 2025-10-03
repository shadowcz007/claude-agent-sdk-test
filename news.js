import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// 获取当前文件的目录
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);

// 获取 dotenv 解析结果
const dotenvResult = dotenv.config({ path: join(__dirname, '.env.local') });

// 单独获取 ANTHROPIC_BASE_URL
const envLocal = dotenvResult.parsed || {};

// 修改jinaReader工具的实现
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

            // 返回符合MCP标准的CallToolResult格式
            return {
                content: [{
                    type: 'text',
                    text: content
                }],
                isError: false
            };
        } catch (error) {
            console.error(`Error fetching ${url}:`, error);

            // 错误情况也返回标准格式
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

async function createNewsBriefing(urls) {
    // 使用 Windows 兼容的路径，如果没有设置则使用当前目录下的 test 文件夹
    const targetDir = process.env.TARGET_DIR || join(__dirname, 'test');
    
    // 确保目标目录存在
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }
    
    const env = {
        ...process.env,
        // 确保 Node.js 路径在 PATH 中
        PATH: process.env.PATH,
        // Anthropic 配置
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || envLocal.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || envLocal.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || envLocal.ANTHROPIC_MODEL,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL || envLocal.ANTHROPIC_DEFAULT_HAIKU_MODEL,
        ANTHROPIC_DEFAULT_OPUS_MODEL: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL || envLocal.ANTHROPIC_DEFAULT_OPUS_MODEL,
        ANTHROPIC_DEFAULT_SONNET_MODEL: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || envLocal.ANTHROPIC_DEFAULT_SONNET_MODEL,
        CLAUDE_CODE_SUBAGENT_MODEL: process.env.CLAUDE_CODE_SUBAGENT_MODEL || envLocal.CLAUDE_CODE_SUBAGENT_MODEL,
    };

    // 调试状态跟踪
    let currentBlockType = null;

    // 简化的系统提示词
    const systemPrompt = `你是一个专业的信息简报制作助手。

请按照以下步骤制作简报：
1. 使用jinaReader工具获取每个URL的内容
2. 分析和整理信息，提取关键要点
3. 制作一份结构清晰的中文简报（800字以内）

简报格式：
- 标题：信息简报 - [日期]
- 概述：简要说明主要内容
- 详细内容：按主题分类整理
- 总结：关键要点和趋势分析

请保持简洁专业的语言风格，确保信息准确完整。`;

    // 构建用户提示词
    const userPrompt = `请帮我制作一份信息简报。以下是需要整理的URL列表：

${urls.map((url, index) => `${index + 1}. ${url}`).join('\n')}

请按照系统提示中的要求，使用jinaReader工具访问这些URL，分析内容，并制作一份结构清晰、重点突出的中文简报（800字以内）。`;

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
            }, // 添加包含jinaReader工具的MCP服务器
            // 禁用大部分工具，只保留jinaReader工具以避免冲突
            disallowedTools: [
                'Task', 'Bash', 'Glob', 'Grep', 'ExitPlanMode', 
                'Read', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 
                'TodoWrite', 'WebSearch', 'BashOutput', 'KillShell', 'SlashCommand'
            ],
            hooks: {
                SessionStart: [{
                    hooks: [async (input) => {
                        console.log('🚀 简报制作会话开始，ID:', input.session_id);
                        return { continue: true };
                    }]
                }],
                PreToolUse: [{
                    hooks: [async (input) => {
                        console.log(`🛠️ 即将调用工具: ${input.tool_name}`);
                        if (input.tool_name.match('_jinaReader')) {
                            console.log('📥 正在爬取URL:', input.tool_input.url);
                        } else {
                            console.log('📥 输入:', JSON.stringify(input.tool_input, null, 2));
                        }
                        return { continue: true };
                    }]
                }],
                PostToolUse: [{
                    hooks: [async (input) => {
                        console.log(`✅ 工具 ${input.tool_name} 执行完成`);
                        if (input.tool_name.match('_jinaReader')) {
                            console.log(`📄 成功爬取: ${input.tool_input.url}`);
                        }
                        return { continue: true };
                    }]
                }],
                SessionEnd: [{
                    hooks: [async (input) => {
                        console.log('🔚 简报制作会话结束');
                        return { continue: true };
                    }]
                }]
            }
        }
    });

    try {
        for await (const msg of messageStream) {
            switch (msg.type) {
            case 'system':
                if (msg.subtype === 'init') {
                    console.log('✅ 会话已启动,模型:', msg.model);
                    console.log('✅  cwd', msg.cwd);
                    console.log('✅  tools', msg.tools);
                    console.log('✅  mcp_servers', msg.mcp_servers);

                } else if (msg.subtype === 'compact_boundary') {
                    console.log('🔄 对话历史已压缩');
                }
                break;

            case 'assistant':
                // 完整的助手回复（每轮结束时）
                console.log('🤖 助手回复:', msg.message.content);
                break;

            case 'stream_event':
                // 增强的流式事件处理
                const eventType = msg.event.type;

                switch (eventType) {
                    case 'content_block_delta':
                        // 正常的文本输出
                        const text = msg.event.delta?.text || '';
                        const thinking = msg.event.delta?.thinking || '';

                        if (text) {
                            // 所有内容都直接输出到控制台
                            process.stdout.write(text);
                        }
                        if (thinking) {
                            // 所有内容都直接输出到控制台
                            process.stdout.write(thinking);
                        }
                        break;

                    case 'content_block_start':
                        // 内容块开始
                        const blockType = msg.event.content_block?.type;
                        currentBlockType = blockType;

                        if (blockType == 'thinking') {
                            console.log('🧠 开始输出思考过程');
                        }


                        break;

                    case 'content_block_stop':

                        currentBlockType = null;
                        break;


                    default:

                        break;
                }
                break;

            case 'result':
                if (msg.subtype === 'success') {
                    console.log('\n✅ 简报制作完成！');
                    console.log('⏱️ 耗时:', msg.duration_ms, 'ms');
                    console.log('💰 花费: $', msg.total_cost_usd.toFixed(6));
                    console.log('📊 总轮次:', msg.num_turns);
                } else {
                    console.error('❌ 执行出错:', msg.subtype);
                    if (msg.error) {
                        console.error('错误详情:', msg.error);
                    }
                    if (msg.message) {
                        console.error('错误消息:', msg.message);
                    }
                    // 输出完整的错误对象以便调试
                    console.error('完整错误信息:', JSON.stringify(msg, null, 2));
                }
                break;
            }
        }
    } catch (error) {
        console.error('❌ 流处理过程中发生错误:', error);
        console.error('错误堆栈:', error.stack);
        throw error;
    }
}

// 主函数
async function main() {
    // 示例URL列表，您可以根据需要修改
    const urls = [
        'https://codenow.wiki',
        'https://www.producthunt.com/products/instruct-2'
    ];

    // 从命令行参数获取URL列表，如果没有则使用默认示例
    const args = process.argv.slice(2);
    const inputUrls = args.length > 0 ? args : urls;

  
    console.log('📰 开始制作信息简报...');
    console.log('📋 待处理的URL列表:');
    inputUrls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
    });
    console.log('');

    await createNewsBriefing(inputUrls);
}

// 如果直接运行此文件，则执行主函数
// 修复 Windows 路径兼容性问题
const currentFileUrl = import.meta.url;
const scriptPath = process.argv[1];
const isMainModule = currentFileUrl.endsWith(scriptPath.replace(/\\/g, '/')) || 
                    currentFileUrl === `file://${scriptPath}` ||
                    currentFileUrl === `file:///${scriptPath.replace(/\\/g, '/')}`;

if (isMainModule) {
    main().catch(console.error);
}

export { createNewsBriefing, jinaReader, mcpServer };