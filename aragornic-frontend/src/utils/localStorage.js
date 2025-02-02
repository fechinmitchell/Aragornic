// src/utils/localStorage.js

// Key under which videos will be stored
const VIDEOS_STORAGE_KEY = 'aragornic_ai_videos';

/**
 * Retrieves the list of videos from localStorage.
 * @returns {Array} Array of video objects.
 */
export const getStoredVideos = () => {
  const storedVideos = localStorage.getItem(VIDEOS_STORAGE_KEY);
  return storedVideos ? JSON.parse(storedVideos) : [];
};

/**
 * Saves a new video to localStorage.
 * @param {Object} video - The video object to store.
 */
export const storeVideo = (video) => {
  const videos = getStoredVideos();
  videos.unshift(video); // Add new video to the beginning
  localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
};

/**
 * Updates an existing video in localStorage.
 * @param {String} id - The unique ID of the video.
 * @param {Object} updatedVideo - The video object with updated data.
 */
export const updateVideo = (id, updatedVideo) => {
  let videos = getStoredVideos();
  videos = videos.map((video) => (video.id === id ? { ...video, ...updatedVideo } : video));
  localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
};

/**
 * Deletes a video from localStorage.
 * @param {String} id - The unique ID of the video.
 */
export const deleteVideo = (id) => {
  let videos = getStoredVideos();
  videos = videos.filter((video) => video.id !== id);
  localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
};


