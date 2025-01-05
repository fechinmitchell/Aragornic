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
  Box
} from '@mui/material';
import {
  PurpleBrainIcon,
  PurpleAirplaneIcon,
  PurpleMagicWandIcon
} from './FakeIcons'; // or replace with MUI icons directly

function App() {
  // State
  const [openAiKey, setOpenAiKey] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [script, setScript] = useState('');
  const [scriptLength, setScriptLength] = useState('1h'); // '1h' or '2h'
  const [voice, setVoice] = useState('attenborough');
  const [model, setModel] = useState('gpt35');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [costBreakdown, setCostBreakdown] = useState({
    scriptCost: 0,
    imageCost: 0,
    total: 0,
  });

  // Helpers
  const updateCost = (field, amount) => {
    const newBreakdown = { ...costBreakdown };
    newBreakdown[field] += amount;
    newBreakdown.total = newBreakdown.scriptCost + newBreakdown.imageCost;
    setCostBreakdown(newBreakdown);
  };

  // Handlers (dummy logic—replace with real API calls)
  const handleGenerateTitle = async () => {
    // Example: call your backend or directly OpenAI
    // For now, just simulating:
    const exampleTitle = 'The Rise and Fall of the Roman Empire';
    setVideoTitle(exampleTitle);
  };

  const handleGenerateImage = async () => {
    // Example: call DALL·E or your backend
    // For now, just a placeholder
    const exampleImageUrl = 'https://via.placeholder.com/1280x720?text=YouTube+Thumbnail';
    setGeneratedImageUrl(exampleImageUrl);

    // Suppose each image generation costs $0.02
    updateCost('imageCost', 0.02);
  };

  const handleModelChange = (e) => {
    const chosenModel = e.target.value;
    setModel(chosenModel);

    // Example cost logic for "estimated cost"
    let cost = 0;
    if (chosenModel === 'gpt35') cost = 0.05;
    if (chosenModel === 'gpt4') cost = 0.20;
    if (chosenModel === 'davinci') cost = 0.10;

    if (scriptLength === '2h') {
      cost += 0.05;
    }

    setEstimatedCost(cost);
  };

  const handleScriptLengthChange = (e) => {
    const length = e.target.value;
    setScriptLength(length);

    // Recompute the "estimated cost" with the selected model
    let cost = 0;
    if (model === 'gpt35') cost = 0.05;
    if (model === 'gpt4') cost = 0.20;
    if (model === 'davinci') cost = 0.10;

    if (length === '2h') {
      cost += 0.05;
    }

    setEstimatedCost(cost);
  };

  const handleGenerateScript = async () => {
    // Example: call your GPT endpoint with model + length + voice
    // For now, just a dummy script
    const exampleScript = `
      This is a sample script about ${videoTitle}.
      It covers major events in a dramatic style... 
      (Imagine this is 1-2 hours long).
    `;
    setScript(exampleScript);

    // Suppose script generation cost depends on model and length
    let scriptCost = 0.1; // e.g. $0.10
    if (model === 'gpt4') {
      scriptCost = 0.2;
    }
    if (scriptLength === '2h') {
      scriptCost += 0.1; // Additional cost for 2-hour version
    }
    updateCost('scriptCost', scriptCost);
  };

  const handleVoiceChange = (e) => {
    setVoice(e.target.value);
  };

  const handleGenerateVideo = async () => {
    // Example: call your backend to compile audio + image into a video
    alert('Pretend we generated the final video. You can now download it.');
  };

  return (
    <>
      {/* TOP BAR with OpenAI Key */}
      <AppBar position="static" sx={{ backgroundColor: '#673ab7' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Aragornic History Video Maker
          </Typography>

          {/* OpenAI Key Input */}
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
        {/* VIDEO TITLE */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Video Title
          </Typography>
          <Box display="flex" alignItems="center">
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Enter or generate a video title"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
            />
            <IconButton
              onClick={handleGenerateTitle}
              sx={{ ml: 1, backgroundColor: '#9c27b0', color: 'white' }}
            >
              <PurpleBrainIcon />
            </IconButton>
          </Box>
        </Box>

        {/* THUMBNAIL */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Thumbnail
          </Typography>
          <Card
            sx={{
              width: 320, // ~YouTube thumbnail ratio
              height: 180,
              position: 'relative',
              backgroundColor: '#f0f0f0',
            }}
          >
            {generatedImageUrl ? (
              <CardMedia
                component="img"
                image={generatedImageUrl}
                alt="Generated Thumbnail"
                sx={{ width: '100%', height: '100%' }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#aaa',
                }}
              >
                No image yet
              </Box>
            )}

            {/* Purple AI Icon in the middle to trigger generation */}
            <IconButton
              onClick={handleGenerateImage}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#9c27b0',
                color: 'white',
              }}
            >
              <PurpleBrainIcon />
            </IconButton>
          </Card>
        </Box>

        {/* SCRIPT SECTION */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Script
          </Typography>

          {/* MODEL & LENGTH & ESTIMATED COST */}
          <Grid container spacing={2} alignItems="center" mb={2}>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Model</InputLabel>
                <Select
                  value={model}
                  label="Model"
                  onChange={handleModelChange}
                >
                  <MenuItem value="gpt35">GPT-3.5 Turbo</MenuItem>
                  <MenuItem value="gpt4">GPT-4</MenuItem>
                  <MenuItem value="davinci">Davinci</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>Length</InputLabel>
                <Select
                  value={scriptLength}
                  label="Length"
                  onChange={handleScriptLengthChange}
                >
                  <MenuItem value="1h">1 Hour</MenuItem>
                  <MenuItem value="2h">2 Hours</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body1">
                Estimated Cost: ${estimatedCost.toFixed(2)}
              </Typography>
            </Grid>
          </Grid>

          {/* VOICE SELECTION */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Voice</InputLabel>
            <Select value={voice} label="Voice" onChange={handleVoiceChange}>
              <MenuItem value="attenborough">Similar to David Attenborough</MenuItem>
              <MenuItem value="freeman">Similar to Morgan Freeman</MenuItem>
              <MenuItem value="genericUK">Generic English (UK)</MenuItem>
              <MenuItem value="genericUS">Generic English (US)</MenuItem>
            </Select>
          </FormControl>

          {/* SCRIPT TEXT AREA */}
          <TextField
            fullWidth
            multiline
            rows={6}
            variant="outlined"
            placeholder="Your script will appear here..."
            value={script}
            onChange={(e) => setScript(e.target.value)}
            sx={{ mb: 2 }}
          />

          {/* GENERATE SCRIPT BUTTON */}
          <Button
            variant="contained"
            onClick={handleGenerateScript}
            startIcon={<PurpleMagicWandIcon />}
            sx={{ backgroundColor: '#9c27b0' }}
          >
            Generate Script
          </Button>
        </Box>

        {/* GENERATE VIDEO */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Compile Video
          </Typography>
          <Button
            variant="contained"
            onClick={handleGenerateVideo}
            startIcon={<PurpleBrainIcon />}
            sx={{ backgroundColor: '#9c27b0' }}
          >
            Generate Video
          </Button>
        </Box>

        {/* COST BREAKDOWN */}
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Cost Breakdown
          </Typography>
          <Typography>Script Cost: ${costBreakdown.scriptCost.toFixed(2)}</Typography>
          <Typography>Image Cost: ${costBreakdown.imageCost.toFixed(2)}</Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1 }}>
            Total: ${costBreakdown.total.toFixed(2)}
          </Typography>
        </Box>
      </Container>
    </>
  );
}

export default App;
