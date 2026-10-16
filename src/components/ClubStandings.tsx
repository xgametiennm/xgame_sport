import React, { useState, useEffect } from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { ClubStandingsDesktop } from './ClubStandingsDesktop';
import { ClubStandingsMobile } from './ClubStandingsMobile';
import { DuprCalculator } from './DuprCalculator';
import { Trophy, Calculator } from 'lucide-react';

interface ClubStandingsProps {
  onOpenRecordMatch: () => void;
  onSelectPlayer?: (player: Player) => void;
  initialSubTab?: 'standings' | 'calculator';
}

export const ClubStandings: React.FC<ClubStandingsProps> = ({
  onOpenRecordMatch,
  onSelectPlayer,
  initialSubTab = 'standings',
}) => {
  const { viewMode } = usePickleball();
  const [subTab, setSubTab] = useState<'standings' | 'calculator'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  return (
    <div>
      {/* Sub-tab Navigation Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '16px 16px 8px',
      }}>
        <div style={{
          display: 'inline-flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 14,
          gap: 4,
          maxWidth: '100%',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <button
            type="button"
            onClick={() => setSubTab('standings')}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: subTab === 'standings' ? '#0d5e46' : 'transparent',
              color: subTab === 'standings' ? '#ffffff' : '#64748b',
              boxShadow: subTab === 'standings' ? '0 2px 6px rgba(13,94,70,0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Trophy size={16} />
            <span>Bảng Xếp Hạng CLB</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('calculator')}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: 'none',
              fontSize: '0.86rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: subTab === 'calculator' ? '#0d5e46' : 'transparent',
              color: subTab === 'calculator' ? '#ffffff' : '#64748b',
              boxShadow: subTab === 'calculator' ? '0 2px 6px rgba(13,94,70,0.25)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Calculator size={16} />
            <span>Máy Tính Điểm DUPR</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Content */}
      {subTab === 'calculator' ? (
        <DuprCalculator />
      ) : viewMode === 'mobile' ? (
        <ClubStandingsMobile
          onOpenRecordMatch={onOpenRecordMatch}
          onSelectPlayer={onSelectPlayer}
        />
      ) : (
        <ClubStandingsDesktop
          onOpenRecordMatch={onOpenRecordMatch}
          onSelectPlayer={onSelectPlayer}
        />
      )}
    </div>
  );
};
