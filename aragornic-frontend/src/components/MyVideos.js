import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Grid, Card, CardMedia, CardContent,
  CardActions, Button, IconButton, Tooltip, CircularProgress, Snackbar,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { Delete as DeleteIcon, Schedule as ScheduleIcon, Login as LoginIcon, PhotoCamera } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { getStoredVideos, deleteVideo, updateVideo } from '../utils/localStorage';

// Use the API URL from environment variables (if needed)
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

function MyVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tiktokAuthenticated, setTiktokAuthenticated] = useState(false);
  const [tiktokAccessToken, setTiktokAccessToken] = useState('');
  const navigate = useNavigate();

  const fetchVideos = () => {
    setLoading(true);
    try {
      const storedVideos = getStoredVideos();
      setVideos(storedVideos);
    } catch (err) {
      console.error(err);
      showSnackbar('Error fetching videos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    const fetchTikTokStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/tiktok_status`, { credentials: 'include' });
        const data = await response.json();
        if (response.ok && data.authenticated) {
          setTiktokAuthenticated(true);
          setTiktokAccessToken(data.access_token);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchTikTokStatus();
  }, []);

  const handleDateChange = (date) => setSelectedDate(date);

  const handleTikTokLogin = () => {
    const client_id = process.env.REACT_APP_TIKTOK_CLIENT_ID || 'YOUR_TIKTOK_CLIENT_ID';
    const redirect_uri = `${API_URL}/tiktok_callback`;
    const response_type = 'code';
    const scope = 'video.upload';
    const state = 'random_state_string';
    const authURL = `https://open-api.tiktok.com/platform/oauth/connect/?client_key=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=${response_type}&scope=${scope}&state=${state}`;
    window.location.href = authURL;
  };

  const handleDeleteVideo = (id) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
      deleteVideo(id);
      showSnackbar('Video deleted successfully!', 'info');
      fetchVideos();
    }
  };

  const handleOpenScheduleDialog = (video) => {
    setSelectedVideo(video);
    setScheduleDateTime('');
    setOpenScheduleDialog(true);
  };

  const handleCloseScheduleDialog = () => {
    setOpenScheduleDialog(false);
    setSelectedVideo(null);
    setScheduleDateTime('');
  };

  const handleScheduleVideo = async () => {
    if (!scheduleDateTime) {
      showSnackbar('Please select a date and time.', 'warning');
      return;
    }
    if (!tiktokAuthenticated || !tiktokAccessToken) {
      showSnackbar('Please authenticate with TikTok first.', 'warning');
      return;
    }
    const selectedDateObj = new Date(selectedDate);
    const scheduledDateObj = new Date(scheduleDateTime);
    if (
      selectedDateObj.getFullYear() !== scheduledDateObj.getFullYear() ||
      selectedDateObj.getMonth() !== scheduledDateObj.getMonth() ||
      selectedDateObj.getDate() !== scheduledDateObj.getDate()
    ) {
      showSnackbar('Scheduled time must be on the selected date.', 'warning');
      return;
    }
    const updatedVideos = videos.map(video =>
      video.id === selectedVideo.id ? { ...video, scheduled_post: scheduleDateTime } : video
    );
    updateVideo(updatedVideos.find(v => v.id === selectedVideo.id));
    setVideos(updatedVideos);
    showSnackbar('Video scheduled successfully!', 'success');
    try {
      const response = await fetch(`${API_URL}/schedule_post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          scheduled_time: scheduleDateTime,
          tiktok_access_token: tiktokAccessToken,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        showSnackbar('Post scheduled on TikTok successfully!', 'success');
      } else {
        showSnackbar(data.error || 'Failed to schedule post on TikTok.', 'error');
      }
    } catch (error) {
      console.error(error);
      showSnackbar('Error scheduling post.', 'error');
    }
    handleCloseScheduleDialog();
  };

  const showSnackbar = (message, severity = 'success') => setSnackbar({ open: true, message, severity });
  const handleCloseSnackbar = () => setSnackbar(prev => ({ ...prev, open: false }));

  return (
    <>
      <AppBar position="static" sx={{ backgroundColor: '#673ab7' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Aragornic AI Video Creator
          </Typography>
          <Button component={Link} to="/" variant="outlined" color="inherit" sx={{ mr: 2 }}>
            Create Video
          </Button>
          {tiktokAuthenticated ? (
            <Typography variant="body1" sx={{ color: 'white' }}>TikTok Connected</Typography>
          ) : (
            <Button variant="outlined" color="inherit" startIcon={<LoginIcon />} onClick={handleTikTokLogin}>
              Connect TikTok
            </Button>
          )}
        </Toolbar>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>My Videos</Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>My Videos</Typography>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>Select Date to Schedule Posts</Typography>
          <Calendar onChange={handleDateChange} value={selectedDate} />
        </Box>
        {loading ? (
          <CircularProgress />
        ) : videos.length === 0 ? (
          <Typography>No videos found. Create some videos first!</Typography>
        ) : (
          <Grid container spacing={4}>
            {videos.map(video => (
              <Grid item xs={12} sm={6} md={4} key={video.id}>
                <Card>
                  {video.video_url ? (
                    <CardMedia component="video" src={video.video_url} controls height="140" />
                  ) : (
                    <CardMedia component="img" image={video.image_url} alt={video.title} height="140" />
                  )}
                  <CardContent>
                    <Typography variant="h6">{video.title}</Typography>
                    <Typography variant="body2" color="text.secondary">Topic: {video.topic}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Created on: {new Date(video.created_at).toLocaleString()}
                    </Typography>
                    {video.scheduled_post && (
                      <Typography variant="body2" color="text.secondary">
                        Scheduled for: {format(new Date(video.scheduled_post), 'PPpp')}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Tooltip title="Delete Video">
                      <IconButton onClick={() => handleDeleteVideo(video.id)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Schedule Post to TikTok">
                      <IconButton onClick={() => handleOpenScheduleDialog(video)} color="primary">
                        <ScheduleIcon />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog open={openScheduleDialog} onClose={handleCloseScheduleDialog}>
        <DialogTitle>Schedule Video Posting to TikTok</DialogTitle>
        <DialogContent>
          <TextField
            label="Select Date and Time"
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={scheduleDateTime}
            onChange={(e) => setScheduleDateTime(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScheduleDialog}>Cancel</Button>
          <Button onClick={handleScheduleVideo} variant="contained" color="primary">
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default MyVideos;
