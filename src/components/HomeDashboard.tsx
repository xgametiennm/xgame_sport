import React from 'react';
import { usePickleball } from '../context/PickleballContext';
import { Player } from '../types/pickleball';
import { HomeDashboardDesktop } from './HomeDashboardDesktop';
import { HomeDashboardMobile } from './HomeDashboardMobile';

interface HomeDashboardProps {
  onOpenRecordMatch: () => void;
  onOpenSettings: () => void;
  onSelectPlayer: (player: Player) => void;
  onOpenPlayMenu: () => void;
  onCreateClub: () => void;
  onJoinClub: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = (props) => {
  const { viewMode } = usePickleball();

  if (viewMode === 'mobile') {
    return <HomeDashboardMobile {...props} />;
  }

  return <HomeDashboardDesktop {...props} />;
};
