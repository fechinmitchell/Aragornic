"""
app.py

Flask server that uses the user-provided OpenAI API key in each request.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import requests
import os
import uuid
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips

app = Flask(__name__, static_folder='static')
CORS(app)

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
@app.route('/generate_audio', methods=['POST'])
def generate_audio():
    """
    Expects JSON: {"script": "...", "tts_model": "...", "user_api_key": "..."}
    Returns: {"audio_file_url": "...", "cost": 0.05}
    """
    data = request.get_json() or {}
    script_text = data.get('script', '')
    tts_model = data.get('tts_model', 'tts-1')
    user_api_key = data.get('user_api_key', '')

    if not user_api_key:
        return jsonify({"error": "No API key provided."}), 400
    if not script_text:
        return jsonify({"error": "No script provided."}), 400

    openai.api_key = user_api_key

    try:
        # Hypothetical TTS call (unofficial). For demonstration, we’ll save a fake MP3:
        local_audio_file = f"static/output_audio_{uuid.uuid4().hex}.mp3"
        with open(local_audio_file, "wb") as f:
            f.write(b"FAKE_MP3_DATA")  # placeholder

        cost = 0.05
        return jsonify({
            "audio_file_url": f"http://localhost:5000/{local_audio_file}",
            "cost": cost
        }), 200

    except Exception as e:
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
    Returns: {"video_url": "..."}
    """
    data = request.get_json() or {}
    audio_url = data.get('audio_url', '')
    image_urls = data.get('image_urls', [])

    if not audio_url or not image_urls:
        return jsonify({"error": "Must provide audio_url and image_urls."}), 400

    try:
        # If audio_url is local, parse out the path
        if "http://localhost:5000/static/" in audio_url:
            local_audio_file = audio_url.replace("http://localhost:5000/", "")
        else:
            return jsonify({"error": "Audio must be local for now."}), 400

        local_image_files = []
        for url in image_urls:
            if "http://localhost:5000/static/" in url:
                local_path = url.replace("http://localhost:5000/", "")
                local_image_files.append(local_path)
            else:
                return jsonify({"error": "Images must be local for now."}), 400

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

        final_video_name = f"static/final_video_{uuid.uuid4().hex}.mp4"
        final_clip.write_videofile(final_video_name, fps=24, codec="libx264", audio_codec="aac")

        audio_clip.close()
        final_clip.close()

        video_url = f"http://localhost:5000/{final_video_name}"
        return jsonify({"video_url": video_url}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True, port=5000)
