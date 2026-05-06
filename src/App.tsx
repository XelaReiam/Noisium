import { createHashRouter, RouterProvider } from 'react-router-dom';
import { HostView } from './components/HostView';
import { ProjectorView } from './components/ProjectorView';
import { SecureContextBlocker } from './components/SecureContextBlocker';

const router = createHashRouter([
  { path: '/', element: <HostView /> },
  { path: '/projector', element: <ProjectorView /> },
]);

export function App() {
  return (
    <SecureContextBlocker>
      <RouterProvider router={router} />
    </SecureContextBlocker>
  );
}
