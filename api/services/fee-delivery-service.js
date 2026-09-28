const { createHash } = require('crypto');
const { db } = require('../db/config');

class FeeDeliveryError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function todayInVietnam(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function requireId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new FeeDeliveryError('INVALID_ID');
  }
  return id;
}

function requireText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new FeeDeliveryError(`INVALID_${field}`);
  return text;
}

function validateRecipients(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new FeeDeliveryError('INVALID_RECIPIENTS');
  }
  const seen = new Set();
  return value.map((row, index) => {
    const userId = requireId(row?.userId);
    const amount = Number(row?.amount);
    if (
      seen.has(userId) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      amount > 999_999_999
    ) {
      throw new FeeDeliveryError('INVALID_RECIPIENTS');
    }
    seen.add(userId);
    if (!['HOME', 'AWAY'].includes(row.team)) {
      throw new FeeDeliveryError('INVALID_RECIPIENTS');
    }
    const name = requireText(row.name, 'RECIPIENT_NAME');
    if (name.length > 100) throw new FeeDeliveryError('INVALID_RECIPIENT_NAME');
    return {
      index: index + 1,
      userId,
      name,
      team: row.team,
      amount,
    };
  });
}

function createFeeDeliveryService({ pool = db, now = () => new Date() } = {}) {
  async function listAccounts() {
    const { rows } = await pool.query(`
      SELECT a.id, a.host_id AS "hostId", h.display_name AS "hostName",
             a.label, a.bank_bin AS "bankBin", a.bank_name AS "bankName",
             a.account_number AS "accountNumber", a.account_name AS "accountName",
             a.is_default AS "isDefault"
      FROM public.host_bank_accounts a
      JOIN public.host h ON h.id = a.host_id
      WHERE a.is_active AND h.is_active
      ORDER BY h.display_name, a.is_default DESC, a.id
    `);
    return rows;
  }

  async function createHost(input) {
    const name = requireText(input?.displayName, 'DISPLAY_NAME');
    if (name.length > 100) throw new FeeDeliveryError('INVALID_DISPLAY_NAME');
    const playerId = input?.playerId == null ? null : requireId(input.playerId);
    const { rows } = await pool.query(
      `INSERT INTO public.host (player_id, display_name)
       VALUES ($1, $2) RETURNING id, player_id AS "playerId", display_name AS "displayName", is_active AS "isActive"`,
      [playerId, name]
    );
    return rows[0];
  }

  async function createAccount(hostIdInput, input) {
    const hostId = requireId(hostIdInput);
    const bankBin = requireText(input?.bankBin, 'BANK_BIN');
    const accountNumber = requireText(input?.accountNumber, 'ACCOUNT_NUMBER');
    const accountName = requireText(input?.accountName, 'ACCOUNT_NAME');
    if (
      accountName.length > 100 ||
      String(input?.bankName ?? '').length > 100
    ) {
      throw new FeeDeliveryError('INVALID_BANK_ACCOUNT');
    }
    if (
      !/^\d{6}$/.test(bankBin) ||
      !/^[A-Za-z0-9]{1,19}$/.test(accountNumber)
    ) {
      throw new FeeDeliveryError('INVALID_BANK_ACCOUNT');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const host = await client.query(
        'SELECT id FROM public.host WHERE id = $1 FOR UPDATE',
        [hostId]
      );
      if (!host.rowCount) throw new FeeDeliveryError('HOST_NOT_FOUND', 404);
      if (input?.isDefault === true) {
        await client.query(
          'UPDATE public.host_bank_accounts SET is_default = FALSE, updated_at = NOW() WHERE host_id = $1 AND is_default',
          [hostId]
        );
      }
      const { rows } = await client.query(
        `INSERT INTO public.host_bank_accounts
         (host_id, label, bank_bin, bank_name, account_number, account_name, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, host_id AS "hostId", label, bank_bin AS "bankBin",
                   bank_name AS "bankName", account_number AS "accountNumber",
                   account_name AS "accountName", is_default AS "isDefault"`,
        [
          hostId,
          input?.label || null,
          bankBin,
          input?.bankName || null,
          accountNumber,
          accountName,
          input?.isDefault === true,
        ]
      );
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function prepareBatch(input) {
    const accountId = requireId(input?.accountId);
    const recipients = validateRecipients(input?.recipients);
    const createdBy = requireText(input?.createdBy, 'CREATED_BY');
    const billDate = todayInVietnam(now());
    const sourceHash = createHash('sha256')
      .update(JSON.stringify({ accountId, recipients }))
      .digest('hex');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const accountResult = await client.query(
        `SELECT a.id, a.bank_bin AS "bankBin", a.bank_name AS "bankName",
                a.account_number AS "accountNumber", a.account_name AS "accountName",
                h.display_name AS "hostName"
         FROM public.host_bank_accounts a JOIN public.host h ON h.id = a.host_id
         WHERE a.id = $1 AND a.is_active AND h.is_active`,
        [accountId]
      );
      if (!accountResult.rowCount)
        throw new FeeDeliveryError('ACCOUNT_NOT_FOUND', 404);
      const account = accountResult.rows[0];
      if (
        [account.hostName, account.bankName, account.accountName].some(
          value => String(value ?? '').length > 100
        )
      )
        throw new FeeDeliveryError('INVALID_BANK_ACCOUNT');
      const inserted = await client.query(
        `INSERT INTO public.fee_batches
         (bill_date, source_hash, account_id, account_snapshot, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (bill_date) DO NOTHING RETURNING id`,
        [billDate, sourceHash, accountId, account, createdBy]
      );
      const batchResult = await client.query(
        `SELECT id, source_hash AS "sourceHash", account_id AS "accountId",
                account_snapshot AS account, bill_date::text AS "billDate"
         FROM public.fee_batches WHERE bill_date = $1 FOR UPDATE`,
        [billDate]
      );
      const batch = batchResult.rows[0];
      if (batch.sourceHash !== sourceHash) {
        throw new FeeDeliveryError('BATCH_ALREADY_EXISTS_DIFFERENT_SPLIT', 409);
      }
      if (inserted.rowCount) {
        const dateCode = billDate.replaceAll('-', '').slice(2);
        const requestRows = recipients.map(recipient => ({
          ...recipient,
          note: `CT${dateCode}${Number(batch.id).toString(36).toUpperCase()}${String(recipient.index).padStart(2, '0')}`,
        }));
        await client.query(
          `INSERT INTO public.fee_requests
           (batch_id, request_index, telegram_user_id, display_name, team, amount, transfer_note)
           SELECT $1, (item->>'index')::integer, (item->>'userId')::bigint,
                  item->>'name', item->>'team', (item->>'amount')::integer,
                  item->>'note'
           FROM jsonb_array_elements($2::jsonb) AS elements(item)`,
          [batch.id, JSON.stringify(requestRows)]
        );
      }
      const { rows } = await client.query(
        `SELECT id, telegram_user_id::text AS "userId", display_name AS name,
                team, amount, transfer_note AS "transferNote",
                delivery_status AS status
         FROM public.fee_requests WHERE batch_id = $1 ORDER BY request_index`,
        [batch.id]
      );
      await client.query('COMMIT');
      return {
        id: batch.id,
        billDate: batch.billDate,
        account: batch.account,
        requests: rows,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function getTodayBatch() {
    const billDate = todayInVietnam(now());
    const { rows } = await pool.query(
      `SELECT b.id, b.bill_date::text AS "billDate", b.account_snapshot AS account,
              r.display_name AS name, r.amount, r.transfer_note AS "transferNote",
              r.delivery_status AS status
       FROM public.fee_batches b
       LEFT JOIN public.fee_requests r ON r.batch_id = b.id
       WHERE b.bill_date = $1 ORDER BY r.request_index`,
      [billDate]
    );
    if (!rows.length) return null;
    return {
      id: rows[0].id,
      billDate: rows[0].billDate,
      account: rows[0].account,
      requests: rows
        .filter(row => row.name != null)
        .map(row => ({
          name: row.name,
          amount: row.amount,
          transferNote: row.transferNote,
          status: row.status,
        })),
    };
  }

  async function claimRequest(idInput) {
    const id = requireId(idInput);
    const { rows } = await pool.query(
      `UPDATE public.fee_requests
       SET delivery_status = 'sending', delivery_error = NULL, updated_at = NOW()
       WHERE id = $1 AND delivery_status IN ('pending', 'failed')
       RETURNING id`,
      [id]
    );
    return { claimed: rows.length === 1 };
  }

  async function finishRequest(idInput, input) {
    const id = requireId(idInput);
    const status = input?.status;
    if (!['sent', 'failed'].includes(status))
      throw new FeeDeliveryError('INVALID_STATUS');
    const messageId = status === 'sent' ? Number(input?.messageId) : null;
    if (
      status === 'sent' &&
      (!Number.isSafeInteger(messageId) || messageId <= 0)
    ) {
      throw new FeeDeliveryError('INVALID_MESSAGE_ID');
    }
    const errorCode =
      status === 'failed'
        ? String(input?.errorCode || 'SEND_FAILED').slice(0, 100)
        : null;
    const { rows } = await pool.query(
      `UPDATE public.fee_requests
       SET delivery_status = $2, telegram_message_id = $3,
           delivery_error = $4, updated_at = NOW()
       WHERE id = $1 AND delivery_status = 'sending'
       RETURNING id`,
      [id, status, messageId, errorCode]
    );
    if (!rows.length) throw new FeeDeliveryError('REQUEST_NOT_SENDING', 409);
    return { saved: true };
  }

  return {
    listAccounts,
    createHost,
    createAccount,
    prepareBatch,
    getTodayBatch,
    claimRequest,
    finishRequest,
  };
}

module.exports = { FeeDeliveryError, createFeeDeliveryService };
