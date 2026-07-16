import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Screen } from '@/components/Screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeRouter } from '@/hooks/useSafeRouter';

// 使用相对路径，API和页面在同一域名下
const API_URL = '/api/v1';

const { width, height } = Dimensions.get('window');

// 传奇风格配色 - 暗黑奇幻风
const COLORS = {
  bg: '#0A0A0F',
  bgCard: '#12121A',
  gold: '#C9A96E',
  goldLight: '#E8D5A3',
  goldDark: '#8B7340',
  border: 'rgba(201, 169, 110, 0.2)',
  borderActive: 'rgba(201, 169, 110, 0.5)',
  text: '#EAEAEA',
  textMuted: '#555570',
  textDim: '#3A3A4A',
  error: '#FF4444',
  success: '#00FF88',
};

export default function LoginScreen() {
  const router = useSafeRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);

  // 检查是否已登录
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('game_token');
      if (savedToken) {
        // 验证token是否有效
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (response.ok) {
          setToken(savedToken);
          // 已登录，直接跳转到游戏
          router.replace('/game');
        } else {
          await AsyncStorage.removeItem('game_token');
        }
      }
    } catch {
      // ignore
    }
  };

  const handleLogin = async () => {
    setError('');
    
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/index.ts
       * 接口：POST /api/v1/auth/login
       * Body 参数：username: string, password: string
       */
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await AsyncStorage.setItem('game_token', data.token);
        await AsyncStorage.setItem('game_user', JSON.stringify(data.user));
        setToken(data.token);
        router.replace('/game');
      } else {
        setError(data.error || '登录失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (username.trim().length < 3) {
      setError('用户名至少3个字符');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password.length < 6) {
      setError('密码至少6个字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/index.ts
       * 接口：POST /api/v1/auth/register
       * Body 参数：username: string, password: string, email?: string
       */
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        await AsyncStorage.setItem('game_token', data.token);
        await AsyncStorage.setItem('game_user', JSON.stringify(data.user));
        setToken(data.token);
        router.replace('/game');
      } else {
        setError(data.error || '注册失败');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <Screen style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 标题区域 */}
          <View style={styles.header}>
            <Text style={styles.title}>传奇世界</Text>
            <Text style={styles.subtitle}>AI时代 - 致敬经典</Text>
            <View style={styles.divider} />
          </View>

          {/* 表单区域 */}
          <View style={styles.form}>
            {/* 用户名 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>角色名</Text>
              <TextInput
                style={styles.input}
                placeholder="输入你的角色名"
                placeholderTextColor={COLORS.textDim}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* 密码 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>密码</Text>
              <TextInput
                style={styles.input}
                placeholder="输入密码"
                placeholderTextColor={COLORS.textDim}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            {/* 注册模式额外字段 */}
            {mode === 'register' && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>确认密码</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="再次输入密码"
                    placeholderTextColor={COLORS.textDim}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>邮箱（可选）</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="输入邮箱用于找回密码"
                    placeholderTextColor={COLORS.textDim}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>
              </>
            )}

            {/* 错误提示 */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* 提交按钮 */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.bg} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'login' ? '进入传奇世界' : '创建角色'}
                </Text>
              )}
            </TouchableOpacity>

            {/* 切换模式 */}
            <TouchableOpacity style={styles.switchButton} onPress={switchMode} disabled={loading}>
              <Text style={styles.switchText}>
                {mode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 底部信息 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>经典战法道三职业</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerText}>打怪爆装升级</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerText}>AI智能世界</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  inner: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.gold,
    letterSpacing: 8,
    textShadowColor: 'rgba(201, 169, 110, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 12,
    letterSpacing: 4,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.gold,
    marginTop: 20,
    opacity: 0.5,
  },
  form: {
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.bg,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: COLORS.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 48,
    gap: 8,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textDim,
    letterSpacing: 1,
  },
  footerDot: {
    fontSize: 11,
    color: COLORS.goldDark,
  },
});
