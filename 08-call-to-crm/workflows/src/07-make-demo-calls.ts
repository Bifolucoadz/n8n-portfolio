import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const run = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Make Demo Calls', position: [200, 300] },
  output: [{}]
});

const lines = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Lines', position: [420, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__LINES__
  } },
  output: [{ call: 0, line: 0, file: 'calloway-discovery.mp3', speaker: 'Maya Collins', voice: 'coral', instructions: 'Friendly', text: 'Hi Renee' }]
});

const speak = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Speak Line',
    position: [640, 300],
    retryOnFail: true, maxTries: 3, waitBetweenTries: 2000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/audio/speech',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ model: "gpt-4o-mini-tts", voice: $json.voice, input: $json.text, instructions: $json.instructions, response_format: "pcm" }) }}'),
      options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } } }
    },
    credentials: OPENAI_CRED
  },
  output: [{}]
});

const join = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Join Calls', position: [860, 300], parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode:
__JOIN__
  } },
  output: [{ file: 'calloway-discovery.wav', path: '/Users/mac/.n8n-files/tidewater/calloway-discovery.wav' }]
});

const write = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: { name: 'Save Recording', position: [1080, 300], parameters: { operation: 'write', fileName: expr('{{ $json.path }}'), dataPropertyName: 'data' } },
  output: [{ fileName: '/Users/mac/.n8n-files/tidewater/calloway-discovery.wav' }]
});

const note = sticky(
  '## Tidewater 7: Make Demo Calls (manual)\nTurns the three scripted sales calls in **lib-calls.js** into recordings: every line is spoken with OpenAI `gpt-4o-mini-tts` in that person\'s voice, then each call is joined into one WAV file with short pauses between speakers, in `~/.n8n-files/tidewater/`. Upload them on the **Tidewater 1** form to demo the pipeline. All people and companies are invented.',
  [], { position: [160, 80], width: 900, height: 180, color: 7 }
);

export default workflow('tidewater-make-demo-calls', 'Tidewater 7: Make Demo Calls')
  .add(run)
  .to(lines)
  .to(speak)
  .to(join)
  .to(write)
  .add(note);
