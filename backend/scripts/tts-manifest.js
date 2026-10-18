import { reviewedNarrations } from '../src/reviewed-narrations.js';

console.log(JSON.stringify(reviewedNarrations.map((item) => ({
  id: item.id,
  text: item.transcript,
  filename: item.audioUrl.split('/').at(-1),
}))));
