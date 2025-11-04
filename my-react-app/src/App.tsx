// my-react-app/src/App.tsx

import { Outlet } from 'react-router-dom';
import Chatbot from './components/Chatbot';
import './App.css';

function App() {
  return (
    <div className="app">
      <main>
        <Outlet />
      </main>
      <Chatbot />
    </div>
  );
}

export default App;