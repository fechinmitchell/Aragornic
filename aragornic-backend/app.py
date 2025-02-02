"""
app.py

Flask server that uses the user-provided OpenAI API key in each request.
Handles multiple media uploads, video creation, TikTok OAuth authentication,
and scheduling of video posts via Celery.
"""

from flask import Flask, request, jsonify, send_from_directory, redirect, session, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
import openai
import requests
import os
import uuid
import io
from urllib.parse import urlparse, urlencode
from pydub import AudioSegment
from moviepy.editor import (
    VideoFileClip,
    AudioFileClip,
    concatenate_videoclips,
    ImageClip,
    CompositeVideoClip
)
from werkzeug.exceptions import NotFound
from datetime import datetime
from celery import Celery
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize the Flask app
app = Flask(__name__, static_folder='static')
app.secret_key = os.getenv('SECRET_KEY', 'your_secret_key_here')
# Allow requests from the frontend running on localhost:3000
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://localhost:3000"}})

# Configure Celery (ensure Redis is running)
app.config['CELERY_BROKER_URL'] = 'redis://localhost:6379/0'
app.config['CELERY_RESULT_BACKEND'] = 'redis://localhost:6379/0'
celery = Celery(app.name, broker=app.config['CELERY_BROKER_URL'])
celery.conf.update(app.config)

###############################################################################
# Helper Function: Generate Voice Previews
###############################################################################
def generate_voice_previews(elevenlabs_api_key):
    samples_dir = os.path.join('static', 'samples')
    if not os.path.exists(samples_dir):
        try:
            os.makedirs(samples_dir)
            print(f"Created directory: {samples_dir}")
        except Exception as e:
            print(f"Error creating directory {samples_dir}: {e}")
            return
    else:
        print(f"Directory already exists: {samples_dir}")

    voices_url = 'https://api.elevenlabs.io/v1/voices'
    headers = {'xi-api-key': elevenlabs_api_key}

    try:
        response = requests.get(voices_url, headers=headers)
        response.raise_for_status()
        voices_data = response.json()
    except Exception as e:
        print(f"Error fetching voices: {e}")
        return

    voices = voices_data.get('voices', [])
    print(f"Found {len(voices)} voices.")

    preview_text = "This is Aragornic AI Video Creator."

    for voice in voices:
        voice_id = voice.get('id')
        if not voice_id:
            continue
        print(f"Generating preview for voice: {voice_id}")
        tts_url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        payload = {'text': preview_text, 'model_id': 'eleven_multilingual_v2'}
        try:
            tts_response = requests.post(
                tts_url,
                headers={**headers, 'Content-Type': 'application/json'},
                json=payload
            )
            tts_response.raise_for_status()
        except requests.exceptions.RequestException as e:
            print(f"Error generating audio for voice {voice_id}: {e}")
            continue

        try:
            full_audio = AudioSegment.from_file(io.BytesIO(tts_response.content), format="mp3")
            preview_audio = full_audio[:5000]
            preview_path = os.path.join(samples_dir, f"{voice_id}.mp3")
            preview_audio.export(preview_path, format="mp3")
            print(f"Saved preview for voice {voice_id} at {preview_path}")
        except Exception as e:
            print(f"Error processing audio for voice {voice_id}: {e}")

###############################################################################
# Temporary Route: Trigger Generation of All Previews
###############################################################################
@app.route('/generate_all_previews', methods=['POST'])
def generate_all_previews():
    data = request.get_json() or {}
    elevenlabs_api_key = data.get('elevenlabs_api_key')
    if not elevenlabs_api_key:
        return jsonify({"error": "No ElevenLabs API key provided."}), 400
    try:
        generate_voice_previews(elevenlabs_api_key)
        return jsonify({"message": "Previews generated successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# Health Check
###############################################################################
@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"message": "pong"}), 200

