import { workflow, node, trigger, sticky, languageModel, outputParser, expr, newCredential } from '@n8n/workflow-sdk';

const SHEET_ID = '1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k';
const SHEET_DOC = { __rl: true, mode: 'id', value: SHEET_ID };
const SHEET_TAB = { __rl: true, mode: 'list', value: 'gid=0', cachedResultName: 'Leads' };
const LEAD_COLUMNS = [
  { id: 'place_id', displayName: 'place_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'business_name', displayName: 'business_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'category', displayName: 'category', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'address', displayName: 'address', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'city', displayName: 'city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'phone', displayName: 'phone', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'website', displayName: 'website', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'email', displayName: 'email', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'rating', displayName: 'rating', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'reviews', displayName: 'reviews', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'maps_url', displayName: 'maps_url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'lead_score', displayName: 'lead_score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'score_reason', displayName: 'score_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'personal_line', displayName: 'personal_line', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'emails_sent', displayName: 'emails_sent', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true },
  { id: 'last_email_at', displayName: 'last_email_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'next_followup_at', displayName: 'next_followup_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'thread_id', displayName: 'thread_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'last_message_id', displayName: 'last_message_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'reply_type', displayName: 'reply_type', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'reply_summary', displayName: 'reply_summary', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'replied_at', displayName: 'replied_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'added_at', displayName: 'added_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }
];

const SHEETS_CRED = { googleSheetsOAuth2Api: { id: 'D8rKxzgMrJwmFZoQ', name: 'Google Sheets account' } };
const GMAIL_CRED = { gmailOAuth2: { id: '9FKWoKxErtgj9Qg7', name: 'Gmail account' } };
const OPENAI_CRED = { openAiApi: newCredential('OpenAI account') };
const APIFY_CRED = { httpHeaderAuth: { id: 'pMeRs9RiRtbTRWt6', name: 'Apify credential' } };

const searchForm = trigger({
  type: 'n8n-nodes-base.formTrigger',
  version: 2.6,
  config: {
    name: 'Lead Search Form',
    position: [240, 300],
    parameters: {
      formTitle: 'Find new leads',
      formDescription: 'Searches Google Maps for one type of business in one area, scores every new place with AI and adds it to the Lead Generation Engine sheet.',
      formFields: {
        values: [
          { fieldLabel: 'Business type', fieldName: 'niche', fieldType: 'text', placeholder: 'e.g. dental clinics', requiredField: true },
          { fieldLabel: 'City or area', fieldName: 'location', fieldType: 'text', placeholder: 'e.g. Leeds, UK', requiredField: true },
          { fieldLabel: 'Max places to scrape (1-100)', fieldName: 'max_places', fieldType: 'number', defaultValue: '20' }
        ]
      },
      responseMode: 'onReceived',
      options: {
        appendAttribution: false,
        buttonLabel: 'Find leads',
        path: 'lead-search',
        respondWithOptions: {
          values: {
            respondWith: 'text',
            formSubmittedText: 'Search started. New leads will appear in the sheet within a few minutes, and a summary email is on its way.'
          }
        }
      }
    }
  },
  output: [{ niche: 'dental clinics', location: 'Leeds, UK', max_places: 20, submittedAt: '2026-10-01T12:00:00.000+01:00', formMode: 'test' }]
});

const config = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [460, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'cfg-niche', name: 'NICHE', value: expr('{{ String($json.niche ?? $json["Business type"] ?? "").trim() }}'), type: 'string' },
          { id: 'cfg-location', name: 'LOCATION', value: expr('{{ String($json.location ?? $json["City or area"] ?? "").trim() }}'), type: 'string' },
          { id: 'cfg-max', name: 'MAX_PLACES', value: expr('{{ Math.min(Math.max(Number($json.max_places ?? $json["Max places to scrape (1-100)"]) || 20, 1), 100) }}'), type: 'number' },
          { id: 'cfg-offer', name: 'OFFER', value: "I build AI automations for small businesses: instant replies to new enquiries, automatic follow-ups so leads don't go cold, appointment booking, and AI assistants that answer common customer questions around the clock. Built on n8n and usually live within two weeks.", type: 'string' },
          { id: 'cfg-min-score', name: 'MIN_SCORE', value: 6, type: 'number' },
          { id: 'cfg-notify', name: 'NOTIFY_EMAIL', value: 'samuelgurru@gmail.com', type: 'string' },
          { id: 'cfg-sheet-url', name: 'SHEET_URL', value: 'https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit', type: 'string' }
        ]
      }
    }
  },
  output: [{
    NICHE: 'dental clinics',
    LOCATION: 'Leeds, UK',
    MAX_PLACES: 20,
    OFFER: 'I build AI automations for small businesses.',
    MIN_SCORE: 6,
    NOTIFY_EMAIL: 'samuelgurru@gmail.com',
    SHEET_URL: 'https://docs.google.com/spreadsheets/d/1515YmG8Ak6Ozdy-Feho_VIYyxr49B4XhGSczavigJ1k/edit'
  }]
});

