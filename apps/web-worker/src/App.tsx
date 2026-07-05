import { Routes, Route, Navigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { Login } from './pages/Login';
import { OpenShift } from './pages/OpenShift';
import { POS } from './pages/POS';
import { CloseShift } from './pages/CloseShift';
import { AuthGate } from './components/AuthGate';
import { currentWorkerAtom } from './atoms';

export function App() {
  const worker = useAtomValue(currentWorkerAtom);
  return (
    <AuthGate>
      <Routes>
        <Route
          path="/"
          element={worker ? <Navigate to="/pos" replace /> : <Navigate to="/login" replace />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/open-shift" element={<OpenShift />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/close-shift" element={<CloseShift />} />
      </Routes>
    </AuthGate>
  );
}
