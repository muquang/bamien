<?php
// Xử lý nút Thoát (xóa cookies)
if (isset($_GET['logout'])) {
    setcookie('poll_user_name', '', time() - 3600, '/');
    header('Location: index.php?time=' . urlencode($selectedTime));
    exit;
}

// Xử lý nhập tên
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['user_name'])) {
    $user_name = trim($_POST['user_name']);
    if (!empty($user_name)) {
        setcookie('poll_user_name', $user_name, time() + (86400 * 2), '/'); // 2 ngày
        header('Location: index.php');
        exit;
    }
}

$user_name = $_COOKIE['poll_user_name'] ?? null;

// Xử lý chọn file JSON từ combo box
$availableTimes = ['10h', '12h', '14h30', '16h30', '19h', '21h'];

// Hàm tự động chọn khung giờ gần nhất dựa vào UTC+7
function getClosestTime($availableTimes) {
    // Lấy thời gian hiện tại theo UTC+7
    $currentTime = new DateTime('now', new DateTimeZone('Asia/Bangkok')); // UTC+7
    $currentHour = (int)$currentTime->format('H');
    $currentMinute = (int)$currentTime->format('i');
    $currentTotalMinutes = $currentHour * 60 + $currentMinute;
    
    // Chuyển đổi các khung giờ thành phút
    $timeSlots = [
        '10h' => 10 * 60,      // 600 phút
        '12h' => 12 * 60,      // 720 phút
        '14h30' => 14 * 60 + 30, // 870 phút
        '16h30' => 16 * 60 + 30, // 990 phút
        '19h' => 19 * 60,      // 1140 phút
        '21h' => 21 * 60       // 1260 phút
    ];
    
    $closestTime = '10h';
    $minDifference = PHP_INT_MAX;
    
    foreach ($availableTimes as $time) {
        if (isset($timeSlots[$time])) {
            $slotMinutes = $timeSlots[$time];
            $difference = abs($currentTotalMinutes - $slotMinutes);
            
            // Xử lý trường hợp qua ngày (sau 21h thì chọn 10h ngày hôm sau)
            if ($currentTotalMinutes > $timeSlots['21h']) {
                $nextDayDifference = (24 * 60) - $currentTotalMinutes + $timeSlots['10h'];
                if ($time === '10h' && $nextDayDifference < $difference) {
                    $difference = $nextDayDifference;
                }
            }
            
            if ($difference < $minDifference) {
                $minDifference = $difference;
                $closestTime = $time;
            }
        }
    }
    
    return $closestTime;
}

// Tự động chọn time nếu không có trong URL hoặc không hợp lệ
$selectedTime = $_GET['time'] ?? null;
if (!$selectedTime || !in_array($selectedTime, $availableTimes)) {
    $selectedTime = getClosestTime($availableTimes);
}

$jsonFile = __DIR__ . '/datav2/' . $selectedTime . '.json';

