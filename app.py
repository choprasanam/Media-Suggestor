import os
import re
import json
import requests
import logging
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Configure logging for serverless (stdout/stderr)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s %(levelname)s: %(message)s'
)

API_URL = "https://integrate.api.nvidia.com/v1"
API_KEY = os.getenv("API_KEY")
MODEL = "meta/llama-3.1-8b-instruct"

def extract_json_from_response(text: str) -> str:
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    
    start_obj = text.find('{')
    start_arr = text.find('[')
    
    if start_obj != -1 and (start_arr == -1 or start_obj < start_arr):
        start = start_obj
        end = text.rfind('}')
    elif start_arr != -1:
        start = start_arr
        end = text.rfind(']')
    else:
        return text

    if start != -1 and end != -1 and end > start:
        return text[start:end+1]
        
    return text

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/next_question", methods=["POST"])
def next_question():
    if not API_KEY:
        return jsonify({"error": "API Key is not configured."}), 500

    data = request.json or {}
    history = data.get("history", [])
    category = data.get("category", "book").lower()
    
    if len(history) == 0:
        if category == "movie":
            return jsonify({"question": "What kind of cinematic experiences usually captivate you?", "done": False})
        elif category == "music":
            return jsonify({"question": "What kind of sounds, genres, or vibes are you drawn to lately?", "done": False})
        elif category == "series":
            return jsonify({"question": "What kind of TV series or shows keep you binge-watching?", "done": False})
        elif category == "anime":
            return jsonify({"question": "What kind of anime worlds or storylines captivate you?", "done": False})
        else:
            return jsonify({"question": "What kind of stories or topics are you usually drawn to?", "done": False})
        
    if len(history) >= 5:
        return jsonify({"done": True})

    roles = {
        "book": "AI Librarian",
        "movie": "AI Film Critic",
        "music": "AI Music Guru",
        "series": "AI TV Critic",
        "anime": "AI Anime Otaku"
    }
    role = roles.get(category, "AI Librarian")

    system_prompt = f"You are an {role}. Ask ONE follow-up question to refine {category} recommendations. Respond ONLY with JSON: {{\"question\": \"...\"}}"

    messages = [{"role": "system", "content": system_prompt}]
    for item in history:
        if isinstance(item, dict):
            if "question" in item: messages.append({"role": "assistant", "content": item["question"]})
            if "answer" in item: messages.append({"role": "user", "content": item["answer"]})

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 100,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(f"{API_URL}/chat/completions", headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        ai_message = result["choices"][0]["message"]["content"].strip()
        
        cleaned = extract_json_from_response(ai_message)
        try:
            parsed = json.loads(cleaned)
            question = parsed.get("question") or f"What else do you look for in a good {category}?"
        except json.JSONDecodeError:
            question = ai_message if ai_message and len(ai_message) > 5 else f"What else do you look for in a good {category}?"
            
        return jsonify({"question": question, "done": False})
    except Exception as e:
        app.logger.error(f"Error in next_question: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to process request."}), 500


@app.route("/api/recommend", methods=["POST"])
def recommend():
    if not API_KEY:
        return jsonify({"error": "API Key is not configured."}), 500

    data = request.json or {}
    history = data.get("history", [])
    category = data.get("category", "book").lower()
    
    roles = {
        "book": "sophisticated book recommendation engine acting as a digital librarian",
        "movie": "expert film critic and cinematic recommendation engine",
        "music": "expert music curator and recommendation engine",
        "series": "expert TV critic and series recommendation engine",
        "anime": "expert anime curator and recommendation engine"
    }
    role = roles.get(category, "recommendation engine")

    creator_label = "Author"
    if category == "movie":
        creator_label = "Director"
    elif category == "music":
        creator_label = "Artist"
    elif category == "series":
        creator_label = "Showrunner"
    elif category == "anime":
        creator_label = "Studio"

    system_prompt = f"""
You are a {role}.
Provide exactly 3 tailored {category} suggestions as a JSON array of objects.
STRICT JSON ONLY. No markdown, no extra text.

Object Schema:
{{
  "title": "{category.capitalize()} Title",
  "creator": "{creator_label} Name",
  "genre": "Genre",
  "summary": "1-2 sentence summary",
  "reason": "Why it fits their taste"
}}
"""

    messages = [{"role": "system", "content": system_prompt}]
    for item in history:
        if isinstance(item, dict):
            if "question" in item: messages.append({"role": "assistant", "content": item["question"]})
            if "answer" in item: messages.append({"role": "user", "content": item["answer"]})

    payload = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 2048,
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(f"{API_URL}/chat/completions", headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        result = response.json()
        ai_message = result["choices"][0]["message"]["content"].strip()
        
        cleaned = extract_json_from_response(ai_message)
        try:
            suggestions = json.loads(cleaned)
        except json.JSONDecodeError:
            return jsonify({"error": "The AI provided an invalid response format. Please try again."}), 500
        
        if isinstance(suggestions, dict):
            for value in suggestions.values():
                if isinstance(value, list):
                    suggestions = value
                    break

        return jsonify({"recommendations": suggestions})
    except Exception as e:
        app.logger.error(f"Error in recommend: {str(e)}")
        return jsonify({"error": "Failed to generate recommendations."}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)