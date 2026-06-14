/**
 * Poll page views – main page, card grid, individual cards.
 */
import { layout } from "./layout";
import { escapeHtml, csrfField } from "../utils/html";
import { AVAILABLE_TIMES, type TimeSlot } from "../utils/time";
import type { OptionWithVotes } from "../db/schema";

interface PollPageData {
  userName: string;
  selectedTime: TimeSlot;
  options: OptionWithVotes[];
  totalVotes: number;
  unvotedCount: number;
  userVotedPorts: string[];
  csrfToken: string;
}

export function renderPollPage(data: PollPageData): string {
  const wsScript = `
  <script src="/public/js/ws.js"></script>
  <script>
    initWebSocket("${escapeHtml(data.selectedTime)}");
  </script>`;

  return layout("Vote Cảng", `
  <div class="poll-container">
    ${renderPollHeader(data)}
    <div id="poll-grid" class="poll-grid">
      ${renderPollCards(data)}
    </div>
  </div>
  `, { scripts: wsScript });
}

function renderPollHeader(data: PollPageData): string {
  const timeOptions = AVAILABLE_TIMES.map((t) =>
    `<option value="${escapeHtml(t)}" ${data.selectedTime === t ? "selected" : ""}>${escapeHtml(t)}</option>`
  ).join("");

  const userVotedHtml = data.userVotedPorts.length > 0
    ? `<div class="user-voted-list">
         Tôi đã vote: <strong>${data.userVotedPorts.map(escapeHtml).join(", ")}</strong>
       </div>`
    : "";

  return `
  <div class="poll-header">
    <div class="poll-title">
      <h1 class="poll-h1">🗳️ Chuyến mới - Giờ tự động nhận</h1>
      <div class="time-selector">
        <form method="get" action="/" class="time-form">
          <label for="time-select" class="time-label">Chọn thời gian:</label>
          <select name="time" id="time-select" onchange="this.form.submit()" class="time-select">
            ${timeOptions}
          </select>
        </form>
      </div>
      <div class="total-votes" id="total-votes">
        Tổng lượt vote: <strong>${data.totalVotes}</strong>
      </div>
      <p class="realtime-note">⚡ Cập nhật thời gian thực</p>
    </div>
    <div class="poll-header-info">
      <span class="unvoted-count" id="unvoted-count">Còn <strong>${data.unvotedCount}</strong> cảng chưa có vote</span>
      ${userVotedHtml}
      <div class="user-greeting">
        <span class="greeting-text">Xin chào,</span>
        <span class="user-name">${escapeHtml(data.userName)}</span>
        <a href="/auth/logout" class="logout-btn">Thoát</a>
      </div>
    </div>
  </div>`;
}

export function renderPollCards(data: PollPageData): string {
  return data.options.map((opt) => renderPollCard(opt, data.userName, data.selectedTime, data.csrfToken)).join("");
}

function renderPollCard(opt: OptionWithVotes, userName: string, timeSlot: TimeSlot, csrfToken: string): string {
  const isFull = opt.vote_count >= 2;
  const cardClass = isFull ? "poll-card poll-card-full" : "poll-card";

  // Voters list
  const votersHtml = opt.voters.length > 0
    ? `<div class="voters-section">
         <div class="voters-list">
           ${opt.voters.map((v) => {
             const tagClass = v === userName ? "voter-tag voter-tag-me" : "voter-tag voter-tag-user";
             return `<span class="${tagClass}">${escapeHtml(v)}</span>`;
           }).join("")}
         </div>
       </div>`
    : "";

  // Sold out toggle
  const soldOutChecked = opt.sold_out ? "checked" : "";
  const soldOutClass = opt.sold_out ? "soldout-toggle soldout-toggle-checked" : "soldout-toggle";

  // Action buttons
  let actionsHtml = "";

  if (opt.vote_count < 2 && opt.user_vote_count < 1) {
    actionsHtml += `
      <form method="post" action="/vote" class="inline-form"
            hx-post="/vote" hx-target="#poll-grid" hx-swap="innerHTML">
        ${csrfField(csrfToken)}
        <input type="hidden" name="time" value="${escapeHtml(timeSlot)}">
        <button type="submit" name="option_id" value="${opt.id}" class="vote-btn">Vote</button>
      </form>`;
  }

  if (opt.user_vote_count > 0) {
    actionsHtml += `
      <form method="post" action="/unvote" class="inline-form"
            hx-post="/unvote" hx-target="#poll-grid" hx-swap="innerHTML">
        ${csrfField(csrfToken)}
        <input type="hidden" name="time" value="${escapeHtml(timeSlot)}">
        <input type="hidden" name="option_id" value="${opt.id}">
        <button type="submit" class="unvote-btn" title="Bỏ 1 lượt vote cho cảng này">Bỏ (${opt.user_vote_count})</button>
      </form>`;
  }

  if (opt.vote_count >= 2 && opt.user_vote_count === 0) {
    actionsHtml += `<button class="vote-btn vote-btn-disabled" disabled>Hết</button>`;
  }

  return `
    <div class="${cardClass}" id="card-${opt.id}">
      <div class="poll-card-header poll-card-header-flex">
        <h3 class="poll-option-title">${escapeHtml(opt.text)}</h3>
        <form method="post" action="/sold-out" class="inline-form"
              hx-post="/sold-out" hx-target="#poll-grid" hx-swap="innerHTML">
          ${csrfField(csrfToken)}
          <input type="hidden" name="time" value="${escapeHtml(timeSlot)}">
          <input type="hidden" name="option_id" value="${opt.id}">
          <label class="${soldOutClass}">
            <input type="checkbox" name="sold_out" value="1" onchange="this.form.submit()" ${soldOutChecked}>
            <span>Bán hết</span>
          </label>
        </form>
      </div>
      <div class="poll-card-body">
        ${votersHtml}
      </div>
      <div class="poll-card-actions poll-card-footer">
        ${actionsHtml}
      </div>
    </div>`;
}
