export const PHOTO_CONFIG = {
  retentionDays: 90,
  thumbMaxSide: 400,
  jpegQuality: 75,
  maxDecodedBytes: 2 * 1024 * 1024,
  cleanupThrottleHours: 6,
  profileHistory: 20,
} as const;
