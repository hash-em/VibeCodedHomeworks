# VibeCodedHomeworks

This repository includes a simple Flask-based implementation of the **Restudiant Platform**, a feedback system for university restaurants.

## Running locally

1. Install dependencies (Flask only) with `pip install flask`.
2. Start the server with `python app.py` (a `feedback.db` SQLite file will be created automatically).
3. Visit `http://localhost:5000/` to submit feedback and `http://localhost:5000/admin` to view and update submissions.

See [`restudiant_platform.md`](restudiant_platform.md) for the original requirements, roles, student/admin flows, data model suggestions, and API surface that guided the implementation.
