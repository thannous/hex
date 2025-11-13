import { View, Text } from "react-native";

export default function AuthScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <View className="gap-4">
        <Text className="text-2xl font-bold text-primary-900">
          Authentification
        </Text>
        <Text className="text-neutral-600">Connexion via Supabase</Text>
      </View>
    </View>
  );
}
