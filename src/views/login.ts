/**
 * Login form view.
 */
import { layout } from "./layout";
import { csrfField } from "../utils/html";

export function renderLoginPage(csrfToken: string): string {
  return layout("Đăng nhập", `
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-6">
        <div class="welcome-card">
          <div class="welcome-body">
            <form method="post" action="/auth/login">
              ${csrfField(csrfToken)}
              <div class="form-group">
                <label for="user_name" class="form-label">Tên của bạn</label>
                <input type="text" class="form-control modern-input" id="user_name" name="user_name"
                  required placeholder="Nhập tên Zalo của bạn" maxlength="50" autocomplete="name">
                <button type="submit" class="btn btn-modern btn-block">Bắt đầu</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
  `);
}