// Tạo file JSON nếu chưa có
if (!file_exists($jsonFile)) {
    $pollData = [
        'options' => [],
        'votes' => []
    ];
    
    // Tạo 35 tùy chọn mẫu
    for ($i = 1; $i <= 35; $i++) {
        $pollData['options'][] = [
            'id' => $i,
            'text' => 'Tùy chọn ' . $i,
            'sold_out' => false
        ];
    }
    
    file_put_contents($jsonFile, json_encode($pollData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Load dữ liệu từ JSON
$pollData = json_decode(file_get_contents($jsonFile), true);

// Sắp xếp option theo thứ tự chữ cái A-Z
usort($pollData['options'], function($a, $b) {
    $ta = str_replace(['Đ','đ'], ['D','d'], $a['text']);
    $tb = str_replace(['Đ','đ'], ['D','d'], $b['text']);
    return strcmp($ta, $tb);
});

// Handle vote
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['set_sold_out']) && $user_name) {
    if (isset($_POST['time'])) {
        $selectedTime = $_POST['time'];
        if (!in_array($selectedTime, $availableTimes)) {
            $selectedTime = '10h';
        }
        $jsonFile = __DIR__ . '/datav2/' . $selectedTime . '.json';
        $pollData = json_decode(file_get_contents($jsonFile), true);
    }

    $option_id = (int)($_POST['option_id'] ?? 0);
    $sold_out = isset($_POST['sold_out']) && $_POST['sold_out'] === '1';

    if (!empty($pollData['options'])) {
        foreach ($pollData['options'] as &$option) {
            if ((int)($option['id'] ?? 0) === $option_id) {
                $option['sold_out'] = $sold_out;
                break;
            }
        }
        unset($option);
    }

    file_put_contents($jsonFile, json_encode($pollData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    header('Location: index.php?time=' . urlencode($selectedTime));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['vote'])) {
    // Lấy time từ POST request nếu có
    if (isset($_POST['time'])) {
        $selectedTime = $_POST['time'];
        if (!in_array($selectedTime, $availableTimes)) {
            $selectedTime = '10h';
        }
        $jsonFile = __DIR__ . '/datav2/' . $selectedTime . '.json';
        $pollData = json_decode(file_get_contents($jsonFile), true);
    }
    
    $option_id = (int)$_POST['vote'];
    
    // Đếm số vote hiện tại cho option này
    $vote_count = 0;
    foreach ($pollData['votes'] as $vote) {
        if ($vote['option_id'] == $option_id) {
            $vote_count++;
        }
    }
    
    if ($vote_count < 2) {
        // Thêm vote mới
        $pollData['votes'][] = [
            'id' => count($pollData['votes']) + 1,
            'user_id' => $user_name, // Lưu tên user thay vì null
            'option_id' => $option_id,
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        // Lưu lại vào file JSON
        file_put_contents($jsonFile, json_encode($pollData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    header('Location: index.php?time=' . urlencode($selectedTime));
    exit;
}

// Handle unvote (xóa 1 lượt vote của user cho option)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['unvote']) && $user_name) {
    // Lấy time từ POST request nếu có
    if (isset($_POST['time'])) {
        $selectedTime = $_POST['time'];
        if (!in_array($selectedTime, $availableTimes)) {
            $selectedTime = '10h';
        }
        $jsonFile = __DIR__ . '/datav2/' . $selectedTime . '.json';
        $pollData = json_decode(file_get_contents($jsonFile), true);
    }
    
    $option_id = (int)$_POST['unvote'];
    // Tìm index vote đầu tiên của user cho option này
    foreach ($pollData['votes'] as $i => $vote) {
        if ($vote['option_id'] == $option_id && $vote['user_id'] === $user_name) {
            unset($pollData['votes'][$i]);
            $pollData['votes'] = array_values($pollData['votes']);
            break;
        }
    }
    file_put_contents($jsonFile, json_encode($pollData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    header('Location: index.php?time=' . urlencode($selectedTime));
    exit;
}

// Tính số vote cho mỗi option
$options = [];
foreach ($pollData['options'] as $option) {
    $vote_count = 0;
    $voters = [];
    foreach ($pollData['votes'] as $vote) {
        if ($vote['option_id'] == $option['id']) {
            $vote_count++;
            $voters[] = $vote['user_id'];
        }
    }
    
    $options[] = [
        'id' => $option['id'],
        'option_text' => $option['text'],
        'vote_count' => $vote_count,
        'voters' => $voters,
        'sold_out' => (bool)($option['sold_out'] ?? false)
    ];
}

// Tính số option chưa có vote (vote_count = 0)
$unvoted_count = 0;
foreach ($options as $opt) {
    if ($opt['vote_count'] == 0) $unvoted_count++;
}

// Lấy danh sách tên cảng user đã vote (dựa trên votes, unique)
$user_voted_ports = [];
if ($user_name) {
    $voted_option_ids = [];
    foreach ($pollData['votes'] as $vote) {
        if ($vote['user_id'] === $user_name) {
            $voted_option_ids[$vote['option_id']] = true;
        }
    }
    foreach (array_keys($voted_option_ids) as $oid) {
        foreach ($pollData['options'] as $opt) {
            if ($opt['id'] == $oid) {
                $user_voted_ports[] = $opt['text'];
                break;
            }
        }
    }
}

foreach ($options as &$opt) {
    $opt['user_vote_count'] = 0;
    foreach ($pollData['votes'] as $vote) {
        if ($vote['option_id'] == $opt['id'] && $vote['user_id'] === $user_name) {
            $opt['user_vote_count']++;
        }
    }
}
unset($opt);
?>

<?php if (!$user_name): ?>
<!-- Form nhập tên -->
<div class="container mt-5">
    <div class="row justify-content-center">
        <div class="col-md-6">
            <div class="welcome-card">
                <div class="welcome-body">
                    <form method="post" action="index.php">
                        <div class="form-group">
                            <label for="user_name" class="form-label">Tên của bạn</label>
                            <input type="text" class="form-control modern-input" id="user_name" name="user_name" required placeholder="Nhập tên Zalo của bạn">
                        
                        <button type="submit" class="btn btn-modern btn-block">Bắt đầu</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
<?php else: ?>
<!-- Hiển thị poll -->
<div class="poll-container">
    <div class="poll-header">
        <div class="poll-title">
            <h3>🗳️ Chuyến mới - Giờ tự động nhận</h3>
            <div class="time-selector">
                <form method="get" action="index.php" style="display: inline-block; margin-bottom: 0.5rem;">
                    <label for="time" style="color: #1976d2; font-weight: 600; margin-right: 0.5rem;">Chọn thời gian:</label>
                    <select name="time" id="time" onchange="this.form.submit()" style="padding: 0.3rem 0.5rem; border-radius: 8px; border: 1px solid #1976d2; background: white; color: #1976d2; font-weight: 600;">
                        <?php foreach ($availableTimes as $time): ?>
                            <option value="<?= $time ?>" <?= $selectedTime === $time ? 'selected' : '' ?>><?= $time ?></option>
                        <?php endforeach; ?>
                    </select>
                </form>
            </div>
            <div class="total-votes" style="color:#1976d2; font-size:1.1rem; margin-bottom:0.2rem;">
                Tổng lượt vote: <strong><?= count($pollData['votes']) ?></strong>
            </div>
            <p>Làm mới lại trình duyệt để hiển thị vote hiện tại</p>
        </div>
        <div class="poll-header-info">
            <span class="unvoted-count">Còn <strong><?= $unvoted_count ?></strong> cảng chưa có vote</span>
            <?php if (!empty($user_voted_ports)): ?>
                <div class="user-voted-list" style="color:#1976d2; font-size:0.98rem; margin-bottom:0.2rem;">
                    Tôi đã vote: <strong><?= htmlspecialchars(implode(', ', $user_voted_ports)) ?></strong>
                </div>
            <?php endif; ?>
            <div class="user-greeting" style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="greeting-text">Xin chào,</span>
                <span class="user-name"><?= htmlspecialchars($user_name) ?></span>
                <a href="?logout=1&time=<?= urlencode($selectedTime) ?>" class="logout-btn" style="margin-bottom:0;">Thoát</a>
            </div>
        </div>
    </div>
    
    <div class="poll-grid">
        <?php foreach ($options as $opt): ?>
                <div class="poll-card <?= $opt['vote_count'] >= 2 ? 'poll-card-full' : '' ?>">
                    <div class="poll-card-header poll-card-header-flex">
                        <h3 class="poll-option-title"><?= htmlspecialchars($opt['option_text']) ?></h3>
                        <form method="post" action="index.php" style="display:inline">
                            <input type="hidden" name="time" value="<?= htmlspecialchars($selectedTime) ?>">
                            <input type="hidden" name="set_sold_out" value="1">
                            <input type="hidden" name="option_id" value="<?= $opt['id'] ?>">
                            <label class="soldout-toggle <?= $opt['sold_out'] ? 'soldout-toggle-checked' : '' ?>">
                                <input type="checkbox" name="sold_out" value="1" onchange="this.form.submit()" <?= $opt['sold_out'] ? 'checked' : '' ?>>
                                <span>Bán hết</span>
                            </label>
                        </form>
                    </div>
                    <div class="poll-card-body">
                        <?php if (!empty($opt['voters'])): ?>
                            <div class="voters-section">
                                <div class="voters-list">
                                <?php foreach ($opt['voters'] as $voter): ?>
                                    <span class="voter-tag<?= $voter === $user_name ? ' voter-tag-me' : ' voter-tag-user' ?>"><?= htmlspecialchars($voter) ?></span>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
                <div class="poll-card-actions poll-card-footer">
                    <?php if ($opt['vote_count'] < 2 && $opt['user_vote_count'] < 3): ?>
                        <form method="post" action="index.php" style="display:inline">
                            <input type="hidden" name="time" value="<?= htmlspecialchars($selectedTime) ?>">
                            <button type="submit" name="vote" value="<?= $opt['id'] ?>" class="vote-btn">Vote</button>
                        </form>
                    <?php endif; ?>
                    <?php if ($opt['user_vote_count'] > 0): ?>
                        <form method="post" action="index.php" style="display:inline">
                            <input type="hidden" name="time" value="<?= htmlspecialchars($selectedTime) ?>">
                            <input type="hidden" name="unvote" value="<?= $opt['id'] ?>">
                            <button type="submit" class="unvote-btn" title="Bỏ 1 lượt vote cho cảng này">Bỏ (<?= $opt['user_vote_count'] ?>)</button>
                        </form>
                    <?php endif; ?>
                    <?php if ($opt['vote_count'] >= 2 && $opt['user_vote_count'] == 0): ?>
                        <button class="vote-btn vote-btn-disabled" disabled>Hết</button>
                    <?php endif; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </div>
</div>
<?php endif; ?>

<style>
:root {
    --primary-color: #1976d2;
    --primary-color-dark: #115293;
    --primary-bg: #fff;
    --secondary-bg: #f5f7fa;
    --text-color: #222;
    --border-radius: 14px;
    --card-shadow: 0 4px 16px rgba(25, 118, 210, 0.08);
    --card-shadow-hover: 0 8px 24px rgba(25, 118, 210, 0.13);
    --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
body {
    background: var(--secondary-bg);
    color: var(--text-color);
}
/* Welcome Card */
.welcome-card {
    background: white;
    border-radius: var(--border-radius);
    box-shadow: var(--card-shadow);
    overflow: hidden;
    animation: slideUp 0.6s ease-out;
}

.welcome-header {
    background: var(--primary-gradient);
    color: white;
    padding: 2rem;
    text-align: center;
}

.welcome-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.welcome-header h2 {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 600;
}

.welcome-header p {
    margin: 0.5rem 0 0 0;
    opacity: 0.9;
}

.welcome-body {
    padding: 2rem;
}

/* Modern Form Inputs */
.modern-input {
    border: 2px solid #e1e5e9;
    border-radius: 12px;
    padding: 1rem;
    font-size: 1rem;
    transition: var(--transition);
    background: #f8f9fa;
}

.modern-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: white;
}

.btn-modern {
    background: var(--primary-gradient);
    border: 1px solid var(--primary-color);
    border-radius: 12px;
    padding: 1rem 2rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    transition: var(--transition);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    max-width:300px;
}

.btn-modern:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}

/* Poll Container */
.poll-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1.5rem;
}
.poll-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding: 1.2rem 1.5rem;
    background: var(--primary-bg);
    border-radius: var(--border-radius);
    box-shadow: var(--card-shadow);
    color: var(--text-color);
}
.poll-title h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-color);
}
.poll-title p {
    margin: 0.3rem 0 0 0;
    color: #555;
    font-size: 1rem;
}
.poll-header-info {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.3rem;
}
.unvoted-count {
    color: var(--primary-color);
    font-weight: 600;
    font-size: 1rem;
    background: #e3f2fd;
    border-radius: 8px;
    padding: 0.2rem 0.7rem;
    margin-bottom: 0.2rem;
}
.user-greeting {
    color: #222;
    font-size: 0.95rem;
}
.user-name {
    color: var(--primary-color);
    font-weight: 600;
    margin-left: 0.2rem;
}

/* Poll Grid */
.poll-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.8rem;
}

/* Poll Cards */
.poll-card {
    background: var(--primary-bg);
    border-radius: var(--border-radius);
    box-shadow: var(--card-shadow);
    transition: var(--transition);
    overflow: hidden;
    animation: fadeInUp 0.6s ease-out;
    border: 1px solid #e3f2fd;
}

.poll-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--card-shadow-hover);
    border-color: var(--primary-color);
}