###############################################################################
# 1) Generate Title - GPT
###############################################################################
@app.route('/generate_title', methods=['POST'])
def generate_title():
    data = request.get_json() or {}
    topic = data.get('topic', 'Unknown Topic')
    model = data.get('model', 'gpt-3.5-turbo')
    user_api_key = data.get('user_api_key', '')
    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400
    openai.api_key = user_api_key
    prompt = f"Suggest a concise, captivating video title about '{topic}'."
    try:
        if model.startswith('gpt-'):
            response = openai.ChatCompletion.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=50
            )
            gpt_title = response["choices"][0]["message"]["content"].strip('\" ')
        else:
            resp = openai.Completion.create(
                engine="text-davinci-003",
                prompt=prompt,
                max_tokens=50,
                temperature=0.7
            )
            gpt_title = resp["choices"][0]["text"].strip('\" ')
        cost = 0.01
        return jsonify({"title": gpt_title, "cost": cost}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 2) Generate Script - GPT
###############################################################################
@app.route('/generate_script', methods=['POST'])
def generate_script():
    data = request.get_json() or {}
    topic = data.get('topic', 'Unknown Topic')
    model = data.get('model', 'gpt-3.5-turbo')
    length = data.get('length', '1h')
    user_api_key = data.get('user_api_key', '')
    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400
    length_mapping = {
        '1m': 1,
        '2m': 2,
        '5m': 5,
        '10m': 10,
        '20m': 20,
        '1h': 60,
        '2h': 120
    }
    script_duration_minutes = length_mapping.get(length.lower())
    if not script_duration_minutes:
        return jsonify({"error": f"Invalid script length: {length}."}), 400
    words = 150 * script_duration_minutes
    tokens = int(words / 0.75)
    openai.api_key = user_api_key
    prompt = (
        f"Write a captivating and detailed {script_duration_minutes} minute documentary story about {topic}. "
        "Include historical context, key events, and weave them into a dramatic and engaging narrative in the style of Dan Carlin storytelling ability. "
        "Make it flow naturally as one continuous story, free of lists or bullet points, with vivid descriptions and compelling storytelling."
    )
    try:
        if model.startswith('gpt-'):
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=tokens
            )
            script_text = resp["choices"][0]["message"]["content"].strip()
        else:
            resp = openai.Completion.create(
                engine="text-davinci-003",
                prompt=prompt,
                temperature=0.7,
                max_tokens=tokens
            )
            script_text = resp["choices"][0]["text"].strip()
        if model == 'gpt-4':
            cost_per_1k = 0.03
        elif model == 'gpt-3.5-turbo':
            cost_per_1k = 0.002
        else:
            cost_per_1k = 0.02
        script_cost = (tokens / 1000) * cost_per_1k
        return jsonify({"script": script_text, "script_cost": round(script_cost, 4)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 3) Generate Image - DALL·E
###############################################################################
@app.route('/generate_image', methods=['POST'])
def generate_image():
    data = request.get_json() or {}
    user_prompt = data.get('prompt', 'A scenic view.')
    image_size = data.get('image_size', '512x512')
    num_images = data.get('num_images', 1)
    user_api_key = data.get('user_api_key', '')
    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400
    openai.api_key = user_api_key
    improved_prompt = (
        f"{user_prompt}. "
        "Scenic, photorealistic, cinematic lighting, ultra high resolution with absolutely no text, no letters, no words."
    )
    try:
        dalle_resp = openai.Image.create(
            prompt=improved_prompt,
            n=num_images,
            size=image_size
        )
        image_urls = [data['url'] for data in dalle_resp['data']]
        cost = 0.02 * num_images
        return jsonify({"image_urls": image_urls, "cost": cost}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 4) Upload Media Endpoint
###############################################################################
@app.route('/upload_media', methods=['POST'])
def upload_media():
    if 'files' not in request.files:
        return jsonify({"error": "No files part in request."}), 400
    files = request.files.getlist('files')
    if not files:
        return jsonify({"error": "No files selected."}), 400
    media_urls = []
    supported_image_extensions = ['png', 'jpg', 'jpeg', 'gif']
    supported_video_extensions = ['mp4', 'mov', 'avi', 'mkv']
    for file in files:
        if file:
            filename = secure_filename(file.filename)
            if '.' not in filename or filename.rsplit('.', 1)[-1].lower() == '':
                return jsonify({"error": f"Invalid file name: {filename}"}), 400
            ext = filename.rsplit('.', 1)[-1].lower()
            if ext not in supported_image_extensions + supported_video_extensions:
                return jsonify({"error": f"Unsupported file type: {ext}"}), 400
            new_filename = f"{uuid.uuid4().hex}_{filename}"
            save_path = os.path.join('static', new_filename)
            try:
                file.save(save_path)
                media_url = f"http://localhost:5000/{save_path}"
                media_urls.append(media_url)
            except Exception as e:
                return jsonify({"error": f"Could not save file: {str(e)}"}), 500
    return jsonify({"media_urls": media_urls}), 200

###############################################################################
# 5) List Voices Endpoint
###############################################################################
@app.route('/list_voices', methods=['GET'])
def list_voices():
    elevenlabs_api_key = request.args.get('elevenlabs_api_key')
    if not elevenlabs_api_key:
        return jsonify({"error": "No API key provided."}), 400
    headers = {'xi-api-key': elevenlabs_api_key}
    voices_url = 'https://api.elevenlabs.io/v1/voices'
    try:
        response = requests.get(voices_url, headers=headers)
        response.raise_for_status()
        voices_data = response.json()
        return jsonify({"voices": voices_data.get('voices', [])})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 6) Generate Audio - ElevenLabs TTS
