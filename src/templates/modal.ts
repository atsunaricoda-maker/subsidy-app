// 共通モーダルコンポーネント

export const modalStyles = `
  /* モーダル基本スタイル */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease, visibility 0.2s ease;
  }
  .modal-overlay.active {
    opacity: 1;
    visibility: visible;
  }
  .modal-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-height: 90vh;
    overflow: hidden;
    transform: scale(0.95) translateY(10px);
    transition: transform 0.2s ease;
    display: flex;
    flex-direction: column;
  }
  .modal-overlay.active .modal-container {
    transform: scale(1) translateY(0);
  }
  
  /* モーダルサイズ */
  .modal-sm { width: 400px; max-width: 95vw; }
  .modal-md { width: 600px; max-width: 95vw; }
  .modal-lg { width: 900px; max-width: 95vw; }
  .modal-xl { width: 1200px; max-width: 95vw; }
  .modal-full { width: 95vw; height: 90vh; }
  
  /* モーダルヘッダー */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .modal-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.15s;
  }
  .modal-close:hover {
    background: #f3f4f6;
    color: #1f2937;
  }
  
  /* モーダルボディ */
  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
  
  /* モーダルフッター */
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 20px;
    border-top: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  
  /* タブスタイル */
  .modal-tabs {
    display: flex;
    border-bottom: 1px solid #e5e7eb;
    padding: 0 20px;
    flex-shrink: 0;
  }
  .modal-tab {
    padding: 12px 16px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
  }
  .modal-tab:hover {
    color: #3b82f6;
  }
  .modal-tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }
  
  /* クイックビュー用スタイル */
  .quick-view-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  .quick-view-item {
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }
  .quick-view-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 4px;
  }
  .quick-view-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
  }
  
  /* ローディングスピナー */
  .modal-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
  }
  .modal-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export const modalScripts = `
  // モーダル管理クラス
  class ModalManager {
    constructor() {
      this.modals = new Map();
      this.activeModal = null;
      this.init();
    }
    
    init() {
      // ESCキーでモーダルを閉じる
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.activeModal) {
          this.close(this.activeModal);
        }
      });
      
      // オーバーレイクリックで閉じる
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
          this.close(this.activeModal);
        }
      });
    }
    
    // モーダルを開く
    open(modalId, options = {}) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      
      this.activeModal = modalId;
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      
      if (options.onOpen) options.onOpen();
    }
    
    // モーダルを閉じる
    close(modalId) {
      const modal = document.getElementById(modalId || this.activeModal);
      if (!modal) return;
      
      modal.classList.remove('active');
      document.body.style.overflow = '';
      this.activeModal = null;
    }
    
    // 動的モーダルを作成
    create(config) {
      const {
        id,
        title,
        icon = '',
        size = 'md',
        content = '',
        tabs = [],
        footer = '',
        onOpen = null
      } = config;
      
      // 既存のモーダルがあれば削除
      const existing = document.getElementById(id);
      if (existing) existing.remove();
      
      const tabsHtml = tabs.length > 0 ? \`
        <div class="modal-tabs">
          \${tabs.map((tab, i) => \`
            <div class="modal-tab \${i === 0 ? 'active' : ''}" data-tab="\${tab.id}" onclick="modalManager.switchTab('\${id}', '\${tab.id}')">
              \${tab.icon ? '<i class="' + tab.icon + ' mr-1"></i>' : ''}\${tab.label}
            </div>
          \`).join('')}
        </div>
      \` : '';
      
      const modal = document.createElement('div');
      modal.id = id;
      modal.className = 'modal-overlay';
      modal.innerHTML = \`
        <div class="modal-container modal-\${size}">
          <div class="modal-header">
            <h3 class="modal-title">
              \${icon ? '<i class="' + icon + '"></i>' : ''}\${title}
            </h3>
            <button class="modal-close" onclick="modalManager.close('\${id}')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          \${tabsHtml}
          <div class="modal-body">
            \${content}
          </div>
          \${footer ? '<div class="modal-footer">' + footer + '</div>' : ''}
        </div>
      \`;
      
      document.body.appendChild(modal);
      this.modals.set(id, { config, onOpen });
      
      return modal;
    }
    
    // タブ切り替え
    switchTab(modalId, tabId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      
      // タブのアクティブ状態を更新
      modal.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
      });
      
      // タブコンテンツを更新
      modal.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('hidden', content.dataset.tab !== tabId);
      });
    }
    
    // モーダル内容を更新
    updateContent(modalId, content) {
      const modal = document.getElementById(modalId);
      if (!modal) return;
      
      const body = modal.querySelector('.modal-body');
      if (body) body.innerHTML = content;
    }
    
    // ローディング表示
    showLoading(modalId) {
      this.updateContent(modalId, \`
        <div class="modal-loading">
          <div class="modal-spinner"></div>
        </div>
      \`);
    }
  }
  
  // グローバルインスタンス
  const modalManager = new ModalManager();
  
  // 確認ダイアログ
  async function confirmDialog(options) {
    const {
      title = '確認',
      message,
      confirmText = '確認',
      cancelText = 'キャンセル',
      confirmClass = 'bg-blue-600 text-white hover:bg-blue-700',
      icon = 'fas fa-question-circle text-blue-600'
    } = options;
    
    return new Promise((resolve) => {
      const id = 'confirm-dialog-' + Date.now();
      
      modalManager.create({
        id,
        title,
        icon,
        size: 'sm',
        content: \`
          <p class="text-gray-600">\${message}</p>
        \`,
        footer: \`
          <button onclick="modalManager.close('\${id}'); window._confirmResolve && window._confirmResolve(false)" 
                  class="px-4 py-2 border rounded-lg hover:bg-gray-50">
            \${cancelText}
          </button>
          <button onclick="modalManager.close('\${id}'); window._confirmResolve && window._confirmResolve(true)" 
                  class="px-4 py-2 rounded-lg \${confirmClass}">
            \${confirmText}
          </button>
        \`
      });
      
      window._confirmResolve = resolve;
      modalManager.open(id);
    });
  }
  
  // 削除確認ダイアログ
  async function confirmDelete(itemName) {
    return confirmDialog({
      title: '削除の確認',
      message: \`「\${itemName}」を削除してもよろしいですか？この操作は取り消せません。\`,
      confirmText: '削除する',
      cancelText: 'キャンセル',
      confirmClass: 'bg-red-600 text-white hover:bg-red-700',
      icon: 'fas fa-trash-alt text-red-600'
    });
  }
`;

// モーダルHTMLテンプレート（汎用）
export function generateModal(config: {
  id: string;
  title: string;
  icon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  content: string;
  footer?: string;
}) {
  const { id, title, icon = '', size = 'md', content, footer = '' } = config;
  
  return `
    <div id="${id}" class="modal-overlay">
      <div class="modal-container modal-${size}">
        <div class="modal-header">
          <h3 class="modal-title">
            ${icon ? `<i class="${icon}"></i>` : ''}${title}
          </h3>
          <button class="modal-close" onclick="modalManager.close('${id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
}