.poll-card-full {
    opacity: 0.6;
    background: #f0f0f0;
    border-color: #bdbdbd;
}

.poll-card-header {
    padding: 0.8rem;
    border-bottom: 1px solid #e9ecef;
}

.poll-option-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #222;
    text-align: center;
}

.poll-card-body {
    padding: 0.6rem 0.8rem;
}

.voters-section {
    margin-top: 0.2rem;
}

.voters-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
    justify-content: center;
}

.voter-tag {
    background: var(--primary-color);
    color: #1976d2;
    padding: 0.15rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 500;
}

.poll-card-footer {
    padding: 0.8rem;
    border-top: 1px solid #e9ecef;
}

.vote-btn {
    width: auto;
    min-width: 60px;
    margin-left: 0.5rem;
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    background: #f3f8fd;
    color: #1976d2;
    border: 1px solid #b3d4fc;
    font-weight: 600;
    box-shadow: none;
    transition: background 0.2s, color 0.2s;
}
.vote-btn:hover:not(:disabled) {
    background: #e3f2fd;
    color: #115293;
    border-color: #90caf9;
}
.vote-btn:active {
    background: #e3f2fd;
    color: #115293;
}

.vote-btn-disabled {
    background: #bdbdbd;
    color: #fff;
    cursor: not-allowed;
}

