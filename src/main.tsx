import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Earlier versions kept club data and the login token in localStorage. Everything now
// lives on the server, so remove what those versions left behind in this browser.
try {
  [
    'xgame_pickleball_players_v4',
    'xgame_pickleball_matches_v4',
    'xgame_pickleball_clubs_v1',
    'xgame_pickleball_auth_user_v2',
    'xgame_selected_club_id',
    'xgame_play_session_v1',
    'xgame_view_mode',
    'xgame_token',
  ].forEach((key) => localStorage.removeItem(key))
} catch {
  // storage unavailable: nothing to clean up
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
