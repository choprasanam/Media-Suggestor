# NextBinge (Media-Suggestor)

> An AI-powered, conversational entertainment recommendation engine. NextBinge asks a short series of adaptive follow-up questions and then generates tailored suggestions for books, movies, music, TV series, or anime.

**Live demo:** https://media-suggestor.vercel.app
**Source:** https://github.com/choprasanam/NextBinge

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Frontend Flow](#frontend-flow)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Overview

NextBinge is a lightweight Flask web application that pairs a minimal, editorial-styled UI with an LLM backend (via NVIDIA's API, running Meta's Llama 3.1 8B Instruct model) to conduct a short interview with the user and then produce three personalized recommendations in the chosen media category.

The user selects a category (Book, Movie, Music, Series, or Anime), answers up to 5 adaptive questions posed by the "AI curator," and receives 3 curated suggestions, each with a title, creator, genre, summary, and a personalized reason for the recommendation.

## Features

- **Five content categories**: Books, Movies, Music, Series, Anime
- **Adaptive questioning**: Each follow-up question is generated dynamically by the LLM based on prior answers (up to 5 questions per session)
- **Role-based AI personas**: The model adopts a category-specific persona (e.g., "AI Librarian," "AI Film Critic," "AI Music Guru," "AI TV Critic," "AI Anime Otaku") for more contextual questioning and recommendations
- **Structured JSON recommendations**: Each recommendation includes `title`, `creator`, `genre`, `summary`, and `reason`
- **Progress indicator**: Visual progress bar tracks quiz progress ("Inquiry X of 5")
- **Graceful error handling**: Dedicated error state with a retry mechanism if the API call fails
- **Responsive, themed UI**: Dark "editorial" theme using Playfair Display and Lato fonts with a gold accent palette
- **Serverless-ready**: Configured for one-click deployment to Vercel

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask |
| WSGI server (production) | Gunicorn |
| AI Inference | NVIDIA API (`integrate.api.nvidia.com`) running `meta/llama-3.1-8b-instruct` |
| HTTP client | `requests` |
| Config management | `python-dotenv` |
| Frontend | Vanilla HTML, CSS, JavaScript (no framework) |
| Fonts | Google Fonts (Playfair Display, Lato) |
| Deployment | Vercel (`@vercel/python` builder) |

Language breakdown (per GitHub): CSS 33.9%, JavaScript 26.8%, Python 20.3%, HTML 19.0%.

## Project Structure

```
NextBinge/
├── app.py                # Flask application: routes, LLM prompt logic, JSON parsing
├── requirements.txt       # Python dependencies
├── vercel.json             # Vercel deployment/build configuration
├── server_debug.log       # Local debug log output (generated at runtime)
├── static/
│   ├── script.js           # Frontend state machine & API calls
│   └── style.css           # Editorial dark theme styling
└── templates/
    └── index.html          # Single-page application markup
```

## How It Works

1. **Category selection** — The user picks one of five categories on the landing screen.
2. **Question loop** — The frontend calls `POST /api/next_question` with the running history of Q&A pairs. On the first call (empty history), the backend returns a fixed opening question tailored to the category. On subsequent calls, it prompts the LLM (in a category-specific persona) to generate one new follow-up question based on the conversation so far.
3. **Answer collection** — The user's answer is appended to the `history` array client-side after each question, and the loop repeats until 5 Q&A pairs are collected.
4. **Recommendation generation** — Once history reaches 5 entries, the frontend calls `POST /api/recommend`, which prompts the LLM to act as a category-specific expert (e.g., "expert film critic") and return exactly 3 suggestions as a strict JSON array.
5. **Rendering** — Recommendations are rendered as animated cards, each showing the title, creator (labeled contextually — Author/Director/Artist/Showrunner/Studio), genre, summary, and personalized reasoning.

### AI Prompting Details

- The backend uses a helper, `extract_json_from_response()`, to robustly pull a JSON object/array out of the raw LLM text response — handling cases where the model wraps output in markdown code fences or adds stray text around the JSON.
- If JSON parsing fails during the question step, the app falls back to using the raw model text (if long enough) or a generic follow-up question.
- If JSON parsing fails during the recommendation step, the API returns a `500` error asking the user to retry.

## API Reference

### `GET /`
Renders the single-page frontend (`templates/index.html`).

### `POST /api/next_question`

Generates the next adaptive question in the conversation.

**Request body:**
```json
{
  "history": [
    { "question": "What kind of stories are you drawn to?", "answer": "Slow-burn mysteries" }
  ],
  "category": "book"
}
```

**Response (question available):**
```json
{ "question": "Do you prefer character-driven plots or intricate puzzles?", "done": false }
```

**Response (history complete, 5+ entries):**
```json
{ "done": true }
```

**Error response:**
```json
{ "error": "API Key is not configured." }
```
Returned with HTTP `500` if `API_KEY` is missing, or if the upstream LLM call fails.

### `POST /api/recommend`

Generates 3 tailored recommendations based on the full Q&A history.

**Request body:**
```json
{
  "history": [ { "question": "...", "answer": "..." }, "... up to 5 pairs" ],
  "category": "movie"
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "title": "Example Title",
      "creator": "Example Director",
      "genre": "Neo-noir Thriller",
      "summary": "A one-to-two sentence summary of the work.",
      "reason": "Why this fits the user's stated preferences."
    }
  ]
}
```

**Error response (HTTP 500):**
```json
{ "error": "The AI provided an invalid response format. Please try again." }
```

## Setup & Installation

### Prerequisites
- Python 3.8+
- An NVIDIA API key with access to the `integrate.api.nvidia.com` inference endpoint

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/choprasanam/NextBinge.git
cd NextBinge

# 2. Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
echo "API_KEY=your_nvidia_api_key_here" > .env

# 5. Run the app locally
python app.py
```

The app will be available at `http://localhost:5000` (Flask's built-in dev server, `debug=True`).

For a production-like run:
```bash
gunicorn app:app
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `API_KEY` | Yes | API key for NVIDIA's integrate API (`https://integrate.api.nvidia.com/v1`), used to authenticate chat completion requests to the `meta/llama-3.1-8b-instruct` model |

Environment variables are loaded via `python-dotenv` from a local `.env` file (not committed to the repo). If `API_KEY` is missing, both API endpoints return an HTTP `500` error with `"API Key is not configured."`

## Deployment

The repository includes a `vercel.json` configured to deploy the Flask app as a Python serverless function:

```json
{
  "version": 2,
  "builds": [{ "src": "app.py", "use": "@vercel/python" }],
  "routes": [{ "src": "/(.*)", "dest": "app.py" }]
}
```

To deploy:
1. Push the repository to your own GitHub account (or fork it).
2. Import the project into [Vercel](https://vercel.com).
3. Add the `API_KEY` environment variable in the Vercel project settings.
4. Deploy — Vercel will route all traffic to `app.py` via the Python builder.

The live instance is hosted at **media-suggestor.vercel.app**.

## Frontend Flow

`static/script.js` implements a small client-side state machine that toggles visibility between six UI sections in `index.html`:

1. `category-section` — category picker (Book/Movie/Music/Series/Anime)
2. `start-section` — category-specific intro screen with a "Begin the Conversation" CTA
3. `quiz-section` — active question/answer form
4. `loading-section` — spinner shown while waiting on API responses
5. `results-section` — recommendation cards grid
6. `error-section` — shown on any fetch failure, with a "Try Again" button

Key implementation details:
- `MAX_QUESTIONS = 5` caps the interview length.
- A `history` array (in-memory, not persisted) stores `{ question, answer }` pairs across the session.
- `renderItems()` builds recommendation cards and sanitizes all model-provided text via a local `escapeHtml()` function to prevent HTML/script injection from LLM output.
- Progress bar percentage and "Inquiry X of 5" label are recalculated after each answer via `updateProgress()`.

## Known Limitations

- **No persistence**: Quiz history and results are stored only in browser memory; refreshing the page resets the session.
- **No authentication or rate limiting**: The API endpoints are open and could be abused if deployed publicly without additional protections.
- **Single LLM provider dependency**: The app is tightly coupled to NVIDIA's hosted `meta/llama-3.1-8b-instruct` model and endpoint; provider outages directly affect app availability.
- **Best-effort JSON parsing**: While `extract_json_from_response()` adds resilience, malformed LLM output can still surface as a generic error to the user.
- **Minimal README**: The repository's own `README.md` currently contains only the project title; this document is intended to supplement it.

## License

No `LICENSE` file is present in the repository at the time of writing. Confirm licensing terms with the repository owner ([choprasanam](https://github.com/choprasanam)) before reuse or redistribution.
