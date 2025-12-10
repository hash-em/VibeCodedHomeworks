const adminList = document.getElementById("admin-feedback-list");
const statusFilter = document.getElementById("status-filter");

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
      await fetchFeedback();
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

statusFilter.addEventListener("change", fetchFeedback);
fetchFeedback();
