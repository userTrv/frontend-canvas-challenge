import { SpacePage } from './canvas/SpacePage';
import { SpacePicker } from './spaces/SpacePicker';
import { useSpaceRoute } from './spaces/useSpaceRoute';

export function App() {
  const { spaceId, openSpace, closeSpace } = useSpaceRoute();
  return spaceId ? (
    <SpacePage key={spaceId} spaceId={spaceId} onClose={closeSpace} />
  ) : (
    <SpacePicker onOpen={openSpace} />
  );
}
