import { useLocalSearchParams } from 'expo-router';

import { InviteLanding } from '@/components/invite-landing';

/** pulse://add/CODE: a friend's invite link. */
export default function AddFriendLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <InviteLanding kind="friend" code={String(code ?? '').toUpperCase()} />;
}
