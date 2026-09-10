const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createCommandRegistry } = require('../core/commands/command-registry');
const { createCommandRouter } = require('../core/commands/command-router');
const { createStateRepository } = require('../core/ports/state-repository');
const {
  createZaloBroadcastCommand,
} = require('../core/use-cases/common/zalo-broadcast-command');
const { createTelegramAdapter } = require('../platforms/telegram/adapter');
const {
  createTelegramPhotoUploadService,
} = require('../platforms/telegram/photo-upload-service');
const {
  createZaloBroadcastService,
} = require('../platforms/zalo/broadcast-service');
const { createZaloBotClient } = require('../platforms/zalo/client');

const ID = '11111111-1111-4111-8111-111111111111';

class FakeTelegramBot extends EventEmitter {
  constructor() {
    super();
    this.token = 'telegram-token';
    this.sentMessages = [];
    this.sentPhotos = [];
  }

  async sendMessage(chatId, text, options = {}) {
    this.sentMessages.push({ chatId, text, options });
    return { message_id: `telegram-${this.sentMessages.length}` };
  }

  async sendPhoto(chatId, photo, options = {}) {
    this.sentPhotos.push({ chatId, photo, options });
    return { message_id: `photo-${this.sentPhotos.length}` };
  }

  async getFile(fileId) {
    return { file_path: `photos/${fileId}.jpg` };
  }
}

function telegramText(text, overrides = {}) {
  return {
    from: { id: overrides.userId ?? 7, first_name: 'Admin' },
    chat: { id: overrides.chatId ?? -42 },
    message_thread_id: overrides.threadId ?? 9,
    text,
    ...(overrides.messageId ? { message_id: overrides.messageId } : {}),
  };
}

function telegramPhoto({
  caption = '',
  fileSize = 4,
  fileId = 'photo-1',
  ...overrides
} = {}) {
  return {
    ...telegramText('', overrides),
    caption,
    photo: [{ file_id: fileId, file_size: fileSize, width: 100, height: 100 }],
    ...('mediaGroupId' in overrides
      ? { media_group_id: overrides.mediaGroupId }
      : {}),
  };
}

function createHarness({
  permission = true,
  recipients = ['zalo-a', 'zalo-b'],
  now = Date.now,
  uploadGate = null,
  uploadError = null,
  onError = () => {},
} = {}) {
  const telegram = new FakeTelegramBot();
  const deliveries = [];
  const uploads = [];
  const drafts = new Map();
  let prepareCalls = 0;
  let claimCalls = 0;
  let uploadCalls = 0;
  const activeRecipients = [...recipients];
  const repository = {
    async prepare(input) {
      prepareCalls += 1;
      const draft = {
        id: ID,
        status: 'draft',
        total: activeRecipients.length,
        sent: 0,
        failed: 0,
        uncertain: 0,
        pending: activeRecipients.length,
        skipped: 0,
        message: input.message,
        photoUrl: input.photoUrl ?? null,
      };
      drafts.set(ID, {
        ...draft,
        source: input,
        recipients: [...activeRecipients],
      });
      return draft;
    },
    async claim(input) {
      claimCalls += 1;
      const draft = drafts.get(input.id);
      if (
        !draft ||
        draft.status !== 'draft' ||
        input.actorId !== '7' ||
        input.sourceChatId !== '-42' ||
        input.sourceThreadId !== '9'
      )
        return null;
      draft.status = 'sending';
      return draft;
    },
    async next({ id }) {
      const draft = drafts.get(id);
      const chatId = draft?.recipients.shift();
      return chatId ? { chatId } : null;
    },
    async record({ chatId, status }) {
      deliveries.push({ chatId, status });
      return true;
    },
    async finish({ id }) {
      drafts.get(id).status = 'finished';
    },
    async status({ id }) {
      return drafts.get(id) || null;
    },
    async cancel({ id, actorId, sourceChatId, sourceThreadId }) {
      const draft = drafts.get(id);
      if (
        !draft ||
        draft.status !== 'draft' ||
        actorId !== '7' ||
        sourceChatId !== '-42' ||
        sourceThreadId !== '9'
      )
        return false;
      draft.status = 'cancelled';
      return true;
    },
    async subscribers() {
      return { subscribers: [], total: 0, page: 1, pageSize: 20 };
    },
  };
  const zaloCalls = [];
  const zalo = createZaloBotClient({
    token: 'zalo-token',
    apiBaseUrl: 'https://zalo.test',
    fetcher: async (url, options) => {
      const method = url.split('/').pop();
      const body = JSON.parse(options.body);
      zaloCalls.push({ method, body });
      return {
        ok: true,
        async json() {
          return { ok: true, result: { ok: true } };
        },
      };
    },
  });
  const imageUploader = createTelegramPhotoUploadService({
    bot: telegram,
    fetcher: async () => {
      if (uploadGate) await uploadGate;
      if (uploadError) throw uploadError;
      return {
        ok: true,
        body: (async function* () {
          yield Buffer.from([0xff, 0xd8, 0xff, 0x00]);
        })(),
      };
    },
    repository: {
      async uploadImage(value) {
        uploadCalls += 1;
        uploads.push(value);
        return 'https://cdn.test/photo.jpg';
      },
    },
  });
  const service = createZaloBroadcastService({
    repository,
    client: zalo,
    imageUploader,
    sendIntervalMs: 0,
  });
  const registry = createCommandRegistry();
  registry.register(createZaloBroadcastCommand({ service }));
  const router = createCommandRouter({
    registry,
    stateRepository: createStateRepository({
      load: async () => ({}),
      save: async () => ({}),
    }),
    permissionPolicy: {
      async isAllowed() {
        return typeof permission === 'function' ? permission() : permission;
      },
    },
  });
  const adapter = createTelegramAdapter({
    bot: telegram,
    router,
    now,
    onError,
  });
  return {
    telegram,
    adapter,
    repository,
    service,
    drafts,
    deliveries,
    uploads,
    zaloCalls,
    get prepareCalls() {
      return prepareCalls;
    },
    get claimCalls() {
      return claimCalls;
    },
    get uploadCalls() {
      return uploadCalls;
    },
  };
}