###############################################################################
@app.route('/generate_audio_elevenlabs', methods=['POST'])
def generate_audio_elevenlabs():
    data = request.get_json() or {}
    script_text = data.get('script', '')
    voice_id = data.get('voice_id')
    elevenlabs_api_key = data.get('elevenlabs_api_key', '')
    if not elevenlabs_api_key:
        return jsonify({"error": "No ElevenLabs API key provided."}), 400
    if not script_text:
        return jsonify({"error": "No script provided."}), 400
    if not voice_id:
        return jsonify({"error": "No voice_id provided."}), 400
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
    headers = {
        'xi-api-key': elevenlabs_api_key,
        'Content-Type': 'application/json'
    }
    payload = {'text': script_text, 'model_id': 'eleven_multilingual_v2'}
    tts_url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'
    try:
        response = requests.post(tts_url, headers=headers, json=payload)
        response.raise_for_status()
        local_audio_file = f"{static_dir}/output_audio_{uuid.uuid4().hex}.mp3"
        with open(local_audio_file, "wb") as f:
            f.write(response.content)
        return jsonify({
            "audio_file_url": f"http://localhost:5000/{local_audio_file}"
        }), 200
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 7) Combine Multiple Media + Audio into a Video
###############################################################################
@app.route('/create_video', methods=['POST'])
def create_video():
    data = request.get_json() or {}
    audio_url = data.get('audio_url', '')
    media_urls = data.get('media_urls', [])
    media_split_config = data.get('media_split_config', {"split_type": "equal", "duration_per_media": None})
    if not audio_url:
        return jsonify({"error": "Must provide audio_url."}), 400
    if not media_urls:
        return jsonify({"error": "Must provide at least one media URL."}), 400
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)
    try:
        if "http://localhost:5000/" in audio_url:
            parsed_audio_url = urlparse(audio_url)
            local_audio_file = parsed_audio_url.path.lstrip('/')
            if not os.path.exists(local_audio_file):
                return jsonify({"error": "Audio file does not exist on the server."}), 400
        else:
            return jsonify({"error": "Audio must be hosted on the server (local URL)."}), 400

        audio_clip = AudioFileClip(local_audio_file)
        audio_duration = audio_clip.duration

        local_media_files = []
        for url in media_urls:
            if "http://localhost:5000/" in url:
                parsed_url = urlparse(url)
                local_path = parsed_url.path.lstrip('/')
                if not os.path.exists(local_path):
                    return jsonify({"error": f"Media file does not exist: {local_path}"}), 400
                local_media_files.append(local_path)
            else:
                response = requests.get(url, stream=True)
                if response.status_code == 200:
                    filename = secure_filename(url.split('/')[-1].split('?')[0])
                    local_path = os.path.join(static_dir, f"{uuid.uuid4().hex}_{filename}")
                    with open(local_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    local_media_files.append(local_path)
                else:
                    return jsonify({"error": f"Failed to download media: {url}"}), 400

        num_media = len(local_media_files)
        split_type = media_split_config.get('split_type', 'equal')
        duration_per_media = media_split_config.get('duration_per_media', None)
        if split_type == 'equal':
            segment_duration = audio_duration / num_media
        elif split_type == 'custom':
            if not duration_per_media:
                return jsonify({"error": "Duration per media not provided for custom split."}), 400
            segment_duration = duration_per_media
            total_required_duration = segment_duration * num_media
            if total_required_duration > audio_duration:
                return jsonify({"error": f"Total media duration ({total_required_duration}s) exceeds audio duration ({audio_duration}s)."}), 400
        else:
            return jsonify({"error": f"Unsupported split_type: {split_type}"}), 400

        clips = []
        for path in local_media_files:
            ext = os.path.splitext(path)[-1].lower().strip('.')
            print(f"Processing file: {path}, Extension: {ext}")
            if ext in ['png', 'jpg', 'jpeg', 'gif']:
                clip = ImageClip(path).set_duration(segment_duration)
                clips.append(clip)
            elif ext in ['mp4', 'mov', 'avi', 'mkv']:
                video = VideoFileClip(path)
                if video.duration > segment_duration:
                    clip = video.subclip(0, segment_duration)
                else:
                    loops = int(segment_duration // video.duration) + 1
                    clip = concatenate_videoclips([video] * loops).subclip(0, segment_duration)
                clips.append(clip)
            else:
                return jsonify({"error": f"Unsupported media type: {ext}"}), 400

        if not clips:
            return jsonify({"error": "No valid media clips to process."}), 400

        final_clip = concatenate_videoclips(clips, method='compose')
        final_clip = final_clip.set_audio(audio_clip)

        final_video_name = f"final_video_{uuid.uuid4().hex}.mp4"
        final_video_path = os.path.join(static_dir, final_video_name)
        final_clip.write_videofile(final_video_path, fps=24, codec="libx264", audio_codec="aac")

        audio_clip.close()
        final_clip.close()
        for clip in clips:
            if isinstance(clip, VideoFileClip):
                clip.close()

        video_url = f"http://localhost:5000/{final_video_path}"
        download_url = f"http://localhost:5000/download_video/{final_video_name}"
        return jsonify({"video_url": video_url, "download_url": download_url}), 200

    except Exception as e:
        print(f"Error in /create_video: {e}")
        return jsonify({"error": str(e)}), 500

###############################################################################
# 8) Download Video Endpoint
###############################################################################
@app.route('/download_video/<filename>', methods=['GET'])
def download_video(filename):
    try:
        static_dir = os.path.join(os.getcwd(), 'static')
        if not os.path.exists(os.path.join(static_dir, filename)):
            raise NotFound
        return send_from_directory(static_dir, filename, as_attachment=True)
    except NotFound:
        return jsonify({'error': 'Video file not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

###############################################################################
# 9) Upload Image Endpoint (Single Image Upload)
###############################################################################
@app.route('/upload_image', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request."}), 400
    file = request.files['file']
    if not file:
        return jsonify({"error": "No file selected."}), 400
    if not os.path.exists('static'):
        os.makedirs('static')
    filename = secure_filename(file.filename)
    new_filename = f"{uuid.uuid4().hex}_{filename}"
    save_path = os.path.join('static', new_filename)
    try:
        file.save(save_path)
    except Exception as e:
        return jsonify({"error": f"Could not save file: {str(e)}"}), 500
    return jsonify({
        "image_url": f"http://localhost:5000/{save_path}"
    }), 200

###############################################################################
# 10) Handle TikTok OAuth Callback
###############################################################################
@app.route('/tiktok_callback', methods=['GET'])
def tiktok_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    if not code:
        return jsonify({"error": "No code provided in callback."}), 400
    # (State validation should be done in production)
    client_id = os.getenv('TIKTOK_CLIENT_ID', 'YOUR_TIKTOK_CLIENT_ID')
    client_secret = os.getenv('TIKTOK_CLIENT_SECRET', 'YOUR_TIKTOK_CLIENT_SECRET')
    redirect_uri = 'http://localhost:5000/tiktok_callback'
    token_url = 'https://open-api.tiktok.com/oauth/access_token/'
    payload = {
        'client_key': client_id,
        'client_secret': client_secret,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': redirect_uri,
    }
    try:
        response = requests.post(token_url, data=payload)
        response.raise_for_status()
        data = response.json()
        if data.get('error_code') != 0:
            return jsonify({"error": data.get('description', 'Failed to obtain access token.')}), 400
        access_token = data['data']['access_token']
        refresh_token = data['data']['refresh_token']
        user_id = data['data']['user_id']
        session['tiktok_access_token'] = access_token
        session['tiktok_user_id'] = user_id
        return redirect('http://localhost:3000/my-videos')
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 11) Check TikTok Authentication Status
###############################################################################
@app.route('/tiktok_status', methods=['GET'])
def tiktok_status():
    access_token = session.get('tiktok_access_token')
    user_id = session.get('tiktok_user_id')
    if access_token and user_id:
        return jsonify({"authenticated": True, "access_token": access_token, "user_id": user_id}), 200
    else:
        return jsonify({"authenticated": False}), 200

###############################################################################
# 12) Schedule Post Endpoint
###############################################################################
@app.route('/schedule_post', methods=['POST'])
def schedule_post():
    data = request.get_json() or {}
    video_id = data.get('video_id')
    scheduled_time = data.get('scheduled_time')  # ISO format
    tiktok_access_token = data.get('tiktok_access_token')
    if not video_id or not scheduled_time or not tiktok_access_token:
        return jsonify({"error": "Missing required fields."}), 400
    videos = getStoredVideos()
    video = next((v for v in videos if v['id'] == video_id), None)
    if not video:
        return jsonify({"error": "Video not found."}), 404
    try:
        scheduled_datetime = datetime.fromisoformat(scheduled_time)
        if scheduled_datetime < datetime.now():
            return jsonify({"error": "Scheduled time must be in the future."}), 400
        post_video_to_tiktok.apply_async(args=[video_id, tiktok_access_token], eta=scheduled_datetime)
        return jsonify({"message": "Video scheduled successfully."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 13) Celery Task: Post Video to TikTok
###############################################################################
@celery.task
def post_video_to_tiktok(video_id, tiktok_access_token):
    videos = getStoredVideos()
    video = next((v for v in videos if v['id'] == video_id), None)
    if not video:
        print(f"Video with ID {video_id} not found.")
        return
    video_url = video.get('video_url')
    if not video_url:
        print(f"No video URL found for video ID {video_id}.")
        return
    try:
        response = requests.get(video_url, stream=True)
        response.raise_for_status()
        video_content = response.content
    except requests.exceptions.RequestException as e:
        print(f"Error downloading video: {e}")
        return
    temp_video_path = f"temp_{uuid.uuid4().hex}.mp4"
    with open(temp_video_path, 'wb') as f:
        f.write(video_content)
    upload_url = 'https://open-api.tiktok.com/share/video/upload/'
    headers = {
        'Authorization': f'Bearer {tiktok_access_token}'
    }
    files = {
        'video': open(temp_video_path, 'rb')
    }
    data = {
        'description': 'Scheduled video from Aragornic AI Video Creator.'
    }
    try:
        upload_resp = requests.post(upload_url, headers=headers, files=files, data=data)
        upload_resp.raise_for_status()
        upload_data = upload_resp.json()
        if upload_data.get('error_code') != 0:
            print(f"Error uploading video to TikTok: {upload_data.get('description')}")
            return
        video_id_tiktok = upload_data['data']['video_id']
        print(f"Video {video_id} posted to TikTok successfully with TikTok video ID {video_id_tiktok}.")
    except requests.exceptions.RequestException as e:
        print(f"Error uploading video to TikTok: {e}")
    finally:
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

###############################################################################
# Utility: Get Stored Videos from Local Storage
###############################################################################
def getStoredVideos():
    if os.path.exists('videos.json'):
        with open('videos.json', 'r') as f:
            return json.load(f)
    return []

def storeVideo(video):
    videos = getStoredVideos()
    videos.append(video)
    with open('videos.json', 'w') as f:
        json.dump(videos, f)

def updateVideo(updated_video):
    videos = getStoredVideos()
    for i, video in enumerate(videos):
        if video['id'] == updated_video['id']:
            videos[i] = updated_video
            break
    with open('videos.json', 'w') as f:
        json.dump(videos, f)

def deleteVideo(video_id):
    videos = getStoredVideos()
    videos = [video for video in videos if video['id'] != video_id]
    with open('videos.json', 'w') as f:
        json.dump(videos, f)

###############################################################################
# Run the Flask app
###############################################################################
if __name__ == '__main__':
    if not os.path.exists('static'):
        os.makedirs('static')
    app.run(debug=True, port=5000)
