const form = document.getElementById("feedback-form");
const messageEl = document.getElementById("form-message");
const recentList = document.getElementById("recent-list");

async function fetchRecent() {
  const response = await fetch("/api/feedback");
  const data = await response.json();
  renderFeedbackList(data, recentList, false);
}

function renderFeedbackList(items, container, includeActions) {
  container.innerHTML = "";
  if (!items.length) {
    container.innerHTML = '<p class="muted">No feedback yet.</p>';
    return;
  }

  items.forEach((item) => {
    const wrapper = document.createElement("div");
    wrapper.className = "feedback-item";

    wrapper.innerHTML = `
      <div class="feedback-meta">
        <span>Rating: ${"⭐".repeat(item.rating)}</span>
        <span>${new Date(item.created_at).toLocaleString()}</span>
        <span class="status-pill" data-status="${item.status}">${item.status}</span>
      </div>
      <div class="feedback-categories">
        ${item.categories.map((c) => `<span class="category-tag">${c}</span>`).join("")}
      </div>
      <div class="comment">${item.comment || "(No additional comments)"}</div>
    `;

    if (includeActions) {
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.innerHTML = `
        <label>Update status</label>
        <select data-id="${item.id}">
          ${["New", "In progress", "Resolved"]
            .map(
              (status) =>
                `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`
            )
            .join("")}
        </select>
      `;
      wrapper.appendChild(actions);
    }

    container.appendChild(wrapper);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "Sending...";

  const formData = new FormData(form);
  const categories = formData.getAll("categories");
  const rating = formData.get("rating");
  const comment = formData.get("comment")?.trim() ?? "";

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories, rating, comment }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to submit feedback");
    }

    messageEl.textContent = data.message;
    messageEl.style.color = "green";
    form.reset();
    document.getElementById("rating").value = 5;
    await fetchRecent();
  } catch (error) {
    messageEl.textContent = error.message;
    messageEl.style.color = "red";
  }
});

fetchRecent();
