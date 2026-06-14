/**
 * Admin page view.
 */
import { layout } from "./layout";
import { escapeHtml, csrfField } from "../utils/html";

interface AdminPageData {
  totalVotes: number;
  timeSlots: string[];
  message?: string;
  error?: string;
  csrfToken: string;
}

export function renderAdminPage(data: AdminPageData): string {
  const messageHtml = data.message
    ? `<div class="message">${escapeHtml(data.message)}</div>`
    : "";

  const errorHtml = data.error
    ? `<div class="error">${escapeHtml(data.error)}</div>`
    : "";

  const timeSlotsHtml = data.timeSlots
    .map((t) => `<span class="file-tag">${escapeHtml(t)}</span>`)
    .join("");

  return layout("Quản lý", `
  <div class="admin-container">
    <h2>Quản lý Poll</h2>
    <div class="votes-info">Tổng số lượt vote hiện tại: <strong>${data.totalVotes}</strong></div>

    <div class="files-info">
      <strong>Các khung giờ được quản lý (${data.timeSlots.length} slot):</strong>
      <div class="files-list">
        ${timeSlotsHtml}
      </div>
    </div>

    ${messageHtml}
    ${errorHtml}

    <form method="post" action="/admin/clear"
          onsubmit="return confirm('Bạn có chắc chắn muốn xóa toàn bộ lượt vote không?');">
      ${csrfField(data.csrfToken)}
      <div class="input-group">
        <label class="input-label" for="admin-password">Mật khẩu quản lý</label>
        <input type="password" id="admin-password" name="password" class="input-password"
               required autocomplete="off">
      </div>
      <button type="submit" class="btn-clear">Xóa toàn bộ lượt vote</button>
    </form>
  </div>
  `);
}
