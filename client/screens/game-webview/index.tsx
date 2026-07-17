import { useRef, useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, BackHandler, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { Screen } from '@/components/Screen';

// 游戏URL - 使用后端基础URL
const GAME_URL = `${process.env.EXPO_PUBLIC_BACKEND_BASE_URL || ''}/mir-game/`;

export default function GameWebView() {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);

  // Android返回键处理
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false; // 退出应用
      });
      return () => backHandler.remove();
    }
  }, [canGoBack]);

  if (error) {
    return (
      <Screen>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>无法连接到游戏服务器</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <Text style={styles.retryHint}>请检查网络连接后重试</Text>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: GAME_URL }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // 允许加载本地资源
        allowFileAccess={true}
        // 允许混合内容
        mixedContentMode="compatibility"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || '加载失败');
          setLoading(false);
        }}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
        }}
        // 允许WebSocket连接
        onShouldStartLoadWithRequest={(request) => {
          return true;
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#C9A96E" />
            <Text style={styles.loadingText}>正在加载传奇世界...</Text>
          </View>
        )}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#C9A96E" />
          <Text style={styles.loadingText}>正在加载传奇世界...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0F',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
  },
  loadingText: {
    color: '#C9A96E',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorDetail: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryHint: {
    color: '#C9A96E',
    fontSize: 14,
  },
});
