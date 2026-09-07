/**
 * Browser-side context sent with "add to room" requests so the server can
 * record MediaItemRoom.sourceMeta. Deliberately limited to timezone + locale;
 * the server stamps the time and nothing about location is ever collected.
 */
export function clientSubmissionContext(): { timezone?: string; locale?: string } {
  const context: { timezone?: string; locale?: string } = {}
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (timezone) context.timezone = timezone
  } catch {
    // Intl may be unavailable or throw in unusual embedders; omit the field.
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    context.locale = navigator.language
  }
  return context
}
