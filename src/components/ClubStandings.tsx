import React from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { ClubStandingsDesktop } from './ClubStandingsDesktop';
import { ClubStandingsMobile } from './ClubStandingsMobile';

interface ClubStandingsProps {
  onOpenRecordMatch: () => void;
  onSelectPlayer?: (player: Player) => void;
}

export const ClubStandings: React.FC<ClubStandingsProps> = ({
  onOpenRecordMatch,
  onSelectPlayer,
}) => {
  const { viewMode } = usePickleball();

  if (viewMode === 'mobile') {
    return (
      <ClubStandingsMobile
        onOpenRecordMatch={onOpenRecordMatch}
        onSelectPlayer={onSelectPlayer}
      />
    );
  }

  return (
    <ClubStandingsDesktop
      onOpenRecordMatch={onOpenRecordMatch}
      onSelectPlayer={onSelectPlayer}
    />
  );
};
