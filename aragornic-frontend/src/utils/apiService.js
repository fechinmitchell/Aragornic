// src/utils/apiService.js

// Hardcoded URLs to eliminate environment variable issues
const PROD_API_URL = 'https://aragornic.onrender.com';
const LOCAL_API_URL = 'http://localhost:5000';

/**
 * Makes an API request with fallback to localhost
 * @param {string} endpoint - API endpoint to call (without the base URL)
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Promise with the API response
 */
export const apiRequest = async (endpoint, options = {}) => {
  // First try the production endpoint with timeout
  try {
    console.log(`Trying production API at: ${PROD_API_URL}${endpoint}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${PROD_API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return await response.json();
    }
    throw new Error(`Production API returned status: ${response.status}`);
  } catch (prodError) {
    console.log('Production API failed, trying localhost...', prodError);
    
    // If production fails, try localhost
    try {
      const response = await fetch(`${LOCAL_API_URL}${endpoint}`, options);
      if (response.ok) {
        return await response.json();
      }
      throw new Error(`Local API returned status: ${response.status}`);
    } catch (localError) {
      console.log('Local API also failed', localError);
      throw new Error('Could not connect to the API. Please check your internet connection or try again later.');
    }
  }
};

// Specific API functions that use the apiRequest utility

export const generateTitle = async (topic, model, apiKey) => {
  return apiRequest('/generate_title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, model, user_api_key: apiKey })
  });
};

export const generateScript = async (topic, model, length, apiKey) => {
  return apiRequest('/generate_script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, model, length, user_api_key: apiKey })
  });
};

export const generateImages = async (prompt, imageSize, numImages, apiKey) => {
  return apiRequest('/generate_image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: imageSize,
      num_images: numImages,
      user_api_key: apiKey
    })
  });
};

export const uploadMedia = async (formData) => {
  return apiRequest('/upload_media', {
    method: 'POST',
    body: formData
  });
};

export const generateAudio = async (script, voiceId, elevenLabsApiKey) => {
  return apiRequest('/generate_audio_elevenlabs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      script,
      voice_id: voiceId,
      elevenlabs_api_key: elevenLabsApiKey
    })
  });
};

export const createVideo = async (audioUrl, mediaUrls, mediaSplitConfig, apiKey) => {
  return apiRequest('/create_video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_url: audioUrl,
      media_urls: mediaUrls,
      media_split_config: mediaSplitConfig,
      user_api_key: apiKey
    })
  });
};

export const listVoices = async (elevenLabsApiKey) => {
  return apiRequest(`/list_voices?elevenlabs_api_key=${elevenLabsApiKey}`);
};

export const generatePreviews = async (elevenLabsApiKey) => {
  return apiRequest('/generate_all_previews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ elevenlabs_api_key: elevenLabsApiKey })
  });
};

export const downloadVideo = async (filename) => {
  // This one needs special handling as it's returning a blob, not JSON
  try {
    console.log(`Trying production download from: ${PROD_API_URL}/download_video/${filename}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for downloads
    
    const response = await fetch(`${PROD_API_URL}/download_video/${filename}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return response;
    }
    throw new Error(`Production download returned status: ${response.status}`);
  } catch (prodError) {
    console.log('Production download failed, trying localhost...', prodError);
    
    try {
      const response = await fetch(`${LOCAL_API_URL}/download_video/${filename}`);
      if (response.ok) {
        return response;
      }
      throw new Error(`Local download returned status: ${response.status}`);
    } catch (localError) {
      console.log('Local download also failed', localError);
      throw new Error('Could not download the video. Please check your internet connection or try again later.');
    }
  }
};