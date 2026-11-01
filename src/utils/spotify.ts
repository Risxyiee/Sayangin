/**
 * Utilitas kecil Spotify untuk kado "Playlist".
 */

/** Track fallback kalau pembuat kado tak mengisi link — contoh dari spesifikasi. */
export const SPOTIFY_DEFAULT_TRACK_ID = "4cOdK2wGLETKBW3PvgPWqT"

/**
 * Ekstrak trackId dari link/URI Spotify.
 *
 * Didukung:
 * - https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
 * - https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123
 * - https://open.spotify.com/intl-id/track/4cOdK2wGLETKBW3PvgPWqT
 * - spotify:track:4cOdK2wGLETKBW3PvgPWqT
 *
 * ID Spotify = 22 karakter base62. Return null kalau bukan link track valid.
 */
export function extractSpotifyTrackId(input: string): string | null {
  const match = input
    .trim()
    .match(
      /(?:open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/i
    )
  return match ? match[1] : null
}
