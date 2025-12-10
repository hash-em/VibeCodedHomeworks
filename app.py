import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

from flask import Flask, jsonify, render_template, request, session

DATABASE_PATH = Path("feedback.db")

app = Flask(__name__)
app.secret_key = "restudiant-secret-key"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                categories TEXT NOT NULL,
                rating INTEGER NOT NULL,
                comment TEXT,
                status TEXT NOT NULL DEFAULT 'New',
                votes INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS feedback_votes (
                feedback_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
                PRIMARY KEY (feedback_id, user_id),
                FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE
            );
            """
        )
        # Backfill column for older databases
        columns = {row[1] for row in conn.execute("PRAGMA table_info(feedback)")}
        if "votes" not in columns:
            conn.execute("ALTER TABLE feedback ADD COLUMN votes INTEGER NOT NULL DEFAULT 0")
        conn.commit()
    finally:
        conn.close()


# Ensure the database exists when the app module is imported (e.g., via `flask run`).
init_db()


def serialize_feedback(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "categories": json.loads(row["categories"]),
        "rating": row["rating"],
        "comment": row["comment"],
        "status": row["status"],
        "votes": row["votes"],
        "created_at": row["created_at"],
    }


def compute_stats() -> dict:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT * FROM feedback").fetchall()
    finally:
        conn.close()

    total = len(rows)
    if total == 0:
        return {
            "total_feedback": 0,
            "average_rating": None,
            "status_counts": {},
            "category_counts": {},
            "trend": [],
            "top_attention": [],
            "rating_trends": {"hours": [], "days": [], "weeks": [], "months": []},
        }

    status_counts = {}
    category_counts = {}
    ratings: List[int] = []
    attention: List[dict] = []
    for row in rows:
        status = row["status"]
        status_counts[status] = status_counts.get(status, 0) + 1

        categories = json.loads(row["categories"])
        for cat in categories:
            category_counts[cat] = category_counts.get(cat, 0) + 1

        ratings.append(row["rating"])
        attention.append(
            {
                "id": row["id"],
                "votes": row["votes"],
                "comment": row["comment"],
                "categories": categories,
                "rating": row["rating"],
                "status": row["status"],
                "created_at": row["created_at"],
            }
        )

    # Trend for last 7 days including today
    today = datetime.utcnow().date()
    trend = []
    for i in range(6, -1, -1):
        day = today.fromordinal(today.toordinal() - i)
        day_str = day.isoformat()
        day_count = 0
        for row in rows:
            try:
                created_date = datetime.fromisoformat(row["created_at"]).date()
            except ValueError:
                continue
            if created_date == day:
                day_count += 1
        trend.append({"date": day_str, "count": day_count})

    average_rating = sum(ratings) / len(ratings) if ratings else None
    return {
        "total_feedback": total,
        "average_rating": average_rating,
        "status_counts": status_counts,
        "category_counts": category_counts,
        "trend": trend,
        "top_attention": sorted(attention, key=lambda item: item["votes"], reverse=True)[:3],
        "rating_trends": {
            "hours": aggregate_ratings(rows, bucket="hour"),
            "days": aggregate_ratings(rows, bucket="day"),
            "weeks": aggregate_ratings(rows, bucket="week"),
            "months": aggregate_ratings(rows, bucket="month"),
        },
    }


def aggregate_ratings(rows: List[sqlite3.Row], bucket: str) -> List[dict]:
    now = datetime.utcnow()

    def iter_windows():
        if bucket == "hour":
            for i in range(23, -1, -1):
                start = (now - timedelta(hours=i)).replace(minute=0, second=0, microsecond=0)
                yield start, start + timedelta(hours=1)
        elif bucket == "day":
            for i in range(6, -1, -1):
                start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                yield start, start + timedelta(days=1)
        elif bucket == "week":
            start_of_week = now - timedelta(days=now.weekday())
            for i in range(7, -1, -1):
                start = (start_of_week - timedelta(weeks=i)).replace(hour=0, minute=0, second=0, microsecond=0)
                yield start, start + timedelta(weeks=1)
        elif bucket == "month":
            base = datetime(now.year, now.month, 1)
            for i in range(6, -1, -1):
                total_months = (base.year * 12 + base.month - 1) - i
                year = total_months // 12
                month = total_months % 12 + 1
                start = datetime(year, month, 1)
                if month == 12:
                    end = datetime(year + 1, 1, 1)
                else:
                    end = datetime(year, month + 1, 1)
                yield start, end
        else:
            return []

    data = []
    for start, end in iter_windows():
        bucket_ratings: List[int] = []
        for row in rows:
            try:
                created = datetime.fromisoformat(row["created_at"])
            except ValueError:
                continue
            if start <= created < end:
                bucket_ratings.append(row["rating"])
        avg = sum(bucket_ratings) / len(bucket_ratings) if bucket_ratings else None
        label = ""
        if bucket == "hour":
            label = start.strftime("%H:%M")
        elif bucket == "day":
            label = start.strftime("%a")
        elif bucket == "week":
            label = f"Week of {start.strftime('%b %d')}"
        elif bucket == "month":
            label = start.strftime("%b %Y")
        data.append({"label": label, "average": avg, "count": len(bucket_ratings)})

    return data


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/admin")
def admin_dashboard():
    return render_template("admin.html", is_admin=session.get("role") == "admin")


@app.route("/api/login", methods=["POST"])
def login():
    payload = request.get_json(force=True)
    user_id = (payload.get("id") or "").strip()

    if user_id == "admin":
        session["role"] = "admin"
        session["user_id"] = "admin"
        return jsonify({"message": "Welcome, admin", "role": "admin"})

    if not user_id.isdigit() or len(user_id) < 5:
        return jsonify({"error": "Please enter a valid national ID."}), 400

    session["role"] = "user"
    session["user_id"] = user_id
    return jsonify({"message": "Signed in", "role": "user", "user_id": user_id})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Signed out"})


@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    payload = request.get_json(force=True)
    categories: List[str] = payload.get("categories", [])
    rating = payload.get("rating")
    comment = payload.get("comment", "").strip()

    if not categories:
        return jsonify({"error": "Please select at least one category."}), 400

    try:
        rating_int = int(rating)
    except (TypeError, ValueError):
        return jsonify({"error": "Rating must be a whole number."}), 400

    if not 1 <= rating_int <= 5:
        return jsonify({"error": "Rating must be between 1 and 5."}), 400

    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO feedback (categories, rating, comment, status, votes, created_at) VALUES (?, ?, ?, 'New', 0, ?)",
            (json.dumps(categories), rating_int, comment, datetime.utcnow().isoformat()),
        )
        conn.commit()
    finally:
        conn.close()

    return jsonify({"message": "Feedback sent successfully"}), 201


@app.route("/api/feedback", methods=["GET"])
def list_feedback():
    status_filter = request.args.get("status")
    conn = get_connection()
    try:
        if status_filter:
            rows = conn.execute(
                "SELECT * FROM feedback WHERE status = ? ORDER BY created_at DESC", (status_filter,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM feedback ORDER BY created_at DESC").fetchall()

        user_votes = {}
        if session.get("user_id"):
            vote_rows = conn.execute(
                "SELECT feedback_id, vote FROM feedback_votes WHERE user_id = ?", (session["user_id"],)
            ).fetchall()
            user_votes = {row["feedback_id"]: row["vote"] for row in vote_rows}
    finally:
        conn.close()
    serialized = [serialize_feedback(row) for row in rows]
    for item in serialized:
        item["my_vote"] = user_votes.get(item["id"])
    return jsonify(serialized)


@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify(compute_stats())


@app.route("/api/feedback/<int:feedback_id>/status", methods=["POST"])
def update_status(feedback_id: int):
    if session.get("role") != "admin":
        return jsonify({"error": "Admin privileges required."}), 403

    payload = request.get_json(force=True)
    new_status = payload.get("status")
    if new_status not in {"New", "In progress", "Resolved"}:
        return jsonify({"error": "Status must be New, In progress, or Resolved."}), 400

    conn = get_connection()
    try:
        result = conn.execute(
            "UPDATE feedback SET status = ? WHERE id = ?", (new_status, feedback_id)
        )
        conn.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Feedback not found."}), 404
    finally:
        conn.close()

    return jsonify({"message": "Status updated"})


@app.route("/api/feedback/<int:feedback_id>/vote", methods=["POST"])
def add_vote(feedback_id: int):
    if not session.get("user_id"):
        return jsonify({"error": "Please log in to vote."}), 401

    payload = request.get_json(force=True)
    direction = payload.get("vote")
    if direction not in {"up", "down"}:
        return jsonify({"error": "Vote must be 'up' or 'down'."}), 400

    vote_value = 1 if direction == "up" else -1
    conn = get_connection()
    try:
        exists = conn.execute("SELECT 1 FROM feedback WHERE id = ?", (feedback_id,)).fetchone()
        if not exists:
            return jsonify({"error": "Feedback not found."}), 404

        conn.execute(
            "REPLACE INTO feedback_votes (feedback_id, user_id, vote) VALUES (?, ?, ?)",
            (feedback_id, session["user_id"], vote_value),
        )
        total = conn.execute(
            "SELECT COALESCE(SUM(vote), 0) as total FROM feedback_votes WHERE feedback_id = ?",
            (feedback_id,),
        ).fetchone()["total"]
        conn.execute("UPDATE feedback SET votes = ? WHERE id = ?", (total, feedback_id))
        conn.commit()
    finally:
        conn.close()

    return jsonify({"message": "Vote recorded", "votes": total, "my_vote": vote_value})


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
