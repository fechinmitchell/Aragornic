// src/App.js

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CreateVideo from './components/CreateVideo';
import MyVideos from './components/MyVideos';

function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateVideo />} />
      <Route path="/my-videos" element={<MyVideos />} />
      {/* Add more routes as needed */}
    </Routes>
  );
}

export default App;
