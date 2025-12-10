const form = document.getElementById("feedback-form");
const messageEl = document.getElementById("form-message");
const recentList = document.getElementById("recent-list");
const ratingButtons = Array.from(document.querySelectorAll(".rating-row .star"));
const ratingInput = document.getElementById("rating");
const ratingLabel = document.getElementById("rating-label");
const userIdInput = document.getElementById("user-id-input");
const loginBtn = document.getElementById("user-login-btn");
const logoutBtn = document.getElementById("user-logout-btn");
const loginMessage = document.getElementById("user-login-message");
const loginState = document.getElementById("user-login-state");
let currentUserId = localStorage.getItem("restudiant:userId") || "";

const ratingCopy = {
  1: "Needs a rescue",
  2: "Could be warmer",
  3: "Okay",
  4: "Tasty",
  5: "Great",
};

async function fetchRecent() {
  const response = await fetch("/api/feedback");
  const data = await response.json();
  renderFeedbackList(data, recentList);
}

function setRating(value) {
  ratingInput.value = value;
  ratingLabel.textContent = ratingCopy[value];
  ratingButtons.forEach((btn) => {
    const isActive = Number(btn.dataset.value) <= value;
    btn.classList.toggle("active", isActive);
  });
}

ratingButtons.forEach((button) => {
  button.addEventListener("click", () => setRating(Number(button.dataset.value)));
});

setRating(Number(ratingInput.value));

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
        <span class="rating-stars">${"⭐".repeat(item.rating)}</span>
        <span>${new Date(item.created_at).toLocaleString()}</span>
        <span class="status-pill" data-status="${item.status}">${item.status}</span>
      </div>
      <div class="feedback-categories">
        ${item.categories.map((c) => `<span class="category-tag">${c}</span>`).join("")}
      </div>
      <div class="comment">${item.comment || "(No additional comments)"}</div>
    `;

    const voteRow = document.createElement("div");
    voteRow.className = "vote-row";
    voteRow.innerHTML = `
      <button class="vote-btn" data-dir="up" aria-label="Agree" ${!currentUserId ? "disabled" : ""}>
        👍
      </button>
      <span class="vote-count">${item.votes}</span>
      <button class="vote-btn" data-dir="down" aria-label="Disagree" ${!currentUserId ? "disabled" : ""}>
        👎
      </button>
      <span class="muted">Attention weight</span>
    `;
    const voteButtons = voteRow.querySelectorAll(".vote-btn");
    const upBtn = voteButtons[0];
    const downBtn = voteButtons[1];
    updateVoteStyles(upBtn, downBtn, item.my_vote);
    upBtn.addEventListener("click", async () => {
      await sendVote(item.id, "up");
    });
    downBtn.addEventListener("click", async () => {
      await sendVote(item.id, "down");
    });
    wrapper.appendChild(voteRow);

    container.appendChild(wrapper);
  });
}

function updateVoteStyles(upBtn, downBtn, vote) {
  upBtn.classList.toggle("active", vote === 1);
  downBtn.classList.toggle("active", vote === -1);
}

async function sendVote(id, direction) {
  if (!currentUserId) {
    loginMessage.textContent = "Please sign in to vote.";
    loginMessage.style.color = "red";
    return;
  }
  const response = await fetch(`/api/feedback/${id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote: direction }),
  });
  if (!response.ok) {
    const data = await response.json();
    alert(data.error || "Unable to vote");
    return;
  }
  await fetchRecent();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "Sending...";
  messageEl.style.color = "var(--muted)";

  if (!currentUserId) {
    messageEl.textContent = "Please sign in with your national ID first.";
    messageEl.style.color = "red";
    return;
  }

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
    messageEl.style.color = "var(--success)";
    form.reset();
    setRating(5);
    await fetchRecent();
  } catch (error) {
    messageEl.textContent = error.message;
    messageEl.style.color = "red";
  }
});

async function handleLogin() {
  const id = userIdInput.value.trim();
  loginMessage.textContent = "";
  if (!id) {
    loginMessage.textContent = "Enter your national ID";
    loginMessage.style.color = "red";
    return;
  }
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await response.json();
  if (!response.ok) {
    loginMessage.textContent = data.error || "Unable to sign in";
    loginMessage.style.color = "red";
    return;
  }
  currentUserId = id;
  localStorage.setItem("restudiant:userId", id);
  loginMessage.textContent = "Signed in";
  loginMessage.style.color = "var(--success)";
  loginState.textContent = `Signed in as ${id}`;
  toggleVoteButtons(true);
  await fetchRecent();
}

async function handleLogout() {
  await fetch("/api/logout", { method: "POST" });
  currentUserId = "";
  localStorage.removeItem("restudiant:userId");
  loginState.textContent = "Not signed in";
  loginMessage.textContent = "";
  toggleVoteButtons(false);
  await fetchRecent();
}

function toggleVoteButtons(enabled) {
  document.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.disabled = !enabled;
  });
}

loginBtn?.addEventListener("click", handleLogin);
logoutBtn?.addEventListener("click", handleLogout);

if (currentUserId) {
  userIdInput.value = currentUserId;
  loginState.textContent = `Signed in as ${currentUserId}`;
  handleLogin();
}

fetchRecent();