test('compose menu, direct text, and multiline text preview require confirmation', async () => {
  const h = createHarness();
  await h.adapter.handleEvent(telegramText('/zalosay'));
  const menu = h.telegram.sentMessages.at(-1);
  assert.deepEqual(
    menu.options.reply_markup.inline_keyboard.map(row => row[0].text),
    ['Text', 'Image']
  );

  await h.adapter.handleAction({
    id: 'menu-text',
    data: menu.options.reply_markup.inline_keyboard[0][0].callback_data,
    from: telegramText('').from,
    message: { chat: { id: -42 }, message_thread_id: 9, message_id: 1 },
  });
  assert.match(h.telegram.sentMessages.at(-1).text, /Gửi nội dung thông báo/);
  await h.adapter.handleEvent(telegramText('menu text'));

  await h.adapter.handleEvent(telegramText('/zalosay direct text'));
  assert.equal(h.prepareCalls, 2);
  assert.match(h.telegram.sentMessages.at(-1).text, /direct text/);
  assert.equal(h.zaloCalls.length, 0);

  await h.adapter.handleEvent(telegramText('/zalosay --text'));
  await h.adapter.handleEvent(telegramText('line one\nline two'));
  assert.equal(h.prepareCalls, 3);
  assert.match(h.telegram.sentMessages.at(-1).text, /line one\nline two/);
  assert.equal(h.zaloCalls.length, 0);
});

test('image photo only and caption upload once, preview, then sendPhoto once', async () => {
  const h = createHarness({ recipients: ['zalo-a'] });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  await h.adapter.handleEvent(
    telegramPhoto({ fileId: 'photo-1', caption: 'first line\nsecond line' })
  );
  assert.equal(h.uploadCalls, 1);
  assert.equal(h.prepareCalls, 1);
  assert.equal(h.telegram.sentPhotos.length, 1);
  assert.equal(h.telegram.sentPhotos[0].photo, 'https://cdn.test/photo.jpg');
  const confirm =
    h.telegram.sentMessages.at(-1).options.reply_markup.inline_keyboard[0][0]
      .callback_data;
  await h.adapter.handleAction({
    id: 'cb-1',
    data: confirm,
    from: telegramText('').from,
    message: { chat: { id: -42 }, message_thread_id: 9, message_id: 1 },
  });
  assert.deepEqual(
    h.zaloCalls.filter(call => call.method === 'sendPhoto'),
    [
      {
        method: 'sendPhoto',
        body: {
          chat_id: 'zalo-a',
          photo: 'https://cdn.test/photo.jpg',
          caption: 'first line\nsecond line',
        },
      },
    ]
  );
  await h.adapter.handleAction({
    id: 'cb-2',
    data: confirm,
    from: telegramText('').from,
    message: { chat: { id: -42 }, message_thread_id: 9, message_id: 2 },
  });
  assert.equal(
    h.zaloCalls.filter(call => call.method === 'sendPhoto').length,
    1
  );
});

