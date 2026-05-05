import { createHashRouter, RouterProvider } from 'react-router-dom';
import { HostView } from './components/HostView';
import { ProjectorPlaceholder } from './components/ProjectorPlaceholder';
import { SecureContextBlocker } from './components/SecureContextBlocker';

const router = createHashRouter([
  { path: '/', element: <HostView /> },
  { path: '/projector', element: <ProjectorPlaceholder /> },
]);

export function App() {
  return (
    <SecureContextBlocker>
      <RouterProvider router={router} />
    </SecureContextBlocker>
  );
}
