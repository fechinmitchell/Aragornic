// App.js

import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  TextField,
  IconButton,
  Button,
  Grid,
  Card,
  CardMedia,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Box
} from '@mui/material';
import {
  PurpleBrainIcon,
  PurpleMagicWandIcon
} from './FakeIcons';  // or use MUI icons, e.g. @mui/icons-material

function App() {
  // State
  const [openAiKey, setOpenAiKey] = useState('');
  const [topic, setTopic] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [scriptLength, setScriptLength] = useState('1h');
  const [script, setScript] = useState('');
  const [imageSize, setImageSize] = useState('512x512');
  const [imageUrl, setImageUrl] = useState('');
  const [ttsModel, setTtsModel] = useState('21m00Tcm4TlvDq8ikWAM'); // Default voice model for ElevenLabs
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');

  // Loading states
  const [loadingTitle, setLoadingTitle] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const [fileName, setFileName] = useState('');
  const [screenSize, setScreenSize] = useState('1920x1080'); // Default to YouTube

  // (Optional) cost
  const [cost, setCost] = useState(0);

  // Generate Title
  const handleGenerateTitle = async () => {
    if (!openAiKey) {
      alert('Please enter your OpenAI API key.');
      return;
    }

    setLoadingTitle(true);
    try {
      const res = await fetch('http://localhost:5000/generate_title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          model,
          user_api_key: openAiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.title) {
        setVideoTitle(data.title);
      }
      if (data.cost) {
        setCost((prev) => prev + data.cost);
      }
    } catch (err) {
      console.error('Title generation error:', err);
    } finally {
      setLoadingTitle(false);
    }
  };

  // Generate Script
  const handleGenerateScript = async () => {
    if (!openAiKey) {
      alert('Please enter your OpenAI API key.');
      return;
    }

    setLoadingScript(true);
    try {
      const res = await fetch('http://localhost:5000/generate_script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          model,
          length: scriptLength,
          user_api_key: openAiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.script) {
        setScript(data.script);
      }
      if (data.script_cost) {
        setCost((prev) => prev + data.script_cost);
      }
    } catch (err) {
      console.error('Script generation error:', err);
    } finally {
      setLoadingScript(false);
    }
  };

  // Generate Image
  const handleGenerateImage = async () => {
    if (!openAiKey) {
      alert('Please enter your OpenAI API key.');
      return;
    }

    setLoadingImage(true);
    try {
      const prompt = `A cinematic, documentary-style scene representing ${topic}`;
      const res = await fetch('http://localhost:5000/generate_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: imageSize,
          num_images: 1,
          user_api_key: openAiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.image_url) {
        setImageUrl(data.image_url);
      }
      if (data.cost) {
        setCost((prev) => prev + data.cost);
      }
    } catch (err) {
      console.error('Image generation error:', err);
    } finally {
      setLoadingImage(false);
    }
  };

  // Generate Audio (TTS)
  const handleGenerateAudio = async () => {
    if (!elevenLabsApiKey) {
      alert('Please enter your Eleven Labs API key.');
      return;
    }
    if (!script) {
      alert('Please enter a script.');
      return;
    }

    setLoadingAudio(true); // Start loading
    try {
      const res = await fetch('http://localhost:5000/generate_audio_elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          voice_id: ttsModel,
          elevenlabs_api_key: elevenLabsApiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.audio_file_url) {
        setAudioUrl(data.audio_file_url);
      }
    } catch (err) {
      console.error('Audio generation error:', err);
    } finally {
      setLoadingAudio(false); // End loading
    }
  };

  // Create Final Video
  const handleCreateVideo = async () => {
    if (!audioUrl || !imageUrl) {
      alert('Need at least one image and an audio file.');
      return;
    }

    setLoadingVideo(true);
    try {
      const res = await fetch('http://localhost:5000/create_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          image_urls: [imageUrl],
          user_api_key: openAiKey // optional if needed for logic
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      if (data.video_url) {
        setVideoUrl(data.video_url);
      }
    } catch (err) {
      console.error('Video creation error:', err);
    } finally {
      setLoadingVideo(false);
    }
  };

  // Download Video
  const handleDownload = async () => {
    // Extract the filename from the video URL
    const filename = videoUrl.split('/').pop(); // Get the last part of the URL
    
    try {
      const response = await fetch(`http://localhost:5000/download_video/${filename}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename; // Use the same filename
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        console.error('Download failed');
      }
    } catch (error) {
      console.error('Error downloading video:', error);
    }
  };

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#673ab7' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Aragornic AI Video Creator
          </Typography>
          {/* The user's OpenAI API key */}
          <TextField
            label="OpenAI API Key"
            variant="outlined"
            size="small"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            sx={{ backgroundColor: 'white', borderRadius: 1 }}
          />
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {/* TOPIC */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Topic
          </Typography>
          <TextField
            fullWidth
            placeholder="E.g. Ancient Rome, World War II..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Box>

        {/* VIDEO TITLE */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Video Title</Typography>
          <Box display="flex" gap={2}>
            <TextField
              fullWidth
              placeholder="Generate or type in a title"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
            />
            <Button
              onClick={handleGenerateTitle}
              disabled={loadingTitle}
              startIcon={loadingTitle ? <CircularProgress size={20} /> : <PurpleMagicWandIcon />}
              sx={{ backgroundColor: '#9c27b0', color: 'white' }}
            >
              {loadingTitle ? 'Generating Title...' : 'Generate Title'}
            </Button>
          </Box>
        </Box>

        {/* MODEL & SCRIPT LENGTH */}
        <Box mb={3}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={model}
                  label="Model"
                  onChange={(e) => setModel(e.target.value)}
                >
                  <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
                  <MenuItem value="gpt-4">GPT-4</MenuItem>
                  <MenuItem value="text-davinci-003">Davinci</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Script Length</InputLabel>
                <Select
                  value={scriptLength}
                  label="Script Length"
                  onChange={(e) => setScriptLength(e.target.value)}
                >
                  <MenuItem value="1h">1 Hour</MenuItem>
                  <MenuItem value="2h">2 Hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* GENERATE SCRIPT */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Script</Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={handleGenerateScript}
            disabled={loadingScript}
            startIcon={loadingScript ? <CircularProgress size={20} /> : <PurpleMagicWandIcon />}
            sx={{ mt: 2, backgroundColor: '#9c27b0' }}
          >
            {loadingScript ? 'Generating Script...' : 'Generate Script'}
          </Button>
        </Box>

        {/* GENERATE IMAGE */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Generate Image (DALL·E)</Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Image Size</InputLabel>
            <Select
              value={imageSize}
              label="Image Size"
              onChange={(e) => setImageSize(e.target.value)}
            >
              <MenuItem value="256x256">256x256</MenuItem>
              <MenuItem value="512x512">512x512</MenuItem>
              <MenuItem value="1024x1024">1024x1024</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={handleGenerateImage}
            disabled={loadingImage}
            startIcon={loadingImage ? <CircularProgress size={20} /> : <PurpleMagicWandIcon />}
            sx={{ backgroundColor: '#9c27b0' }}
          >
            {loadingImage ? 'Generating Image...' : 'Generate Image'}
          </Button>
          {imageUrl && (
            <Card sx={{ width: 320, height: 180, mt: 2 }}>
              <CardMedia
                component="img"
                image={imageUrl}
                alt="Generated"
                sx={{ width: '100%', height: '100%' }}
              />
            </Card>
          )}
        </Box>

        {/* GENERATE AUDIO */}
        <Container sx={{ mt: 4 }}>
        {/* Eleven Labs API Key */}
        <Box mb={3}>
          <Typography variant="h6">Eleven Labs API Key</Typography>
          <TextField
            fullWidth
            placeholder="Enter your Eleven Labs API Key"
            value={elevenLabsApiKey}
            onChange={(e) => setElevenLabsApiKey(e.target.value)}
            sx={{ mb: 2 }}
          />
        </Box>

        {/* Script Input */}
        <Box mb={3}>
          <Typography variant="h6">Script</Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder="Enter your script here..."
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
        </Box>

        {/* Voice Model Selection */}
        <Box mb={3}>
          <FormControl fullWidth>
            <InputLabel>Voice Model</InputLabel>
            <Select
              value={ttsModel}
              label="Voice Model"
              onChange={(e) => setTtsModel(e.target.value)}
            >
              <MenuItem value="21m00Tcm4TlvDq8ikWAM">Rachel</MenuItem>
              <MenuItem value="29vD33N1CtxCmqQRPOHJ">Drew</MenuItem>
              {/* Add more voices as needed */}
            </Select>
          </FormControl>
        </Box>

        {/* Play Audio Button */}
        {audioUrl && (
          <Box mb={3}>
            <Typography variant="h6">Preview Audio</Typography>
            <audio controls src={audioUrl} style={{ width: '100%' }}>
              Your browser does not support the audio element.
            </audio>
          </Box>
        )}

        {/* Generate Audio Button */}
        <Box mb={3} textAlign="center">
          <Button
            variant="contained"
            onClick={handleGenerateAudio}
            disabled={loadingAudio}
            startIcon={loadingAudio ? <CircularProgress size={20} /> : <PurpleMagicWandIcon />}
            sx={{ backgroundColor: '#9c27b0' }}
          >
            {loadingAudio ? 'Generating Audio...' : 'Generate Audio'}
          </Button>
        </Box>
      </Container>

        {/* COMPILE VIDEO */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Compile Final Video</Typography>
          <Button
            variant="contained"
            onClick={handleCreateVideo}
            disabled={loadingVideo}
            startIcon={loadingVideo ? <CircularProgress size={20} /> : <PurpleMagicWandIcon />}
            sx={{ backgroundColor: '#9c27b0', mb: 2 }}
          >
            {loadingVideo ? 'Creating Video...' : 'Create Video'}
          </Button>
          {videoUrl && (
            <Box sx={{ mt: 2 }}>
              <Typography>Final Video:</Typography>
              <video controls src={videoUrl} style={{ width: '100%', maxWidth: '600px', borderRadius: '8px' }} />
            </Box>
          )}
        </Box>

        {/* DOWNLOAD BUTTON */}
        {videoUrl && (
        <Box sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="h6" gutterBottom>Download Options</Typography>
          <TextField
            label="File Name"
            placeholder="Enter file name (without extension)"
            onChange={(e) => setFileName(e.target.value)}
            sx={{ mb: 2, width: '50%' }}
          />
          <FormControl sx={{ mb: 2, width: '50%' }}>
            <InputLabel>Screen Size</InputLabel>
            <Select
              value={screenSize}
              onChange={(e) => setScreenSize(e.target.value)}
            >
              <MenuItem value="1920x1080">YouTube (16:9)</MenuItem>
              <MenuItem value="1080x1920">TikTok (9:16)</MenuItem>
              <MenuItem value="1080x1080">Square (1:1)</MenuItem>
            </Select>
          </FormControl>
          <Button
              variant="contained"
              startIcon={<PurpleMagicWandIcon />}
              sx={{ backgroundColor: '#9c27b0' }}
              onClick={handleDownload}
            >
              Download Video
            </Button>
        </Box>
      )}


        {/* COST DISPLAY */}
        <Box mb={3}>
          <Typography variant="h6">
            Total Cost: ${cost.toFixed(2)}
          </Typography>
        </Box>
      </Container>
    </>
  );
}

export default App;
