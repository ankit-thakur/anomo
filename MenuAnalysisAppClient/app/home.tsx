import { useLocalSearchParams } from 'expo-router';
import HomeScreen from '@/components/HomeScreenV2'; // swap to HomeScreen to revert
// import HomeScreen from '@/components/HomeScreen'; // swap to HomeScreen to revert

export default function Index() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();

  placeId ? console.log(`Place ID: ${placeId}`) : console.log('No Place ID');

  return (
    <HomeScreen
      placeId={placeId as string | undefined}
    />
  );
}
