import React from 'react';
import { Player } from '../types/pickleball';
import { PlayerProfileView } from './PlayerProfileView';

interface PlayerDetailModalProps {
  player: Player | null;
  onClose: () => void;
  onPlayWithPlayer?: (player: Player) => void;
}

export const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({
  player,
  onClose,
}) => {
  if (!player) return null;

  return (
    <PlayerProfileView
      player={player}
      onClose={onClose}
      isModal={true}
    />
  );
};
