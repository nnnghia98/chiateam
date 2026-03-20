const cron = require('node-cron');
const { CHAT_ID, THREAD_TYPES } = require('../utils/chat');

// ── Day mapping ────────────────────────────────────────────────
const DAY_MAP = {
  'cn': 0, 'chủ nhật': 0,
  'thứ 2': 1, 't2': 1,
  'thứ 3': 2, 't3': 2,
  'thứ 4': 3, 't4': 3,
  'thứ 5': 4, 't5': 4,
  'thứ 6': 5, 't6': 5,
  'thứ 7': 6, 't7': 6,
};

const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/**
 * Parse day from text input. Returns 0-6 or null.
 */
function parseDay(text) {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (lower.startsWith(key)) return val;
  }
  return null;
}

/**
 * Parse hour from text like "14h", "14h30", "9h". Returns { hour, minute } or null.
 */
function parseHour(text) {
  const m = text.match(/(\d{1,2})h(\d{2})?/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2] || '0', 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function formatHour(hour, minute) {
  return `${hour}h${String(minute).padStart(2, '0')}`;
}

// ── Pure helpers ───────────────────────────────────────────────

function getNextDayOfWeek(dayOfWeek, from = new Date()) {
  const d = new Date(from);
  const current = d.getDay();
  const daysUntil = ((dayOfWeek - current + 7) % 7) || 7;
  d.setDate(d.getDate() + daysUntil);
  return d;
}

function formatDDMM(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function calculateTotalPlayers(votes) {
  const optionCounts = [0, 0, 0, 0, 0];
  for (const vote of Object.values(votes)) {
    for (const optIdx of vote.options) {
      if (optIdx >= 0 && optIdx < 5) {
        optionCounts[optIdx]++;
      }
    }
  }
  return optionCounts.reduce((sum, count, idx) => sum + count * idx, 0);
}

const POLL_OPTIONS = ['0', '+1', '+2', '+3', '+4'];
const MIN_PLAYERS = 10;

// ── Scheduler ──────────────────────────────────────────────────

function startWeeklyVoteScheduler(bot) {
  if (!bot) {
    console.warn('⚠️ [weekly-vote] Bot not initialized, scheduler skipped.');
    return;
  }

  // ── Config ───────────────────────────────────────────────────
  const config = {
    enabled: true,
    // Match info (shown in poll title)
    matchDay: 4,          // 0=CN, 1=T2, ..., 4=T5
    matchTime: '19h15',
    fieldName: 'Sân số 8',
    // Cron schedule for auto poll creation
    pollDay: 5,           // Thứ 6 (Friday)
    pollHour: 14,
    pollMinute: 0,
    // Cron schedule for auto remind
    remindDay: 1,         // Thứ 2 (Monday)
    remindHour: 14,
    remindMinute: 0,
  };

  let scheduledVote = null;
  let pollTask = null;
  let remindTask = null;

  // ── Build helpers ────────────────────────────────────────────
  function buildQuestion() {
    const nextMatch = getNextDayOfWeek(config.matchDay);
    const ddmm = formatDDMM(nextMatch);
    return `${ddmm} - ${config.matchTime} - ${config.fieldName}`;
  }

  function buildCronExpr(minute, hour, dayOfWeek) {
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }

  // ── Poll creation logic ──────────────────────────────────────
  function createPoll() {
    if (!config.enabled) {
      console.log('⏸️ [weekly-vote] Auto poll disabled, skipping.');
      return;
    }

    const question = buildQuestion();
    console.log(`📊 [weekly-vote] Creating poll: "${question}"`);

    const pollOpts = {
      is_anonymous: false,
      allows_multiple_answers: false,
    };
    if (THREAD_TYPES.ANNOUNCEMENT) {
      pollOpts.message_thread_id = THREAD_TYPES.ANNOUNCEMENT;
    }

    bot
      .sendPoll(CHAT_ID, question, POLL_OPTIONS, pollOpts)
      .then(pollMessage => {
        scheduledVote = {
          id: pollMessage.poll.id,
          question,
          messageId: pollMessage.message_id,
          createdAt: new Date(),
          votes: {},
        };
        console.log(`✅ [weekly-vote] Poll created: ${question}`);
      })
      .catch(err => {
        console.error('❌ [weekly-vote] Failed to create poll:', err);
      });
  }

  // ── Remind logic ─────────────────────────────────────────────
  function checkRemind() {
    if (!config.enabled) {
      console.log('⏸️ [weekly-vote] Auto remind disabled, skipping.');
      return;
    }

    if (!scheduledVote) {
      console.log('📭 [weekly-vote] No active poll to check.');
      return;
    }

    const total = calculateTotalPlayers(scheduledVote.votes);
    console.log(`📊 [weekly-vote] Total players: ${total}`);

    if (total < MIN_PLAYERS) {
      const forwardOpts = {};
      if (THREAD_TYPES.MAIN) {
        forwardOpts.message_thread_id = THREAD_TYPES.MAIN;
      }
      bot
        .forwardMessage(CHAT_ID, CHAT_ID, scheduledVote.messageId, forwardOpts)
        .then(() => {
          console.log(`✅ [weekly-vote] Poll forwarded (${total}/${MIN_PLAYERS})`);
        })
        .catch(err => {
          console.error('❌ [weekly-vote] Failed to forward poll:', err);
        });
    } else {
      console.log(`✅ [weekly-vote] Enough players (${total}), no reminder needed.`);
    }
  }

  // ── Start/restart cron tasks ─────────────────────────────────
  function startCronTasks() {
    if (pollTask) pollTask.stop();
    if (remindTask) remindTask.stop();

    const pollExpr = buildCronExpr(config.pollMinute, config.pollHour, config.pollDay);
    const remindExpr = buildCronExpr(config.remindMinute, config.remindHour, config.remindDay);

    pollTask = cron.schedule(pollExpr, createPoll, { timezone: 'Asia/Ho_Chi_Minh' });
    remindTask = cron.schedule(remindExpr, checkRemind, { timezone: 'Asia/Ho_Chi_Minh' });

    console.log(`📅 [weekly-vote] Cron updated — poll: "${pollExpr}", remind: "${remindExpr}"`);
  }

  function statusText() {
    return (
      `📋 *Cấu hình hiện tại:*\n\n` +
      `🔄 Auto: ${config.enabled ? '✅ BẬT' : '⏸️ TẮT'}\n\n` +
      `⚽ *Lịch đá:*\n` +
      `• Ngày: ${DAY_NAMES[config.matchDay]}\n` +
      `• Giờ: ${config.matchTime}\n` +
      `• Sân: ${config.fieldName}\n\n` +
      `📊 *Auto tạo poll:*\n` +
      `• ${DAY_NAMES[config.pollDay]} lúc ${formatHour(config.pollHour, config.pollMinute)}\n\n` +
      `🔔 *Auto remind:*\n` +
      `• ${DAY_NAMES[config.remindDay]} lúc ${formatHour(config.remindHour, config.remindMinute)}`
    );
  }

  // ── Track poll answers ───────────────────────────────────────
  bot.on('poll_answer', pollAnswer => {
    if (!scheduledVote || pollAnswer.poll_id !== scheduledVote.id) return;

    const userId = pollAnswer.user.id;
    const userName = pollAnswer.user.first_name || pollAnswer.user.username || 'Unknown';

    if (pollAnswer.option_ids.length === 0) {
      delete scheduledVote.votes[userId];
    } else {
      scheduledVote.votes[userId] = {
        id: userId,
        name: userName,
        options: pollAnswer.option_ids,
      };
    }
  });

  // ── Start cron ───────────────────────────────────────────────
  startCronTasks();

  // ═══════════════════════════════════════════════════════════════
  // COMMANDS
  // ═══════════════════════════════════════════════════════════════

  // ── /autopoll — toggle on/off ───────────────────────────────
  bot.onText(/^\/autopoll$/, msg => {
    config.enabled = !config.enabled;
    const status = config.enabled ? '✅ Auto poll & remind đã *BẬT*' : '⏸️ Auto poll & remind đã *TẮT*';

    // Reply to user
    bot.sendMessage(msg.chat.id, statusText(), { parse_mode: 'Markdown' });

    // Notify in MAIN thread
    const notifyOpts = { parse_mode: 'Markdown' };
    if (THREAD_TYPES.MAIN) {
      notifyOpts.message_thread_id = THREAD_TYPES.MAIN;
    }
    bot.sendMessage(CHAT_ID, status, notifyOpts);

    console.log(`📅 [weekly-vote] Auto poll ${config.enabled ? 'ENABLED' : 'DISABLED'}`);
  });

  // ── /setschedule — change match day/time/field ──────────────
  bot.onText(/^\/setschedule$/, msg => {
    const help =
      '📋 *Cách sử dụng /setschedule:*\n\n' +
      '• `/setschedule thứ 5 19h15` — Đổi ngày & giờ đá\n' +
      '• `/setschedule t4 20h00 Sân số 5` — Đổi ngày, giờ & sân\n\n' +
      statusText();
    bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' });
  });

  bot.onText(/^\/setschedule\s+(.+)$/, (msg, match) => {
    const input = match[1].trim();
    const newDay = parseDay(input);
    if (newDay === null) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra ngày. Ví dụ: `/setschedule thứ 5 19h15`', { parse_mode: 'Markdown' });
      return;
    }
    const timeMatch = input.match(/(\d{1,2}h\d{2})/i);
    if (!timeMatch) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra giờ. Ví dụ: `/setschedule thứ 5 19h15`', { parse_mode: 'Markdown' });
      return;
    }
    const newTime = timeMatch[1];
    const afterTime = input.substring(input.indexOf(newTime) + newTime.length).trim();

    config.matchDay = newDay;
    config.matchTime = newTime;
    if (afterTime) config.fieldName = afterTime;

    const preview = buildQuestion();
    bot.sendMessage(msg.chat.id,
      `✅ *Đã cập nhật lịch đá!*\n\n🔮 Poll tuần tới: *${preview}*\n\n` + statusText(),
      { parse_mode: 'Markdown' }
    );
  });

  // ── /setautopoll — change when auto poll runs ───────────────
  bot.onText(/^\/setautopoll$/, msg => {
    bot.sendMessage(msg.chat.id,
      '📋 *Cách sử dụng /setautopoll:*\n\n' +
      '• `/setautopoll thứ 6 14h00` — Tạo poll vào thứ 6 lúc 14h\n' +
      '• `/setautopoll t5 10h30` — Tạo poll vào thứ 5 lúc 10h30\n\n' +
      `📊 *Hiện tại:* ${DAY_NAMES[config.pollDay]} lúc ${formatHour(config.pollHour, config.pollMinute)}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/^\/setautopoll\s+(.+)$/, (msg, match) => {
    const input = match[1].trim();
    const newDay = parseDay(input);
    if (newDay === null) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra ngày. Ví dụ: `/setautopoll thứ 6 14h00`', { parse_mode: 'Markdown' });
      return;
    }
    const parsed = parseHour(input);
    if (!parsed) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra giờ. Ví dụ: `/setautopoll thứ 6 14h00`', { parse_mode: 'Markdown' });
      return;
    }

    config.pollDay = newDay;
    config.pollHour = parsed.hour;
    config.pollMinute = parsed.minute;
    startCronTasks();

    bot.sendMessage(msg.chat.id,
      `✅ *Auto tạo poll đã đổi:* ${DAY_NAMES[config.pollDay]} lúc ${formatHour(config.pollHour, config.pollMinute)}\n\n` + statusText(),
      { parse_mode: 'Markdown' }
    );
  });

  // ── /setautoremind — change when auto remind runs ───────────
  bot.onText(/^\/setautoremind$/, msg => {
    bot.sendMessage(msg.chat.id,
      '📋 *Cách sử dụng /setautoremind:*\n\n' +
      '• `/setautoremind thứ 2 14h00` — Remind vào thứ 2 lúc 14h\n' +
      '• `/setautoremind t3 9h00` — Remind vào thứ 3 lúc 9h\n\n' +
      `🔔 *Hiện tại:* ${DAY_NAMES[config.remindDay]} lúc ${formatHour(config.remindHour, config.remindMinute)}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/^\/setautoremind\s+(.+)$/, (msg, match) => {
    const input = match[1].trim();
    const newDay = parseDay(input);
    if (newDay === null) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra ngày. Ví dụ: `/setautoremind thứ 2 14h00`', { parse_mode: 'Markdown' });
      return;
    }
    const parsed = parseHour(input);
    if (!parsed) {
      bot.sendMessage(msg.chat.id, '⚠️ Không nhận ra giờ. Ví dụ: `/setautoremind thứ 2 14h00`', { parse_mode: 'Markdown' });
      return;
    }

    config.remindDay = newDay;
    config.remindHour = parsed.hour;
    config.remindMinute = parsed.minute;
    startCronTasks();

    bot.sendMessage(msg.chat.id,
      `✅ *Auto remind đã đổi:* ${DAY_NAMES[config.remindDay]} lúc ${formatHour(config.remindHour, config.remindMinute)}\n\n` + statusText(),
      { parse_mode: 'Markdown' }
    );
  });

  // ── /testcron — trigger full flow immediately ───────────────
  bot.onText(/^\/testcron$/, msg => {
    const chatId = msg.chat.id;
    const question = buildQuestion();

    bot.sendMessage(chatId, '🧪 *Test cron bắt đầu...*\n\n1️⃣ Tạo poll ngay\n2️⃣ Sau 60 giây sẽ check remind', { parse_mode: 'Markdown' });

    bot
      .sendPoll(chatId, question, POLL_OPTIONS, {
        is_anonymous: false,
        allows_multiple_answers: false,
      })
      .then(pollMessage => {
        scheduledVote = {
          id: pollMessage.poll.id,
          question,
          messageId: pollMessage.message_id,
          createdAt: new Date(),
          votes: {},
        };
        bot.sendMessage(chatId, '✅ Poll đã tạo! Hãy vote trong 60 giây...');

        setTimeout(() => {
          const total = calculateTotalPlayers(scheduledVote.votes);
          if (total < MIN_PLAYERS) {
            bot
              .forwardMessage(chatId, chatId, scheduledVote.messageId)
              .then(() => {
                bot.sendMessage(chatId, `⚠️ Remind: mới có *${total}* người (cần ${MIN_PLAYERS})`, { parse_mode: 'Markdown' });
              })
              .catch(err => console.error('❌ [weekly-vote] Test forward failed:', err.message));
          } else {
            bot.sendMessage(chatId, `✅ Đủ *${total}* người, không cần remind!`, { parse_mode: 'Markdown' });
          }
        }, 60_000);
      })
      .catch(err => {
        bot.sendMessage(chatId, `❌ Lỗi: ${err.message}`);
      });
  });

  console.log('📅 [weekly-vote] Scheduler started');
}

module.exports = { startWeeklyVoteScheduler, getNextDayOfWeek, formatDDMM, calculateTotalPlayers };
