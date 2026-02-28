import { useRef, useCallback } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { PhotoOverlayInfo } from '@/lib/photoOverlay';

const OVERLAY_COLOR = '#ea580c';
const OVERLAY_SHADOW = '#9a3412';
const MAX_CAPTURE_SIDE = 2048;
const IS_WEB = Platform.OS === 'web';

type PhotoWithOverlayProps = {
  uri: string;
  width: number;
  height: number;
  overlay: PhotoOverlayInfo;
  onCaptured: (uri: string) => void;
  onError: (err: Error) => void;
};

export function PhotoWithOverlay({ uri, width, height, overlay, onCaptured, onError }: PhotoWithOverlayProps) {
  const viewRef = useRef<View>(null);
  const captured = useRef(false);

  const capture = useCallback(() => {
    if (!viewRef.current || captured.current) return;
    captured.current = true;

    // react-native-view-shot uses findNodeHandle, which is not supported on web.
    if (IS_WEB) {
      onCaptured(uri);
      return;
    }

    const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(width, height));
    const capW = Math.round(width * scale);
    const capH = Math.round(height * scale);
    captureRef(viewRef, {
      format: 'jpg',
      quality: 0.9,
      width: capW,
      height: capH,
      result: 'tmpfile',
    })
      .then((outUri) => onCaptured(outUri))
      .catch((err) => onError(err instanceof Error ? err : new Error(String(err))));
  }, [uri, width, height, onCaptured, onError]);

  const scale = Math.min(1, MAX_CAPTURE_SIDE / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const padding = Math.max(8, w / 80);
  const fontSize = Math.min(56, Math.max(28, (w / 55) * 2));
  const lineHeight = fontSize * 1.25;

  return (
    <View
      ref={viewRef}
      style={[styles.container, { width: w, height: h }]}
      collapsable={false}
    >
      <Image
        source={{ uri }}
        style={[styles.image, { width: w, height: h }]}
        resizeMode="cover"
        onLoadEnd={capture}
      />
      <View style={[styles.overlay, { padding, top: padding, left: padding }]}>
        <Text
          style={[
            styles.text,
            {
              fontSize,
              lineHeight,
              color: OVERLAY_COLOR,
              textShadowColor: OVERLAY_SHADOW,
              textShadowOffset: { width: 1, height: 1 },
              textShadowRadius: 2,
            },
          ]}
        >
          {overlay.timestamp}
        </Text>
        {overlay.addressLines.length > 0 && (
          <Text
            style={[
              styles.text,
              {
                fontSize,
                lineHeight,
                marginTop: 4,
                color: OVERLAY_COLOR,
                textShadowColor: OVERLAY_SHADOW,
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              },
            ]}
          >
            {overlay.addressLines.join('\n')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: -10000,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  text: {
    fontWeight: '600',
  },
});
