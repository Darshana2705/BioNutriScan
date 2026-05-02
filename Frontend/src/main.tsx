import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LandingPage from './components/LandingPage.tsx'

function Root() {
  const [showApp, setShowApp] = useState(() => {
    return sessionStorage.getItem('appStarted') === 'true';
  });
  const [backendURL, setBackendURL] = useState("http://127.0.0.1:5000");

  useEffect(() => {
    const fetchBackendURL = async () => {
      try {
        const response = await fetch("/backend_url.txt");
        if (response.ok) {
          const fetchedURL = (await response.text()).trim();
          if (fetchedURL) {
            setBackendURL(fetchedURL);
          }
        }
      } catch (err) {
        // Fallback to default
      }
    };
    fetchBackendURL();
  }, []);

  const handleStartApp = () => {
    setShowApp(true);
    sessionStorage.setItem('appStarted', 'true');
  };

  if (!showApp) {
    return <LandingPage onStart={handleStartApp} backendURL={backendURL} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