test('wrong actor, chat, thread, albums, and oversized photos do not upload or prepare', async () => {
  const h = createHarness();
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  await h.adapter.handleEvent(
    telegramPhoto({ userId: 8, fileId: 'wrong-user' })
  );
  await h.adapter.handleEvent(
    telegramPhoto({ chatId: -99, fileId: 'wrong-chat' })
  );
  await h.adapter.handleEvent(
    telegramPhoto({ threadId: 10, fileId: 'wrong-thread' })
  );
  await h.adapter.handleEvent(
    telegramPhoto({ mediaGroupId: 'album', fileId: 'album' })
  );
  await h.adapter.handleEvent({
    ...telegramText('', {}),
    document: { file_id: 'doc-1', file_size: 4 },
  });
  await h.adapter.handleEvent(
    telegramPhoto({ fileSize: 5 * 1024 * 1024 + 1, fileId: 'large' })
  );
  assert.equal(h.uploadCalls, 0);
  assert.equal(h.prepareCalls, 0);
  assert.match(h.telegram.sentMessages.at(-1).text, /5 MB/);
});

test('wrong attachment and long caption re-prompt, then a valid photo succeeds', async () => {
  const h = createHarness({ recipients: ['zalo-a'] });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  await h.adapter.handleEvent({
    ...telegramText(''),
    document: { file_id: 'doc-1', file_size: 4 },
  });
  assert.equal(h.uploadCalls, 0);
  assert.match(h.telegram.sentMessages.at(-1).text, /JPG, PNG hoặc WebP/);
  await h.adapter.handleEvent(
    telegramPhoto({ caption: 'x'.repeat(2001), fileId: 'too-long' })
  );
  assert.equal(h.uploadCalls, 0);
  assert.match(h.telegram.sentMessages.at(-1).text, /tối đa 2000/);
  await h.adapter.handleEvent(
    telegramPhoto({ caption: 'valid caption', fileId: 'valid' })
  );
  assert.equal(h.uploadCalls, 1);
  assert.equal(h.prepareCalls, 1);
});

test('duplicate concurrent photo update uploads and prepares only once', async () => {
  const h = createHarness({ recipients: ['zalo-a'] });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  const photo = telegramPhoto({
    caption: 'once',
    fileId: 'same',
    messageId: 'same-photo',
  });
  await Promise.all([
    h.adapter.handleEvent(photo),
    h.adapter.handleEvent(photo),
  ]);
  assert.equal(h.uploadCalls, 1);
  assert.equal(h.prepareCalls, 1);
});

test('pending image mode expires after ten minutes', async () => {
  let clock = 1000;
  const h = createHarness({ now: () => clock });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  clock += 10 * 60 * 1000 + 1;
  await h.adapter.handleEvent(telegramPhoto({ fileId: 'expired' }));
  assert.equal(h.uploadCalls, 0);
  assert.equal(h.prepareCalls, 0);
});

test('failed photo preview reports in the source topic, restores image input, and retries', async () => {
  const h = createHarness({ recipients: ['zalo-a'] });
  const originalSendPhoto = h.telegram.sendPhoto.bind(h.telegram);
  let rejectPhoto = true;
  h.telegram.sendPhoto = async (...args) => {
    if (rejectPhoto) {
      rejectPhoto = false;
      throw new Error('preview photo failed');
    }
    return originalSendPhoto(...args);
  };
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  await h.adapter.handleEvent(telegramPhoto({ fileId: 'first' }));
  assert.equal(h.zaloCalls.length, 0);
  assert.equal(h.telegram.sentMessages.at(-1).chatId, '-42');
  assert.equal(h.telegram.sentMessages.at(-1).options.message_thread_id, '9');
  assert.equal(
    h.telegram.sentMessages.at(-1).text,
    '❌ Có lỗi xảy ra. Vui lòng thử lại.'
  );
  await h.adapter.handleEvent(telegramPhoto({ fileId: 'retry' }));
  assert.equal(h.prepareCalls, 2);
  assert.equal(h.telegram.sentPhotos.length, 1);
});

