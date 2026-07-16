import { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/Screen';

// Game URL: use relative path, game is served from same domain
const GAME_URL = '/mir-game/';

export default function GameScreen() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  // Handle Android back button
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => subscription.remove();
  }, []);

  return (
    <Screen>
      <View style={styles.container}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingTitle}>AI 传 奇</Text>
            <Text style={styles.loadingSubtitle}>AI Legend of MIR</Text>
            <ActivityIndicator size="large" color="#FFD700" style={styles.spinner} />
            <Text style={styles.loadingText}>正在进入玛法大陆...</Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ uri: GAME_URL }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          allowsFullscreenVideo={true}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(event) => {
            console.error('WebView error:', event.nativeEvent.description);
          }}
          onHttpError={(event) => {
            console.error('HTTP error:', event.nativeEvent.statusCode, event.nativeEvent.url);
          }}
          injectedJavaScript={`
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'webviewReady' }));
            true;
          `}
          onMessage={() => {
            setLoading(false);
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    zIndex: 10,
  },
  loadingTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFD700',
    letterSpacing: 8,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 4,
    marginBottom: 40,
  },
  spinner: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#aaa',
  },
});
