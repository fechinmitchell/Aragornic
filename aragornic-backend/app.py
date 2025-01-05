from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
import pyttsx3
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
import requests
import uuid

app = Flask(__name__, static_folder='static')
CORS(app)

# Set your OpenAI API key via environment variable, e.g.:
#   export OPENAI_API_KEY="sk-YourKeyHere"
openai.api_key = os.getenv("OPENAI_API_KEY", "")

@app.route('/ping', methods=['GET'])
def ping():
    """
    Simple health check: returns "pong" if the server is running.
    """
    return jsonify({"message": "pong"}), 200


@app.route('/create_full_video', methods=['POST'])
def create_full_video():
    """
    A single endpoint that:
      1) Generates an optional video title (GPT) if the user requests it
      2) Generates a main script (GPT-3.5 turbo by default, or another if specified)
      3) Generates multiple images (DALL·E)
      4) Converts script to audio (pyttsx3)
      5) Combines images + audio into a slideshow video (MoviePy)
      6) Returns final script & video URL

    Sample request JSON:
      {
        "topic": "Ancient Rome",
        "num_images": 3,
        "image_size": "512x512",
        "use_title_prompt": true,
        "voice_rate": 150,
        "script_model": "gpt-3.5-turbo"  // or "gpt-4" in the future
      }
    """
    data = request.get_json() or {}

    # ----------------------------------------------------------------
    #  1) Parse Incoming JSON / Defaults
    # ----------------------------------------------------------------
    topic           = data.get('topic', 'Unknown Historical Topic')
    num_images      = data.get('num_images', 3)
    image_size      = data.get('image_size', '512x512')       # DALL·E sizes: 256x256, 512x512, 1024x1024
    use_title_prompt= data.get('use_title_prompt', False)
    voice_rate      = data.get('voice_rate', 150)
    script_model    = data.get('script_model', 'gpt-3.5-turbo')  # default to GPT-3.5 Turbo
    # In the future, you can pass "gpt-4" or another model here.

    # ----------------------------------------------------------------
    #  2) Generate an (Optional) Video Title
    # ----------------------------------------------------------------
    video_title = topic
    if use_title_prompt:
        try:
            title_prompt = f"Suggest an engaging YouTube title for a documentary on {topic}."
            # We'll assume GPT-3.5 (chat) style approach if script_model is "gpt-*" or "gpt-4".
            if script_model.startswith('gpt-'):
                chat_resp = openai.ChatCompletion.create(
                    model=script_model,
                    messages=[{"role": "user", "content": title_prompt}],
                    temperature=0.7,
                    max_tokens=50
                )
                video_title = chat_resp['choices'][0]['message']['content'].strip('" ')
            else:
                # For older or different models using Completions
                completion_resp = openai.Completion.create(
                    engine="text-davinci-003",
                    prompt=title_prompt,
                    temperature=0.7,
                    max_tokens=50
                )
                video_title = completion_resp['choices'][0]['text'].strip('" ')
        except Exception as e:
            print(f"Title generation failed: {e}")
            # fallback: just keep topic as title

    # ----------------------------------------------------------------
    #  3) Generate Main Script (GPT)
    # ----------------------------------------------------------------
    script_prompt = (
        f"Write a detailed narration about {topic}, including historical context, key events, "
        "and interesting anecdotes. Write it in a documentary style."
    )

    script_text = ""
    try:
        if script_model.startswith('gpt-'):
            # ChatCompletion approach
            chat_resp = openai.ChatCompletion.create(
                model=script_model,
                messages=[{"role": "user", "content": script_prompt}],
                temperature=0.7,
                max_tokens=2000
            )
            script_text = chat_resp['choices'][0]['message']['content'].strip()
        else:
            # Completions approach (davinci, etc.)
            completion_resp = openai.Completion.create(
                engine="text-davinci-003",
                prompt=script_prompt,
                temperature=0.7,
                max_tokens=2000
            )
            script_text = completion_resp['choices'][0]['text'].strip()

    except Exception as e:
        return jsonify({"error": f"Error generating script: {str(e)}"}), 500

    # ----------------------------------------------------------------
    #  4) Generate Images (DALL·E)
    # ----------------------------------------------------------------
    image_file_paths = []
    try:
        dalle_prompt = f"A cinematic, documentary-style scene representing {topic}."
        dalle_resp = openai.Image.create(
            prompt=dalle_prompt,
            n=num_images,
            size=image_size
        )
        # Each image is a URL we need to download to local disk
        for i, img_info in enumerate(dalle_resp['data']):
            img_url = img_info['url']
            local_filename = f"static/dalle_image_{uuid.uuid4().hex}.png"
            r = requests.get(img_url, timeout=30)
            with open(local_filename, 'wb') as f:
                f.write(r.content)
            image_file_paths.append(local_filename)
    except Exception as e:
        return jsonify({"error": f"DALL·E generation error: {str(e)}"}), 500

    # ----------------------------------------------------------------
    #  5) Convert Script to Audio (pyttsx3)
    # ----------------------------------------------------------------
    audio_file_name = f"output_audio_{uuid.uuid4().hex}.mp3"
    try:
        engine = pyttsx3.init()
        engine.setProperty('rate', voice_rate)
        engine.save_to_file(script_text, audio_file_name)
        engine.runAndWait()
    except Exception as e:
        return jsonify({"error": f"TTS error: {str(e)}"}), 500

    # ----------------------------------------------------------------
    #  6) Create a Slideshow Video (MoviePy)
    # ----------------------------------------------------------------
    final_video_path = f"static/final_video_{uuid.uuid4().hex}.mp4"
    try:
        audio_clip = AudioFileClip(audio_file_name)
        audio_duration = audio_clip.duration

        clip_duration = audio_duration / max(1, len(image_file_paths))  # avoid division by zero
        clips = []
        for path in image_file_paths:
            clip = ImageClip(path).set_duration(clip_duration)
            clips.append(clip)

        final_clip = concatenate_videoclips(clips, method='compose')
        final_clip = final_clip.set_audio(audio_clip)

        final_clip.write_videofile(final_video_path, fps=24, codec="libx264", audio_codec="aac")

        audio_clip.close()
        final_clip.close()

        # (Optional) Cleanup: remove local images/audio if you don't need them
        # for path in image_file_paths:
        #     os.remove(path)
        # os.remove(audio_file_name)

    except Exception as e:
        return jsonify({"error": f"MoviePy error: {str(e)}"}), 500

    # ----------------------------------------------------------------
    #  7) Return JSON with final script, video URL, and image file paths
    # ----------------------------------------------------------------
    video_url = f"http://localhost:5000/{final_video_path}"  # served from static folder

    return jsonify({
        "video_title": video_title,
        "script": script_text,
        "video_url": video_url,
        "image_files": image_file_paths
    }), 200


if __name__ == '__main__':
    # Make sure you have:
    #   1) export OPENAI_API_KEY="sk-YourKey"
    #   2) pip install -r requirements.txt (inside a venv if you prefer)
    #   3) A "static" folder for storing images/video
    # Then run: python app.py
    # The server should listen on http://localhost:5000
    app.run(debug=True, port=5000)
