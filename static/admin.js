const adminList = document.getElementById("admin-feedback-list");
const statusFilter = document.getElementById("status-filter");
const statTotal = document.getElementById("stat-total");
const statAverage = document.getElementById("stat-average");
const statOpen = document.getElementById("stat-open");
const categoryBars = document.getElementById("category-bars");
const statusBars = document.getElementById("status-bars");
const trendBars = document.getElementById("trend-bars");

async function fetchFeedback() {
  const params = new URLSearchParams();
  if (statusFilter.value) {
    params.set("status", statusFilter.value);
  }
  const response = await fetch(`/api/feedback${params.toString() ? `?${params}` : ""}`);
  const data = await response.json();
  renderFeedbackList(data);
}

function renderFeedbackList(items) {
  adminList.innerHTML = "";
  if (!items.length) {
    adminList.innerHTML = '<p class="muted">No feedback found for this filter.</p>';
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "feedback-item";

    wrapper.innerHTML = `
      <div class="feedback-meta">
        <span>#${item.id}</span>
        <span>${new Date(item.created_at).toLocaleString()}</span>
        <span class="status-pill" data-status="${item.status}">${item.status}</span>
      </div>
      <div class="feedback-categories">
        ${item.categories.map((c) => `<span class="category-tag">${c}</span>`).join("")}
      </div>
      <div class="comment">${item.comment || "(No additional comments)"}</div>
      <div class="feedback-meta">Rating: ${"⭐".repeat(item.rating)}</div>
      <div class="actions">
        <label for="status-${item.id}">Update status</label>
        <select id="status-${item.id}" data-id="${item.id}">
          ${["New", "In progress", "Resolved"]
            .map(
              (status) =>
                `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`
            )
            .join("")}
        </select>
      </div>
    `;

    const select = wrapper.querySelector("select");
    select.addEventListener("change", async (event) => {
      const newStatus = event.target.value;
      await updateStatus(item.id, newStatus);
      await Promise.all([fetchFeedback(), fetchStats()]);
    });

    adminList.appendChild(wrapper);
  });
}

async function updateStatus(id, status) {
  const response = await fetch(`/api/feedback/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const data = await response.json();
    alert(data.error || "Unable to update status");
  }
}

async function fetchStats() {
  const response = await fetch("/api/stats");
  const data = await response.json();

  statTotal.textContent = data.total_feedback;
  statAverage.textContent = data.average_rating?.toFixed(1) ?? "—";
  statOpen.textContent = (data.status_counts["New"] || 0) + (data.status_counts["In progress"] || 0);

  renderBars(categoryBars, data.category_counts, "No feedback yet.");
  renderBars(statusBars, data.status_counts, "No statuses yet.");
  renderTrend(trendBars, data.trend);
}

function renderBars(container, entries, emptyText) {
  container.innerHTML = "";
  const pairs = Object.entries(entries || {}).sort((a, b) => b[1] - a[1]);
  if (!pairs.length) {
    container.innerHTML = `<p class="muted">${emptyText}</p>`;
    return;
  }

  const max = Math.max(...pairs.map(([_, count]) => count));
  pairs.forEach(([label, count]) => {
    const item = document.createElement("div");
    item.className = "bar-item";
    const width = max ? Math.max((count / max) * 100, 8) : 0;
    item.innerHTML = `
      <div class="bar-top">
        <span>${label}</span>
        <span>${count}</span>
      </div>
      <div class="bar"><span style="width:${width}%"></span></div>
    `;
    container.appendChild(item);
  });
}

function renderTrend(container, trend) {
  container.innerHTML = "";
  if (!trend.length) {
    container.innerHTML = '<p class="muted">No activity yet.</p>';
    return;
  }
  const max = Math.max(...trend.map((item) => item.count));
  trend.forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-item";
    const width = max ? Math.max((item.count / max) * 100, 8) : 0;
    row.innerHTML = `
      <div class="bar-top">
        <span>${item.date}</span>
        <span>${item.count}</span>
      </div>
      <div class="bar"><span style="width:${width}%"></span></div>
    `;
    container.appendChild(row);
  });
}

statusFilter.addEventListener("change", fetchFeedback);
fetchFeedback();
fetchStats();
