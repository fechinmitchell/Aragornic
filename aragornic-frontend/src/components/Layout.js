// src/components/Layout.js

import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  Container,
} from '@mui/material';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import CreateVideo from './CreateVideo';
import MyVideos from './MyVideos';

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = React.useState(0);

  React.useEffect(() => {
    // Set the current tab based on the URL path
    if (location.pathname === '/my-videos') {
      setCurrentTab(1);
    } else {
      setCurrentTab(0);
    }
  }, [location.pathname]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    if (newValue === 0) {
      navigate('/');
    } else if (newValue === 1) {
      navigate('/my-videos');
    }
  };

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#673ab7' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Aragornic AI Video Creator
          </Typography>
          {/* OpenAI API key input can be moved to a settings page or kept here if desired */}
        </Toolbar>
        {/* Tabs for navigation */}
        <Tabs value={currentTab} onChange={handleTabChange} centered>
          <Tab label="Create Video" />
          <Tab label="My Videos" />
        </Tabs>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        <Routes>
          <Route path="/" element={<CreateVideo />} />
          <Route path="/my-videos" element={<MyVideos />} />
        </Routes>
      </Container>
    </>
  );
}

export default Layout;