test('failed text preview reports once and restores pending text input', async () => {
  const h = createHarness();
  const originalSendMessage = h.telegram.sendMessage.bind(h.telegram);
  let rejectPreview = true;
  h.telegram.sendMessage = async (chatId, text, options) => {
    if (rejectPreview && String(text).includes('Sẽ gửi thông báo')) {
      rejectPreview = false;
      throw new Error('preview text failed');
    }
    return originalSendMessage(chatId, text, options);
  };
  await h.adapter.handleEvent(telegramText('/zalosay --text'));
  await h.adapter.handleEvent(telegramText('retry text'));
  assert.equal(h.zaloCalls.length, 0);
  assert.equal(h.telegram.sentMessages.at(-1).chatId, '-42');
  await h.adapter.handleEvent(telegramText('retry text again'));
  assert.equal(h.prepareCalls, 2);
  assert.match(h.telegram.sentMessages.at(-1).text, /retry text again/);
});

test('late image upload failure cannot revive image mode after stop or text switch', async () => {
  let rejectUpload;
  const uploadGate = new Promise(resolve => {
    rejectUpload = resolve;
  });
  const h = createHarness({
    uploadGate,
    uploadError: Object.assign(new Error('late upload failed'), {
      code: 'IMAGE_UPLOAD_FAILED',
    }),
  });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  const pendingPhoto = h.adapter.handleEvent(telegramPhoto({ fileId: 'late' }));
  await h.adapter.handleEvent(telegramText('/zalosay --stop'));
  rejectUpload();
  await pendingPhoto;
  assert.equal(
    h.telegram.sentMessages.at(-1).text,
    'Đã hủy thông báo. Không có tin nhắn nào được gửi.'
  );
  assert.equal(h.zaloCalls.length, 0);

  let release;
  const switchGate = new Promise(resolve => {
    release = resolve;
  });
  const switched = createHarness({
    uploadGate: switchGate,
    uploadError: Object.assign(new Error('late upload failed'), {
      code: 'IMAGE_UPLOAD_FAILED',
    }),
  });
  await switched.adapter.handleEvent(telegramText('/zalosay --image'));
  const delayedPhoto = switched.adapter.handleEvent(
    telegramPhoto({ fileId: 'late-switch' })
  );
  await switched.adapter.handleEvent(telegramText('/zalosay --text'));
  await switched.adapter.handleEvent(telegramText('text survives'));
  release();
  await delayedPhoto;
  assert.match(switched.telegram.sentMessages.at(-1).text, /text survives/);
  assert.equal(switched.zaloCalls.length, 0);
});

test('stop cancels a pending draft and permission denial never uploads or sends', async () => {
  const stopBeforeUpload = createHarness();
  await stopBeforeUpload.adapter.handleEvent(telegramText('/zalosay --image'));
  await stopBeforeUpload.adapter.handleEvent(telegramText('/zalosay --stop'));
  await stopBeforeUpload.adapter.handleEvent(
    telegramPhoto({ fileId: 'stopped-before-upload' })
  );
  assert.equal(stopBeforeUpload.uploadCalls, 0);
  assert.equal(stopBeforeUpload.prepareCalls, 0);

  const h = createHarness({ recipients: ['zalo-a'] });
  await h.adapter.handleEvent(telegramText('/zalosay --image'));
  await h.adapter.handleEvent(
    telegramPhoto({ fileId: 'photo-stop', caption: 'caption' })
  );
  const cancel =
    h.telegram.sentMessages.at(-1).options.reply_markup.inline_keyboard[1][0]
      .callback_data;
  await h.adapter.handleAction({
    id: 'cb-cancel',
    data: cancel,
    from: telegramText('').from,
    message: { chat: { id: -42 }, message_thread_id: 9, message_id: 1 },
  });
  assert.equal(h.drafts.get(ID).status, 'cancelled');
  assert.equal(
    h.zaloCalls.filter(call => call.method === 'sendPhoto').length,
    0
  );

  let allowed = true;
  const denied = createHarness({ permission: () => allowed });
  await denied.adapter.handleEvent(telegramText('/zalosay --image'));
  allowed = false;
  await denied.adapter.handleEvent(telegramPhoto({ fileId: 'denied' }));
  assert.equal(denied.uploadCalls, 0);
  assert.equal(denied.prepareCalls, 0);
  assert.match(denied.telegram.sentMessages.at(-1).text, /admin/i);
});
