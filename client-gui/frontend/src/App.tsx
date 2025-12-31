import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import UploadPage from './pages/Upload';
import ServersPage from './pages/Servers';
import KeysPage from './pages/Keys';
import HistoryPage from './pages/History';
import WatchPage from './pages/Watch';
import SchedulePage from './pages/Schedule';
import './style.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<UploadPage />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="keys" element={<KeysPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="watch" element={<WatchPage />} />
          <Route path="schedule" element={<SchedulePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
