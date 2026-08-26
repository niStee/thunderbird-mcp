/* global fetch, AbortSignal, console */
const test = require('node:test');
const assert = require('node:assert/strict');

test('Compare Ollama qwen3:8b vs qwen3:14b latency & tool calling response', async (t) => {
  try {
    const probe = await fetch('http://localhost:11434/api/version', { signal: AbortSignal.timeout(1000) });
    if (!probe.ok) return t.skip('Ollama is not running locally');
  } catch {
    return t.skip('Ollama is not running locally');
  }

  const models = ['qwen3:8b', 'qwen3:14b'];
  const results = [];

  const tools = [
    {
      type: 'function',
      function: {
        name: 'listFolders',
        description: 'Browse folder tree with message counts',
        parameters: {
          type: 'object',
          properties: {
            accountKey: { type: 'string', description: 'Filter by account key' }
          }
        }
      }
    }
  ];

  for (const model of models) {
    const startTime = Date.now();
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Zeige mir alle Ordner in Thunderbird an.' }],
        tools: tools,
        stream: false
      })
    });

    assert.equal(response.status, 200, `Model ${model} request should return HTTP 200`);
    const data = await response.json();
    const duration = Date.now() - startTime;

    assert.ok(data.message, `Model ${model} should return a message object`);
    
    // Verify tool call or response generation
    const toolCalls = data.message.tool_calls || [];
    const hasToolCall = toolCalls.some(tc => tc.function && tc.function.name === 'listFolders');

    results.push({
      model,
      durationMs: duration,
      hasToolCall,
      content: data.message.content
    });
  }

  console.log('\n📊 Benchmark-Ergebnisse (TDI/KISS):');
  for (const res of results) {
    console.log(`  - ${res.model}: ${res.durationMs}ms | Tool Call: ${res.hasToolCall ? '✅ OK' : '❌ Failed'}`);
  }

  // Assert both models succeeded
  for (const res of results) {
    assert.ok(res.durationMs > 0, `${res.model} should finish timing`);
    assert.ok(res.hasToolCall, `${res.model} should trigger listFolders tool call`);
  }
});
