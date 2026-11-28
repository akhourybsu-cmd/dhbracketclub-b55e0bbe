import { useNavigate } from 'react-router-dom';
import { PocketDevice } from '@/components/pocket/PocketHandheld';
import RiftwatchPage from './RiftwatchPage';

export default function RiftwatchPracticePage() {
  const navigate = useNavigate();
  const close = () => navigate('/dashboard', { replace: true, state: { focusPocketLauncher: true } });
  return (
    <PocketDevice onClose={close}>
      <RiftwatchPage practiceOnly onExitPocketGame={close} />
    </PocketDevice>
  );
}
