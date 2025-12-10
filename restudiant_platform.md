# Restudiant Platform Requirements and UX Outline

## Goal
A lightweight feedback platform for university restaurants that lets students quickly submit feedback (optionally anonymously) and enables management to triage, act on, and analyze issues over time.

## Roles
- **Student/User**: Submit feedback with ratings and optional comments/photos; view confirmation and (optionally) their submission history.
- **Admin/Management**: View, filter, and respond to feedback; manage status; review analytics and reports.

## Student Experience
1. **Access**
   - Entry via QR code on-site or direct app link.
   - Optional login to enable submission history; anonymous submissions allowed.

2. **Feedback Form**
   - Select one or more categories: Hygiene, Food quality, Menu variety, Presentation, Staff behavior.
   - Ratings (1–5) captured per selected category; optional overall rating if desired.
   - Optional free-text comments for details or suggestions.
   - Optional photo upload to document hygiene/presentation.
   - Submit shows a confirmation state: “Feedback sent successfully.”

3. **Submission History (optional MVP)**
   - List of past submissions with status badges (Reviewed, In progress, Resolved).
   - Detail view shows category ratings, comment, photo (if any), and admin status updates.

## Admin Experience
1. **Authentication**
   - Username/password login (or secure QR for internal terminals).

2. **Dashboard Overview**
   - KPIs for total feedback today/week/month.
   - Top recurring categories (e.g., hygiene, menu, presentation).
   - Urgent items flagged by multiple complaints or low ratings.

3. **Feedback List & Detail**
   - Table with date/time, category, rating, comment, photo indicator, and status (New/In progress/Resolved).
   - Filters by date range, category, rating, and urgency.
   - Detail view shows full comment, ratings per category, photos, and action buttons:
     - Mark as **In progress** or **Resolved**.
     - Add internal notes/actions taken.

4. **Reports & Analytics**
   - Charts for trends over time (weekly/monthly) by category.
   - Breakdown of recurring issues (e.g., hygiene spikes at peak hours).
   - Export to PDF/Excel for management meetings.

5. **Notifications (QoL)**
   - Push alerts to management when multiple complaints hit the same category/time window (e.g., hygiene cluster).
   - Student notification (if identifiable): “Your issue has been addressed.”

## Data Model (suggested)
- **User**: id, role (student/admin), name/email (optional for students), auth credentials (admins only).
- **Feedback**: id, student_id (nullable for anonymous), submitted_at, status (new/in_progress/resolved), urgency_score, comment, photo_url.
- **FeedbackCategory**: feedback_id, category (enum: hygiene/food_quality/menu_variety/presentation/staff_behavior), rating (1–5).
- **AdminNote**: feedback_id, admin_id, note, created_at, status_change (optional).
- **NotificationLog** (optional): event_type, audience (admin/student), status, created_at.

## API / Feature Outline
- **Student-facing**
  - `POST /feedback`: create feedback with categories, ratings, comment, photo (upload or URL), optional contact token.
  - `GET /feedback` (optional): list student’s own submissions with statuses when authenticated.
- **Admin-facing**
  - `POST /auth/login`: obtain admin session/token.
  - `GET /dashboard/summary`: aggregate metrics for KPIs and urgent items.
  - `GET /feedback`: list with filters (date, category, rating, status, urgency).
  - `GET /feedback/{id}`: detail view with category ratings, comments, photos, notes.
  - `PATCH /feedback/{id}`: update status (in progress/resolved) and urgency.
  - `POST /feedback/{id}/notes`: add internal notes/actions.
  - `GET /reports`: analytics data for charts and exports.

## MVP vs. Later Enhancements
- **MVP**: QR/direct access, multi-category feedback with per-category ratings, optional comments/photos, confirmation screen, admin dashboard with list/detail, status updates, basic filters, weekly/monthly summary chart.
- **Post-MVP QoL**: Push notifications, student status alerts, menu-planning integration (surface top menu requests), richer analytics (peak-hour detection), PDF/Excel export automation.

## UI Screen Map
- **Student**: Home/QR entry → Feedback form → Confirmation → (optional) Submission history & detail.
- **Admin**: Login → Dashboard overview → Feedback list → Feedback detail (status/actions) → Reports/analytics.
