import { query } from '@anthropic-ai/claude-agent-sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 获取 dotenv 解析结果
const dotenvResult = dotenv.config({ path: join(__dirname, '.env.local') });
const envLocal = dotenvResult.parsed || {};

async function testWithoutMCP() {
    const targetDir = join(__dirname, 'test');
    
    const env = {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || envLocal.ANTHROPIC_AUTH_TOKEN,
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || envLocal.ANTHROPIC_BASE_URL,
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || envLocal.ANTHROPIC_MODEL,
    };

    console.log('🧪 测试不使用MCP服务器...');

    const messageStream = query({
        prompt: '请制作一份关于人工智能发展的简短信息简报（200字以内）',
        options: {
            env,
            cwd: targetDir,
            systemPrompt: '你是一个专业的信息简报制作助手。请制作简洁专业的简报。',
            permissionMode: 'bypassPermissions',
            includePartialMessages: true,
        }
    });

    try {
        for await (const msg of messageStream) {
            switch (msg.type) {
                case 'system':
                    if (msg.subtype === 'init') {
                        console.log('✅ 会话已启动,模型:', msg.model);
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

testWithoutMCP().catch(console.error);
