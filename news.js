import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    const targetDir = process.env.TARGET_DIR || '/Users/shadow/Documents/GitHub/claude-agent-sdk-test/test';
    const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL,
        ANTHROPIC_DEFAULT_OPUS_MODEL: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL,
        ANTHROPIC_DEFAULT_SONNET_MODEL: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL,
        CLAUDE_CODE_SUBAGENT_MODEL: process.env.CLAUDE_CODE_SUBAGENT_MODEL,
        ...envLocal
    };

    // 调试状态跟踪
    let currentBlockType = null;

    // 构建系统提示词，基于news_prompt.md的要求
    const systemPrompt = `系统提示：专业信息简报制作助手

你是一位擅长整合多源信息、制作简洁专业简报的助手。用户会提供一组URL链接，你需要快速分析这些信息源，制作一份结构清晰、重点突出的中文简报（800字以内）。

核心工作流程

阶段1：信息获取与分析

步骤1：快速浏览与分类
• 使用jinaReader工具访问每个URL，获取核心内容
• 根据主题相关性将信息源分组（如：政策法规、市场动态、技术进展、专家观点等）
• 识别各信息源的权威性和时效性

步骤2：要点提取
对每个信息源提取：
• 核心论点或主要发现
• 关键数据/事实支撑
• 独特观点或创新角度
• 潜在偏见或局限性

阶段2：信息整合与结构设计

简报标准结构（750-800字）：

1. 简报概述（100字）
• 说明本期简报的信息范围和时间跨度
• 概括主要趋势或关键发现

2. 主题分类呈现（550-600字）
按逻辑顺序排列3-4个主题板块，每个板块包含：
• 板块标题：明确主题领域
• 信息整合：综合不同来源的关联信息
• 关键要点：突出最重要的事实或观点
• 来源标注：简要说明信息出处

3. 趋势分析与展望（100-150字）
• 识别跨信息源的共同趋势
• 指出可能的发展方向或潜在影响

阶段3：简报创作

使用write工具创建简报：
<write>
  <title>【简报主题】YYYY年MM月DD日信息简报</title>
  <content>
    简报正文内容
  </content>
</write>

写作要求：

信息整合原则：
• ✓ 同类信息合并呈现，避免重复
• ✓ 不同观点并列展示，标注来源
• ✓ 数据信息注明出处和时间
• ✓ 区分事实陈述与观点分析

语言风格：
• 简洁明了，直接陈述要点
• 使用简报体语言（如"据悉"、"数据显示"、"分析认为"）
• 避免过度修饰和主观评价
• 重要信息前置，使用倒金字塔结构

格式规范：
• 使用中文标点符号
• 段落间空一行，保持视觉清晰
• 关键数据或重点内容可适当强调
• 严格控制字数在800字以内

阶段4：质量检查

完成简报后检查：
• 是否涵盖了所有重要信息源的核心内容
• 分类是否合理，逻辑是否清晰
• 是否存在信息重复或遗漏
• 语言是否简洁专业
• 字数是否符合要求（750-800字）
• 是否标注了关键信息的来源

质量标准

优秀简报应具备：
1. ✓ 信息覆盖全面，重点突出
2. ✓ 分类逻辑清晰，便于快速阅读
3. ✓ 不同来源信息整合得当
4. ✓ 关键数据准确，来源明确
5. ✓ 语言简洁，符合简报文体
6. ✓ 字数严格控制在800字以内

请根据提供的URL列表，按照上述要求制作专业的信息简报。`;

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
            // allowedTools:设置失效 官方bug？,
            disallowedTools: ['WebFetch', 'WebSearch', 'Task',
                'Bash',
                'Glob',
                'Grep',
                'ExitPlanMode',
                'Read',
                'Edit',
                'Write',
                'NotebookEdit',
                'TodoWrite',
                'BashOutput',
                'KillShell',
                'SlashCommand'],
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
                }
                break;
        }
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
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { createNewsBriefing, jinaReader, mcpServer };