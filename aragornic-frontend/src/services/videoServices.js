// src/services/videoService.js

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Fetch all videos
export const fetchVideos = async () => {
  const response = await axios.get(`${API_BASE_URL}/videos`);
  return response.data.videos;
};

// Add a new video
export const addVideo = async (video) => {
  const response = await axios.post(`${API_BASE_URL}/videos`, video);
  return response.data;
};

// Update an existing video
export const editVideo = async (id, updatedVideo) => {
  const response = await axios.put(`${API_BASE_URL}/videos/${id}`, updatedVideo);
  return response.data;
};

// Delete a video
export const removeVideo = async (id) => {
  const response = await axios.delete(`${API_BASE_URL}/videos/${id}`);
  return response.data;
};

// Schedule a video post
export const schedulePost = async (id, scheduleTime) => {
  const response = await axios.post(`${API_BASE_URL}/videos/${id}/schedule`, { schedule_time: scheduleTime });
  return response.data;
};
