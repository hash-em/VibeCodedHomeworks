import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List

from flask import Flask, jsonify, render_template, request

DATABASE_PATH = Path("feedback.db")

app = Flask(__name__)


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
    }


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/admin")
def admin_dashboard():
    return render_template("admin.html")


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
    finally:
        conn.close()
    return jsonify([serialize_feedback(row) for row in rows])


@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify(compute_stats())


@app.route("/api/feedback/<int:feedback_id>/status", methods=["POST"])
def update_status(feedback_id: int):
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
    conn = get_connection()
    try:
        result = conn.execute(
            "UPDATE feedback SET votes = votes + 1 WHERE id = ?", (feedback_id,)
        )
        conn.commit()
        if result.rowcount == 0:
            return jsonify({"error": "Feedback not found."}), 404
        row = conn.execute(
            "SELECT votes FROM feedback WHERE id = ?", (feedback_id,)
        ).fetchone()
    finally:
        conn.close()

    return jsonify({"message": "Vote recorded", "votes": row["votes"]})


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
