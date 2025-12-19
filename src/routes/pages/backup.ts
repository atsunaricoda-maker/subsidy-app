// バックアップ管理画面
import { Hono } from 'hono'
import { generateSidebar, sidebarStyles, sidebarScripts } from '../../templates/sidebar'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/admin/backup', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>バックアップ管理 - 申請らくらく君</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            ${sidebarStyles}
        </style>
    </head>
    <body class="bg-gray-100">
        <div class="min-h-screen flex">
            ${generateSidebar('backup')}
            
            <main class="flex-1 min-h-screen">
                <header class="bg-white shadow-sm sticky top-0 z-30">
                    <div class="flex items-center justify-between px-4 py-3">
                        <div class="flex items-center gap-4">
                            <button onclick="toggleSidebar()" class="lg:hidden text-gray-600 hover:text-gray-900">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <h2 class="text-lg font-semibold text-gray-800">
                                <i class="fas fa-database mr-2"></i>バックアップ管理
                            </h2>
                        </div>
                    </div>
                </header>

                <div class="p-4 lg:p-6">
                <!-- 警告メッセージ -->
                <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-r-lg">
                    <div class="flex items-start">
                        <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                        <div>
                            <h3 class="font-bold text-yellow-800">注意事項</h3>
                            <p class="text-yellow-700 text-sm mt-1">
                                バックアップの復元（インポート）を行うと、既存のデータが上書きされます。<br>
                                必ず現在のデータをエクスポートしてから復元を行ってください。
                            </p>
                        </div>
                    </div>
                </div>

                <!-- データ概要 -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-chart-pie mr-2 text-amber-600"></i>
                        現在のデータ概要
                    </h2>
                    <div id="dataOverview" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div class="text-center py-8 col-span-full text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <div>読み込み中...</div>
                        </div>
                    </div>
                </div>

                <!-- エクスポート -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-download mr-2 text-green-600"></i>
                        データエクスポート
                    </h2>
                    <p class="text-gray-600 mb-4">
                        全データをJSON形式でダウンロードします。バックアップとして保存してください。
                    </p>
                    <div class="flex flex-wrap gap-3">
                        <button onclick="exportAllData()" 
                                class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-file-export mr-2"></i>
                            全データをエクスポート
                        </button>
                        <div class="flex items-center text-sm text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            JSON形式でダウンロードされます
                        </div>
                    </div>
                </div>

                <!-- インポート -->
                <div class="bg-white rounded-lg shadow p-6 mb-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-upload mr-2 text-blue-600"></i>
                        データインポート（復元）
                    </h2>
                    <p class="text-gray-600 mb-4">
                        エクスポートしたJSONファイルからデータを復元します。
                    </p>
                    
                    <!-- ファイル選択 -->
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center hover:border-blue-500 transition cursor-pointer"
                         onclick="document.getElementById('backupFile').click()"
                         ondrop="handleFileDrop(event)"
                         ondragover="handleDragOver(event)"
                         ondragleave="handleDragLeave(event)"
                         id="dropZone">
                        <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
                        <p class="text-gray-600 mb-2">クリックしてファイルを選択、またはドラッグ＆ドロップ</p>
                        <p class="text-sm text-gray-400">対応形式: JSON (.json)</p>
                        <input type="file" id="backupFile" accept=".json" class="hidden" onchange="handleFileSelect(event)">
                    </div>
                    
                    <!-- 選択されたファイル情報 -->
                    <div id="selectedFileInfo" class="hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <i class="fas fa-file-code text-blue-600 mr-3 text-xl"></i>
                                <div>
                                    <div id="selectedFileName" class="font-medium"></div>
                                    <div id="selectedFileSize" class="text-sm text-gray-500"></div>
                                </div>
                            </div>
                            <button onclick="clearSelectedFile()" class="text-gray-500 hover:text-red-600">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <!-- プレビュー -->
                    <div id="backupPreview" class="hidden bg-gray-50 rounded-lg p-4 mb-4">
                        <h3 class="font-bold mb-3">
                            <i class="fas fa-eye mr-2"></i>
                            バックアップ内容プレビュー
                        </h3>
                        <div id="previewContent" class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        </div>
                        <div id="previewMeta" class="mt-3 pt-3 border-t text-xs text-gray-500">
                        </div>
                    </div>

                    <!-- インポートオプション -->
                    <div id="importOptions" class="hidden space-y-4 mb-4">
                        <h3 class="font-bold">
                            <i class="fas fa-cog mr-2"></i>
                            インポートオプション
                        </h3>
                        <div class="flex items-center">
                            <input type="checkbox" id="mergeMode" class="mr-2 h-4 w-4">
                            <label for="mergeMode" class="text-sm">
                                マージモード（既存データと統合、重複は上書き）
                            </label>
                        </div>
                        <div class="text-sm text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            チェックしない場合、既存データはすべて削除されます
                        </div>
                    </div>

                    <!-- インポートボタン -->
                    <div class="flex flex-wrap gap-3">
                        <button id="importBtn" onclick="importData()" 
                                class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-file-import mr-2"></i>
                            データを復元
                        </button>
                        <button id="selectiveImportBtn" onclick="openSelectiveImportModal()" 
                                class="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                                disabled>
                            <i class="fas fa-tasks mr-2"></i>
                            選択的インポート
                        </button>
                    </div>
                </div>

                <!-- インポート履歴（将来の拡張用） -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-bold mb-4">
                        <i class="fas fa-history mr-2 text-gray-600"></i>
                        バックアップのヒント
                    </h2>
                    <div class="grid md:grid-cols-2 gap-4 text-sm">
                        <div class="bg-green-50 p-4 rounded-lg">
                            <h3 class="font-bold text-green-800 mb-2">
                                <i class="fas fa-check-circle mr-1"></i>
                                推奨事項
                            </h3>
                            <ul class="text-green-700 space-y-1">
                                <li>• 定期的にバックアップを取得してください</li>
                                <li>• 重要な変更前にはバックアップを取得してください</li>
                                <li>• バックアップファイルは安全な場所に保存してください</li>
                                <li>• 複数のバックアップを保持することをお勧めします</li>
                            </ul>
                        </div>
                        <div class="bg-red-50 p-4 rounded-lg">
                            <h3 class="font-bold text-red-800 mb-2">
                                <i class="fas fa-exclamation-circle mr-1"></i>
                                注意事項
                            </h3>
                            <ul class="text-red-700 space-y-1">
                                <li>• 復元時は既存データが上書きされます</li>
                                <li>• バックアップファイルを他者と共有しないでください</li>
                                <li>• インポート中はブラウザを閉じないでください</li>
                                <li>• 大容量データの復元には時間がかかる場合があります</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 選択的インポートモーダル -->
        <div id="selectiveImportModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">
                        <i class="fas fa-tasks mr-2"></i>
                        選択的インポート
                    </h3>
                    <button onclick="closeSelectiveImportModal()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <p class="text-gray-600 mb-4">
                    復元するテーブルを選択してください。
                </p>
                <div id="tableSelectionList" class="grid grid-cols-2 gap-3 mb-4">
                </div>
                <div class="flex gap-3 pt-4 border-t">
                    <button onclick="selectAllTables()" class="text-blue-600 hover:text-blue-800 text-sm">
                        <i class="fas fa-check-double mr-1"></i>全て選択
                    </button>
                    <button onclick="deselectAllTables()" class="text-gray-600 hover:text-gray-800 text-sm">
                        <i class="fas fa-times mr-1"></i>全て解除
                    </button>
                </div>
                <div class="flex gap-3 pt-4">
                    <button onclick="executeSelectiveImport()" 
                            class="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700">
                        <i class="fas fa-file-import mr-2"></i>
                        選択したテーブルを復元
                    </button>
                    <button onclick="closeSelectiveImportModal()" 
                            class="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>

        <!-- トースト通知 -->
        <div id="toast" class="hidden fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-full">
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            ${sidebarScripts}
        </script>
        <script>
            // adminロールチェック
            const adminRole = localStorage.getItem('admin_role');
            if (adminRole !== 'admin') {
                alert('この機能は管理者のみ使用できます');
                window.location.href = '/';
            }

            let selectedBackupData = null;

            const TABLE_LABELS = {
                admin_users: '管理ユーザー',
                subsidy_types: '助成金種別',
                subsidy_type_documents: '助成金種別書類',
                document_checklist: '書類チェックリスト',
                clients: '顧客',
                documents: 'アップロード書類',
                communications: 'コミュニケーション',
                subsidy_guidelines: '公募要領',
                subsidy_watch_urls: '監視URL',
                subsidy_update_logs: '更新ログ',
                admin_notifications: '通知',
                hearing_questions: 'ヒアリング質問',
                hearing_answers: 'ヒアリング回答',
                ai_chat_history: 'AIチャット履歴',
                document_templates: '文書テンプレート',
                generated_documents: '生成文書',
                document_section_edits: '文書編集履歴',
                success_cases: '採択事例',
                client_profiles: '顧客プロファイル',
                subsidy_match_scores: 'マッチングスコア'
            };

            // データ概要の読み込み
            async function loadDataOverview() {
                try {
                    const response = await axios.get('/api/backup/info');
                    const data = response.data;
                    
                    const overview = document.getElementById('dataOverview');
                    overview.innerHTML = \`
                        <div class="bg-blue-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-blue-600">\${data.summary.admin_users}</div>
                            <div class="text-xs text-gray-600">管理ユーザー</div>
                        </div>
                        <div class="bg-purple-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-purple-600">\${data.summary.subsidy_types}</div>
                            <div class="text-xs text-gray-600">助成金種別</div>
                        </div>
                        <div class="bg-green-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-green-600">\${data.summary.clients}</div>
                            <div class="text-xs text-gray-600">顧客</div>
                        </div>
                        <div class="bg-orange-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-orange-600">\${data.summary.documents}</div>
                            <div class="text-xs text-gray-600">アップロード書類</div>
                        </div>
                        <div class="bg-indigo-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-indigo-600">\${data.summary.generated_documents}</div>
                            <div class="text-xs text-gray-600">生成文書</div>
                        </div>
                        <div class="bg-amber-50 rounded-lg p-4 text-center">
                            <div class="text-2xl font-bold text-amber-600">\${data.summary.success_cases}</div>
                            <div class="text-xs text-gray-600">採択事例</div>
                        </div>
                    \`;
                } catch (error) {
                    console.error('Error loading data overview:', error);
                }
            }

            // エクスポート
            function exportAllData() {
                showToast('バックアップを作成中...', 'info');
                
                // ダウンロードリンクを作成
                const link = document.createElement('a');
                link.href = '/api/backup/export';
                link.download = \`subsidy_app_backup_\${new Date().toISOString().split('T')[0]}.json\`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => {
                    showToast('バックアップファイルのダウンロードが開始されました', 'success');
                }, 1000);
            }

            // ファイル選択
            function handleFileSelect(event) {
                const file = event.target.files[0];
                if (file) {
                    processFile(file);
                }
            }

            function handleDragOver(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.add('border-blue-500', 'bg-blue-50');
            }

            function handleDragLeave(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.remove('border-blue-500', 'bg-blue-50');
            }

            function handleFileDrop(event) {
                event.preventDefault();
                document.getElementById('dropZone').classList.remove('border-blue-500', 'bg-blue-50');
                
                const file = event.dataTransfer.files[0];
                if (file && file.type === 'application/json') {
                    processFile(file);
                } else {
                    showToast('JSONファイルを選択してください', 'error');
                }
            }

            function processFile(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (!data.version || !data.tables) {
                            throw new Error('Invalid backup format');
                        }
                        
                        selectedBackupData = data;
                        
                        // ファイル情報表示
                        document.getElementById('selectedFileInfo').classList.remove('hidden');
                        document.getElementById('selectedFileName').textContent = file.name;
                        document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);
                        
                        // プレビュー表示
                        showBackupPreview(data);
                        
                        // ボタン有効化
                        document.getElementById('importBtn').disabled = false;
                        document.getElementById('selectiveImportBtn').disabled = false;
                        document.getElementById('importOptions').classList.remove('hidden');
                        
                        showToast('バックアップファイルを読み込みました', 'success');
                    } catch (error) {
                        console.error('Parse error:', error);
                        showToast('無効なバックアップファイルです', 'error');
                    }
                };
                reader.readAsText(file);
            }

            function formatFileSize(bytes) {
                if (bytes < 1024) return bytes + ' bytes';
                if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
                return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
            }

            function showBackupPreview(data) {
                document.getElementById('backupPreview').classList.remove('hidden');
                
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = Object.entries(data.tables)
                    .filter(([_, records]) => records.length > 0)
                    .map(([table, records]) => \`
                        <div class="bg-white rounded p-2 border">
                            <span class="font-medium">\${TABLE_LABELS[table] || table}</span>
                            <span class="text-blue-600 ml-2">\${records.length}件</span>
                        </div>
                    \`).join('');
                
                const previewMeta = document.getElementById('previewMeta');
                previewMeta.innerHTML = \`
                    <div>バックアップ日時: \${new Date(data.exported_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</div>
                    <div>バージョン: \${data.version}</div>
                \`;
            }

            function clearSelectedFile() {
                selectedBackupData = null;
                document.getElementById('backupFile').value = '';
                document.getElementById('selectedFileInfo').classList.add('hidden');
                document.getElementById('backupPreview').classList.add('hidden');
                document.getElementById('importOptions').classList.add('hidden');
                document.getElementById('importBtn').disabled = true;
                document.getElementById('selectiveImportBtn').disabled = true;
            }

            // インポート実行
            async function importData() {
                if (!selectedBackupData) return;
                
                if (!confirm('本当にデータを復元しますか？\\n既存のデータは上書きされます。')) {
                    return;
                }
                
                showToast('データを復元中...', 'info');
                
                try {
                    const response = await axios.post('/api/backup/import', selectedBackupData);
                    const result = response.data;
                    
                    if (result.success) {
                        showToast('データの復元が完了しました', 'success');
                    } else {
                        showToast('一部のデータの復元に失敗しました', 'warning');
                    }
                    
                    // 結果表示
                    alert(\`復元結果:\\n\\n\${Object.entries(result.imported).map(([t, c]) => \`\${TABLE_LABELS[t] || t}: \${c}件\`).join('\\n')}\`);
                    
                    loadDataOverview();
                } catch (error) {
                    console.error('Import error:', error);
                    showToast('復元に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // 選択的インポート
            function openSelectiveImportModal() {
                if (!selectedBackupData) return;
                
                document.getElementById('selectiveImportModal').classList.remove('hidden');
                
                const list = document.getElementById('tableSelectionList');
                list.innerHTML = Object.entries(selectedBackupData.tables)
                    .filter(([_, records]) => records.length > 0)
                    .map(([table, records]) => \`
                        <label class="flex items-center p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                            <input type="checkbox" class="table-checkbox mr-3" value="\${table}">
                            <span class="flex-1">\${TABLE_LABELS[table] || table}</span>
                            <span class="text-sm text-gray-500">\${records.length}件</span>
                        </label>
                    \`).join('');
            }

            function closeSelectiveImportModal() {
                document.getElementById('selectiveImportModal').classList.add('hidden');
            }

            function selectAllTables() {
                document.querySelectorAll('.table-checkbox').forEach(cb => cb.checked = true);
            }

            function deselectAllTables() {
                document.querySelectorAll('.table-checkbox').forEach(cb => cb.checked = false);
            }

            async function executeSelectiveImport() {
                const selectedTables = Array.from(document.querySelectorAll('.table-checkbox:checked'))
                    .map(cb => cb.value);
                
                if (selectedTables.length === 0) {
                    showToast('復元するテーブルを選択してください', 'error');
                    return;
                }
                
                if (!confirm(\`選択した\${selectedTables.length}個のテーブルを復元しますか？\\n選択されたテーブルの既存データは上書きされます。\`)) {
                    return;
                }
                
                showToast('選択したデータを復元中...', 'info');
                
                try {
                    const mergeMode = document.getElementById('mergeMode').checked;
                    const response = await axios.post('/api/backup/import-selective', {
                        tables: selectedTables,
                        data: selectedBackupData,
                        merge_mode: mergeMode
                    });
                    const result = response.data;
                    
                    closeSelectiveImportModal();
                    
                    if (result.success) {
                        showToast('選択したデータの復元が完了しました', 'success');
                    } else {
                        showToast('一部のデータの復元に失敗しました', 'warning');
                    }
                    
                    alert(\`復元結果:\\n\\n\${Object.entries(result.imported).map(([t, c]) => \`\${TABLE_LABELS[t] || t}: \${c}件\`).join('\\n')}\`);
                    
                    loadDataOverview();
                } catch (error) {
                    console.error('Selective import error:', error);
                    showToast('復元に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
                }
            }

            // トースト通知
            function showToast(message, type = 'success') {
                const toast = document.getElementById('toast');
                const colors = {
                    success: 'bg-green-500 text-white',
                    error: 'bg-red-500 text-white',
                    warning: 'bg-yellow-500 text-white',
                    info: 'bg-blue-500 text-white'
                };
                
                toast.className = \`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform \${colors[type]}\`;
                toast.innerHTML = \`<i class="fas fa-\${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'}-circle mr-2"></i>\${message}\`;
                toast.classList.remove('translate-x-full', 'hidden');
                
                setTimeout(() => {
                    toast.classList.add('translate-x-full');
                }, 3000);
            }

            // グローバルスコープに関数を公開（onclick対応）
            window.logout = logout;
            window.exportAllData = exportAllData;
            window.importData = importData;
            window.clearSelectedFile = clearSelectedFile;
            window.openSelectiveImportModal = openSelectiveImportModal;
            window.closeSelectiveImportModal = closeSelectiveImportModal;
            window.selectAllTables = selectAllTables;
            window.deselectAllTables = deselectAllTables;
            window.executeSelectiveImport = executeSelectiveImport;
            window.showToast = showToast;

            // 初期読み込み
            loadDataOverview();
        </script>
    </body>
    </html>
  `)
})

export default routes
