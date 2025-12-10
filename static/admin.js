const adminList = document.getElementById("admin-feedback-list");
const statusFilter = document.getElementById("status-filter");
const statTotal = document.getElementById("stat-total");
const statAverage = document.getElementById("stat-average");
const statOpen = document.getElementById("stat-open");
const categoryBars = document.getElementById("category-bars");
const statusBars = document.getElementById("status-bars");
const trendBars = document.getElementById("trend-bars");
const categoryPie = document.getElementById("category-pie");
const statusPie = document.getElementById("status-pie");
const attentionList = document.getElementById("attention-list");
const adminCard = document.getElementById("admin-login-card");
const adminState = document.getElementById("admin-login-state");
const adminMessage = document.getElementById("admin-login-message");
const adminIdInput = document.getElementById("admin-id-input");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const ratingTrendEl = document.getElementById("rating-trend");
const ratingRangeSwitch = document.getElementById("rating-range");

let isAdmin = (adminCard?.dataset.isAdmin || "false") === "true";
let currentRange = "hours";
let latestStats = null;

async function fetchFeedback() {
  const params = new URLSearchParams();
  if (statusFilter?.value) {
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
      <div class="feedback-meta attention-row">Attention score <strong>${item.votes}</strong></div>
      <div class="actions">
        <label for="status-${item.id}">Update status</label>
        <select id="status-${item.id}" data-id="${item.id}" ${!isAdmin ? "disabled" : ""}>
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

    const boostBtn = document.createElement("button");
    boostBtn.type = "button";
    boostBtn.className = "button ghost";
    boostBtn.textContent = "Boost attention";
    boostBtn.disabled = !isAdmin;
    boostBtn.addEventListener("click", async () => {
      await addVote(item.id);
      await Promise.all([fetchFeedback(), fetchStats()]);
    });

    const footer = document.createElement("div");
    footer.className = "actions stack";
    footer.appendChild(boostBtn);
    wrapper.appendChild(footer);

    adminList.appendChild(wrapper);
  });
}

async function updateStatus(id, status) {
  if (!isAdmin) {
    alert("Please sign in as admin to update statuses.");
    return;
  }
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
  latestStats = data;

  statTotal.textContent = data.total_feedback;
  statAverage.textContent = data.average_rating?.toFixed(1) ?? "—";
  statOpen.textContent = (data.status_counts["New"] || 0) + (data.status_counts["In progress"] || 0);

  renderBars(categoryBars, data.category_counts, "No feedback yet.");
  renderBars(statusBars, data.status_counts, "No statuses yet.");
  renderTrend(trendBars, data.trend);
  renderPie(categoryPie, data.category_counts);
  renderPie(statusPie, data.status_counts);
  renderAttention(data.top_attention || []);
  renderRatingTrend(data.rating_trends?.[currentRange] || []);
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

function renderPie(canvas, entries) {
  const ctx = canvas.getContext("2d");
  const pairs = Object.entries(entries || {});
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!pairs.length) {
    ctx.fillStyle = "#c7ced6";
    ctx.beginPath();
    ctx.arc(80, 80, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b7480";
    ctx.fillText("No data", 50, 84);
    return;
  }

  const total = pairs.reduce((sum, [, count]) => sum + count, 0);
  let start = -Math.PI / 2;
  pairs.forEach(([label, count], index) => {
    const slice = (count / total) * Math.PI * 2;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(80, 80);
    ctx.fillStyle = colorForIndex(index);
    ctx.arc(80, 80, 70, start, end);
    ctx.fill();
    start = end;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(80, 80, 38, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function renderAttention(items) {
  attentionList.innerHTML = "";
  if (!items.length) {
    attentionList.innerHTML = '<p class="muted">No votes yet. Boost attention to prioritize items.</p>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "attention-item";
    const categories = item.categories.map((c) => `<span class="category-tag">${c}</span>`).join("");
    row.innerHTML = `
      <div class="attention-meta">
        <span class="pill pill-soft">#${item.id}</span>
        <span class="muted">${new Date(item.created_at).toLocaleDateString()}</span>
      </div>
      <div class="attention-body">
        <div class="comment">${item.comment || "(No comment)"}</div>
        <div class="feedback-categories">${categories}</div>
      </div>
      <div class="attention-score">${item.votes} ⭐</div>
    `;
    attentionList.appendChild(row);
  });
}

function renderRatingTrend(points) {
  ratingTrendEl.innerHTML = "";
  if (!points.length) {
    ratingTrendEl.innerHTML = '<p class="muted">No ratings yet.</p>';
    return;
  }
  const validPoints = points.filter((p) => p.average !== null && p.average !== undefined);
  if (!validPoints.length) {
    ratingTrendEl.innerHTML = '<p class="muted">No ratings yet.</p>';
    return;
  }
  const max = 5;
  validPoints.forEach((point) => {
    const bar = document.createElement("div");
    bar.className = "rating-bar";
    const height = (point.average / max) * 100;
    bar.innerHTML = `
      <div class="rating-bar-fill" style="height:${height}%"></div>
      <span class="rating-bar-label">${point.label}</span>
      <span class="rating-bar-value">${point.average.toFixed(1)}</span>
    `;
    ratingTrendEl.appendChild(bar);
  });
}

function colorForIndex(index) {
  const palette = ["#f97463", "#f2c84b", "#6cc7a1", "#62a8f3", "#c17dd4", "#ff9f6e"];
  return palette[index % palette.length];
}

async function addVote(id) {
  if (!isAdmin) {
    alert("Sign in as admin to boost attention.");
    return;
  }
  const response = await fetch(`/api/feedback/${id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote: "up" }),
  });
  if (!response.ok) {
    const data = await response.json();
    alert(data.error || "Unable to vote");
  }
}

async function handleAdminLogin() {
  adminMessage.textContent = "";
  const id = adminIdInput.value.trim();
  if (!id) {
    adminMessage.textContent = "Enter the admin ID.";
    return;
  }
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await response.json();
  if (!response.ok) {
    adminMessage.textContent = data.error || "Unable to sign in";
    adminMessage.style.color = "red";
    return;
  }
  isAdmin = data.role === "admin";
  adminState.textContent = isAdmin ? "Admin" : "Locked";
  adminMessage.textContent = isAdmin ? "Unlocked" : "Signed in";
  adminMessage.style.color = "var(--success)";
  await Promise.all([fetchFeedback(), fetchStats()]);
}

async function handleAdminLogout() {
  await fetch("/api/logout", { method: "POST" });
  isAdmin = false;
  adminState.textContent = "Locked";
  adminMessage.textContent = "";
  await Promise.all([fetchFeedback(), fetchStats()]);
}

statusFilter?.addEventListener("change", fetchFeedback);
adminLoginBtn?.addEventListener("click", handleAdminLogin);
adminLogoutBtn?.addEventListener("click", handleAdminLogout);
ratingRangeSwitch?.addEventListener("click", (event) => {
  if (event.target.tagName !== "BUTTON") return;
  currentRange = event.target.dataset.range;
  ratingRangeSwitch.querySelectorAll("button").forEach((btn) => btn.classList.toggle("active", btn === event.target));
  if (latestStats) {
    renderRatingTrend(latestStats.rating_trends?.[currentRange] || []);
  }
});

fetchFeedback();
fetchStats();
