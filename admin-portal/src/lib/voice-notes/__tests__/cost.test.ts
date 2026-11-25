/**
 * @jest-environment node
 */
import {
  billedAudioSeconds,
  estimateClassificationCostUsd,
  estimateTranscriptionCostUsd,
  roundUsd,
} from '../cost';

describe('voice-notes cost', () => {
  it('applies 10 s minimum billed audio for whisper turbo', () => {
    expect(billedAudioSeconds(3)).toBe(10);
    expect(billedAudioSeconds(10)).toBe(10);
    expect(billedAudioSeconds(30)).toBe(30);
  });

  it('estimates transcription cost with 10 s minimum', () => {
    // 10 s of $0.04/hour = 10/3600 * 0.04
    const short = estimateTranscriptionCostUsd(3);
    expect(roundUsd(short, 8)).toBe(roundUsd((10 / 3600) * 0.04, 8));

    const thirty = estimateTranscriptionCostUsd(30);
    expect(roundUsd(thirty, 8)).toBe(roundUsd((30 / 3600) * 0.04, 8));
  });

  it('estimates classification cost for gpt-oss-20b', () => {
    const cost = estimateClassificationCostUsd(700, 200);
    const expected = (700 / 1_000_000) * 0.075 + (200 / 1_000_000) * 0.3;
    expect(roundUsd(cost, 8)).toBe(roundUsd(expected, 8));
  });
});
