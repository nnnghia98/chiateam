'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';

interface PlayerConfig {
  id: string;
  name: string;
  subNames: string[];
  telegramHandle: string;
  jerseyNumber: number;
}

interface VenueInfo {
  date: string;
  time: string;
  venue: string;
  googleMapLink: string;
}

type EditingPlayer = {
  id: string;
  name: string;
  subNames: string;
  telegramHandle: string;
  jerseyNumber: string;
};

export default function AdminPage() {
  const [players, setPlayers] = useState<PlayerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlayer, setNewPlayer] = useState({ name: '', subNames: '', telegramHandle: '', jerseyNumber: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditingPlayer | null>(null);
  const [saving, setSaving] = useState(false);

  // Venue state
  const [venue, setVenue] = useState<VenueInfo>({ date: '', time: '', venue: '', googleMapLink: '' });
  const [venueLoading, setVenueLoading] = useState(true);
  const [venueSaving, setVenueSaving] = useState(false);
  const [venueStatus, setVenueStatus] = useState<string | null>(null);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      setPlayers(data);
    } catch (err) {
      console.error('Failed to fetch players:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVenue = useCallback(async () => {
    try {
      const res = await fetch('/api/venue');
      const data = await res.json();
      setVenue({
        date: data.date || '',
        time: data.time || '',
        venue: data.venue || '',
        googleMapLink: data.googleMapLink || '',
      });
    } catch (err) {
      console.error('Failed to fetch venue:', err);
    } finally {
      setVenueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
    fetchVenue();
  }, [fetchPlayers, fetchVenue]);

  // --- Player CRUD ---
  const handleAdd = async () => {
    if (!newPlayer.name || !newPlayer.jerseyNumber) return;
    setSaving(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlayer.name,
          subNames: newPlayer.subNames.split(',').map(s => s.trim()).filter(Boolean),
          telegramHandle: newPlayer.telegramHandle,
          jerseyNumber: parseInt(newPlayer.jerseyNumber),
        }),
      });
      if (res.ok) {
        setNewPlayer({ name: '', subNames: '', telegramHandle: '', jerseyNumber: '' });
        await fetchPlayers();
      }
    } finally { setSaving(false); }
  };

  const startEdit = (player: PlayerConfig) => {
    setEditingId(player.id);
    setEditForm({
      id: player.id,
      name: player.name,
      subNames: player.subNames.join(', '),
      telegramHandle: player.telegramHandle || '',
      jerseyNumber: String(player.jerseyNumber),
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditForm(null); };

  const handleUpdate = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const res = await fetch('/api/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          name: editForm.name,
          subNames: editForm.subNames.split(',').map(s => s.trim()).filter(Boolean),
          telegramHandle: editForm.telegramHandle,
          jerseyNumber: parseInt(editForm.jerseyNumber),
        }),
      });
      if (res.ok) { setEditingId(null); setEditForm(null); await fetchPlayers(); }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá cầu thủ này?')) return;
    try {
      const res = await fetch(`/api/players?id=${id}`, { method: 'DELETE' });
      if (res.ok) await fetchPlayers();
    } catch (err) { console.error('Delete failed:', err); }
  };

  // --- Venue ---
  const handleVenueSave = async () => {
    setVenueSaving(true);
    setVenueStatus(null);
    try {
      const res = await fetch('/api/venue', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venue),
      });
      if (res.ok) {
        setVenueStatus('Đã lưu!');
        setTimeout(() => setVenueStatus(null), 2000);
      }
    } catch (err) {
      console.error('Venue save failed:', err);
      setVenueStatus('Lỗi khi lưu');
    } finally { setVenueSaving(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f8f4', fontFamily: 'Outfit, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1b5e20, #43a047)',
        padding: '20px 32px', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '1px', margin: 0 }}>
            Quản lý trận đấu
          </h1>
          <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '2px' }}>
            Thông tin sân, cầu thủ, số áo
          </p>
        </div>
        <Link href="/" style={{
          color: 'white', textDecoration: 'none',
          padding: '8px 18px', background: 'rgba(255,255,255,0.18)',
          borderRadius: '10px', fontSize: '13px', fontWeight: 600,
        }}>
          ← Trang chủ
        </Link>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>

        {/* ==================== */}
        {/* VENUE SECTION        */}
        {/* ==================== */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px 24px',
          marginBottom: '20px', border: '1px solid rgba(46,125,50,0.1)',
          boxShadow: '0 2px 8px rgba(46,125,50,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#2e7d32', margin: 0 }}>
              Thông tin sân bóng
            </h2>
            {venueStatus && (
              <span style={{ fontSize: '12px', color: '#43a047', fontWeight: 600 }}>{venueStatus}</span>
            )}
          </div>

          {venueLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#8aaa8a' }}>Đang tải...</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>Ngày thi đấu</label>
                  <input
                    style={inputStyle}
                    placeholder="VD: 12/3, 25/12"
                    value={venue.date}
                    onChange={e => setVenue(v => ({ ...v, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Giờ thi đấu</label>
                  <input
                    style={inputStyle}
                    placeholder="VD: 19h15, 20h00"
                    value={venue.time}
                    onChange={e => setVenue(v => ({ ...v, time: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Tên sân</label>
                  <input
                    style={inputStyle}
                    placeholder="VD: Sân số 8"
                    value={venue.venue}
                    onChange={e => setVenue(v => ({ ...v, venue: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Link Google Maps</label>
                  <input
                    style={inputStyle}
                    placeholder="https://maps.google.com/..."
                    value={venue.googleMapLink}
                    onChange={e => setVenue(v => ({ ...v, googleMapLink: e.target.value }))}
                  />
                </div>
              </div>
              <button
                style={{
                  ...btnPrimary,
                  opacity: venueSaving ? 0.6 : 1,
                }}
                onClick={handleVenueSave}
                disabled={venueSaving}
              >
                {venueSaving ? 'Đang lưu...' : 'Lưu thông tin sân'}
              </button>
            </>
          )}
        </div>

        {/* ==================== */}
        {/* ADD PLAYER           */}
        {/* ==================== */}
        <div style={{
          background: 'white', borderRadius: '14px', padding: '20px 24px',
          marginBottom: '20px', border: '1px solid rgba(46,125,50,0.1)',
          boxShadow: '0 2px 8px rgba(46,125,50,0.05)',
        }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px', color: '#2e7d32' }}>
            Thêm cầu thủ mới
          </h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 150px' }}>
              <label style={labelStyle}>Tên cầu thủ</label>
              <input
                style={inputStyle}
                placeholder="Nguyễn Văn A"
                value={newPlayer.name}
                onChange={e => setNewPlayer(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div style={{ flex: '1.5 1 200px' }}>
              <label style={labelStyle}>Biệt danh (phẩy phân cách)</label>
              <input
                style={inputStyle}
                placeholder="Bravo, bravo2, Bravo3"
                value={newPlayer.subNames}
                onChange={e => setNewPlayer(p => ({ ...p, subNames: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label style={labelStyle}>Telegram</label>
              <input
                style={inputStyle}
                placeholder="@username"
                value={newPlayer.telegramHandle}
                onChange={e => setNewPlayer(p => ({ ...p, telegramHandle: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div style={{ flex: '0 0 80px' }}>
              <label style={labelStyle}>Số áo</label>
              <input
                style={{ ...inputStyle, textAlign: 'center' }}
                type="number"
                placeholder="10"
                value={newPlayer.jerseyNumber}
                onChange={e => setNewPlayer(p => ({ ...p, jerseyNumber: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button
              style={{
                ...btnPrimary,
                opacity: (!newPlayer.name || !newPlayer.jerseyNumber) ? 0.5 : 1,
                cursor: (!newPlayer.name || !newPlayer.jerseyNumber) ? 'not-allowed' : 'pointer',
              }}
              onClick={handleAdd}
              disabled={saving || !newPlayer.name || !newPlayer.jerseyNumber}
            >
              {saving ? '...' : 'Thêm'}
            </button>
          </div>
        </div>

        {/* ==================== */}
        {/* PLAYERS TABLE        */}
        {/* ==================== */}
        <div style={{
          background: 'white', borderRadius: '14px', overflow: 'hidden',
          border: '1px solid rgba(46,125,50,0.1)',
          boxShadow: '0 2px 8px rgba(46,125,50,0.05)',
        }}>
          <div style={{
            padding: '14px 24px', borderBottom: '1px solid rgba(46,125,50,0.08)',
          }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#1a2e1a', margin: 0 }}>
              Danh sách cầu thủ ({players.length})
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#8aaa8a' }}>Đang tải...</div>
          ) : players.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#8aaa8a' }}>
              <p style={{ fontSize: '15px' }}>Chưa có cầu thủ nào</p>
              <p style={{ fontSize: '13px', marginTop: '4px' }}>Thêm cầu thủ đầu tiên ở form bên trên</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(46,125,50,0.03)' }}>
                  <th style={{ ...thStyle, width: '40px' }}>#</th>
                  <th style={{ ...thStyle, width: '60px' }}>Số áo</th>
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '16px' }}>Tên</th>
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '16px' }}>Biệt danh</th>
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '16px' }}>Telegram</th>
                  <th style={{ ...thStyle, width: '110px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, idx) => (
                  <tr key={player.id} style={{ borderBottom: '1px solid rgba(46,125,50,0.05)' }}>
                    {editingId === player.id && editForm ? (
                      <>
                        <td style={tdCenter}>{idx + 1}</td>
                        <td style={tdCenter}>
                          <input
                            style={{ ...inputCompact, width: '56px', textAlign: 'center' }}
                            type="number"
                            value={editForm.jerseyNumber}
                            onChange={e => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
                          />
                        </td>
                        <td style={tdLeft}>
                          <input
                            style={{ ...inputCompact, width: '100%' }}
                            value={editForm.name}
                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          />
                        </td>
                        <td style={tdLeft}>
                          <input
                            style={{ ...inputCompact, width: '100%' }}
                            value={editForm.subNames}
                            onChange={e => setEditForm({ ...editForm, subNames: e.target.value })}
                          />
                        </td>
                        <td style={tdLeft}>
                          <input
                            style={{ ...inputCompact, width: '100%' }}
                            value={editForm.telegramHandle}
                            onChange={e => setEditForm({ ...editForm, telegramHandle: e.target.value })}
                            placeholder="@username"
                          />
                        </td>
                        <td style={tdCenter}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button style={btnSave} onClick={handleUpdate}>Lưu</button>
                            <button style={btnCancel} onClick={cancelEdit}>Huỷ</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={tdCenter}>
                          <span style={{ color: '#8aaa8a', fontSize: '13px' }}>{idx + 1}</span>
                        </td>
                        <td style={tdCenter}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #43a047, #66bb6a)',
                            color: 'white', fontWeight: 800, fontSize: '14px',
                          }}>
                            {player.jerseyNumber}
                          </span>
                        </td>
                        <td style={{ ...tdLeft, fontWeight: 600, color: '#1a2e1a' }}>{player.name}</td>
                        <td style={tdLeft}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {player.subNames.map((sub, i) => (
                              <span key={i} style={{
                                padding: '3px 10px', borderRadius: '6px',
                                background: 'rgba(46,125,50,0.08)', color: '#2e7d32',
                                fontSize: '12px', fontWeight: 500,
                              }}>
                                {sub}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={tdLeft}>
                          {player.telegramHandle && (
                            <span style={{
                              padding: '3px 10px', borderRadius: '6px',
                              background: 'rgba(25,118,210,0.08)', color: '#1565c0',
                              fontSize: '12px', fontWeight: 500,
                            }}>
                              {player.telegramHandle}
                            </span>
                          )}
                        </td>
                        <td style={tdCenter}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            <button style={btnEdit} onClick={() => startEdit(player)}>Sửa</button>
                            <button style={btnDelete} onClick={() => handleDelete(player.id)}>Xoá</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========== STYLES ========== */

const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#4a6a4a',
  display: 'block', marginBottom: '4px', textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1.5px solid rgba(46,125,50,0.15)', background: '#fafff9',
  fontSize: '14px', fontFamily: 'Outfit, sans-serif', outline: 'none',
  color: '#1a2e1a', transition: 'border-color 0.2s',
};

const inputCompact: React.CSSProperties = {
  padding: '7px 10px', borderRadius: '8px',
  border: '1.5px solid rgba(46,125,50,0.2)', background: '#fafff9',
  fontSize: '13px', fontFamily: 'Outfit, sans-serif', outline: 'none',
  color: '#1a2e1a',
};

const btnBase: React.CSSProperties = {
  padding: '8px 16px', borderRadius: '8px', border: 'none',
  fontSize: '13px', fontWeight: 600, fontFamily: 'Outfit, sans-serif',
  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  padding: '10px 24px', borderRadius: '10px',
  background: 'linear-gradient(135deg, #43a047, #66bb6a)',
  color: 'white', fontSize: '14px',
};

const btnEdit: React.CSSProperties = {
  ...btnBase, background: '#e3f2fd', color: '#1565c0',
};

const btnDelete: React.CSSProperties = {
  ...btnBase, background: '#fce4ec', color: '#c62828',
};

const btnSave: React.CSSProperties = {
  ...btnBase, background: '#e8f5e9', color: '#2e7d32',
};

const btnCancel: React.CSSProperties = {
  ...btnBase, background: '#f5f5f5', color: '#616161',
};

const thStyle: React.CSSProperties = {
  padding: '12px 12px', fontSize: '11px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6a8a6a',
  textAlign: 'center', borderBottom: '1px solid rgba(46,125,50,0.08)',
};

const tdCenter: React.CSSProperties = {
  padding: '12px 12px', fontSize: '14px', textAlign: 'center', verticalAlign: 'middle',
};

const tdLeft: React.CSSProperties = {
  padding: '12px 20px', fontSize: '14px', textAlign: 'left', verticalAlign: 'middle',
};
