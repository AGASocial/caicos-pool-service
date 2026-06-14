import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Pressable, Platform, Linking } from 'react-native';

type Props = {
  href: string;
  children: React.ReactNode;
  style?: React.ComponentProps<typeof Pressable>['style'];
};

export function ExternalLink({ href, children, style }: Props) {
  return (
    <Pressable
      style={style}
      onPress={() => {
        if (Platform.OS === 'web') {
          void Linking.openURL(href);
        } else {
          void WebBrowser.openBrowserAsync(href);
        }
      }}
    >
      {children}
    </Pressable>
  );
}
