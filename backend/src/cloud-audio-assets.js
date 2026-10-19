import { reviewedNarrations } from './reviewed-narrations.js';

export const CLOUD_AUDIO_ENV_ID = 'cloud1-d8gmw1jur6dc98110';
export const CLOUD_AUDIO_BUCKET = '636c-cloud1-d8gmw1jur6dc98110-1470332055';
export const CLOUD_AUDIO_PREFIX = 'bijiang-heritage/audio';
export const CLOUD_AUDIO_ROOT = `cloud://${CLOUD_AUDIO_ENV_ID}.${CLOUD_AUDIO_BUCKET}/${CLOUD_AUDIO_PREFIX}`;

export const cloudAudioAssets = Object.freeze(reviewedNarrations.map((narration) => {
  const filename = narration.audioUrl.split('/').at(-1);
  return Object.freeze({
    narrationId: narration.id,
    spotId: narration.spotId,
    filename,
    localUrl: narration.audioUrl,
    cloudPath: `${CLOUD_AUDIO_PREFIX}/${filename}`,
    cloudFileId: `${CLOUD_AUDIO_ROOT}/${filename}`,
  });
}));

export function buildVerifiedCloudAudioMap(report) {
  if (report?.status !== 'verified' || report.environmentId !== CLOUD_AUDIO_ENV_ID || !Array.isArray(report.files)) return new Map();
  const reported = new Map(report.files.map((item) => [item.spotId, item]));
  const complete = cloudAudioAssets.every((expected) => {
    const actual = reported.get(expected.spotId);
    return actual
      && actual.cloudFileId === expected.cloudFileId
      && actual.localSha256
      && actual.localSha256 === actual.downloadedSha256
      && Number(actual.size) > 0;
  });
  if (!complete) return new Map();
  return new Map(cloudAudioAssets.map((asset) => [asset.spotId, asset.cloudFileId]));
}
