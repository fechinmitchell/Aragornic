// src/components/MyVideos.js - Fixed version with apiService

import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Grid, Card, CardMedia, CardContent,
  CardActions, Button, IconButton, Tooltip, CircularProgress, Snackbar,
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { Delete as DeleteIcon, Schedule as ScheduleIcon, Login as LoginIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { getStoredVideos, deleteVideo, updateVideo } from '../utils/localStorage';
import { apiRequest } from '../utils/apiService';

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
        const data = await apiRequest('/tiktok_status', { credentials: 'include' });
        if (data.authenticated) {
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

  const handleTikTokLogin = async () => {
    try {
      // Get client ID from production endpoint first, fall back to local if that fails
      const data = await apiRequest('/tiktok_login_url');
      window.location.href = data.auth_url;
    } catch (error) {
      showSnackbar('Error connecting to TikTok: ' + error.message, 'error');
    }
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
    
    try {
      await apiRequest('/schedule_post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: selectedVideo.id,
          scheduled_time: scheduleDateTime,
          tiktok_access_token: tiktokAccessToken,
        }),
      });
      
      // Update local state
      const updatedVideo = { ...selectedVideo, scheduled_post: scheduleDateTime };
      updateVideo(updatedVideo.id, updatedVideo);
      
      // Update the videos list
      setVideos(videos.map(video => 
        video.id === selectedVideo.id ? updatedVideo : video
      ));
      
      showSnackbar('Video scheduled successfully!', 'success');
      handleCloseScheduleDialog();
    } catch (error) {
      showSnackbar('Error scheduling post: ' + error.message, 'error');
    }
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
          {!tiktokAuthenticated && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              Please connect your TikTok account before scheduling posts.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseScheduleDialog}>Cancel</Button>
          <Button 
            onClick={handleScheduleVideo} 
            variant="contained" 
            color="primary"
            disabled={!tiktokAuthenticated || !scheduleDateTime}
          >
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default MyVideos;