import { query } from '@anthropic-ai/claude-agent-sdk';
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

async function runWithCustomSystemPromptAndCwd() {
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

    const messageStream = query({
        prompt: "帮我创建一个md文档，关于PPT Agent的介绍,100字",
        options: {
            env,
            cwd: targetDir,
            systemPrompt: `你是一个专业的产品设计师，擅长调研用户需求，设计独特的产品功能，富有乔布斯演讲的叙事能力。根据用户的指令创建ppt，不需要询问用户，直接创建。

重要：请使用 Write 工具将文件保存到当前工作目录（${targetDir}）中，文件名使用相对路径格式，例如：./filename.md`,
            permissionMode: 'bypassPermissions', // 简化权限控制
            includePartialMessages: true, // 可选：包含流式中间消息
            hooks: {
                SessionStart: [{
                    hooks: [async(input) => {
                        console.log('🚀 会话开始，ID:', input.session_id);
                        return { continue: true };
                    }]
                }],
                PreToolUse: [{
                    hooks: [async(input) => {
                        console.log(`🛠️ 即将调用工具: ${input.tool_name}`);
                        console.log('📥 输入:', JSON.stringify(input.tool_input, null, 2));
                        return { continue: true };
                    }]
                }],
                PostToolUse: [{
                    hooks: [async(input) => {
                        console.log(`✅ 工具 ${input.tool_name} 执行完成`);
                        return { continue: true };
                    }]
                }],
                SessionEnd: [{
                    hooks: [async(input) => {
                        console.log('🔚 会话结束');
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
                    console.log('✅ 会话已启动，模型:', msg.model);
                } else if (msg.subtype === 'compact_boundary') {
                    console.log('🔄 对话历史已压缩');
                }
                break;

            case 'assistant':
                // 完整的助手回复（每轮结束时）
                console.log('🤖 助手回复:', msg.message.content);
                break;

            case 'stream_event':
                // 流式中间内容（需开启 includePartialMessages）
                if (msg.event.type === 'content_block_delta') {
                    process.stdout.write(msg.event.delta.text || '');
                }
                break;

            case 'result':
                if (msg.subtype === 'success') {
                    console.log('\n✅ 任务完成！');
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

runWithCustomSystemPromptAndCwd()