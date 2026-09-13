const COMMAND_MANIFEST = Object.freeze(
  [
    {
      name: 'start',
      category: 'Bắt đầu',
      usage: '/start',
      description: 'Xem hướng dẫn và danh sách lệnh',
      permission: 'player',
    },
    {
      name: 'zalosay',
      aliases: ['say'],
      category: 'Thông báo',
      usage: '/zalosay [MESSAGE]',
      description:
        'Soạn và xác nhận thông báo đến tất cả người đăng ký trên Zalo',
      permission: 'admin',
    },
    {
      name: 'addme',
      category: 'Bench',
      usage: '/addme',
      description: 'Tự thêm mình vào bench',
      permission: 'player',
    },
    {
      name: 'add',
      category: 'Bench',
      usage: '/add NAME[, NAME...]',
      description: 'Thêm cầu ngoài vào bench',
      permission: 'admin',
    },
    {
      name: 'bench',
      category: 'Bench',
      usage: '/bench',
      description: 'Xem bench hiện tại',
      permission: 'player',
    },
    {
      name: 'editbench',
      category: 'Bench',
      usage: '/editbench [NUMBER NEW_NAME]',
      description: 'Đổi tên người trong bench',
      permission: 'admin',
    },
    {
      name: 'clearbench',
      category: 'Bench',
      usage: '/clearbench [SELECTION|all]',
      description: 'Xóa người khỏi bench',
      permission: 'admin',
    },
    {
      name: 'chiateam',
      category: 'Team',
      usage: '/chiateam [2|3]',
      description: 'Chia hai hoặc ba team',
      permission: 'admin',
    },
    {
      name: 'team',
      category: 'Team',
      usage: '/team [2|3]',
      description: 'Xem team hiện tại',
      permission: 'player',
    },
    {
      name: 'addtoteam',
      category: 'Team',
      usage: '/addtoteam [2|3] HOME|AWAY|EXTRA [SELECTION]',
      description: 'Thêm người vào team',
      permission: 'admin',
    },
    {
      name: 'clearteam',
      category: 'Team',
      usage: '/clearteam MODE [TEAM] [SELECTION|confirm]',
      description: 'Xóa người hoặc toàn bộ team',
      permission: 'admin',
    },
    {
      name: 'manifest',
      category: 'Team',
      usage: '/manifest [FIRST SAME|DIFFERENT SECOND]',
      description: 'Tạo điều kiện chia team',
      permission: 'admin',
    },
    {
      name: 'manifests',
      aliases: ['mf'],
      category: 'Team',
      usage: '/manifests',
      description: 'Xem các điều kiện chia team',
      permission: 'player',
    },
    {
      name: 'removemanifest',
      category: 'Team',
      usage: '/removemanifest [NUMBER]',
      description: 'Xóa một điều kiện chia team',
      permission: 'admin',
    },
    {
      name: 'clearmanifests',
      category: 'Team',
      usage: '/clearmanifests [confirm|cancel]',
      description: 'Xóa tất cả điều kiện chia team',
      permission: 'admin',
    },
    {
      name: 'san',
      category: 'Sân và chi phí',
      usage: '/san [NAME]',
      description: 'Xem sân; chỉ admin được cập nhật',
      permission: 'player',
    },
    {
      name: 'clearsan',
      category: 'Sân và chi phí',
      usage: '/clearsan',
      description: 'Xóa sân hiện tại',
      permission: 'admin',
    },
    {
      name: 'tiensan',
      category: 'Sân và chi phí',
      usage: '/tiensan [AMOUNT]',
      description: 'Xem tiền sân; chỉ admin được cập nhật',
      permission: 'player',
    },
    {
      name: 'tiennuoc',
      category: 'Sân và chi phí',
      usage: '/tiennuoc [AMOUNT]',
      description: 'Xem tiền nước; chỉ admin được cập nhật',
      permission: 'player',
    },
    {
      name: 'winner',
      category: 'Sân và chi phí',
      usage: '/winner [HOME|AWAY]',
      description: 'Xem team thắng; chỉ admin được cập nhật',
      permission: 'player',
    },
    {
      name: 'loser',
      category: 'Sân và chi phí',
      usage: '/loser [HOME|AWAY]',
      description: 'Lệnh cũ; chuyển sang /winner',
      permission: 'player',
    },
    {
      name: 'chiatien',
      category: 'Sân và chi phí',
      usage: '/chiatien',
      description: 'Chia tiền cho hai team',
      permission: 'player',
    },
    {
      name: 'taovote',
      category: 'Vote',
      usage: '/taovote [QUESTION]',
      description: 'Tạo vote tham gia',
      permission: 'admin',
    },
    {
      name: 'demvote',
      category: 'Vote',
      usage: '/demvote',
      description: 'Xem kết quả vote',
      permission: 'player',
    },
    {
      name: 'sync',
      category: 'Vote',
      usage: '/sync',
      description: 'Đồng bộ người tham gia vào bench',
      permission: 'admin',
    },
    {
      name: 'clearvote',
      category: 'Vote',
      usage: '/clearvote [confirm|cancel]',
      description: 'Đóng và xóa vote hiện tại',
      permission: 'admin',
    },
    {
      name: 'register',
      category: 'Cầu thủ',
      usage: '/register NUMBER | add NAME NUMBER | delete NUMBER',
      description: 'Đăng ký số áo; chỉ admin được thêm hoặc xóa cầu thủ',
      permission: 'player',
    },
    {
      name: 'me',
      category: 'Cầu thủ',
      usage: '/me',
      description: 'Xem thông tin của bạn',
      permission: 'player',
    },
    {
      name: 'match',
      category: 'Trận đấu',
      usage: '/match ACTION [ARGS]',
      description: 'Xem trận đấu; chỉ admin được thay đổi',
      permission: 'player',
    },
    {
      name: 'matches',
      category: 'Trận đấu',
      usage: '/matches [LIMIT] [PAGE]',
      description: 'Xem các trận gần đây',
      permission: 'player',
    },
    {
      name: 'reset',
      category: 'Admin',
      usage: '/reset',
      description: 'Reset toàn bộ dữ liệu trận kế tiếp',
      permission: 'admin',
    },
  ].map(entry =>
    Object.freeze({
      ...entry,
      aliases: Object.freeze([...(entry.aliases || [])]),
    })
  )
);

function listSupportedCommandNames() {
  return COMMAND_MANIFEST.flatMap(entry => [
    `/${entry.name}`,
    ...entry.aliases.map(alias => `/${alias}`),
  ]);
}

function getCommandManifestEntry(name) {
  const normalized = String(name ?? '')
    .trim()
    .replace(/^\//, '')
    .toLowerCase();

  return (
    COMMAND_MANIFEST.find(
      entry => entry.name === normalized || entry.aliases.includes(normalized)
    ) || null
  );
}

module.exports = {
  COMMAND_MANIFEST,
  getCommandManifestEntry,
  listSupportedCommandNames,
};
