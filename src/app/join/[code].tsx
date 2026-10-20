import { useLocalSearchParams } from 'expo-router';

import { InviteLanding } from '@/components/invite-landing';

/** pulse://join/CODE: a crew's invite link. */
export default function JoinCrewLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <InviteLanding kind="crew" code={String(code ?? '').toUpperCase()} />;
}
