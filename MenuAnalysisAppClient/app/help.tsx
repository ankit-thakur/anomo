import { router } from 'expo-router';
import HelpScreen from '@/components/HelpScreen';

export default function Help() {
  return <HelpScreen onClose={() => router.back()} />;
}
