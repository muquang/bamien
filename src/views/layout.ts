/**
 * Base HTML layout template.
 */
export function layout(title: string, body: string, options?: { scripts?: string }): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1200">
  <meta name="description" content="Bà Miên - Hệ thống vote cảng theo khung giờ, cập nhật thời gian thực">
  <title>${title} - Bà Miên Vote</title>
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <link rel="stylesheet" href="/public/css/style.css">
</head>
<body>
  ${body}
  <script src="/public/js/htmx.min.js"></script>
  ${options?.scripts ?? ""}
</body>
</html>`;
}
