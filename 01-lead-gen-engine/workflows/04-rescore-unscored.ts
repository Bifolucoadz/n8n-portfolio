import { workflow, node, trigger, sticky, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const SHEET_DOC = { __rl: true, mode: 'id', value: '1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k' };
const SHEET_TAB = { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Leads' };
const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const OPENAI_CRED = { openAiApi: { id: 'GQdth43VUJxkSsw9', name: 'OpenAI account' } };

const start = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run Manually', position: [220, 300] },
  output: [{}]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [440, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cfg-offer', name: 'OFFER', value: "I build AI automations for small businesses: instant replies to new enquiries, automatic follow-ups so leads don't go cold, appointment booking, and AI assistants that answer common customer questions around the clock. Built on n8n and usually live within two weeks.", type: 'string' }
        ]
      }
    }
  },
  output: [{ OFFER: 'I build AI automations for small businesses.' }]
});

const readLeads = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read All Leads',
    position: [660, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'read',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: SHEET_TAB
    },
    credentials: SHEETS_CRED
  },
  output: [{ row_number: 2, place_id: 'ChIJD96Y64Jw44kRW3CFAudEMrE', business_name: 'Boston Dental', category: 'Dentist', city: 'Boston', address: '36 Chauncy St, Boston, MA 02111', phone: '(617) 338-5000', website: 'https://bostondental.com/', email: 'dtx@bostondental.com', rating: 4.9, reviews: 454, lead_score: '', status: 'new' }]
});

const unscoredOnly = node({
  type: 'n8n-nodes-base.filter',
  version: 2.3,
  config: {
    name: 'Unscored Leads Only',
    position: [880, 300],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{
          leftValue: expr('{{ Boolean($json.place_id) && ($json.lead_score === "" || $json.lead_score === null || $json.lead_score === undefined) }}'),
          rightValue: '',
          operator: { type: 'boolean', operation: 'true', singleValue: true }
        }],
        combinator: 'and'
      }
    }
  },
  output: [{ row_number: 2, place_id: 'ChIJD96Y64Jw44kRW3CFAudEMrE', business_name: 'Boston Dental', category: 'Dentist', city: 'Boston', address: '36 Chauncy St, Boston, MA 02111', phone: '(617) 338-5000', website: 'https://bostondental.com/', email: 'dtx@bostondental.com', rating: 4.9, reviews: 454, lead_score: '', status: 'new' }]
});

const scoringModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI GPT-5.4 mini',
    position: [1100, 540],
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-5.4-mini', cachedResultName: 'gpt-5.4-mini' },
      responsesApiEnabled: true,
      options: { reasoningEffort: 'low' }
    },
    credentials: OPENAI_CRED
  }
});

const scoreParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Score Format',
    position: [1320, 540],
    parameters: {
      schemaType: 'manual',
      inputSchema: '{\n  "type": "object",\n  "properties": {\n    "lead_score": { "type": "integer", "minimum": 1, "maximum": 10, "description": "Fit with the offer, 1 (poor) to 10 (ideal)" },\n    "score_reason": { "type": "string", "description": "One short sentence explaining the score" },\n    "personal_line": { "type": "string", "description": "One natural opening sentence for a cold email, max 25 words" }\n  },\n  "required": ["lead_score", "score_reason", "personal_line"]\n}'
    }
  }
});

const scoreLead = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'Score Lead with AI',
    position: [1180, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      promptType: 'define',
      text: expr(
        'Business: {{ $json.business_name }}\n' +
        'Category: {{ $json.category || "unknown" }}\n' +
        'Area: {{ $json.city || $json.address || "unknown" }}\n' +
        'Google rating: {{ $json.rating || "none" }} from {{ $json.reviews || 0 }} reviews\n' +
        'Website: {{ $json.website || "none" }}\n' +
        'Email address found: {{ $json.email ? "yes" : "no" }}\n' +
        'Phone listed: {{ $json.phone ? "yes" : "no" }}\n\n' +
        'The offer: {{ $("Config").first().json.OFFER }}'
      ),
      hasOutputParser: true,
      messages: {
        messageValues: [
          {
            type: 'SystemMessagePromptTemplate',
            message:
              'You qualify local businesses as prospects for a freelancer who builds AI automations. Use only the listing data you are given and never invent facts.\n\n' +
              'lead_score (1-10): how likely this business is to need and pay for the offer. Score higher when the business runs on enquiries and bookings (clinics, salons, trades, agencies, restaurants that take reservations), is busy (many reviews), is active online (has a website) and can be reached by email. Score lower for large chains and franchises with central IT, public bodies and charities, and listings with very few reviews and no website.\n\n' +
              'score_reason: one short sentence explaining the score.\n\n' +
              'personal_line: one natural sentence, max 25 words, that the freelancer could open a cold email with. Base it on something specific, true and positive from the listing, such as a strong rating, a high number of reviews, the specialty or the neighbourhood. Never mention a rating below 4.0 or a low number of reviews. Do not start with "I noticed" or "I saw". No flattery cliches and no exclamation marks.'
          }
        ]
      },
      batching: { batchSize: 5, delayBetweenBatches: 0 }
    },
    subnodes: { model: scoringModel, outputParser: scoreParser }
  },
  output: [{ output: { lead_score: 7, score_reason: 'Busy multi-location practice with a website and email.', personal_line: '454 reviews at 4.9 stars is a lot of happy patients for one Downtown Crossing office.' } }]
});

const saveScore = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Score to Sheet',
    position: [1500, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'update',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: SHEET_TAB,
      columns: {
        mappingMode: 'defineBelow',
        matchingColumns: ['place_id'],
        value: {
          place_id: expr('{{ $("Unscored Leads Only").item.json.place_id }}'),
          lead_score: expr('{{ $json.output.lead_score }}'),
          score_reason: expr('{{ $json.output.score_reason }}'),
          personal_line: expr('{{ $json.output.personal_line }}')
        },
        schema: [
          { id: 'place_id', displayName: 'place_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'lead_score', displayName: 'lead_score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
          { id: 'score_reason', displayName: 'score_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
          { id: 'personal_line', displayName: 'personal_line', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
        ]
      },
      options: { cellFormat: 'RAW' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ place_id: 'ChIJD96Y64Jw44kRW3CFAudEMrE', lead_score: 7 }]
});

const note = sticky(
  '## Rescore unscored leads\n' +
  'The Lead Scraper saves a place even when the AI scoring step fails, so no Apify results are lost. Those rows have an empty `lead_score` and are never emailed.\n\n' +
  'Run this workflow by hand to score them afterwards. It only touches rows with an empty `lead_score` and only writes `lead_score`, `score_reason` and `personal_line`. Keep `OFFER` in **Config** the same as in the other workflows.',
  [start, config, readLeads, unscoredOnly, scoreLead, scoringModel, scoreParser, saveScore],
  { color: 4 }
);

export default workflow('lead-engine-rescore', 'Lead Engine 4: Rescore Unscored Leads')
  .add(start)
  .to(config)
  .to(readLeads)
  .to(unscoredOnly)
  .to(scoreLead)
  .to(saveScore)
  .add(note);
