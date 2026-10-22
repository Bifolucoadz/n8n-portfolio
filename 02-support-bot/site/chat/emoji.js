// Emoji picker and shortcode search for the Copperline chat. No dependencies.
// Each entry is "emoji name keywords"; the first word is the :shortcode:.
(() => {
  const CATS = [
    ['recent', 'Recently used', '🕘', ''],
    ['people', 'Smileys and people', '😀',
      '😀 grinning happy smile|😃 smiley happy|😄 smile happy joy|😁 grin|😆 laughing lol|😅 sweat_smile phew|🤣 rofl laughing|😂 joy laugh tears|🙂 slight_smile|🙃 upside_down|😉 wink|😊 blush happy|😇 innocent halo|🥰 smiling_hearts love|😍 heart_eyes love|🤩 star_struck wow|😘 kiss|😋 yum tasty|😛 tongue|😜 wink_tongue|🤪 zany crazy|🤑 money_mouth|🤗 hugs|🤭 oops giggle|🫢 gasp|🤫 shush quiet|🤔 thinking hmm|🫡 salute|🤐 zipper_mouth|🤨 raised_eyebrow|😐 neutral|😑 expressionless|😶 no_mouth|🫠 melting|😏 smirk|😒 unamused|🙄 eye_roll|😬 grimace awkward|😮‍💨 exhale relief|😌 relieved|😔 pensive|😪 sleepy|😴 sleeping zzz|😷 mask sick|🤒 fever sick|🤕 hurt bandage|🤢 nauseated|🥵 hot|🥶 freezing cold|🥴 woozy|😵‍💫 spiral_eyes dizzy|🤯 mind_blown exploding|🤠 cowboy|🥳 party celebrate|🥸 disguise|😎 cool sunglasses|🤓 nerd|🧐 monocle|😕 confused|🫤 meh diagonal_mouth|😟 worried|🙁 frown|😮 wow open_mouth|😯 hushed|😲 astonished|😳 flushed|🥺 pleading|🥹 holding_tears|😦 frowning|😨 fearful scared|😰 anxious|😥 sad_relieved|😢 cry tear|😭 sob|😱 scream|😖 confounded|😣 persevere|😞 disappointed|😓 downcast|😩 weary|😫 tired|🥱 yawn|😤 huff triumph|😡 rage|😠 angry|🤬 cursing|😈 devil|💀 skull dead|💩 poop|🤡 clown|👻 ghost|👽 alien|🤖 robot bot|🙈 see_no_evil monkey|🙉 hear_no_evil|🙊 speak_no_evil'],
    ['hands', 'Hands and people', '👋',
      '👋 wave hello hi bye|🤚 raised_back|🖐️ splayed_hand|✋ hand stop high_five|🖖 vulcan|👌 ok_hand perfect|🤌 pinched|🤏 pinch small|✌️ victory peace|🤞 fingers_crossed luck|🫰 finger_heart|🤟 love_you|🤘 rock_on|🤙 call_me shaka|👈 point_left|👉 point_right|👆 point_up|👇 point_down|☝️ index_up|🫵 point_at_you|👍 thumbsup yes like ok|👎 thumbsdown no dislike|✊ fist|👊 punch|🤛 left_fist|🤜 right_fist|👏 clap applause|🙌 raised_hands hooray|🫶 heart_hands love|👐 open_hands|🤲 palms_up|🤝 handshake deal|🙏 pray please thanks|✍️ writing|💅 nails|🤳 selfie|💪 muscle strong|🦾 robot_arm|👀 eyes look|👁️ eye|🧠 brain smart|🗣️ speaking|👤 person|🧑‍🔧 mechanic|👩‍🔧 woman_mechanic|👨‍🔧 man_mechanic|🏃 running hurry|🚶 walking'],
    ['car', 'Car and road', '🚗',
      '🚗 car auto|🚙 suv jeep|🛻 pickup truck|🚕 taxi cab|🚓 police|🚑 ambulance|🚒 fire_engine|🚐 minibus van|🚚 truck delivery|🚛 lorry semi|🚜 tractor|🏎️ race_car fast|🏍️ motorcycle bike|🛵 scooter moped|🚲 bicycle bike|🛴 kick_scooter|🚘 oncoming_car|🚖 oncoming_taxi|🚌 bus|🛞 wheel tire tyre|⛽ fuel gas petrol pump|🔋 battery charged|🪫 low_battery dead|🔌 plug ev charger electric|🔧 wrench repair tool|🔩 nut_bolt|⚙️ gear settings|🪛 screwdriver|🛠️ tools hammer_wrench|🧰 toolbox|🪝 hook tow|⛓️ chains|🚨 siren emergency alert|🚦 traffic_light|🚥 horizontal_light|🛑 stop_sign|⚠️ warning caution|🚧 construction roadwork|🛣️ highway road|🅿️ parking|🗺️ map|📍 pin location|🧭 compass|🔑 key|🗝️ old_key|🧯 extinguisher fire|🛢️ oil_drum oil|💨 dash smoke exhaust|🌡️ thermometer temperature overheat|🧊 ice cold ac|💦 sweat_drops coolant water|🪟 window glass|🪞 mirror|🔊 loud noise|🔇 mute quiet|💸 expensive money_wings'],
    ['things', 'Objects', '📅',
      '📅 calendar date|🗓️ spiral_calendar schedule|⏰ alarm clock|⏱️ stopwatch|⏳ hourglass wait|⌚ watch|🕗 eight_oclock time|💵 dollar cash money|💳 credit_card pay|🧾 receipt invoice|💰 money_bag|🏷️ label price tag|📞 phone call|📱 mobile cell|☎️ telephone|✉️ envelope email|📧 email e_mail|📨 incoming_envelope|📝 memo note|📋 clipboard|📎 paperclip|📌 pushpin|📷 camera photo|📸 camera_flash|🔍 search magnifier|💡 bulb idea|🔦 flashlight|🔔 bell notification|📣 megaphone|📦 package box|🛒 cart shopping|🎉 tada party|🎊 confetti|🎁 gift present|🎈 balloon|🏆 trophy win|🥇 gold first|🎯 bullseye target|☕ coffee|🍩 donut|🍕 pizza|🍔 burger|🥤 cup drink|🏠 house home|🏡 home_garden|🏢 office|🏪 shop store|🏁 checkered_flag finish|🚩 red_flag|🧹 broom clean|🧼 soap wash|🧽 sponge|🪣 bucket'],
    ['symbols', 'Symbols', '❤️',
      '❤️ heart love red_heart|🧡 orange_heart copper|💛 yellow_heart|💚 green_heart|💙 blue_heart|💜 purple_heart|🖤 black_heart|🤍 white_heart|🤎 brown_heart|💔 broken_heart|❤️‍🔥 heart_on_fire|💕 two_hearts|💖 sparkling_heart|💯 hundred perfect|✅ check done yes|☑️ ballot_box|✔️ check_mark|❌ cross no wrong|❎ cross_mark|🚫 no_entry prohibited|⛔ no_entry_sign|❓ question|❗ exclamation|‼️ bangbang|⭐ star|🌟 glowing_star|✨ sparkles shiny clean|⚡ zap lightning electric|🔥 fire lit hot|💥 boom crash|💫 dizzy_star|💬 speech chat|💭 thought|🗯️ anger_bubble|🔴 red_circle|🟠 orange_circle|🟡 yellow_circle|🟢 green_circle|🔵 blue_circle|⚫ black_circle|➡️ arrow_right|⬅️ arrow_left|⬆️ arrow_up|⬇️ arrow_down|🔁 repeat|🔄 refresh|➕ plus|➖ minus|✖️ multiply|💲 dollar_sign|🆗 ok_button|🆕 new|🆓 free|🆘 sos help|ℹ️ info|♻️ recycle'],
    ['nature', 'Weather and nature', '🌤️',
      '☀️ sun sunny|🌤️ sun_small_cloud|⛅ partly_sunny|🌥️ cloudy_sun|☁️ cloud|🌦️ sun_rain|🌧️ rain|⛈️ thunderstorm|🌩️ lightning_cloud|🌨️ snow_cloud|❄️ snowflake snow winter|☃️ snowman|🌬️ wind|🌪️ tornado|🌫️ fog|🌈 rainbow|☔ umbrella rain|🌙 moon night|🌊 wave ocean|💧 droplet water leak|🍂 autumn leaves fall|🍁 maple_leaf|🌸 blossom spring|🌻 sunflower|🌵 cactus|🌲 evergreen tree|🌴 palm|🐶 dog|🐱 cat|🦊 fox|🐻 bear|🐼 panda|🦁 lion|🐯 tiger|🐸 frog|🐢 turtle slow|🐌 snail slow|🦄 unicorn|🐝 bee|🦋 butterfly|🦆 duck|🐿️ squirrel|🦌 deer']
  ];

  const parse = s => s.split('|').map(item => {
    const [e, name, ...rest] = item.trim().split(/\s+/);
    const words = [name, ...name.split('_'), ...rest];
    return { e, name, words, label: name.replace(/_/g, ' ') };
  });

  const ALL = [];
  const byEmoji = new Map();
  const cats = CATS.map(([id, label, icon, data]) => {
    const list = data ? parse(data) : [];
    list.forEach(x => { if (!byEmoji.has(x.e)) { byEmoji.set(x.e, x); ALL.push(x); } });
    return { id, label, icon, list };
  });

  const RKEY = 'copperline-emoji-recent';
  const recent = {
    get() { try { return (JSON.parse(localStorage.getItem(RKEY)) || []).filter(e => byEmoji.has(e)); } catch { return []; } },
    add(e) {
      const list = [e, ...recent.get().filter(x => x !== e)].slice(0, 16);
      try { localStorage.setItem(RKEY, JSON.stringify(list)); } catch { /* storage blocked */ }
    }
  };

  // Names that start with the query first, then any keyword that starts with it.
  function search(query, limit = 48) {
    const q = String(query).toLowerCase().replace(/^:/, '').trim();
    if (!q) return [];
    const first = [];
    const then = [];
    for (const x of ALL) {
      if (x.name.startsWith(q)) first.push(x);
      else if (x.words.some(w => w.startsWith(q))) then.push(x);
    }
    first.sort((x, y) => x.name.length - y.name.length);
    return [...first, ...then].slice(0, limit);
  }

  // ---------- picker ----------
  const COLS = 8;
  let root, body, input, tabs, preview, opts = null;

  const btn = x => `<button type="button" class="ep-e" data-e="${x.e}" aria-label="${x.label}">${x.e}</button>`;

  function build() {
    root = document.createElement('div');
    root.className = 'ep';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Emoji picker');
    root.innerHTML = `
      <div class="ep-search">
        <svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="ep-q" type="search" placeholder="Search emoji" autocomplete="off" spellcheck="false" aria-label="Search emoji">
      </div>
      <div class="ep-tabs" role="tablist" aria-label="Emoji categories">
        ${cats.map(c => `<button type="button" class="ep-tab" role="tab" data-cat="${c.id}" aria-label="${c.label}" title="${c.label}">${c.icon}</button>`).join('')}
      </div>
      <div class="ep-body"></div>
      <div class="ep-foot" aria-hidden="true"><span class="ep-big">👋</span><span class="ep-name">Pick an emoji</span></div>`;
    document.body.appendChild(root);
    body = root.querySelector('.ep-body');
    input = root.querySelector('#ep-q');
    tabs = root.querySelector('.ep-tabs');
    preview = { big: root.querySelector('.ep-big'), name: root.querySelector('.ep-name') };

    input.addEventListener('input', () => (input.value.trim() ? renderResults() : renderAll()));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); body.querySelector('.ep-e')?.focus(); }
      if (e.key === 'Enter') { e.preventDefault(); const first = body.querySelector('.ep-e'); if (first) pick(first.dataset.e, e.shiftKey); }
    });
    body.addEventListener('click', e => { const b = e.target.closest('.ep-e'); if (b) pick(b.dataset.e, e.shiftKey); });
    const show = e => {
      const b = e.target.closest('.ep-e');
      if (!b) return;
      const x = byEmoji.get(b.dataset.e);
      preview.big.textContent = b.dataset.e;
      preview.name.textContent = x ? `:${x.name}:` : '';
    };
    body.addEventListener('pointerover', show);
    body.addEventListener('focusin', show);
    body.addEventListener('keydown', gridKeys);
    body.addEventListener('scroll', spy, { passive: true });
    tabs.addEventListener('click', e => {
      const t = e.target.closest('.ep-tab');
      if (!t) return;
      if (input.value) { input.value = ''; renderAll(); }
      const sec = body.querySelector(`.ep-sec[data-cat="${t.dataset.cat}"]`);
      if (sec) body.scrollTo({ top: sec.offsetTop - body.offsetTop, behavior: 'smooth' });
    });
    root.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(true); } });
    document.addEventListener('pointerdown', e => {
      if (!root.hidden && !root.contains(e.target) && !opts.anchor.contains(e.target)) close(false);
    });
    window.addEventListener('resize', () => { if (!root.hidden) place(); });
  }

  function renderAll() {
    const rec = recent.get().map(e => byEmoji.get(e));
    body.innerHTML = cats.map(c => {
      const list = c.id === 'recent' ? rec : c.list;
      return list.length ? `<section class="ep-sec" data-cat="${c.id}"><h3 class="ep-h">${c.label}</h3><div class="ep-grid">${list.map(btn).join('')}</div></section>` : '';
    }).join('');
    tabs.querySelector('[data-cat="recent"]').hidden = !rec.length;
    body.scrollTop = 0;
    spy();
  }

  function renderResults() {
    const hits = search(input.value);
    body.innerHTML = hits.length
      ? `<section class="ep-sec"><h3 class="ep-h">Results</h3><div class="ep-grid">${hits.map(btn).join('')}</div></section>`
      : `<p class="ep-empty">No emoji called “${input.value.replace(/[<>&"]/g, '')}”.<br>Try “car”, “thanks” or “fire”.</p>`;
    preview.big.textContent = hits[0]?.e || '🔍';
    preview.name.textContent = hits[0] ? `:${hits[0].name}:` : 'No match';
    tabs.querySelectorAll('.ep-tab').forEach(t => t.setAttribute('aria-selected', 'false'));
  }

  function spy() {
    if (input.value) return;
    let current = null;
    body.querySelectorAll('.ep-sec').forEach(s => { if (s.offsetTop - body.offsetTop <= body.scrollTop + 12) current = s.dataset.cat; });
    current = current || body.querySelector('.ep-sec')?.dataset.cat;
    tabs.querySelectorAll('.ep-tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.cat === current)));
  }

  function gridKeys(e) {
    const all = [...body.querySelectorAll('.ep-e')];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const move = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const next = i + move;
    if (next < 0) input.focus();
    else all[Math.min(next, all.length - 1)].focus();
  }

  function pick(emoji, keepOpen) {
    recent.add(emoji);
    opts.onPick(emoji);
    if (!keepOpen) close(false);
  }

  // Sit above `around` (the whole composer, say) when given, lined up with the anchor's left edge.
  function place() {
    const a = opts.anchor.getBoundingClientRect();
    const r = (opts.around || opts.anchor).getBoundingClientRect();
    const w = root.offsetWidth;
    const h = root.offsetHeight;
    let top = r.top - h - 10;
    if (top < 8) top = Math.min(r.bottom + 10, innerHeight - h - 8);
    const left = Math.max(8, Math.min(a.left - 8, innerWidth - w - 8));
    root.style.top = `${Math.max(8, top)}px`;
    root.style.left = `${left}px`;
  }

  function open(options) {
    if (!root) build();
    if (opts && opts.anchor !== options.anchor) opts.anchor.setAttribute('aria-expanded', 'false');
    opts = options;
    input.value = '';
    renderAll();
    root.hidden = false;
    place();
    opts.anchor.setAttribute('aria-expanded', 'true');
    if (matchMedia('(pointer: fine)').matches) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  }

  function close(returnFocus) {
    if (!root || root.hidden) return;
    root.hidden = true;
    opts.anchor.setAttribute('aria-expanded', 'false');
    if (returnFocus) opts.anchor.focus();
    opts.onClose?.();
  }

  const isOpen = () => Boolean(root && !root.hidden);
  const toggle = options => (isOpen() && opts.anchor === options.anchor ? close(true) : open(options));

  window.EmojiKit = { open, close, toggle, isOpen, search, remember: recent.add };
})();
