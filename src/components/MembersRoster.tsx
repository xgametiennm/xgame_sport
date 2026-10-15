import React, { useState, useMemo } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { getDuprTier } from '../utils/duprCalculator';
import { 
  Plus, 
  Search, 
  ChevronRight, 
} from 'lucide-react';

interface MembersRosterProps {
  onSelectPlayer: (player: Player) => void;
}

export const MembersRoster: React.FC<MembersRosterProps> = ({ onSelectPlayer }) => {
  const { players, addNewPlayer, selectedClub } = usePickleball();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rating' | 'wins' | 'name'>('rating');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDoubles, setNewDoubles] = useState(3.5);
  const [newSingles, setNewSingles] = useState(3.2);

  const filtered = useMemo(() => {
    const list = players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      if (sortBy === 'rating') {
        return (b.doublesRating - a.doublesRating) || (b.winsDoubles - a.winsDoubles);
      }
      if (sortBy === 'wins') {
        return (b.winsDoubles - a.winsDoubles) || (b.doublesRating - a.doublesRating);
      }
      return a.name.localeCompare(b.name, 'vi');
    });
    return list;
  }, [players, search, sortBy]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addNewPlayer(newName.trim(), newDoubles, newSingles);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Không thêm được thành viên');
      return;
    }
    setNewName('');
    setShowAddModal(false);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
            Danh Sách Thành Viên
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
            {selectedClub.name} · {players.length} thành viên
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Plus size={16} />
          <span>Thêm Mới</span>
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Tìm thành viên theo tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-dark"
            style={{ paddingLeft: 38 }}
          />
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 14, top: 14 }} />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'rating' | 'wins' | 'name')}
          style={{
            padding: '11px 12px',
            borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            background: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#334155',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="rating">DUPR cao nhất</option>
          <option value="wins">Nhiều trận thắng nhất</option>
          <option value="name">Tên A-Z</option>
        </select>
      </div>

      {/* Members List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((player) => {
          const tier = getDuprTier(player.doublesRating);
          return (
            <div
              key={player.id}
              onClick={() => onSelectPlayer(player)}
              className="card card-interactive"
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderRadius: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                  src={player.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.name}`}
                  alt={player.name}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                      {player.name}
                    </span>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: player.role === 'owner' ? '#fef3c7' : player.role === 'admin' ? '#eff6ff' : '#f1f5f9',
                      color: player.role === 'owner' ? '#b45309' : player.role === 'admin' ? '#1d4ed8' : '#475569',
                      border: player.role === 'owner' ? '1px solid #fde68a' : player.role === 'admin' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    }}>
                      {player.role === 'owner' ? '👑 Chủ CLB' : player.role === 'admin' ? '🛡️ Quản trị' : 'Hội viên'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span className="badge badge-court" style={{ padding: '1px 8px', fontSize: '0.68rem' }}>
                      {tier.nameVi}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {player.matchesPlayedDoubles} trận ({player.winsDoubles} thắng)
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>DUPR Đôi</div>
                  <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#059669' }}>
                    {player.doublesRating.toFixed(3)}
                  </div>
                </div>
                <ChevronRight size={18} color="#94a3b8" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 16 }}>
              Thêm Thành Viên Mới
            </h3>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                  Họ và tên:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input-dark"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                    DUPR Đôi khởi điểm:
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="2.0"
                    max="8.0"
                    value={newDoubles}
                    onChange={(e) => setNewDoubles(parseFloat(e.target.value) || 3.0)}
                    className="input-dark mono"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                    DUPR Đơn khởi điểm:
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="2.0"
                    max="8.0"
                    value={newSingles}
                    onChange={(e) => setNewSingles(parseFloat(e.target.value) || 3.0)}
                    className="input-dark mono"
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: 8 }}>
                Lưu Thành Viên
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
