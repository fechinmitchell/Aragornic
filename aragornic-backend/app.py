"""
app.py

Flask server that uses the user-provided OpenAI API key in each request.
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import openai
import requests
import os
import uuid
from moviepy.editor import VideoFileClip, AudioFileClip, concatenate_videoclips, ImageClip
from moviepy.video.fx.resize import resize
from moviepy.video.io.ffmpeg_tools import ffmpeg_extract_subclip
from elevenlabs import ElevenLabs
import subprocess

# Initialize the Flask app
app = Flask(__name__, static_folder='static')

# Enable CORS for all routes and methods
CORS(app, supports_credentials=True, resources={r"/*": {"origins": "*"}})

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
    """
    Expects JSON with {"topic": "...", "model": "...", "user_api_key": "..."}
    Returns JSON: {"title": "...", "cost": 0.01}
    """
    data = request.get_json() or {}
    topic = data.get('topic', 'Unknown Topic')
    model = data.get('model', 'gpt-3.5-turbo')
    user_api_key = data.get('user_api_key', '')

    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400

    # Use the user-provided key
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
    """
    Expects JSON: {
      "topic": "...",
      "model": "...",
      "length": "1h" or "2h",
      "user_api_key": "sk-..."
    }
    Returns JSON: {"script": "...", "script_cost": 0.2}
    """
    data = request.get_json() or {}
    topic = data.get('topic', 'Unknown Topic')
    model = data.get('model', 'gpt-3.5-turbo')
    length = data.get('length', '1h')
    user_api_key = data.get('user_api_key', '')

    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400

    openai.api_key = user_api_key

    prompt = (
        f"Write a detailed {length} documentary script about {topic}, "
        "including historical context, key events, and a dramatic narrative."
    )

    try:
        if model.startswith('gpt-'):
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=2000
            )
            script_text = resp["choices"][0]["message"]["content"].strip()
        else:
            resp = openai.Completion.create(
                engine="text-davinci-003",
                prompt=prompt,
                temperature=0.7,
                max_tokens=2000
            )
            script_text = resp["choices"][0]["text"].strip()

        # Simple cost logic
        base_cost = 0.1
        if model == 'gpt-4':
            base_cost = 0.2
        if length == '2h':
            base_cost += 0.1

        return jsonify({"script": script_text, "script_cost": base_cost}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 3) Generate Image - DALL·E
###############################################################################
@app.route('/generate_image', methods=['POST'])
def generate_image():
    """
    Expects JSON: {
      "prompt": "...",
      "image_size": "512x512",
      "num_images": 1,
      "user_api_key": "sk-..."
    }
    Returns JSON: {"image_url": "...", "cost": 0.02}
    """
    data = request.get_json() or {}
    prompt = data.get('prompt', 'A scenic view.')
    image_size = data.get('image_size', '512x512')
    num_images = data.get('num_images', 1)
    user_api_key = data.get('user_api_key', '')

    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400

    openai.api_key = user_api_key

    try:
        dalle_resp = openai.Image.create(
            prompt=prompt,
            n=num_images,
            size=image_size
        )
        image_url = dalle_resp['data'][0]['url']
        cost = 0.02 * num_images
        return jsonify({"image_url": image_url, "cost": cost}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 4) Convert Script to Audio - (Example with OpenAI TTS or fallback)
###############################################################################
@app.route('/generate_audio_elevenlabs', methods=['POST'])
def generate_audio_elevenlabs():
    """
    Expects JSON: {"script": "...", "voice_id": "...", "elevenlabs_api_key": "..."}
    Returns: {"audio_file_url": "..."}
    """
    data = request.get_json() or {}
    script_text = data.get('script', '')
    voice_id = data.get('voice_id', '21m00Tcm4TlvDq8ikWAM')  # Default voice ID
    elevenlabs_api_key = data.get('elevenlabs_api_key', '')

    if not elevenlabs_api_key:
        return jsonify({"error": "No ElevenLabs API key provided."}), 400
    if not script_text:
        return jsonify({"error": "No script provided."}), 400

    # Ensure the static directory exists
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

    headers = {
        'xi-api-key': elevenlabs_api_key,
        'Content-Type': 'application/json'
    }
    payload = {
        'text': script_text,
        'model_id': 'eleven_multilingual_v2'  # Specify the desired model
    }
    tts_url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}'

    try:
        response = requests.post(tts_url, headers=headers, json=payload)
        response.raise_for_status()

        # Save the audio file locally
        local_audio_file = f"{static_dir}/output_audio_{uuid.uuid4().hex}.mp3"
        with open(local_audio_file, "wb") as f:
            f.write(response.content)

        return jsonify({
            "audio_file_url": f"http://localhost:5000/{local_audio_file}"
        }), 200

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

###############################################################################
# 5) Combine Images + Audio into a Video
###############################################################################
@app.route('/create_video', methods=['POST'])
def create_video():
    """
    Expects JSON:
      {
        "audio_url": "...",
        "image_urls": ["..."],
        "user_api_key": "sk-..." (optional if needed)
      }
    Returns: {"video_url": "...", "download_url": "..."}
    """
    data = request.get_json() or {}
    audio_url = data.get('audio_url', '')
    image_urls = data.get('image_urls', [])

    if not audio_url or not image_urls:
        return jsonify({"error": "Must provide audio_url and image_urls."}), 400

    # Ensure the static directory exists
    static_dir = 'static'
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

    try:
        # Handle audio file
        if "http://localhost:5000/static/" in audio_url:
            local_audio_file = audio_url.replace("http://localhost:5000/", "")
        else:
            return jsonify({"error": "Audio must be local for now."}), 400

        # Handle image files
        local_image_files = []
        for url in image_urls:
            if "http://localhost:5000/static/" in url:
                local_path = url.replace("http://localhost:5000/", "")
                local_image_files.append(local_path)
            else:
                response = requests.get(url)
                if response.status_code == 200:
                    image_name = f"{uuid.uuid4().hex}.jpg"
                    local_path = os.path.join(static_dir, image_name)
                    with open(local_path, "wb") as f:
                        f.write(response.content)
                    local_image_files.append(local_path)
                else:
                    return jsonify({"error": f"Failed to download image: {url}"}), 400

        # Create video
        audio_clip = AudioFileClip(local_audio_file)
        audio_duration = audio_clip.duration
        num_images = len(local_image_files)

        each_duration = audio_duration / num_images
        clips = []
        for path in local_image_files:
            clip = ImageClip(path).set_duration(each_duration)
            clips.append(clip)

        final_clip = concatenate_videoclips(clips, method='compose')
        final_clip = final_clip.set_audio(audio_clip)

        final_video_name = f"{static_dir}/final_video_{uuid.uuid4().hex}.mp4"
        final_clip.write_videofile(final_video_name, fps=24, codec="libx264", audio_codec="aac")

        audio_clip.close()
        final_clip.close()

        video_url = f"http://localhost:5000/{final_video_name}"
        download_url = f"http://localhost:5000/download_video/{os.path.basename(final_video_name)}"
        return jsonify({"video_url": video_url, "download_url": download_url}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
###############################################################################
# 6) Download Video
###############################################################################
@app.route('/download_video', methods=['POST'])
def download_video_post():
    """
    Allows downloading a video file after resizing or renaming it.
    Expects JSON: {
      "video_url": "...",
      "width": 1920,
      "height": 1080,
      "file_name": "custom_name.mp4"
    }
    """
    data = request.get_json() or {}
    video_url = data.get('video_url')
    width = data.get('width', 1920)
    height = data.get('height', 1080)
    file_name = data.get('file_name', 'final_video.mp4')

    if not video_url:
        return jsonify({"error": "No video URL provided."}), 400

    try:
        # Extract the local file path from the video URL
        if "http://localhost:5000/static/" in video_url:
            local_video_path = video_url.replace("http://localhost:5000/static/", "static/")
        else:
            return jsonify({"error": "Only local videos are supported for download."}), 400

        # Resize video if necessary
        resized_video_path = f"static/{uuid.uuid4().hex}_{file_name}"
        clip = VideoFileClip(local_video_path)
        resized_clip = clip.resize(height=height, width=width)
        resized_clip.write_videofile(resized_video_path, codec="libx264")
        clip.close()
        resized_clip.close()

        # Send the resized/renamed video to the client
        static_dir = os.path.join(os.getcwd(), 'static')
        return send_from_directory(static_dir, os.path.basename(resized_video_path), as_attachment=True)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/download_video/<filename>')
def download_video(filename):
    try:
        # Print debugging information
        print(f"Attempting to download: {filename}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Files in static directory: {os.listdir('static')}")
        
        # Use the same static directory where videos are saved
        return send_from_directory('static', filename, as_attachment=True)
    except FileNotFoundError as e:
        print(f"File not found error: {str(e)}")
        return jsonify({'error': 'Video file not found'}), 404
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True, port=5000)
