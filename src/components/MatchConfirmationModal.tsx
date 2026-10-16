import React, { useState } from 'react';
import { MatchResult, Player } from '../types/pickleball';
import { usePickleball } from '../context/PickleballContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  X, 
  Trophy, 
  Send, 
  ShieldAlert,
  Info
} from 'lucide-react';

interface MatchConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchResult | null;
  initialMode?: 'view' | 'appeal';
}

export const MatchConfirmationModal: React.FC<MatchConfirmationModalProps> = ({
  isOpen,
  onClose,
  match,
  initialMode = 'view',
}) => {
  const { myPlayer, confirmMatch, appealMatch, isManager } = usePickleball();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAppealForm, setShowAppealForm] = useState(initialMode === 'appeal');
  const [appealReason, setAppealReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !match) return null;

  // Extract all participants
  const team1Players = [match.team1.player1, match.team1.player2].filter((p): p is Player => !!p);
  const team2Players = [match.team2.player1, match.team2.player2].filter((p): p is Player => !!p);
  const allParticipants = [...team1Players, ...team2Players];
  const totalCount = allParticipants.length;

  const confirmedIds = match.confirmedPlayerIds || [];
  const appeals = match.appeals || [];

  const confirmedCount = confirmedIds.filter((id) => allParticipants.some((p) => p.id === id)).length;
  const isFullyConfirmed = totalCount > 0 && confirmedCount >= totalCount;
  const hasAppeals = appeals.length > 0;

  // Check if current user is one of the participants
  const myParticipant = myPlayer ? allParticipants.find((p) => p.id === myPlayer.id) : null;
  const isMyConfirmed = myParticipant ? confirmedIds.includes(myParticipant.id) : false;
  const myAppeal = myParticipant ? appeals.find((a) => a.playerId === myParticipant.id) : null;

  const score1 = match.sets && match.sets.length > 0 ? match.sets[0].team1 : match.totalScoreTeam1;
  const score2 = match.sets && match.sets.length > 0 ? match.sets[0].team2 : match.totalScoreTeam2;

  const handleConfirm = async () => {
    if (!myParticipant && !isManager) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await confirmMatch(match.id, myParticipant?.id);
      setShowAppealForm(false);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không xác nhận được kết quả');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      setErrorMessage('Vui lòng nhập lý do kháng cáo');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await appealMatch(match.id, appealReason.trim());
      setShowAppealForm(false);
      setAppealReason('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không gửi được kháng cáo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAppealReasons = [
    'Sai tỉ số trận đấu',
    'Nhầm người đánh cặp',
    'Tôi không tham gia trận này',
    'Kết quả chưa hoàn tất',
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        border: '1px solid #e2e8f0',
      }}>
        {/* HEADER */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
              Xác Nhận Kết Quả Trận Đấu
            </h3>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
              {match.courtName || 'Sân CLB'} · {match.format === 'doubles' ? 'Đánh đôi' : 'Đánh đơn'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#e2e8f0',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#475569',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* SCORE SUMMARY CARD */}
          <div style={{
            background: 'linear-gradient(135deg, #064030, #0d5e46)',
            borderRadius: 16,
            padding: '16px 20px',
            color: '#ffffff',
            marginBottom: 20,
            boxShadow: '0 4px 12px rgba(6, 64, 48, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              {/* Team 1 */}
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase' }}>
                  Đội 1 {match.winner === 1 && '🏆 Thắng'}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 4 }}>
                  {team1Players.map((p) => p.name).join(' & ')}
                </div>
              </div>

              {/* Score pill */}
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '6px 16px',
                borderRadius: 12,
                fontFamily: 'var(--font-mono)',
                fontSize: '1.5rem',
                fontWeight: 900,
                letterSpacing: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ color: match.winner === 1 ? '#bef264' : '#e2e8f0' }}>{score1}</span>
                <span style={{ opacity: 0.4 }}>:</span>
                <span style={{ color: match.winner === 2 ? '#bef264' : '#e2e8f0' }}>{score2}</span>
              </div>

              {/* Team 2 */}
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase' }}>
                  Đội 2 {match.winner === 2 && '🏆 Thắng'}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 4 }}>
                  {team2Players.map((p) => p.name).join(' & ')}
                </div>
              </div>
            </div>
          </div>

          {/* CONFIRMATION PROGRESS STATS */}
          <div style={{
            background: hasAppeals ? '#fff1f2' : isFullyConfirmed ? '#f0fdf4' : '#f8fafc',
            border: `1.5px solid ${hasAppeals ? '#fecdd3' : isFullyConfirmed ? '#bbf7d0' : '#e2e8f0'}`,
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {hasAppeals ? (
                  <AlertTriangle size={18} color="#e11d48" />
                ) : isFullyConfirmed ? (
                  <CheckCircle2 size={18} color="#16a34a" />
                ) : (
                  <Clock size={18} color="#d97706" />
                )}
                <span style={{
                  fontSize: '0.92rem',
                  fontWeight: 900,
                  color: hasAppeals ? '#be123c' : isFullyConfirmed ? '#15803d' : '#0f172a',
                }}>
                  {hasAppeals
                    ? `Có ${appeals.length} khiếu nại / kháng cáo`
                    : isFullyConfirmed
                    ? `Hoàn tất: ${confirmedCount}/${totalCount} người đã xác nhận`
                    : `Đang chờ: ${confirmedCount}/${totalCount} người đã xác nhận`}
                </span>
              </div>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: hasAppeals ? '#be123c' : isFullyConfirmed ? '#16a34a' : '#64748b',
              }}>
                {Math.round((confirmedCount / Math.max(1, totalCount)) * 100)}%
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round((confirmedCount / Math.max(1, totalCount)) * 100)}%`,
                background: hasAppeals ? '#f43f5e' : isFullyConfirmed ? '#10b981' : '#f59e0b',
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>

            {hasAppeals && (
              <div style={{ fontSize: '0.78rem', color: '#be123c', fontWeight: 600, marginTop: 8 }}>
                ⚠️ Kết quả trận đấu đang bị tranh chấp. Ban quản trị hoặc người ghi nhận sẽ xem xét lại.
              </div>
            )}
          </div>

          {/* PARTICIPANTS LIST & STATUSES */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
              Danh Sách VĐV & Trạng Thái Xác Nhận
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allParticipants.map((player) => {
                const isConfirmed = confirmedIds.includes(player.id);
                const playerAppeal = appeals.find((a) => a.playerId === player.id);
                const isMe = myPlayer?.id === player.id;
                const isTeam1 = team1Players.some((p) => p.id === player.id);

                return (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isMe ? '#f0fdf4' : '#ffffff',
                      border: isMe ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src={player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`}
                        alt=""
                        style={{ width: 34, height: 34, borderRadius: '50%', background: '#f1f5f9' }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                            {player.name}
                          </span>
                          {isMe && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}>
                              Bạn
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {isTeam1 ? 'Đội 1' : 'Đội 2'} · DUPR: {player.doublesRating.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {playerAppeal ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            borderRadius: 999,
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                          }}>
                            <AlertTriangle size={12} />
                            Đã kháng cáo
                          </span>
                          <div style={{ fontSize: '0.72rem', color: '#b91c1c', marginTop: 2, maxWidth: 200, wordBreak: 'break-word' }}>
                            "{playerAppeal.reason}"
                          </div>
                        </div>
                      ) : isConfirmed ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                        }}>
                          <CheckCircle2 size={13} />
                          Đã xác nhận
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 10px',
                          borderRadius: 999,
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          background: '#f1f5f9',
                          color: '#64748b',
                        }}>
                          <Clock size={12} />
                          Chờ xác nhận
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTION SECTION FOR PARTICIPANT OR MANAGER */}
          {errorMessage && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fee2e2',
              color: '#b91c1c',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: 16,
            }}>
              {errorMessage}
            </div>
          )}

          {myParticipant ? (
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
                Hành động của bạn ({myParticipant.name}):
              </div>

              {showAppealForm ? (
                <form onSubmit={handleAppealSubmit}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Lý do kháng cáo kết quả trận đấu:
                    </label>
                    <textarea
                      value={appealReason}
                      onChange={(e) => setAppealReason(e.target.value)}
                      placeholder="Ghi rõ lý do (ví dụ: Tỉ số thực tế là 11-9 chứ không phải 11-5, người đánh cặp bị ghi nhầm...)"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  {/* Quick Suggestions */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {quickAppealReasons.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setAppealReason(reason)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        + {reason}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="submit"
                      disabled={isSubmitting || !appealReason.trim()}
                      className="btn-primary"
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        background: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <Send size={15} />
                      {isSubmitting ? 'Đang gửi...' : 'Gửi Kháng Cáo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAppealForm(false)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {isMyConfirmed ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#ecfdf5',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: '1px solid #a7f3d0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontSize: '0.82rem', fontWeight: 800 }}>
                        <CheckCircle2 size={16} />
                        Bạn đã xác nhận kết quả trận đấu này
                      </div>
                      <button
                        onClick={() => setShowAppealForm(true)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#dc2626',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Kháng cáo nếu phát hiện sai
                      </button>
                    </div>
                  ) : myAppeal ? (
                    <div style={{
                      background: '#fef2f2',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #fecaca',
                    }}>
                      <div style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 800, marginBottom: 4 }}>
                        ⚠️ Bạn đã gửi kháng cáo: "{myAppeal.reason}"
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 10 }}>
                        Quản trị viên CLB đã nhận được thông báo khiếu nại của bạn.
                      </div>
                      <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="btn-primary"
                        style={{
                          padding: '8px 14px',
                          borderRadius: 8,
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          background: '#059669',
                        }}
                      >
                        {isSubmitting ? 'Đang xử lý...' : '✓ Rút khiếu nại & Xác nhận kết quả'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="btn-primary"
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 12,
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                        }}
                      >
                        <CheckCircle2 size={18} />
                        {isSubmitting ? 'Đang xác nhận...' : 'Xác Nhận Kết Quả'}
                      </button>
                      <button
                        onClick={() => setShowAppealForm(true)}
                        style={{
                          padding: '12px 18px',
                          borderRadius: 12,
                          border: '1.5px solid #fca5a5',
                          background: '#fff1f2',
                          color: '#dc2626',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <AlertTriangle size={16} />
                        Kháng Cáo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Info size={16} color="#94a3b8" />
              <span>
                {isManager 
                  ? 'Bạn đang xem với tư cách Quản trị viên CLB. Chỉ các VĐV tham gia trận đấu mới có quyền trực tiếp xác nhận hoặc kháng cáo.'
                  : 'Bạn không nằm trong danh sách thi đấu của trận này.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