const scrapeMaps = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Scrape Google Maps (Apify)',
    position: [680, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      method: 'POST',
      url: 'https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ searchStringsArray: [$json.NICHE], locationQuery: $json.LOCATION, maxCrawledPlacesPerSearch: $json.MAX_PLACES, language: "en", skipClosedPlaces: true, scrapeContacts: true }) }}'),
      options: { timeout: 310000 }
    },
    credentials: APIFY_CRED
  },
  output: [{
    placeId: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    title: 'Headingley Dental Care',
    categoryName: 'Dental clinic',
    address: '12 Otley Rd, Leeds LS6 2AD, UK',
    city: 'Leeds',
    phone: '+44 113 123 4567',
    website: 'https://headingleydental.example',
    emails: ['hello@headingleydental.example'],
    totalScore: 4.8,
    reviewsCount: 214,
    url: 'https://www.google.com/maps/place/?q=place_id:ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A'
  }]
});

const readExisting = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Read Existing Leads',
    position: [900, 300],
    executeOnce: true,
    alwaysOutputData: true,
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
  output: [{ row_number: 2, place_id: 'ChIJexisting123', business_name: 'Existing Dental', status: 'contacted' }]
});

const keepNew = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keep New Places Only',
    position: [1120, 300],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        '// Drop places already in the sheet (or repeated in this scrape) and map Apify fields to sheet columns.\n' +
        'const known = new Set($input.all().map(i => String(i.json.place_id ?? "")).filter(Boolean));\n' +
        'const isEmail = e => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e);\n' +
        'const seen = new Set();\n' +
        'const fresh = [];\n' +
        '\n' +
        'for (const { json: p } of $("Scrape Google Maps (Apify)").all()) {\n' +
        '  const placeId = p.placeId;\n' +
        '  if (!placeId || known.has(placeId) || seen.has(placeId)) continue;\n' +
        '  seen.add(placeId);\n' +
        '  const email = (p.emails ?? []).map(e => String(e).trim().toLowerCase()).find(isEmail) ?? "";\n' +
        '  fresh.push({\n' +
        '    json: {\n' +
        '      place_id: placeId,\n' +
        '      business_name: p.title ?? "",\n' +
        '      category: p.categoryName ?? "",\n' +
        '      address: p.address ?? "",\n' +
        '      city: p.city ?? "",\n' +
        '      phone: p.phone ?? "",\n' +
        '      website: p.website ?? "",\n' +
        '      email,\n' +
        '      rating: typeof p.totalScore === "number" ? p.totalScore : null,\n' +
        '      reviews: typeof p.reviewsCount === "number" ? p.reviewsCount : null,\n' +
        '      maps_url: p.url ?? "",\n' +
        '    },\n' +
        '  });\n' +
        '}\n' +
        '\n' +
        'return fresh;'
    }
  },
  output: [{
    place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    business_name: 'Headingley Dental Care',
    category: 'Dental clinic',
    address: '12 Otley Rd, Leeds LS6 2AD, UK',
    city: 'Leeds',
    phone: '+44 113 123 4567',
    website: 'https://headingleydental.example',
    email: 'hello@headingleydental.example',
    rating: 4.8,
    reviews: 214,
    maps_url: 'https://www.google.com/maps/place/?q=place_id:ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A'
  }]
});

const scoringModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI GPT-5.4 mini',
    position: [1260, 540],
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
    position: [1440, 540],
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
    position: [1340, 300],
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      promptType: 'define',
      text: expr(
        'Business: {{ $json.business_name }}\n' +
        'Category: {{ $json.category || "unknown" }}\n' +
        'Area: {{ $json.city || $json.address || "unknown" }}\n' +
        'Google rating: {{ $json.rating ?? "none" }} from {{ $json.reviews ?? 0 }} reviews\n' +
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
  output: [{ output: { lead_score: 8, score_reason: 'Busy clinic that takes bookings and has a website and email.', personal_line: 'A 4.8 rating from 214 reviews is rare for a Leeds dental clinic.' } }]
});

const buildRow = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Build Lead Row',
    position: [1600, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: false,
      assignments: {
        assignments: [
          { id: 'row-place_id', name: 'place_id', value: expr('{{ $("Keep New Places Only").item.json.place_id }}'), type: 'string' },
          { id: 'row-business_name', name: 'business_name', value: expr('{{ $("Keep New Places Only").item.json.business_name }}'), type: 'string' },
          { id: 'row-category', name: 'category', value: expr('{{ $("Keep New Places Only").item.json.category }}'), type: 'string' },
          { id: 'row-address', name: 'address', value: expr('{{ $("Keep New Places Only").item.json.address }}'), type: 'string' },
          { id: 'row-city', name: 'city', value: expr('{{ $("Keep New Places Only").item.json.city }}'), type: 'string' },
          { id: 'row-phone', name: 'phone', value: expr('{{ $("Keep New Places Only").item.json.phone }}'), type: 'string' },
          { id: 'row-website', name: 'website', value: expr('{{ $("Keep New Places Only").item.json.website }}'), type: 'string' },
          { id: 'row-email', name: 'email', value: expr('{{ $("Keep New Places Only").item.json.email }}'), type: 'string' },
          { id: 'row-maps_url', name: 'maps_url', value: expr('{{ $("Keep New Places Only").item.json.maps_url }}'), type: 'string' },
          { id: 'row-rating', name: 'rating', value: expr('{{ $("Keep New Places Only").item.json.rating }}'), type: 'number' },
          { id: 'row-reviews', name: 'reviews', value: expr('{{ $("Keep New Places Only").item.json.reviews }}'), type: 'number' },
          { id: 'row-score', name: 'lead_score', value: expr('{{ $json.output?.lead_score ?? null }}'), type: 'number' },
          { id: 'row-reason', name: 'score_reason', value: expr('{{ $json.output?.score_reason ?? "Not scored: the AI step failed, see the execution log" }}'), type: 'string' },
          { id: 'row-line', name: 'personal_line', value: expr('{{ $json.output?.personal_line ?? "" }}'), type: 'string' },
          { id: 'row-status', name: 'status', value: expr('{{ $("Keep New Places Only").item.json.email ? "new" : "no_email" }}'), type: 'string' },
          { id: 'row-sent', name: 'emails_sent', value: 0, type: 'number' },
          { id: 'row-added', name: 'added_at', value: expr('{{ $now.toISO() }}'), type: 'string' }
        ]
      },
      options: { ignoreConversionErrors: true }
    }
  },
  output: [{
    place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    business_name: 'Headingley Dental Care',
    category: 'Dental clinic',
    address: '12 Otley Rd, Leeds LS6 2AD, UK',
    city: 'Leeds',
    phone: '+44 113 123 4567',
    website: 'https://headingleydental.example',
    email: 'hello@headingleydental.example',
    maps_url: 'https://www.google.com/maps/place/?q=place_id:ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A',
    rating: 4.8,
    reviews: 214,
    lead_score: 8,
    score_reason: 'Busy clinic that takes bookings and has a website and email.',
    personal_line: 'A 4.8 rating from 214 reviews is rare for a Leeds dental clinic.',
    status: 'new',
    emails_sent: 0,
    added_at: '2026-10-01T12:05:00.000+01:00'
  }]
});

const saveLeads = node({
  type: 'n8n-nodes-base.googleSheets',
  version: 4.7,
  config: {
    name: 'Save Leads to Sheet',
    position: [1820, 300],
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'sheet',
      operation: 'append',
      authentication: 'oAuth2',
      documentId: SHEET_DOC,
      sheetName: SHEET_TAB,
      columns: { mappingMode: 'autoMapInputData', value: {}, schema: LEAD_COLUMNS },
      options: { cellFormat: 'RAW', handlingExtraData: 'ignoreIt' }
    },
    credentials: SHEETS_CRED
  },
  output: [{ place_id: 'ChIJ2fX0bWtbeUgR8yJ4xk1Qx0A', business_name: 'Headingley Dental Care', status: 'new', lead_score: 8 }]
});

