/**
 * The signed-in member, as little of them as possible: id and handle.
 *
 * Mirrors Runtime/Identity/TygaZenSession.cs. Deliberately NOT a profile cache —
 * a game that wants more should ask the game center, so there is one source of
 * truth for what a member looks like and a stale copy cannot outlive a rename.
 */
const KEY = 'tygazen.session';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }   // private mode, blocked storage: a guest, not a crash
}

export const Session = {
  get player() { return read(); },
  get isGuest() { return read() === null },
  signIn(player) {
    try { localStorage.setItem(KEY, JSON.stringify({ id: player.id, handle: player.handle })); } catch {}
  },
  signOut() { try { localStorage.removeItem(KEY); } catch {} }
};
