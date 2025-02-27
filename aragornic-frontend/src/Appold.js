import React, { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  TextField,
  Button,
  Grid,
  Card,
  CardMedia,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
  RadioGroup,
  FormControlLabel,
  Radio,
  InputAdornment
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import { FaMagic } from 'react-icons/fa'; // Importing magic wand icon from react-icons
import DeleteIcon from '@mui/icons-material/Delete';
import UploadIcon from '@mui/icons-material/Upload';

function App() {
  /*******************************
   * 1) Word Count & Duration
   *******************************/
  const getWordCount = (text) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const estimateScriptDuration = (text, wpm = 150) => {
    const words = getWordCount(text);
    const totalMinutes = words / wpm;
    const fullMinutes = Math.floor(totalMinutes);
    const leftoverSeconds = Math.round((totalMinutes - fullMinutes) * 60);
    return { fullMinutes, leftoverSeconds };
  };

  /*******************************
   * 2) Approximate Token Calculation
   *******************************/
  // Simple rule of thumb: ~1 token per 0.75 words => tokens = words * (1 / 0.75) = words * 1.33
  const approximateTokens = (text) => {
    const words = getWordCount(text);
    return Math.round(words / 0.75); // or Math.round(words * 1.33)
  };

  /*******************************
   * STATE VARIABLES
   *******************************/
  const [openAiKey, setOpenAiKey] = useState('');
  const [topic, setTopic] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [scriptLength, setScriptLength] = useState('1h'); // Default to 1 hour
  const [script, setScript] = useState('');
  const [imageSize, setImageSize] = useState('512x512');
  const [ttsModel, setTtsModel] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);

  // Loading states
  const [loadingTitle, setLoadingTitle] = useState(false);
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Media files
  const [mediaFiles, setMediaFiles] = useState([]); // To store uploaded media URLs

  // Segmentation configuration
  const [splitType, setSplitType] = useState('equal'); // 'equal' or 'custom'
  const [durationPerMedia, setDurationPerMedia] = useState(''); // In seconds (for custom split)

  // File name, screen size, cost
  const [fileName, setFileName] = useState('');
  const [screenSize, setScreenSize] = useState('1920x1080');
  const [cost, setCost] = useState(0);

  /*******************************
   * Duration & Token Estimates
   *******************************/
  const { fullMinutes, leftoverSeconds } = estimateScriptDuration(script);
  const scriptTokens = approximateTokens(script);

  /*******************************
   * AUTO-SET FILE NAME WHEN VIDEO TITLE IS READY
   *******************************/
  useEffect(() => {
    // If we have a new videoUrl, a videoTitle, and the user hasn't typed a fileName yet,
    // set the fileName to a sanitized version of videoTitle.
    if (videoUrl && videoTitle && !fileName) {
      const sanitized = videoTitle.replace(/[^a-zA-Z0-9_\-]+/g, '_');
      setFileName(sanitized);
    }
  }, [videoUrl, videoTitle, fileName]);

  /*******************************
   * 1) Generate Title
   *******************************/
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
        body: JSON.stringify({ topic, model, user_api_key: openAiKey })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setVideoTitle(data.title || '');
      if (data.cost) setCost((prev) => prev + data.cost);
    } catch (err) {
      console.error('Title generation error:', err);
      alert('Error generating title.');
    } finally {
      setLoadingTitle(false);
    }
  };

  /*******************************
   * 2) Generate Script
   *******************************/
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
      setScript(data.script || '');
      if (data.script_cost) setCost((prev) => prev + data.script_cost);
    } catch (err) {
      console.error('Script generation error:', err);
      alert('Error generating script.');
    } finally {
      setLoadingScript(false);
    }
  };

  /*******************************
   * 3) Generate Images
   *******************************/
  const handleGenerateImages = async () => {
    if (!openAiKey) {
      alert('Please enter your OpenAI API key.');
      return;
    }
    setLoadingImage(true);
    try {
      const prompt = `A cinematic, documentary-style scene representing ${topic}. Scenic, photorealistic, no text, no words, no lettering.`;
      const res = await fetch('http://localhost:5000/generate_image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image_size: imageSize,
          num_images: 3, // Generate multiple images
          user_api_key: openAiKey
        })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setMediaFiles((prev) => [...prev, ...data.image_urls]);
      if (data.cost) setCost((prev) => prev + data.cost);
    } catch (err) {
      console.error('Image generation error:', err);
      alert('Error generating images.');
    } finally {
      setLoadingImage(false);
    }
  };

  /*******************************
   * 4) Fetching Voices
   *******************************/
  const fetchVoices = async () => {
    if (!elevenLabsApiKey) {
      alert('Please enter your Eleven Labs API key.');
      return;
    }
    try {
      const res = await fetch(
        `http://localhost:5000/list_voices?elevenlabs_api_key=${elevenLabsApiKey}`
      );
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      console.log('Voices fetched:', data.voices);
      setAvailableVoices(data.voices || []);
    } catch (err) {
      console.error('Error fetching voices:', err);
      alert('Error fetching voices.');
    }
  };

  useEffect(() => {
    if (elevenLabsApiKey) {
      fetchVoices();
    }
  }, [elevenLabsApiKey]);

  // Auto-select the first voice if availableVoices is non-empty and ttsModel is still empty
  useEffect(() => {
    if (availableVoices.length > 0 && !ttsModel) {
      console.log('First voice object:', availableVoices[0]);
      setTtsModel(availableVoices[0].voice_id);
      console.log('Auto-selected voice:', availableVoices[0].voice_id);
    }
  }, [availableVoices, ttsModel]);

  /*******************************
   * 5) Generate Audio (TTS)
   *******************************/
  const handleGenerateAudio = async () => {
    if (!elevenLabsApiKey) {
      alert('Please enter your Eleven Labs API key.');
      return;
    }
    if (!script) {
      alert('Please enter a script.');
      return;
    }
    if (!ttsModel) {
      alert('Please select a voice.');
      return;
    }

    setLoadingAudio(true);
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
      setAudioUrl(data.audio_file_url || '');
    } catch (err) {
      console.error('Audio generation error:', err);
      alert('Error generating audio.');
    } finally {
      setLoadingAudio(false);
    }
  };

  /*******************************
   * 6) Upload Multiple Media
   *******************************/
  const handleMediaUpload = async (event) => {
    const files = event.target.files;
    if (!files.length) return;

    const formData = new FormData();
    for (let file of files) {
      formData.append('files', file);
    }

    setUploadingMedia(true);
    try {
      const res = await fetch('http://localhost:5000/upload_media', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setMediaFiles((prev) => [...prev, ...data.media_urls]);
    } catch (err) {
      console.error('Media upload error:', err);
      alert('Error uploading media.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleRemoveMedia = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /*******************************
   * 7) Create Final Video with Multiple Media
   *******************************/
  const handleCreateVideo = async () => {
    if (!audioUrl) {
      alert('Need an audio file.');
      return;
    }
    if (mediaFiles.length === 0) {
      alert('Need at least one image or video.');
      return;
    }
    setLoadingVideo(true);
    try {
      // Prepare media_split_config based on splitType
      let media_split_config = {};
      if (splitType === 'equal') {
        media_split_config = { split_type: 'equal', duration_per_media: null };
      } else if (splitType === 'custom') {
        const duration = parseFloat(durationPerMedia);
        if (isNaN(duration) || duration <= 0) {
          alert('Please enter a valid duration per media in seconds.');
          setLoadingVideo(false);
          return;
        }
        media_split_config = { split_type: 'custom', duration_per_media: duration };
      } else {
        alert('Invalid split type selected.');
        setLoadingVideo(false);
        return;
      }

      const res = await fetch('http://localhost:5000/create_video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          media_urls: mediaFiles,
          media_split_config: media_split_config,
          user_api_key: openAiKey, // If needed
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setVideoUrl(data.video_url || '');
    } catch (err) {
      console.error('Video creation error:', err);
      alert('Error creating video.');
    } finally {
      setLoadingVideo(false);
    }
  };

  /*******************************
   * 8) Download Final Video
   *******************************/
  const handleDownload = async () => {
    if (!videoUrl) {
      alert('No video URL to download.');
      return;
    }
    const filenameFromUrl = videoUrl.split('/').pop();

    try {
      const response = await fetch(`http://localhost:5000/download_video/${filenameFromUrl}`, {
        method: 'GET',
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // If user hasn't typed a filename, fallback to "final_video"
        const finalName = fileName || 'final_video';
        a.download = `${finalName}.mp4`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        console.error('Download failed');
        alert('Failed to download video.');
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      alert('Error downloading video.');
    }
  };

  /*******************************
   * 9) Generate Previews (Optional)
   *******************************/
  const handleGeneratePreviews = async () => {
    if (!elevenLabsApiKey) {
      alert('Please enter your Eleven Labs API key.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/generate_all_previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevenlabs_api_key: elevenLabsApiKey })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(data.message || 'Previews generated successfully.');
      }
    } catch (err) {
      console.error('Error generating previews:', err);
      alert('Error generating previews.');
    }
  };

  /*******************************
   * RENDER
   *******************************/
  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#673ab7' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Aragornic AI Video Creator
          </Typography>
          {/* OpenAI API key input */}
          <TextField
            label="OpenAI API Key"
            variant="outlined"
            size="small"
            value={openAiKey}
            onChange={(e) => setOpenAiKey(e.target.value)}
            sx={{ backgroundColor: 'white', borderRadius: 1 }}
            type="password"
          />
        </Toolbar>
      </AppBar>

      <Container sx={{ mt: 4 }}>
        {/* TOPIC */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>Topic</Typography>
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
              startIcon={loadingTitle ? <CircularProgress size={20} /> : <FaMagic />}
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
                  <MenuItem value="1m">1 Minute</MenuItem>
                  <MenuItem value="2m">2 Minutes</MenuItem>
                  <MenuItem value="5m">5 Minutes</MenuItem>
                  <MenuItem value="10m">10 Minutes</MenuItem>
                  <MenuItem value="20m">20 Minutes</MenuItem>
                  <MenuItem value="1h">1 Hour</MenuItem>
                  <MenuItem value="2h">2 Hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>

        {/* SCRIPT (Word Count, Duration, Approx. Tokens) */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Script</Typography>
          <TextField
            fullWidth
            multiline
            rows={8}
            value={script}
            onChange={(e) => setScript(e.target.value)}
          />
          <Box mt={2}>
            <Typography variant="body1">
              Word Count: <strong>{getWordCount(script)}</strong>
            </Typography>
            <Typography variant="body1">
              Estimated Duration:{' '}
              <strong>{fullMinutes} min {leftoverSeconds} sec</strong>
            </Typography>
            <Typography variant="body1">
              Approx. Tokens: <strong>{scriptTokens}</strong>
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleGenerateScript}
            disabled={loadingScript}
            startIcon={loadingScript ? <CircularProgress size={20} /> : <FaMagic />}
            sx={{ mt: 2, backgroundColor: '#9c27b0' }}
          >
            {loadingScript ? 'Generating Script...' : 'Generate Script'}
          </Button>
        </Box>

        {/* GENERATE IMAGES */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Generate Images (DALL·E)</Typography>
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
            onClick={handleGenerateImages}
            disabled={loadingImage}
            startIcon={loadingImage ? <CircularProgress size={20} /> : <FaMagic />}
            sx={{ backgroundColor: '#9c27b0' }}
          >
            {loadingImage ? 'Generating Images...' : 'Generate Images'}
          </Button>
          {mediaFiles.filter(url => {
            const ext = url.split('.').pop().toLowerCase().split(/\#|\?/)[0];
            return ['png', 'jpg', 'jpeg', 'gif'].includes(ext);
          }).length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle1">Generated Images:</Typography>
              <Grid container spacing={2}>
                {mediaFiles.filter(url => {
                  const ext = url.split('.').pop().toLowerCase().split(/\#|\?/)[0];
                  return ['png', 'jpg', 'jpeg', 'gif'].includes(ext);
                }).map((url, index) => (
                  <Grid item key={index}>
                    <Card sx={{ width: 200, height: 120, position: 'relative' }}>
                      <CardMedia
                        component="img"
                        image={url}
                        alt={`Generated ${index + 1}`}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <Tooltip title="Remove">
                        <IconButton
                          onClick={() => handleRemoveMedia(mediaFiles.indexOf(url))}
                          sx={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>

        {/* UPLOAD MULTIPLE MEDIA */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Upload Images and Videos</Typography>
          <Button
            variant="contained"
            component="label"
            disabled={uploadingMedia}
            startIcon={<UploadIcon />}
            sx={{ backgroundColor: '#9c27b0', color: 'white' }}
          >
            {uploadingMedia ? 'Uploading...' : 'Upload Media'}
            <input
              type="file"
              hidden
              multiple
              accept="image/*,video/*"
              onChange={handleMediaUpload}
            />
          </Button>
          {mediaFiles.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle1">Uploaded Media:</Typography>
              <Grid container spacing={2}>
                {mediaFiles.map((url, index) => {
                  const ext = url.split('.').pop().toLowerCase().split(/\#|\?/)[0];
                  const isImage = ['png', 'jpg', 'jpeg', 'gif'].includes(ext);
                  const isVideo = ['mp4', 'mov', 'avi', 'mkv'].includes(ext);
                  return (
                    <Grid item key={index}>
                      <Box position="relative">
                        {isImage ? (
                          <Card sx={{ width: 200, height: 120 }}>
                            <CardMedia
                              component="img"
                              image={url}
                              alt={`Uploaded ${index + 1}`}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Card>
                        ) : isVideo ? (
                          <Card sx={{ width: 200, height: 120 }}>
                            <CardMedia
                              component="video"
                              src={url}
                              controls
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </Card>
                        ) : null}
                        <Tooltip title="Remove">
                          <IconButton
                            onClick={() => handleRemoveMedia(index)}
                            sx={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(255,255,255,0.7)' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </Box>

        {/* GENERATE AUDIO */}
        <Container sx={{ mt: 4 }}>
          <Box mb={3}>
            <Typography variant="h6">Eleven Labs API Key</Typography>
            <TextField
              fullWidth
              placeholder="Enter your Eleven Labs API Key"
              value={elevenLabsApiKey}
              onChange={(e) => setElevenLabsApiKey(e.target.value)}
              sx={{ mb: 2 }}
              type="password"
            />
            <Button
              variant="outlined"
              onClick={handleGeneratePreviews}
              sx={{ mb: 2 }}
            >
              Generate Previews
            </Button>
          </Box>

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

          <Box mb={3}>
            <FormControl fullWidth>
              <InputLabel>Voice Model</InputLabel>
              <Select
                value={ttsModel || ''}
                label="Voice Model"
                onChange={(e) => {
                  console.log('Voice selection changed to:', e.target.value);
                  setTtsModel(e.target.value);
                }}
              >
                {availableVoices.map((voice) => (
                  <MenuItem key={voice.voice_id} value={voice.voice_id}>
                    {voice.name || voice.voice_id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {!audioUrl && ttsModel && (
            <Box mb={3}>
              <Typography variant="h6">Preview of Selected Voice</Typography>
              <audio
                key={ttsModel}
                controls
                src={`/static/samples/${ttsModel}.mp3`}
                style={{ width: '100%' }}
              >
                Your browser does not support the audio element.
              </audio>
            </Box>
          )}

          {audioUrl && (
            <Box mb={3}>
              <Typography variant="h6">Preview Audio</Typography>
              <audio
                key={audioUrl}
                controls
                src={audioUrl}
                style={{ width: '100%' }}
              >
                Your browser does not support the audio element.
              </audio>
            </Box>
          )}

          <Box mb={3} textAlign="center">
            <Button
              variant="contained"
              onClick={handleGenerateAudio}
              disabled={loadingAudio}
              startIcon={loadingAudio ? <CircularProgress size={20} /> : <PhotoCamera />}
              sx={{ backgroundColor: '#9c27b0' }}
            >
              {loadingAudio ? 'Generating Audio...' : 'Generate Audio'}
            </Button>
          </Box>
        </Container>

        {/* COMPILE VIDEO */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Compile Final Video</Typography>
          <Box mb={2}>
            <FormControl component="fieldset">
              <Typography variant="subtitle1" gutterBottom>Segmentation Type</Typography>
              <RadioGroup
                row
                value={splitType}
                onChange={(e) => setSplitType(e.target.value)}
              >
                <FormControlLabel value="equal" control={<Radio />} label="Equal Segments" />
                <FormControlLabel value="custom" control={<Radio />} label="Custom Duration" />
              </RadioGroup>
            </FormControl>
            {splitType === 'custom' && (
              <TextField
                label="Duration per Media (seconds)"
                type="number"
                value={durationPerMedia}
                onChange={(e) => setDurationPerMedia(e.target.value)}
                InputProps={{
                  endAdornment: <InputAdornment position="end">s</InputAdornment>,
                }}
                sx={{ mt: 1 }}
                fullWidth
              />
            )}
          </Box>
          <Button
            variant="contained"
            onClick={handleCreateVideo}
            disabled={loadingVideo}
            startIcon={loadingVideo ? <CircularProgress size={20} /> : <PhotoCamera />}
            sx={{ backgroundColor: '#9c27b0', mb: 2 }}
          >
            {loadingVideo ? 'Creating Video...' : 'Create Video'}
          </Button>
          {videoUrl && (
            <Box sx={{ mt: 2 }}>
              <Typography>Final Video:</Typography>
              <video
                controls
                src={videoUrl}
                style={{ width: '100%', maxWidth: '600px', borderRadius: '8px' }}
              />
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
              value={fileName}
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
              startIcon={<PhotoCamera />}
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