.vote-btn-disabled:hover {
    background: #bdbdbd;
    color: #fff;
}

/* Animations */
@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Responsive Design */
@media (max-width: 768px) {
    .poll-header {
        flex-direction: column;
        text-align: center;
        gap: 0.7rem;
        padding: 1rem 0.5rem;
    }
    .poll-header-info {
        align-items: center;
        text-align: center;
    }
    .poll-title h3 {
        font-size: 1.2rem;
    }
    .poll-grid {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.5rem;
    }
    .poll-card-header {
        padding: 0.5rem 0.5rem;
    }
    .poll-card-body {
        padding: 0.4rem 0.5rem;
    }
}

@media (max-width: 480px) {
    .poll-grid {
        grid-template-columns: 1fr;
    }
    
    .welcome-card {
        margin: 1rem;
    }
    
    .welcome-header {
        padding: 1.5rem;
    }
    
    .welcome-body {
        padding: 1.5rem;
    }
}

.poll-card-header-flex {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.7rem 0.8rem;
}
.poll-option-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #222;
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.vote-btn {
    width: auto;
    min-width: 60px;
    margin-left: 0.5rem;
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
}
.unvote-btn {
    background: #fff;
    color: #1976d2;
    border: 1px solid #1976d2;
    border-radius: 8px;
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
    font-weight: 600;
    margin-left: 0.5rem;
    transition: background 0.2s, color 0.2s;
    cursor: pointer;
}
.unvote-btn:hover {
    background: #1976d2;
    color: #fff;
}
.poll-card-actions {
    display: flex;
    align-items: center;
    gap: 0.3rem;
}
.poll-card-actions.poll-card-footer {
    border-top: 1px solid #e9ecef;
    padding: 0.7rem 0.8rem;
    margin-top: 0;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    justify-content: flex-end;
}
.soldout-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-weight: 700;
    font-size: 0.9rem;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
}
.soldout-toggle input[type="checkbox"] {
    width: 16px;
    height: 16px;
    margin: 0;
}
.soldout-toggle span {
    color: #666;
}
.soldout-toggle-checked span {
    color: #d32f2f;
}
@media (max-width: 768px) {
    .poll-card-header-flex {
        flex-direction: row;
        gap: 0.3rem;
        padding: 0.6rem;
    }
    .vote-btn {
        min-width: 60px;
        padding: 0.4rem 0.7rem;
        font-size: 0.85rem;
    }
    .unvote-btn {
        font-size: 0.85rem;
        padding: 0.3rem 0.6rem;
    }
}
.logout-btn {
    display: inline-block;
    background: #fff;
    color: #1976d2;
    border: 1px solid #1976d2;
    border-radius: 8px;
    padding: 0.4rem 1.1rem;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.2s, color 0.2s;
    margin-bottom: 0.5rem;
}
.logout-btn:hover {
    background: #1976d2;
    color: #fff;
}
.btn-block {
    display: block;
    width: 100%;
    box-sizing: border-box;
}
@media (max-width: 768px) {
    .welcome-body {
        padding: 1rem;
    }
    .btn-modern.btn-block {
        font-size: 1.1rem;
        padding: 1rem 0.5rem;
    }
}
.voter-tag-me {
    background: #fff0f0 !important;
    color: #d32f2f !important;
    border: 1px solid #d32f2f !important;
    font-weight: bold;
    font-size: 1.1rem;
}
.voter-tag-user {
    background:rgb(2, 129, 255) !important;
    color: #fff !important;
    font-weight: bold;
    border: 1px solid #e0e0e0 !important;
    font-size: 1.1rem;
}
</style>
