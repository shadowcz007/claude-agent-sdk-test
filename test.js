import { query } from '@anthropic-ai/claude-agent-sdk';


async function runClaudeQuery() {
    try {
        const claudeStream = query({
            prompt: "用一句话解释量子计算的基本原理",
            options: {
                model: 'anthropic/claude-3.5-haiku',
                permissionMode: 'bypassPermissions' // 简化权限控制
            }
        });

        for await (const message of claudeStream) {
            if (message.type === 'assistant') {
                console.log('Claude回复:', message.message.content[0].text);
            }
        }

    } catch (error) {
        console.error('执行出错:', error);
    }
}


async function runWithCustomSystemPrompt() {
    const stream = query({
        prompt: "帮我创建一个md文档，关于PPT Agent的介绍",
        options: {
            systemPrompt: "你是一个专业的产品设计师，擅长调研用户需求，设计独特的产品功能，富有乔布斯演讲的叙事能力。",
            model: 'anthropic/claude-3.5-haiku',
            permissionMode: 'bypassPermissions' // 简化权限控制
        }
    });

    for await (const message of stream) {
        if (message.type === 'assistant') {
            console.log(message.message.content[0].text);
        }
    }
}


import { query } from '@anthropic-ai/claude-agent-sdk';

async function runWithCustomSystemPromptAndCwd() {
    const targetDir = '/Users/shadow/Documents/GitHub/claude-agent-sdk-test/test';
    const stream = query({
        prompt: "帮我创建一个md文档，关于PPT Agent的介绍",
        options: {
            cwd: targetDir,
            systemPrompt: "你是一个专业的产品设计师，擅长调研用户需求，设计独特的产品功能，富有乔布斯演讲的叙事能力。根据用户的指令创建ppt，不需要询问用户，直接创建",
            model: 'google/gemini-2.5-flash',
            permissionMode: 'bypassPermissions' // 简化权限控制
        }
    });

    for await (const message of stream) {
        if (message.type === 'assistant') {
            console.log(message.message.content[0].text);
        }
    }
}

runWithCustomSystemPromptAndCwd()