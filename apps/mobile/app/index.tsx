import { View, Text, Pressable } from "react-native";
import { Link } from "expo-router";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <View className="gap-4">
        <Text className="text-4xl font-bold text-primary-900">HEX Ops</Text>
        <Text className="text-lg text-primary-700">SaaS Mobile Lite</Text>

        <View className="mt-8 gap-4">
          <Link href="/auth" asChild>
            <Pressable className="bg-primary-600 px-6 py-3 rounded-lg">
              <Text className="text-white text-center font-semibold">
                Connexion
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}
