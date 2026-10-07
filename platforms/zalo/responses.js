const { createTextResult } = require('../../core/contracts/command-result');
const {
  buildZaloGreeting,
} = require('../../core/use-cases/common/zalo-greeting');

const numbered = names =>
  names.map((name, index) => `${index + 1}. ${name}`).join('\n');
const selection = choice => (choice === '1' ? 'tham gia' : 'không tham gia');
const voteInstructions = 'Tham gia: gửi /vote 1\nKhông tham gia: gửi /vote 0';

function greeting(actor, env) {
  // Preserve the admin panel's configured greeting.
  if (String(env.ZALO_GREETING_TEXT || '').trim())
    return buildZaloGreeting(actor, env);
  const name =
    String(actor?.displayName || 'bạn')
      .replace(/[\p{Cc}\s]+/gu, ' ')
      .trim()
      .slice(0, 100) || 'bạn';
  return `Chào ${name}, đây là bot ChiaTeam.`;
}

function createZaloGreetingResult(actor, env = process.env) {
  return createTextResult(
    `${greeting(actor, env)}\n\nBạn có thể xem bình chọn, đội hình và nhận thông báo của đội.\n\nGửi /poll để xem bình chọn đang mở.\nGửi /start để xem danh sách lệnh.`
  );
}

const helpGroups = [
  [
    'Bình chọn',
    [
      ['poll', '/poll — Xem bình chọn đang mở'],
      ['vote', '/vote — Xem cách đăng ký tham gia'],
      ['dempoll', '/dempoll — Xem kết quả bình chọn'],
    ],
  ],
  [
    'Danh sách và đội hình',
    [
      ['bench', '/bench — Xem danh sách cầu thủ'],
      ['team', '/team — Xem đội hình 2 đội\n/team 3 — Xem đội hình 3 đội'],
    ],
  ],
  [
    'Thông báo',
    [
      ['subscribe', '/subscribe — Đăng ký nhận thông báo'],
      ['unsubscribe', '/unsubscribe — Ngừng nhận thông báo'],
    ],
  ],
];

const errors = {
  poll: {
    INVALID_ARGUMENTS: 'Gửi /poll, không thêm nội dung phía sau.',
    NO_ACTIVE_VOTE:
      'Chưa có bình chọn đang mở.\nGửi /poll để kiểm tra lại sau.',
    STATE_LOAD_FAILED:
      'Chưa tải được bình chọn.\nVui lòng gửi lại /poll sau ít phút.',
    INVALID_VOTE_STATE:
      'Chưa tải được bình chọn.\nVui lòng gửi lại /poll sau ít phút.',
  },
  vote: {
    INVALID_ARGUMENTS:
      'Gửi /vote 1 để tham gia hoặc /vote 0 để không tham gia.',
    NO_ACTIVE_VOTE:
      'Chưa có bình chọn đang mở.\nGửi /poll để kiểm tra lại sau.',
    STATE_LOAD_FAILED:
      'Chưa tải được bình chọn.\nVui lòng gửi lại /vote sau ít phút.',
    INVALID_VOTE_STATE:
      'Chưa tải được bình chọn.\nVui lòng gửi lại /vote sau ít phút.',
    STATE_SAVE_FAILED:
      'Chưa lưu được lựa chọn của bạn.\nVui lòng gửi lại lệnh vừa dùng.',
  },
  dempoll: {
    INVALID_ARGUMENTS: 'Gửi /dempoll, không thêm nội dung phía sau.',
    NO_ACTIVE_VOTE:
      'Chưa có bình chọn đang mở.\nGửi /poll để kiểm tra lại sau.',
    STATE_LOAD_FAILED:
      'Chưa tải được kết quả bình chọn.\nVui lòng gửi lại /dempoll sau ít phút.',
    INVALID_VOTE_STATE:
      'Chưa tải được kết quả bình chọn.\nVui lòng gửi lại /dempoll sau ít phút.',
  },
  bench: {
    EMPTY_BENCH: 'Danh sách cầu thủ đang trống.',
    STATE_LOAD_FAILED:
      'Chưa tải được danh sách cầu thủ.\nVui lòng gửi lại /bench sau ít phút.',
    INVALID_BENCH_STATE:
      'Chưa tải được danh sách cầu thủ.\nVui lòng gửi lại /bench sau ít phút.',
  },
  team: {
    INVALID_MODE: 'Gửi /team để xem 2 đội hoặc /team 3 để xem 3 đội.',
    STATE_LOAD_FAILED:
      'Chưa tải được đội hình.\nVui lòng gửi lại lệnh vừa dùng sau ít phút.',
    INVALID_TEAM_STATE:
      'Chưa tải được đội hình.\nVui lòng gửi lại lệnh vừa dùng sau ít phút.',
  },
  zalosay: {
    MISSING_ANNOUNCEMENT: 'Gửi /zalosay kèm nội dung tin nhắn.',
    INVALID_ANNOUNCEMENT: 'Nội dung tin nhắn cần có từ 1 đến 2000 ký tự.',
    PERMISSION_DENIED: 'Chỉ admin mới có quyền gửi thông báo.',
  },
};

