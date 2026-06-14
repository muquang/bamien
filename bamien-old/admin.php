<?php
// admin.php - Trang quản lý xóa toàn bộ vote từ các file JSON trong datav2
$datav2Dir = __DIR__ . '/datav2/';
$message = '';
$error = '';
$password = '';

// Lấy danh sách các file JSON trong thư mục datav2
function getJsonFiles($dir) {
    $files = [];
    if (is_dir($dir)) {
        $items = scandir($dir);
        foreach ($items as $item) {
            if (pathinfo($item, PATHINFO_EXTENSION) === 'json') {
                $files[] = $item;
            }
        }
    }
    return $files;
}

// Tính tổng số vote từ tất cả các file
function getTotalVotes($dir, $files) {
    $totalVotes = 0;
    foreach ($files as $file) {
        $filePath = $dir . $file;
        if (file_exists($filePath)) {
            $data = json_decode(file_get_contents($filePath), true);
            if (is_array($data['votes'] ?? null)) {
                $totalVotes += count($data['votes']);
            }
        }
    }
    return $totalVotes;
}

$jsonFiles = getJsonFiles($datav2Dir);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['clear_votes'])) {
    $password = $_POST['password'] ?? '';
    if ($password === '123456abc') {
        $clearedFiles = 0;
        $totalCleared = 0;
        
        foreach ($jsonFiles as $file) {
            $filePath = $datav2Dir . $file;
            if (file_exists($filePath)) {
                $pollData = json_decode(file_get_contents($filePath), true);
                if (is_array($pollData['votes'] ?? null)) {
                    $totalCleared += count($pollData['votes']);
                    $pollData['votes'] = [];
                    file_put_contents($filePath, json_encode($pollData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                    $clearedFiles++;
                }
            }
        }
        
        $message = "Đã xóa toàn bộ {$totalCleared} lượt vote từ {$clearedFiles} file JSON thành công!";
    } else {
        $error = 'Mật khẩu không đúng!';
    }
}

$total_votes = getTotalVotes($datav2Dir, $jsonFiles);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>Quản lý Poll - Xóa vote</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f7fa; color: #222; }
        .admin-container { max-width: 600px; margin: 60px auto; background: #fff; border-radius: 14px; box-shadow: 0 4px 16px rgba(25, 118, 210, 0.08); padding: 2rem; }
        h2 { color: #1976d2; }
        .btn-clear { background: #d32f2f; color: #fff; border: none; border-radius: 8px; padding: 0.7rem 1.5rem; font-size: 1.1rem; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        .btn-clear:hover { background: #b71c1c; }
        .message { margin: 1rem 0; color: #388e3c; font-weight: bold; }
        .error { margin: 1rem 0; color: #d32f2f; font-weight: bold; }
        .votes-info { margin-bottom: 1.5rem; font-size: 1.1rem; }
        .files-info { margin-bottom: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; }
        .files-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
        .file-tag { background: #e3f2fd; color: #1976d2; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.9rem; }
        .input-group { margin-bottom: 1rem; }
        .input-label { display: block; margin-bottom: 0.3rem; font-weight: 600; }
        .input-password { width: 100%; padding: 0.5rem; border-radius: 6px; border: 1px solid #bdbdbd; font-size: 1rem; }
    </style>
</head>
<body>
    <div class="admin-container">
        <h2>Quản lý Poll - DataV2</h2>
        <div class="votes-info">Tổng số lượt vote hiện tại: <strong><?= $total_votes ?></strong></div>
        
        <div class="files-info">
            <strong>Các file JSON được quản lý (<?= count($jsonFiles) ?> file):</strong>
            <div class="files-list">
                <?php foreach ($jsonFiles as $file): ?>
                    <span class="file-tag"><?= htmlspecialchars($file) ?></span>
                <?php endforeach; ?>
            </div>
        </div>
        
        <?php if ($message): ?>
            <div class="message"><?= htmlspecialchars($message) ?></div>
        <?php endif; ?>
        <?php if ($error): ?>
            <div class="error"><?= htmlspecialchars($error) ?></div>
        <?php endif; ?>
        <form method="post" onsubmit="return confirm('Bạn có chắc chắn muốn xóa toàn bộ lượt vote từ TẤT CẢ các file JSON không?');">
            <div class="input-group">
                <label class="input-label" for="password">Mật khẩu quản lý</label>
                <input type="password" id="password" name="password" class="input-password" required autocomplete="off" value="<?= htmlspecialchars($password) ?>">
            </div>
            <button type="submit" name="clear_votes" class="btn-clear">Xóa toàn bộ lượt vote từ tất cả file</button>
        </form>
    </div>
</body>
</html>