// The full Vapi assistant: prompt, voice, transcriber, tools (all pointing at Receptionist 1),
// end-of-call webhook (Receptionist 3) and the post-call analysis. PATCH if it exists, else POST.
const s = Object.fromEntries($("Read Settings").all().map(i => [i.json.key, i.json.value ?? ""]));
const base = String(s.public_base_url ?? "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) throw new Error("Set public_base_url (the https ngrok address) in Receptionist Settings first.");
if (!s.webhook_secret) throw new Error("Run Receptionist 0a: Setup first (no webhook secret yet).");
const headers = { "x-fernhollow-key": s.webhook_secret };
const toolServer = { url: base + "/webhook/fernhollow/tools", headers, timeoutSeconds: 20 };
const SYSTEM_PROMPT =
__PROMPT_RECEPTIONIST__
;
const fn = (name, description, properties, required, startMessage) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
  server: toolServer,
  messages: startMessage ? [{ type: "request-start", content: startMessage, blocking: false }] : [],
});
const TYPE = { type: "string", enum: ["new_patient", "cleaning", "emergency", "consultation"], description: "Appointment type key" };
const tools = [
  fn("check_availability", "Free appointment start times. Call before offering any time. Searches the given days and, if nothing is free, the following week.", {
    appointment_type: TYPE,
    date_from: { type: "string", description: "First day to search, YYYY-MM-DD (today if not given)" },
    date_to: { type: "string", description: "Last day to search, YYYY-MM-DD (same as date_from for one day)" },
    time_of_day: { type: "string", enum: ["any", "morning", "afternoon"] },
  }, ["appointment_type"], "Let me check the schedule."),
  fn("book_appointment", "Book an appointment after the caller has confirmed the details. Re-checks the time first.", {
    appointment_type: TYPE,
    start: { type: "string", description: "The exact start value returned by check_availability" },
    patient_name: { type: "string", description: "Patient's first and last name" },
    phone: { type: "string", description: "Best callback number, digits with area code" },
    is_new_patient: { type: "boolean" },
    insurance: { type: "string", description: "Insurance provider, or 'self-pay'" },
    reason: { type: "string", description: "Short reason for the visit" },
  }, ["appointment_type", "start", "patient_name", "phone"], "One moment while I book that."),
  fn("find_appointment", "Find a caller's upcoming appointments by confirmation code or the phone number they booked with.", {
    confirmation_code: { type: "string", description: "e.g. FD-7K2Q, or just the last four characters" },
    phone: { type: "string", description: "Phone number used when booking (defaults to the caller's number)" },
  }, [], "Let me look that up."),
  fn("cancel_appointment", "Cancel an appointment after the caller confirms which one.", {
    confirmation_code: { type: "string" },
    phone: { type: "string" },
    reason: { type: "string" },
  }, [], "One moment."),
  fn("reschedule_appointment", "Move an appointment to a new start time from check_availability, after the caller confirms.", {
    confirmation_code: { type: "string" },
    phone: { type: "string" },
    new_start: { type: "string", description: "The exact start value returned by check_availability" },
  }, ["new_start"], "Let me move that for you."),
  fn("take_message", "Pass a message to the clinic staff, who call back.", {
    caller_name: { type: "string" },
    phone: { type: "string" },
    message: { type: "string", description: "What the caller needs, in one or two sentences" },
    urgent: { type: "boolean" },
  }, ["caller_name", "message"], ""),
  { type: "endCall" },
];
const assistant = {
  name: "Fernhollow Dental Receptionist",
  firstMessage: "Thanks for calling Fernhollow Dental, this is Nora, the clinic's virtual assistant. This call may be recorded. How can I help you today?",
  firstMessageMode: "assistant-speaks-first",
  model: { provider: "openai", model: "gpt-5.4-mini", reasoningEffort: "low", messages: [{ role: "system", content: SYSTEM_PROMPT }], tools },
  voice: { provider: "vapi", voiceId: "Clara" },
  transcriber: { provider: "deepgram", model: "nova-3", language: "en-US", keyterm: ["Fernhollow", "Invisalign", "Ortega", "Maya Chen"] },
  server: { url: base + "/webhook/fernhollow/events", headers, timeoutSeconds: 20 },
  serverMessages: ["end-of-call-report"],
  endCallMessage: "Thanks for calling Fernhollow Dental. Have a great day!",
  maxDurationSeconds: 600,
  artifactPlan: { recordingEnabled: true, recordingFormat: "mp3" },
  analysisPlan: {
    summaryPlan: { enabled: true, timeoutSeconds: 15, messages: [
      { role: "system", content: "You summarise calls to a dental clinic's AI receptionist for the front-desk team. In 2-3 plain sentences: who called, what they needed, what was done (booking, change, message) and anything staff must follow up. Return only the summary." },
      { role: "user", content: "Here is the transcript:\n\n{{transcript}}\n\n" },
    ] },
    structuredDataPlan: { enabled: true, timeoutSeconds: 15, schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["booked", "rescheduled", "cancelled", "question_answered", "message_taken", "emergency_referred", "no_action", "other"] },
        caller_name: { type: "string" },
        appointment_type: { type: "string" },
        appointment_time: { type: "string", description: "Day and time of the booked or moved appointment, as said on the call" },
        confirmation_code: { type: "string" },
        follow_up_needed: { type: "boolean", description: "True if staff must call back or act (message taken, unanswered question, complaint, failed booking)" },
        follow_up_reason: { type: "string" },
      },
      required: ["outcome", "follow_up_needed"],
    } },
  },
  metadata: { project: "n8n-portfolio-05", clinic: "Fernhollow Dental (fictional)" },
};
return [{ json: { assistant_id: s.assistant_id || "", phone_number_id: s.phone_number_id || "", assistant } }];
