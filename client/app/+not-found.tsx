import { View, Text, Pressable } from 'react-native';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0f' }}>
      <Text style={{ color: '#c9a96e', fontSize: 24, fontWeight: 'bold' }}>页面未找到</Text>
      <Pressable
        onPress={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
        style={{ marginTop: 20, padding: 10, backgroundColor: '#c9a96e', borderRadius: 8 }}>
        <Text style={{ color: '#0a0a0f', fontWeight: 'bold' }}>返回首页</Text>
      </Pressable>
    </View>
  );
}
