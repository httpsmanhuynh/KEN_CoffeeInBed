#!/usr/bin/env node
/**
 * Runner cross-platform tiện ích cho KÉN Machine Learning (ken_ml).
 * Tự động phát hiện python (py -3, python3, python, py) và điều phối các script.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname);

function detectPython() {
  const candidates = [
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
    { cmd: 'python', args: [] },
    { cmd: 'py', args: [] },
  ];

  for (const c of candidates) {
    try {
      const res = spawnSync(c.cmd, [...c.args, '--version'], {
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: false,
      });
      if (res.status === 0) {
        return c;
      }
    } catch (_) {}
  }
  return null;
}

const py = detectPython();
if (!py) {
  console.error('[KÉN ML] Không tìm thấy Python runtime (đã thử: py -3, python3, python, py). Vui lòng cài đặt Python 3.10+');
  process.exit(1);
}

const action = process.argv[2] || 'help';
const extraArgs = process.argv.slice(3);

function runPy(scriptRelativePath, extra = []) {
  const scriptPath = path.join(ROOT_DIR, scriptRelativePath);
  console.log(`\n======================================================`);
  console.log(`[KÉN ML] Chạy: ${scriptRelativePath} ${extra.join(' ')}`);
  console.log(`======================================================\n`);
  
  const result = spawnSync(py.cmd, [...py.args, scriptPath, ...extra], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    console.error(`\n[KÉN ML] Script kết thúc với mã lỗi: ${result.status}`);
    process.exit(result.status || 1);
  }
}

switch (action) {
  case 'check':
    runPy('src/_check_connection.py', extraArgs);
    break;

  case 'prep':
    runPy('src/Preparation.py', extraArgs);
    break;

  case 'test':
    console.log('[KÉN ML] Chạy toàn bộ test suites cho 3 bài toán ML...');
    runPy('tests/trending_test.py');
    runPy('tests/forecasting_test.py');
    runPy('tests/clustering_test.py');
    console.log('\n======================================================');
    console.log('[KÉN ML] TẤT CẢ 3 BÀI TOÁN TEST ĐỀU ĐẠT THÀNH CÔNG! [PASS]');
    console.log('======================================================\n');
    break;

  case 'trending':
    runPy('src/01_Trending.py', extraArgs);
    break;

  case 'forecast':
    runPy('src/02_Forecasting_run.py', extraArgs);
    break;

  case 'forecast-train':
    runPy('src/02_Forecasting_train.py', extraArgs);
    break;

  case 'cluster':
    runPy('src/03_Clustering_run.py', extraArgs);
    break;

  case 'cluster-train':
    runPy('src/03_Clustering_train.py', extraArgs);
    break;

  case 'all':
    console.log('[KÉN ML] Chạy toàn diện 3 bài toán Machine Learning...');
    runPy('src/01_Trending.py', extraArgs);
    runPy('src/02_Forecasting_run.py', extraArgs);
    runPy('src/03_Clustering_run.py', extraArgs);
    console.log('\n======================================================');
    console.log('[KÉN ML] HOÀN TẤT CẢ 3 BÀI TOÁN ML THÀNH CÔNG!');
    console.log('======================================================\n');
    break;

  case 'help':
  default:
    console.log(`
KÉN Machine Learning Runner CLI
===============================
Cú pháp: node ken_ml/run.js <command> [flags]

Lệnh có sẵn:
  check           Kiểm tra kết nối MongoDB Atlas và các collection
  prep            Tiền xử lý dữ liệu từ MongoDB sang data/master_ken_data.csv
  test            Chạy toàn bộ 3 test suites tự động (Trending, Forecast, Cluster)
  trending        Chạy Bài 1: Trending Score (mặc định dry-run, thêm --write để ghi MongoDB)
  forecast        Chạy Bài 2: Demand Forecasting (mặc định dry-run, thêm --write để ghi MongoDB)
  forecast-train  Huấn luyện lại mô hình Random Forest cho dự báo nhu cầu
  cluster         Chạy Bài 3: Customer Clustering (mặc định dry-run, thêm --write để ghi MongoDB)
  cluster-train   Huấn luyện lại mô hình K-Means gom cụm khách hàng
  all             Chạy cả 3 bài toán tuần tự (thêm --write để ghi toàn bộ vào MongoDB)
  help            Hiển thị trợ giúp này
`);
    break;
}