const sendSummary = node({
  type: 'n8n-nodes-base.gmail',
  version: 2.2,
  config: {
    name: 'Email Run Summary',
    position: [2040, 300],
    executeOnce: true,
    retryOnFail: true,
    maxTries: 3,
    waitBetweenTries: 5000,
    parameters: {
      resource: 'message',
      operation: 'send',
      sendTo: expr('{{ $("Config").first().json.NOTIFY_EMAIL }}'),
      subject: expr('Lead Scraper: {{ $("Build Lead Row").all().length }} new leads for {{ $("Config").first().json.NICHE }} in {{ $("Config").first().json.LOCATION }}'),
      emailType: 'text',
      message: expr(
        'Run finished at {{ $now.toFormat("HH:mm, d LLL yyyy") }}.\n\n' +
        'Places returned by Google Maps: {{ $("Scrape Google Maps (Apify)").all().length }}\n' +
        'New places added to the sheet: {{ $("Build Lead Row").all().length }}\n' +
        'With an email address: {{ $("Build Lead Row").all().filter(i => i.json.status === "new").length }}\n' +
        'Ready for outreach (email and score {{ $("Config").first().json.MIN_SCORE }}+): {{ $("Build Lead Row").all().filter(i => i.json.status === "new" && (i.json.lead_score ?? 0) >= $("Config").first().json.MIN_SCORE).length }}\n\n' +
        'Top leads:\n' +
        '{{ $("Build Lead Row").all().map(i => i.json).sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0)).slice(0, 5).map(l => "- " + l.business_name + " (score " + (l.lead_score ?? "n/a") + ", " + (l.email || "no email") + ")").join("\\n") }}\n\n' +
        'Open the sheet: {{ $("Config").first().json.SHEET_URL }}\n'
      ),
      options: { appendAttribution: false }
    },
    credentials: GMAIL_CRED
  },
  output: [{ id: '18f0b', threadId: '18f0b', labelIds: ['SENT'] }]
});

const inputNote = sticky(
  '## 1. Search input\n' +
  'Open the form (Production URL once the workflow is published), enter a business type and an area, and submit. The form answers straight away; the scrape keeps running in the background.\n\n' +
  '**Config** holds `OFFER` (keep it the same as in the Outreach workflow), `MIN_SCORE` and `NOTIFY_EMAIL`.',
  [searchForm, config],
  { color: 7 }
);

const scrapeNote = sticky(
  '## 2. Scrape Google Maps\n' +
  "Calls Apify's Google Maps actor (`compass/crawler-google-places`) with contact scraping on, so each place comes back with any email addresses found on its website.\n\n" +
  'The run-sync endpoint waits up to 5 minutes, which covers about 100 places. Places whose `place_id` is already in the sheet are dropped, so re-running a search only adds new businesses.',
  [scrapeMaps, readExisting, keepNew],
  { color: 4 }
);

const scoreNote = sticky(
  '## 3. Score with AI\n' +
  'OpenAI GPT-5.4 mini rates each place 1-10 for fit with the offer, says why, and writes a one-line personal opener from the listing.\n\n' +
  'If the AI step fails for a place, the place is still saved without a score, so the Apify spend is not wasted. Unscored leads are never emailed.',
  [scoreLead, scoringModel, scoreParser],
  { color: 6 }
);

const saveNote = sticky(
  '## 4. Save and report\n' +
  'Each place is appended to the sheet with `status = new` (email found) or `no_email`. A summary email lists how many were added and the top five by score.',
  [buildRow, saveLeads, sendSummary],
  { color: 5 }
);

export default workflow('lead-engine-scraper', 'Lead Engine 1: Lead Scraper')
  .add(searchForm)
  .to(config)
  .to(scrapeMaps)
  .to(readExisting)
  .to(keepNew)
  .to(scoreLead)
  .to(buildRow)
  .to(saveLeads)
  .to(sendSummary)
  .add(inputNote)
  .add(scrapeNote)
  .add(scoreNote)
  .add(saveNote);
