// ---- lib-calls.js (included by build.py): the three scripted demo calls ----
// Everyone and every company is invented. Each line is [speaker, text]; VOICES maps speakers to
// OpenAI voices and how they should sound.
const VOICES = {
  'Maya Collins': ['coral', 'A friendly, confident sales account executive on a video call. Natural pace, warm.'],
  'Renee Alvarez': ['sage', 'A busy operations director at a dental group. Practical and direct, slightly tired.'],
  'Tom Reyes': ['ash', 'An IT manager at a freight company. Calm, technical, a little sceptical.'],
  'Janelle Brooks': ['shimmer', 'The CEO of a home care agency. Decisive, upbeat, negotiating firmly but politely.']
};

const CALLS = [
  {
    file: 'calloway-discovery.wav', deal_id: 'D-1001', title: 'Calloway Dental Group: discovery call',
    lines: [
      ['Maya Collins', 'Hi Renee, thanks for making time today. I know Mondays are busy for you.'],
      ['Renee Alvarez', 'They always are. But this one matters, so go ahead.'],
      ['Maya Collins', 'Great. I\'d love to start with how things work today. How do patients get reminded about appointments across your clinics?'],
      ['Renee Alvarez', 'Honestly, mostly by phone. We have five clinics, and the front desk at each one spends about three hours a day calling patients to confirm.'],
      ['Maya Collins', 'Three hours a day, per clinic?'],
      ['Renee Alvarez', 'Per clinic. And we still have a no-show rate of about eleven percent. That\'s chairs sitting empty every single day.'],
      ['Maya Collins', 'That adds up fast. What system do you book appointments in?'],
      ['Renee Alvarez', 'Dentrix, at all five locations.'],
      ['Maya Collins', 'Good, we\'ve connected to Dentrix before. Have you looked at any tools for this already?'],
      ['Renee Alvarez', 'We looked at Weave last year, but it felt heavy for what we need, and the staff didn\'t want another app.'],
      ['Maya Collins', 'That makes sense. What we\'d build is lighter: automatic text and email reminders straight from Dentrix, two-way, so patients can confirm or ask to reschedule, and the front desk only sees the ones that need a person.'],
      ['Renee Alvarez', 'That\'s exactly the part I care about. The front desk only dealing with exceptions.'],
      ['Maya Collins', 'Can I ask about budget? Is there money set aside for this?'],
      ['Renee Alvarez', 'We set aside around forty thousand dollars for patient communication this year. So it has to fit inside that.'],
      ['Maya Collins', 'Understood. And who else is involved in the decision?'],
      ['Renee Alvarez', 'I make the recommendation. Our COO, Mark Feld, signs off on anything over twenty-five thousand, so he\'ll need to see it.'],
      ['Maya Collins', 'Makes sense. Is there a date you\'re working towards?'],
      ['Renee Alvarez', 'We want it live before the January rush. Insurance resets in January and every clinic gets slammed.'],
      ['Maya Collins', 'Okay. Then here\'s what I suggest. I\'ll send you a short case study from another dental group and an outline of the proposal by Friday.'],
      ['Renee Alvarez', 'That works. I can send you our no-show report so you can see the numbers per clinic.'],
      ['Maya Collins', 'That would be really helpful. And could we get thirty minutes with Mark next week to walk him through it?'],
      ['Renee Alvarez', 'I\'ll introduce you. Let\'s aim for next Tuesday.'],
      ['Maya Collins', 'Perfect. Thanks so much, Renee. Talk soon.'],
      ['Renee Alvarez', 'Thanks, Maya. Bye.']
    ]
  },
  {
    file: 'pemberton-demo-followup.wav', deal_id: 'D-1002', title: 'Pemberton Freight: demo follow-up',
    lines: [
      ['Maya Collins', 'Hi Tom, thanks for jumping on. How did the team feel about last week\'s portal demo?'],
      ['Tom Reyes', 'Overall, good. The dispatchers liked the live tracking view a lot. Customers keep calling us just to ask where their load is.'],
      ['Maya Collins', 'That\'s great to hear. What questions came up afterwards?'],
      ['Tom Reyes', 'Two big ones. First, integration. Everything we do runs on McLeod, so the portal has to read from it without us retyping anything.'],
      ['Maya Collins', 'That\'s doable. We\'d read loads and status updates from McLeod through its API every few minutes. Nobody retypes anything.'],
      ['Tom Reyes', 'Okay. Second is security. Before anything touches customer data, we need a security review. There\'s a questionnaire, about eighty questions, and they\'ll ask about SOC 2.'],
      ['Maya Collins', 'No problem. Send it over and we\'ll return it within a week.'],
      ['Tom Reyes', 'Good. Now, the price. Sixty-five thousand is above what we expected. Our CFO was thinking closer to fifty.'],
      ['Maya Collins', 'I appreciate you being straight with me. One option is to phase it: the tracking portal first, and the customer self-service features in a second phase.'],
      ['Tom Reyes', 'A phased option would help. I can take that to the CFO.'],
      ['Maya Collins', 'Can I ask, are you looking at anyone else?'],
      ['Tom Reyes', 'We\'re also talking to Freightlink Labs. Their price is lower, but they don\'t integrate with McLeod yet.'],
      ['Maya Collins', 'That\'s fair to mention. The integration is usually where these projects succeed or fail.'],
      ['Tom Reyes', 'That\'s my worry with them too.'],
      ['Maya Collins', 'So, next steps. I\'ll send a revised proposal with a phased option by Thursday. Could our lead developer have a technical call with your dev lead about the McLeod API?'],
      ['Tom Reyes', 'Yes. Let\'s do Thursday afternoon. I\'ll also send you the security questionnaire today.'],
      ['Maya Collins', 'Perfect. And when would your CFO want to make a decision?'],
      ['Tom Reyes', 'Probably by mid-December. We want to start in the new year.'],
      ['Maya Collins', 'Great, thanks Tom. I\'ll get everything over to you.'],
      ['Tom Reyes', 'Sounds good. Thanks.']
    ]
  },
  {
    file: 'ostara-negotiation.wav', deal_id: 'D-1003', title: 'Ostara Home Care: contract call',
    lines: [
      ['Maya Collins', 'Hi Janelle, thanks for calling back. Did you get a chance to go through the contract?'],
      ['Janelle Brooks', 'I did, and I\'ll be honest, we want to do this. But I need two changes before I can sign.'],
      ['Maya Collins', 'Of course. What are they?'],
      ['Janelle Brooks', 'First, I want to start with a pilot. Two branches for sixty days, and then roll out to all eight if the caregivers actually use it.'],
      ['Maya Collins', 'A pilot is reasonable. We can structure it as two branches first, with the full rollout priced in the same contract.'],
      ['Janelle Brooks', 'Good. Second, if we prepay the whole year, I\'d like ten percent off.'],
      ['Maya Collins', 'I can\'t promise ten today, but I\'ll take it to my manager. Annual prepay usually gets something.'],
      ['Janelle Brooks', 'That\'s fair. Also, our lawyer flagged the data retention clause in the MSA. We have to keep visit records for seven years, and the contract says three.'],
      ['Maya Collins', 'That\'s an easy fix. We\'ll change it to seven years to match your requirement.'],
      ['Janelle Brooks', 'Great. If you can do the pilot terms and fix that clause, we\'ll sign this month.'],
      ['Maya Collins', 'That\'s great news. I\'ll send the revised contract with the pilot terms and the retention change by Wednesday.'],
      ['Janelle Brooks', 'And I\'ll get our lawyer to sign off as soon as it arrives.'],
      ['Maya Collins', 'For planning, could we pencil in a kickoff for November tenth?'],
      ['Janelle Brooks', 'November tenth works. Put it in.'],
      ['Maya Collins', 'Will do. Thanks so much, Janelle.'],
      ['Janelle Brooks', 'Thank you, Maya. Talk soon.']
    ]
  }
];
// ---- end lib-calls.js ----