function withZaloResponses(definition, { env, commandRules }) {
  return Object.freeze({
    ...definition,
    async reply(outcome, context) {
      const name = definition.name;
      const code = outcome.code;
      const original = await definition.reply(outcome, context);
      const respond = text =>
        createTextResult(text, [], { channel: original.messages[0].channel });
      if (name === 'zalosay' && code === 'ANNOUNCEMENT_READY') return original;
      if (errors[name]?.[code]) return respond(errors[name][code]);
      if (code === 'PERMISSION_DENIED')
        return respond('Bạn không có quyền thực hiện lệnh này.');
      if (name === 'start') {
        const sections = helpGroups
          .map(([title, rows]) => {
            const visible = rows.filter(
              ([command]) =>
                commandRules(context, { name: command }).enabled !== false
            );
            return visible.length
              ? `${title}\n${visible.map(([command, text]) => `${text}${commandRules(context, { name: command }).permission === 'admin' ? ' (admin)' : ''}`).join('\n')}`
              : '';
          })
          .filter(Boolean);
        return respond(
          `${String(env.ZALO_GREETING_TEXT || '').trim() ? `${greeting(context.actor, env)}\n\n` : ''}Hướng dẫn ChiaTeam\n\nGửi lệnh tương ứng với việc bạn muốn làm.\n\n${sections.join('\n\n') || 'Hiện chưa có lệnh nào khả dụng.'}\n\nGửi /start để xem lại hướng dẫn.`
        );
      }
      if (name === 'subscribe' || name === 'unsubscribe') {
        if (code === 'PRIVATE_CHAT_REQUIRED')
          return respond(
            `Mở chat riêng với bot và gửi /${name}, không thêm nội dung phía sau.`
          );
        if (code !== 'SAVED')
          return respond(
            `Chưa lưu được lựa chọn nhận thông báo.\nVui lòng gửi lại /${name}.`
          );
        return respond(
          name === 'subscribe'
            ? 'Đã bật thông báo của đội.\n\nGửi /unsubscribe để ngừng nhận.'
            : 'Đã tắt thông báo của đội.\n\nGửi /subscribe để nhận lại.'
        );
      }
      if (name === 'poll')
        return respond(
          `Bình chọn tham gia\n\n${outcome.vote.question}\n\nGửi /vote 1 nếu bạn tham gia.\nGửi /vote 0 nếu bạn không tham gia.\n\nBạn có thể gửi lại lệnh để đổi lựa chọn.`
        );
      if (name === 'vote') {
        if (code === 'VOTE_PROMPTED')
          return respond(
            `Bạn có tham gia không?\n\n${outcome.vote.question}\n\n${voteInstructions}`
          );
        return respond(
          code === 'VOTE_UNCHANGED'
            ? `Lựa chọn của bạn vẫn là: ${selection(outcome.choice)}.`
            : `Đã ghi nhận: ${outcome.name} ${selection(outcome.choice)}.`
        );
      }
      if (name === 'dempoll') {
        const groups = [...outcome.summary.choices]
          .reverse()
          .map(
            choice =>
              `${choice.value === '1' ? 'Tham gia' : 'Không tham gia'}: ${choice.count} người\n${numbered(choice.voterNames) || 'Chưa có ai.'}`
          );
        return respond(
          `Kết quả bình chọn\n\n${outcome.summary.question}\n\n${groups.join('\n\n')}\n\nGửi /vote để chọn hoặc đổi lựa chọn.`
        );
      }
      if (name === 'bench')
        return respond(
          `Danh sách cầu thủ\nTổng: ${outcome.names.length} người\n\n${numbered(outcome.names)}`
        );
      if (name === 'team') {
        if (code === 'EMPTY_TEAMS')
          return respond(
            `Chưa có đội hình ${outcome.mode} đội.\nĐội hình sẽ hiển thị sau khi admin chia đội.`
          );
        const teams = [
          ['HOME', outcome.teams.home],
          ['AWAY', outcome.teams.away],
          ...(outcome.mode === 3 ? [['EXT', outcome.teams.extra]] : []),
        ];
        return respond(
          `Đội hình hiện tại\n\n${teams.map(([label, names]) => `${label} — ${names.length} người\n${numbered(names) || 'Chưa có cầu thủ.'}`).join('\n\n')}`
        );
      }
      return original;
    },
  });
}

module.exports = { createZaloGreetingResult, withZaloResponses };
